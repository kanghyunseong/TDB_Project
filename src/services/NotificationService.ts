import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DoseTimeSettings {
  morning: string;
  afternoon: string;
  evening: string;
}

interface NotificationSchedule {
  id: string;
  title: string;
  message: string;
  time: string;
  enabled: boolean;
}

const DOSE_TIME_SETTINGS_KEY = '@dose_time_settings';
const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

class NotificationService {
  private initialized = false;

  constructor() {
    this.initializeNotifications();
  }

  private initializeNotifications() {
    if (this.initialized) return;

    PushNotification.configure({
      onRegister: function (token) {
        console.log('알림 토큰:', token);
      },
      onNotification: function (notification) {
        console.log('알림 수신:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    // 기존 알림 모두 취소
    PushNotification.cancelAllLocalNotifications();
    
    this.initialized = true;
    console.log('✅ 알림 서비스 초기화 완료');
  }

  // 🔥 복용 시간 알림 스케줄링
  async scheduleDoseReminders() {
    try {
      // 복용 시간 설정 불러오기
      const doseSettings = await this.getDoseTimeSettings();
      const notificationEnabled = await this.getNotificationEnabled();

      if (!notificationEnabled) {
        console.log('⚠️ 알림이 비활성화되어 있음');
        return;
      }

      // 기존 알림 취소
      PushNotification.cancelAllLocalNotifications();

      console.log('🔔 복용 알림 스케줄링 시작:', doseSettings);

      // 각 시간대별 알림 스케줄링
      this.scheduleTimeSlotNotification('morning', doseSettings.morning, '🌅 아침 복용 시간입니다');
      this.scheduleTimeSlotNotification('afternoon', doseSettings.afternoon, '☀️ 점심 복용 시간입니다');
      this.scheduleTimeSlotNotification('evening', doseSettings.evening, '🌙 저녁 복용 시간입니다');

      console.log('✅ 복용 알림 스케줄링 완료');
    } catch (error) {
      console.error('🔥 복용 알림 스케줄링 에러:', error);
    }
  }

  private scheduleTimeSlotNotification(timeSlot: string, timeString: string, message: string) {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // 매일 반복 알림 설정
    const notificationId = `dose_${timeSlot}`;
    
    PushNotification.localNotificationSchedule({
      id: notificationId,
      title: '💊 복용 알림',
      message: message,
      date: this.createDateFromTime(hours, minutes),
      repeatType: 'day',
      actions: ['복용완료', '나중에'],
      category: 'dose_reminder',
      userInfo: {
        timeSlot: timeSlot,
        type: 'dose_reminder'
      }
    });

    console.log(`🔔 ${timeSlot} 알림 스케줄링: ${timeString} - ${message}`);
  }

  private createDateFromTime(hours: number, minutes: number): Date {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);

    // 오늘 시간이 지났으면 내일로 설정
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    return targetTime;
  }

  // 🔥 즉시 알림 보내기 (복용 완료 등)
  sendImmediateNotification(title: string, message: string, data?: any) {
    PushNotification.localNotification({
      title: title,
      message: message,
      playSound: true,
      soundName: 'default',
      userInfo: data || {}
    });
    
    console.log('🔔 즉시 알림 전송:', title, message);
  }

  // 🔥 특정 알림 취소
  cancelNotification(notificationId: string) {
    PushNotification.cancelLocalNotifications({ id: notificationId });
    console.log('🔕 알림 취소:', notificationId);
  }

  // 🔥 모든 알림 취소
  cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
    console.log('🔕 모든 알림 취소');
  }

  // 🔥 복용 시간 설정 불러오기
  private async getDoseTimeSettings(): Promise<DoseTimeSettings> {
    try {
      const settings = await AsyncStorage.getItem(DOSE_TIME_SETTINGS_KEY);
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('복용 시간 설정 로드 에러:', error);
    }

    // 기본값 반환
    return {
      morning: '08:00',
      afternoon: '13:00',
      evening: '19:00'
    };
  }

  // 🔥 알림 활성화 상태 확인
  private async getNotificationEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(`${NOTIFICATION_SETTINGS_KEY}_enabled`);
      return enabled !== 'false'; // 기본값: true
    } catch (error) {
      console.error('알림 설정 로드 에러:', error);
      return true;
    }
  }

  // 🔥 알림 활성화/비활성화
  async setNotificationEnabled(enabled: boolean) {
    try {
      await AsyncStorage.setItem(`${NOTIFICATION_SETTINGS_KEY}_enabled`, enabled.toString());
      
      if (enabled) {
        await this.scheduleDoseReminders();
      } else {
        this.cancelAllNotifications();
      }
      
      console.log(`🔔 알림 설정 변경: ${enabled ? '활성화' : '비활성화'}`);
    } catch (error) {
      console.error('알림 설정 저장 에러:', error);
    }
  }

  // 🔥 가족 공유 알림 보내기
  sendFamilyNotification(memberName: string, action: string, medicineNames: string[]) {
    const message = `${memberName}님이 ${medicineNames.join(', ')} ${action}했습니다.`;
    
    this.sendImmediateNotification('👨‍👩‍👧‍👦 가족 알림', message, {
      type: 'family_update',
      memberName,
      action,
      medicines: medicineNames
    });
  }

  // 🔥 약물 부족 알림
  sendLowStockNotification(medicineName: string, remainingDoses: number) {
    const message = `${medicineName}이(가) ${remainingDoses}정 남았습니다. 약국에서 처방받으세요.`;
    
    this.sendImmediateNotification('⚠️ 약물 부족 알림', message, {
      type: 'low_stock',
      medicineName,
      remainingDoses
    });
  }

  // 🔥 놓친 복용 알림
  sendMissedDoseNotification(timeSlot: string, medicineNames: string[]) {
    const timeLabel = timeSlot === 'morning' ? '아침' : timeSlot === 'afternoon' ? '점심' : '저녁';
    const message = `${timeLabel} 복용을 놓치셨습니다: ${medicineNames.join(', ')}`;
    
    this.sendImmediateNotification('📅 놓친 복용 알림', message, {
      type: 'missed_dose',
      timeSlot,
      medicines: medicineNames
    });
  }

  // 🔥 복용 완료 확인 알림
  sendDoseCompletedNotification(memberName: string, timeSlot: string, medicineNames: string[]) {
    const timeLabel = timeSlot === 'morning' ? '아침' : timeSlot === 'afternoon' ? '점심' : '저녁';
    const message = `${memberName}님이 ${timeLabel} 약을 복용했습니다: ${medicineNames.join(', ')}`;
    
    this.sendImmediateNotification('✅ 복용 완료', message, {
      type: 'dose_completed',
      memberName,
      timeSlot,
      medicines: medicineNames
    });
  }
}

// 싱글톤 인스턴스 생성
const notificationService = new NotificationService();

export default notificationService; 