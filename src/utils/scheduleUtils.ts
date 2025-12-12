import { Medicine, NutritionalSupplement } from '../types/tdb';

export interface TodaySchedule {
  morning: number;
  afternoon: number;
  evening: number;
  total: number;
  dayOfWeek: string;
  isScheduledDay: boolean;
  reason: string;
}

interface DailySchedule {
  morning: number;
  afternoon: number;
  evening: number;
  total: number;
  weeklySchedule: Record<string, any> | null;
}

/**
 * 약물의 오늘 스케줄 계산
 */
export const getTodayScheduleForMedicine = (
  medicine: Medicine,
  dailySchedule: DailySchedule | undefined
): TodaySchedule => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  
  const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayShortName = shortDayNames[dayOfWeek];
  
  const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayFullName = fullDayNames[dayOfWeek];
  
  if (__DEV__) {
    console.log(`🗓️ [${medicine.name}] 오늘 요일 체크: ${todayShortName} (${dayOfWeek}) / 전체명: ${todayFullName}`);
    console.log(`🗓️ [${medicine.name}] 전체 dailySchedule 데이터:`, dailySchedule);
  }
  
  // 약물 상태 검증 - 재고와 복용 기간 확인
  const totalQuantity = parseInt(medicine.totalQuantity || '0');
  const endDate = medicine.end_date ? new Date(medicine.end_date) : null;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  // 재고가 0이거나 복용 기간이 끝난 경우 스케줄 표시 안함
  if (totalQuantity <= 0) {
    if (__DEV__) {
      console.log(`❌ [${medicine.name}] 재고 부족으로 스케줄 표시 안함: ${totalQuantity}정`);
    }
    return {
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0,
      dayOfWeek: todayShortName,
      isScheduledDay: false,
      reason: 'no_stock'
    };
  }
  
  if (endDate && endDate < todayDate) {
    if (__DEV__) {
      console.log(`❌ [${medicine.name}] 복용 기간 만료로 스케줄 표시 안함: ${medicine.end_date}`);
    }
    return {
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0,
      dayOfWeek: todayShortName,
      isScheduledDay: false,
      reason: 'expired'
    };
  }
  
  if (__DEV__) {
    console.log(`✅ [${medicine.name}] 약물 상태 정상 - 재고: ${totalQuantity}정, 종료일: ${medicine.end_date}`);
  }
  
  // 🔥 우선 기본 복용량부터 확인 (매일 복용하는 경우)
  const morningDose = dailySchedule?.morning || 0;
  const afternoonDose = dailySchedule?.afternoon || 0;
  const eveningDose = dailySchedule?.evening || 0;
  
  if (__DEV__) {
    console.log(`📋 [${medicine.name}] 기본 복용량:`, { morningDose, afternoonDose, eveningDose });
  }
  
  // 🔥 기본 복용량이 있으면 우선 사용 (매일 복용)
  if (morningDose > 0 || afternoonDose > 0 || eveningDose > 0) {
    const result = {
      morning: morningDose,
      afternoon: afternoonDose,
      evening: eveningDose,
      total: morningDose + afternoonDose + eveningDose,
      dayOfWeek: todayShortName,
      isScheduledDay: true,
      reason: 'daily_schedule'
    };
    
    if (__DEV__) {
      console.log(`✅ [${medicine.name}] 매일 복용 스케줄 적용:`, result);
    }
    return result;
  }
  
  // 🔥 요일별 스케줄이 있는 경우에만 처리
  if (dailySchedule?.weeklySchedule) {
    if (__DEV__) {
      console.log(`📋 [${medicine.name}] 요일별 스케줄 존재:`, dailySchedule.weeklySchedule);
    }
    
    // 🔥 짧은 형식(mon, tue)과 전체 형식(monday, tuesday) 모두 시도
    let todaySchedule = dailySchedule.weeklySchedule[todayShortName]; // 먼저 짧은 형식으로 시도
    
    // 짧은 형식이 없으면 전체 형식으로 시도
    if (!todaySchedule) {
      todaySchedule = dailySchedule.weeklySchedule[todayFullName];
      if (__DEV__) {
        console.log(`📋 [${medicine.name}] 전체 요일명으로 재시도: ${todayFullName}`, todaySchedule);
      }
    } else {
      if (__DEV__) {
        console.log(`📋 [${medicine.name}] 짧은 요일명으로 발견: ${todayShortName}`, todaySchedule);
      }
    }
    
    if (todaySchedule) {
      if (__DEV__) {
        console.log(`📋 [${medicine.name}] 오늘 스케줄 (요일별):`, todaySchedule);
      }
      
      // 요일별 스케줄에서 직접 복용량 가져오기
      const weeklyMorningDose = todaySchedule.morning ? (parseInt(todaySchedule.morningDose?.toString()) || 1) : 0;
      const weeklyAfternoonDose = todaySchedule.afternoon ? (parseInt(todaySchedule.afternoonDose?.toString()) || 1) : 0;
      const weeklyEveningDose = todaySchedule.evening ? (parseInt(todaySchedule.eveningDose?.toString()) || 1) : 0;
      
      const result = {
        morning: weeklyMorningDose,
        afternoon: weeklyAfternoonDose,
        evening: weeklyEveningDose,
        total: weeklyMorningDose + weeklyAfternoonDose + weeklyEveningDose,
        dayOfWeek: todayShortName,
        isScheduledDay: weeklyMorningDose > 0 || weeklyAfternoonDose > 0 || weeklyEveningDose > 0,
        reason: 'weekly_schedule'
      };
      
      if (__DEV__) {
        console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (요일별):`, result);
      }
      return result;
    } else {
      // 오늘 요일에 스케줄이 없는 경우 - 복용하지 않는 날
      if (__DEV__) {
        console.log(`❌ [${medicine.name}] 요일별 스케줄에서 오늘은 복용하지 않는 날: ${todayShortName} / ${todayFullName}`);
      }
      
      const result = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        dayOfWeek: todayShortName,
        isScheduledDay: false,
        reason: 'no_schedule_today'
      };
      
      if (__DEV__) {
        console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (스케줄 없음):`, result);
      }
      return result;
    }
  }
  
  // 🔥 어떤 스케줄도 없는 경우 - 기본 스케줄 적용 (매일 아침 1정)
  if (__DEV__) {
    console.log(`❌ [${medicine.name}] 스케줄 정보가 전혀 없음 - 기본 스케줄 적용`);
  }
  
  const result = {
    morning: 1, // 🔥 기본값: 매일 아침 1정
    afternoon: 0,
    evening: 0,
    total: 1,
    dayOfWeek: todayShortName,
    isScheduledDay: true, // 🔥 기본적으로 복용 가능하도록 변경
    reason: 'default_schedule'
  };
  
  if (__DEV__) {
    console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (기본 매일 아침 1정):`, result);
  }
  return result;
};

/**
 * 영양제의 오늘 스케줄 계산
 */
export const getTodayScheduleForSupplement = (
  supplement: NutritionalSupplement,
  dailySchedule: DailySchedule | undefined
): TodaySchedule => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  
  const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayShortName = shortDayNames[dayOfWeek];
  
  const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayFullName = fullDayNames[dayOfWeek];
  
  if (__DEV__) {
    console.log(`🗓️ [영양제 ${supplement.name}] 오늘 요일 체크: ${todayShortName} (${dayOfWeek}) / 전체명: ${todayFullName}`);
    console.log(`🗓️ [영양제 ${supplement.name}] 전체 dailySchedule 데이터:`, dailySchedule);
  }
  
  // 영양제 상태 검증 - 기간 확인
  const endDate = supplement.endDate ? new Date(supplement.endDate) : null;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  if (endDate && endDate < todayDate) {
    if (__DEV__) {
      console.log(`❌ [영양제 ${supplement.name}] 복용 기간 만료로 스케줄 표시 안함: ${supplement.endDate}`);
    }
    return {
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0,
      dayOfWeek: todayShortName,
      isScheduledDay: false,
      reason: 'expired'
    };
  }
  
  // 🔥 매일 복용 스케줄이 있는 경우 (weeklySchedule이 null이거나 없음)
  if (!dailySchedule?.weeklySchedule) {
    if (__DEV__) {
      console.log(`📋 [영양제 ${supplement.name}] 매일 복용 스케줄 존재`);
    }
    
    const morningDose = dailySchedule?.morning || 0;
    const afternoonDose = dailySchedule?.afternoon || 0;
    const eveningDose = dailySchedule?.evening || 0;
    const total = morningDose + afternoonDose + eveningDose;
    
    const result = {
      morning: morningDose,
      afternoon: afternoonDose,
      evening: eveningDose,
      total,
      dayOfWeek: todayShortName,
      isScheduledDay: total > 0,
      reason: 'daily_schedule'
    };
    
    if (__DEV__) {
      console.log(`✅ [영양제 ${supplement.name}] 매일 복용 스케줄 적용:`, result);
    }
    return result;
  }
  
  // 🔥 요일별 스케줄이 있는 경우에만 처리
  if (dailySchedule?.weeklySchedule) {
    if (__DEV__) {
      console.log(`📋 [영양제 ${supplement.name}] 요일별 스케줄 존재:`, dailySchedule.weeklySchedule);
    }
    
    // 🔥 짧은 형식(mon, tue)과 전체 형식(monday, tuesday) 모두 시도
    let todaySchedule = dailySchedule.weeklySchedule[todayShortName]; // 먼저 짧은 형식으로 시도
    
    // 짧은 형식이 없으면 전체 형식으로 시도
    if (!todaySchedule) {
      todaySchedule = dailySchedule.weeklySchedule[todayFullName];
      if (__DEV__) {
        console.log(`📋 [영양제 ${supplement.name}] 전체 요일명으로 재시도: ${todayFullName}`, todaySchedule);
      }
    } else {
      if (__DEV__) {
        console.log(`📋 [영양제 ${supplement.name}] 짧은 요일명으로 발견: ${todayShortName}`, todaySchedule);
      }
    }
    
    if (todaySchedule) {
      if (__DEV__) {
        console.log(`📋 [영양제 ${supplement.name}] 오늘 스케줄 (요일별):`, todaySchedule);
      }
      
      // 요일별 스케줄에서 직접 복용량 가져오기
      const weeklyMorningDose = todaySchedule.morning ? (parseInt(todaySchedule.morningDose?.toString()) || 1) : 0;
      const weeklyAfternoonDose = todaySchedule.afternoon ? (parseInt(todaySchedule.afternoonDose?.toString()) || 1) : 0;
      const weeklyEveningDose = todaySchedule.evening ? (parseInt(todaySchedule.eveningDose?.toString()) || 1) : 0;
      
      const result = {
        morning: weeklyMorningDose,
        afternoon: weeklyAfternoonDose,
        evening: weeklyEveningDose,
        total: weeklyMorningDose + weeklyAfternoonDose + weeklyEveningDose,
        dayOfWeek: todayShortName,
        isScheduledDay: weeklyMorningDose > 0 || weeklyAfternoonDose > 0 || weeklyEveningDose > 0,
        reason: 'weekly_schedule'
      };
      
      if (__DEV__) {
        console.log(`✅ [영양제 ${supplement.name}] 오늘의 복용 스케줄 (요일별):`, result);
      }
      return result;
    } else {
      // 오늘 요일에 스케줄이 없는 경우 - 복용하지 않는 날
      if (__DEV__) {
        console.log(`❌ [영양제 ${supplement.name}] 요일별 스케줄에서 오늘은 복용하지 않는 날: ${todayShortName} / ${todayFullName}`);
      }
      
      const result = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        dayOfWeek: todayShortName,
        isScheduledDay: false,
        reason: 'no_schedule_today'
      };
      
      if (__DEV__) {
        console.log(`✅ [영양제 ${supplement.name}] 오늘의 복용 스케줄 (스케줄 없음):`, result);
      }
      return result;
    }
  }
  
  // 🔥 어떤 스케줄도 없는 경우 - 기본 스케줄 적용 (매일 아침 1정)
  if (__DEV__) {
    console.log(`❌ [영양제 ${supplement.name}] 스케줄 정보가 전혀 없음 - 기본 스케줄 적용`);
  }
  
  const result = {
    morning: 1, // 🔥 기본값: 매일 아침 1정
    afternoon: 0,
    evening: 0,
    total: 1,
    dayOfWeek: todayShortName,
    isScheduledDay: true, // 🔥 기본적으로 복용 가능하도록 변경
    reason: 'default_schedule'
  };
  
  if (__DEV__) {
    console.log(`✅ [영양제 ${supplement.name}] 오늘의 복용 스케줄 (기본 매일 아침 1정):`, result);
  }
  return result;
};

