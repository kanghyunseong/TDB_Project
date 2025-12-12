import DosageFrequencyValidator from './dosageFrequencyValidator';
import { Alert } from 'react-native';

export interface ScheduleData {
  [day: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
}

export class ScheduleValidationHelper {
  /**
   * 스케줄 편집 시 실시간 유효성 검사 (서버 API 사용)
   */
  static async validateScheduleEdit(
    medicineId: string,
    medicineName: string,
    schedule: ScheduleData,
    onValidationResult?: (isValid: boolean, message?: string) => void
  ): Promise<boolean> {
    const validation = await DosageFrequencyValidator.validateSchedule(medicineId, schedule);
    
    if (onValidationResult) {
      onValidationResult(validation.isValid, validation.warningMessage);
    }
    
    return validation.isValid;
  }

  /**
   * 특정 시간대 체크박스 클릭 시 검증 (서버 API 사용)
   */
  static async canToggleTimeSlot(
    medicineId: string,
    schedule: ScheduleData,
    day: string,
    timeSlot: string,
    showAlert: boolean = true
  ): Promise<boolean> {
    console.log('🔥 [ScheduleValidationHelper] canToggleTimeSlot 시작:', { medicineId, day, timeSlot });
    
    const canSelect = await DosageFrequencyValidator.canSelectTimeSlot(
      medicineId,
      schedule,
      day,
      timeSlot
    );
    
    console.log('🔥 [ScheduleValidationHelper] canSelectTimeSlot 결과:', canSelect);

    if (!canSelect && showAlert) {
      console.log('🔥 [ScheduleValidationHelper] 선택 제한 Alert 표시');
      const dosageInfo = await DosageFrequencyValidator.extractDosageFrequency(medicineId);
      console.log('🔥 [ScheduleValidationHelper] 복용량 정보:', dosageInfo);
      const maxCount = dosageInfo?.dailyCount || 3;
      
      Alert.alert(
        '선택 제한',
        `이 약물은 1일 최대 ${maxCount}회까지만 복용할 수 있습니다.\n${day}요일에 이미 ${maxCount}개의 시간대가 선택되었습니다.`,
        [{ text: '확인' }]
      );
    }

    return canSelect;
  }

  /**
   * 스케줄 저장 전 최종 검증 (서버 API 사용)
   */
  static async validateBeforeSave(
    medicineId: string,
    medicineName: string,
    schedule: ScheduleData
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const validation = await DosageFrequencyValidator.validateSchedule(medicineId, schedule);
      
      if (validation.isValid) {
        resolve(true);
        return;
      }

      // 유효성 검사 실패 시 사용자에게 확인 요청
      Alert.alert(
        '⚠️ 복용 횟수 초과',
        `${medicineName}\n${validation.warningMessage}\n\n그래도 저장하시겠습니까?`,
        [
          {
            text: '수정하기',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: '강제 저장',
            style: 'destructive',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  /**
   * 권장 스케줄 제안 (서버 API 사용)
   */
  static async suggestOptimalSchedule(medicineId: string): Promise<ScheduleData> {
    const recommended = await DosageFrequencyValidator.generateRecommendedSchedule(medicineId);
    
    // Record<string, Record<string, boolean>>을 ScheduleData 타입으로 변환
    const schedule: ScheduleData = {};
    for (const [day, times] of Object.entries(recommended)) {
      schedule[day] = {
        morning: times.morning || false,
        afternoon: times.afternoon || false,
        evening: times.evening || false
      };
    }
    
    return schedule;
  }

  /**
   * 복용 정보 요약 메시지 생성 (서버 API 사용)
   */
  static async getDosageInfoMessage(medicineId: string): Promise<string> {
    const dosageInfo = await DosageFrequencyValidator.extractDosageFrequency(medicineId);
    
    if (!dosageInfo) {
      return '복용 횟수 정보를 확인할 수 없습니다.';
    }

    let message = `권장 복용 횟수: 1일 ${dosageInfo.dailyCount}회`;
    
    if (dosageInfo.maxPerDose > 1) {
      message += `\n1회 복용량: 최대 ${dosageInfo.maxPerDose}정`;
    }

    switch (dosageInfo.dailyCount) {
      case 1:
        message += '\n💡 아침, 점심, 저녁 중 하나만 선택하세요.';
        break;
      case 2:
        message += '\n💡 아침+저녁 또는 점심+저녁 조합을 권장합니다.';
        break;
      case 3:
        message += '\n💡 아침, 점심, 저녁 모두 선택 가능합니다.';
        break;
    }

    if (dosageInfo.confidence === 'low') {
      message += '\n⚠️ 정확한 복용법은 의사나 약사와 상담하세요.';
    }

    return message;
  }
}

export default ScheduleValidationHelper; 