import { useState, useCallback, useRef } from 'react';
import { getMedicineSchedule, getSupplementSchedule } from '../api/family';

export interface DailySchedule {
  morning: number;
  afternoon: number;
  evening: number;
  total: number;
  weeklySchedule: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    morningDose: number;
    afternoonDose: number;
    eveningDose: number;
  }> | null;
}

interface UseScheduleDataReturn {
  dailySchedules: Record<string, DailySchedule>;
  supplementSchedules: Record<string, DailySchedule>;
  loadDailySchedule: (medicineId: string, userId: string) => Promise<void>;
  loadSupplementSchedule: (supplementId: string, userId: string) => Promise<void>;
  clearSchedule: (scheduleKey: string) => void;
  clearAllSchedules: () => void;
}

/**
 * 스케줄 데이터 관리 훅
 * - 약물 및 영양제 스케줄 로딩
 * - 스케줄 캐싱
 * - 중복 로딩 방지
 */
export const useScheduleData = (
  selectedMemberId: string | null,
  isMountedRef: React.MutableRefObject<boolean>
): UseScheduleDataReturn => {
  const [dailySchedules, setDailySchedules] = useState<Record<string, DailySchedule>>({});
  const [supplementSchedules, setSupplementSchedules] = useState<Record<string, DailySchedule>>({});
  
  // 조회 중인 스케줄을 추적하는 ref
  const loadingSchedules = useRef<Set<string>>(new Set());
  
  /**
   * 약물 스케줄 로딩
   */
  const loadDailySchedule = useCallback(async (medicineId: string, userId: string) => {
    const scheduleKey = `${medicineId}_${userId}`;
    
    // 이미 조회 중인 경우 중복 호출 방지
    if (loadingSchedules.current.has(scheduleKey)) {
      return;
    }
    
    // 🔥 컴포넌트가 unmount된 경우 중단
    if (!isMountedRef.current) {
      return;
    }
    
    // 조회 중임을 표시
    loadingSchedules.current.add(scheduleKey);
    
    try {
      if (__DEV__) {
        console.log(`[loadDailySchedule] 조회: ${medicineId}, ${userId}`);
      }

      // 🔥 integrated-server와 호환되는 스케줄 조회 API 사용
      const scheduleResult: any = await getMedicineSchedule(medicineId, userId);
      
      // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
      if (!isMountedRef.current) {
        loadingSchedules.current.delete(scheduleKey);
        return;
      }
      
      if (scheduleResult && typeof scheduleResult === 'object') {
        // 🔥 서버에서 반환하는 시간대별 복용량 사용
        let morningDose = 0, afternoonDose = 0, eveningDose = 0;
        let weeklySchedule: Record<string, {
          morning: boolean;
          afternoon: boolean;
          evening: boolean;
          morningDose: number;
          afternoonDose: number;
          eveningDose: number;
        }> | null = null;
        
        // 🔥 1. 서버가 시간대별 복용량을 제공하는 경우 우선 사용
        if (scheduleResult.morningDose !== undefined) {
          morningDose = parseInt(scheduleResult.morningDose.toString()) || 0;
        }
        if (scheduleResult.afternoonDose !== undefined) {
          afternoonDose = parseInt(scheduleResult.afternoonDose.toString()) || 0;
        }
        if (scheduleResult.eveningDose !== undefined) {
          eveningDose = parseInt(scheduleResult.eveningDose.toString()) || 0;
        }
        
        // 🔥 요일별 스케줄 정보 추출
        if (scheduleResult.schedule && typeof scheduleResult.schedule === 'object') {
          weeklySchedule = {};
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          
          dayNames.forEach(day => {
            if (scheduleResult.schedule[day]) {
              const daySchedule = scheduleResult.schedule[day];
              if (weeklySchedule) {
                weeklySchedule[day] = {
                  morning: daySchedule.morning || false,
                  afternoon: daySchedule.afternoon || false,
                  evening: daySchedule.evening || false,
                  morningDose: daySchedule.morningDose || morningDose,
                  afternoonDose: daySchedule.afternoonDose || afternoonDose,
                  eveningDose: daySchedule.eveningDose || eveningDose,
                };
              }
            }
          });
        }
        
        // 🔥 2. 시간대별 복용량이 없는 경우 기존 방식으로 fallback
        if (morningDose === 0 && afternoonDose === 0 && eveningDose === 0) {
          const doseCount = parseInt((scheduleResult.doseCount || '0').toString()) || 0;
          
          // 📊 스케줄이 설정된 시간대만 복용량 설정 (성능 최적화)
          const hasSchedule = scheduleResult.schedule;
          if (hasSchedule && typeof hasSchedule === 'object') {
            // 간단한 체크: 어느 하나라도 morning이 true면 설정
            const hasAnyMorning = Object.values(hasSchedule).some((day: any) => day?.morning);
            const hasAnyAfternoon = Object.values(hasSchedule).some((day: any) => day?.afternoon);
            const hasAnyEvening = Object.values(hasSchedule).some((day: any) => day?.evening);
            
            if (hasAnyMorning) morningDose = doseCount;
            if (hasAnyAfternoon) afternoonDose = doseCount;
            if (hasAnyEvening) eveningDose = doseCount;
          }
        }
        
        // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단 (setState 직전 최종 체크)
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        const scheduleData: DailySchedule = {
          morning: morningDose,
          afternoon: afternoonDose,
          evening: eveningDose,
          total: morningDose + afternoonDose + eveningDose,
          weeklySchedule: weeklySchedule
        };
        
        // 🔥 setState 호출 직전 한 번 더 체크 (안전장치)
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        // 🔥 try-catch로 setState를 감싸서 안전하게 처리
        try {
          setDailySchedules(prev => ({
            ...prev,
            [scheduleKey]: scheduleData
          }));
        } catch (error) {
          // 컴포넌트가 unmount된 경우 에러 무시
          if (__DEV__) {
            console.warn('[useScheduleData] setState 에러 (무시됨):', error);
          }
          loadingSchedules.current.delete(scheduleKey);
        }
      } else {
        // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        // 실패한 경우에도 빈 데이터로 저장하여 재시도 방지
        const emptyScheduleData: DailySchedule = {
          morning: 0,
          afternoon: 0,
          evening: 0,
          total: 0,
          weeklySchedule: null
        };
        
        // 🔥 try-catch로 setState를 감싸서 안전하게 처리
        try {
          setDailySchedules(prev => ({
            ...prev,
            [scheduleKey]: emptyScheduleData
          }));
        } catch (error) {
          if (__DEV__) {
            console.warn('[useScheduleData] setState 에러 (무시됨):', error);
          }
          loadingSchedules.current.delete(scheduleKey);
        }
      }
    } catch (error: unknown) {
      // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
      if (!isMountedRef.current) {
        loadingSchedules.current.delete(scheduleKey);
        return;
      }
      
      if (error instanceof Error && error.message.includes('인증이 만료되었습니다')) {
        if (__DEV__) {
          console.error('[loadDailySchedule] 인증 만료');
        }
        return;
      }
      
      if (__DEV__) {
        console.error('[loadDailySchedule] 에러:', error);
      }
      
      // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
      if (!isMountedRef.current) {
        loadingSchedules.current.delete(scheduleKey);
        return;
      }
      
      // 에러 발생 시 빈 스케줄로 저장
      const emptyScheduleData: DailySchedule = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        weeklySchedule: null
      };
      
      // 🔥 try-catch로 setState를 감싸서 안전하게 처리
      try {
        setDailySchedules(prev => ({
          ...prev,
          [scheduleKey]: emptyScheduleData
        }));
      } catch (error) {
        if (__DEV__) {
          console.warn('[useScheduleData] setState 에러 (무시됨):', error);
        }
        loadingSchedules.current.delete(scheduleKey);
      }
    } finally {
      // 조회 완료 표시
      loadingSchedules.current.delete(scheduleKey);
    }
  }, [isMountedRef]);
  
  /**
   * 영양제 스케줄 로딩
   */
  const loadSupplementSchedule = useCallback(async (supplementId: string, userId: string) => {
    const scheduleKey = `${supplementId}_${userId}`;
    
    // 이미 조회 중인 경우 중복 호출 방지
    if (loadingSchedules.current.has(scheduleKey)) {
      return;
    }
    
    // 🔥 컴포넌트가 unmount된 경우 중단
    if (!isMountedRef.current) {
      return;
    }
    
    // 조회 중임을 표시
    loadingSchedules.current.add(scheduleKey);
    
    try {
      if (__DEV__) {
        console.log(`🔍 [영양제 스케줄] 조회 시작: supplementId=${supplementId}, userId=${userId}`);
      }
      
      // 현재 선택된 사용자와 조회하려는 사용자가 일치하는지 확인
      if (userId !== selectedMemberId) {
        if (__DEV__) {
          console.log(`⚠️ 사용자 불일치 감지 - 요청 취소: 요청=${userId}, 선택됨=${selectedMemberId}`);
        }
        loadingSchedules.current.delete(scheduleKey);
        return;
      }

      // 영양제 스케줄 조회 API 사용
      const scheduleResult: any = await getSupplementSchedule(supplementId, userId);
      
      // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
      if (!isMountedRef.current) {
        loadingSchedules.current.delete(scheduleKey);
        return;
      }
      
      if (scheduleResult && typeof scheduleResult === 'object') {
        // 시간대별 복용량 처리
        let morningDose = 0, afternoonDose = 0, eveningDose = 0;
        let weeklySchedule: Record<string, {
          morning: boolean;
          afternoon: boolean;
          evening: boolean;
          morningDose: number;
          afternoonDose: number;
          eveningDose: number;
        }> | null = null;
        
        // 서버가 시간대별 복용량을 제공하는 경우 우선 사용
        if (scheduleResult.morningDose !== undefined) {
          morningDose = parseInt(scheduleResult.morningDose.toString()) || 0;
        }
        if (scheduleResult.afternoonDose !== undefined) {
          afternoonDose = parseInt(scheduleResult.afternoonDose.toString()) || 0;
        }
        if (scheduleResult.eveningDose !== undefined) {
          eveningDose = parseInt(scheduleResult.eveningDose.toString()) || 0;
        }
        
        // 요일별 스케줄 정보 추출
        if (scheduleResult.schedule && typeof scheduleResult.schedule === 'object') {
          weeklySchedule = {};
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          
          dayNames.forEach(day => {
            if (scheduleResult.schedule[day]) {
              const daySchedule = scheduleResult.schedule[day];
              if (weeklySchedule) {
                weeklySchedule[day] = {
                  morning: daySchedule.morning || false,
                  afternoon: daySchedule.afternoon || false,
                  evening: daySchedule.evening || false,
                  morningDose: daySchedule.morningDose || morningDose,
                  afternoonDose: daySchedule.afternoonDose || afternoonDose,
                  eveningDose: daySchedule.eveningDose || eveningDose,
                };
              }
            }
          });
          
          if (__DEV__) {
            console.log(`📅 [영양제 ${supplementId}] 요일별 스케줄:`, weeklySchedule);
          }
        }
        
        // 시간대별 복용량이 없는 경우 기존 방식으로 fallback
        if (morningDose === 0 && afternoonDose === 0 && eveningDose === 0) {
          if (__DEV__) {
            console.log('🔍 [영양제 스케줄] 시간대별 복용량이 없어서 기존 방식 사용');
          }
          
          const doseCount = parseInt((scheduleResult.doseCount || '0').toString()) || 0;
          
          // 스케줄이 설정된 시간대만 복용량 설정
          morningDose = scheduleResult.schedule?.mon?.morning || scheduleResult.schedule?.monday?.morning ? doseCount : 0;
          afternoonDose = scheduleResult.schedule?.mon?.afternoon || scheduleResult.schedule?.monday?.afternoon ? doseCount : 0;
          eveningDose = scheduleResult.schedule?.mon?.evening || scheduleResult.schedule?.monday?.evening ? doseCount : 0;
        }
        
        const total = morningDose + afternoonDose + eveningDose;
        
        if (__DEV__) {
          console.log(`✅ [영양제 스케줄] ${supplementId} 시간대별 복용량:`, {
            morning: morningDose,
            afternoon: afternoonDose,
            evening: eveningDose,
            total
          });
        }
        
        // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        // 스케줄 state 업데이트
        const scheduleData: DailySchedule = {
          morning: morningDose,
          afternoon: afternoonDose,
          evening: eveningDose,
          total,
          weeklySchedule
        };
        
        // 🔥 setState 호출 직전 한 번 더 체크 (안전장치)
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        // 🔥 try-catch로 setState를 감싸서 안전하게 처리
        try {
          setSupplementSchedules(prev => ({
            ...prev,
            [scheduleKey]: scheduleData
          }));
        } catch (error) {
          if (__DEV__) {
            console.warn('[useScheduleData] setState 에러 (무시됨):', error);
          }
          loadingSchedules.current.delete(scheduleKey);
        }
      } else {
        // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
        if (!isMountedRef.current) {
          loadingSchedules.current.delete(scheduleKey);
          return;
        }
        
        if (__DEV__) {
          console.log('🔍 [영양제 스케줄] 빈 스케줄 설정');
        }
        const emptyScheduleData: DailySchedule = {
          morning: 0,
          afternoon: 0,
          evening: 0,
          total: 0,
          weeklySchedule: null
        };
        
        // 🔥 try-catch로 setState를 감싸서 안전하게 처리
        try {
          setSupplementSchedules(prev => ({
            ...prev,
            [scheduleKey]: emptyScheduleData
          }));
        } catch (error) {
          if (__DEV__) {
            console.warn('[useScheduleData] setState 에러 (무시됨):', error);
          }
          loadingSchedules.current.delete(scheduleKey);
        }
      }
    } catch (error: unknown) {
      // 🔥 컴포넌트가 unmount된 경우 상태 업데이트 중단
      if (!isMountedRef.current) {
        loadingSchedules.current.delete(scheduleKey);
        return;
      }
      
      if (__DEV__) {
        console.log(`❌ [영양제 스케줄] 에러 발생 - 빈 스케줄로 설정:`, error);
      }
      const emptyScheduleData: DailySchedule = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        weeklySchedule: null
      };
      
      // 🔥 try-catch로 setState를 감싸서 안전하게 처리
      try {
        setSupplementSchedules(prev => ({
          ...prev,
          [scheduleKey]: emptyScheduleData
        }));
      } catch (setStateError) {
        if (__DEV__) {
          console.warn('[useScheduleData] setState 에러 (무시됨):', setStateError);
        }
        loadingSchedules.current.delete(scheduleKey);
      }
    } finally {
      // 조회 완료 표시
      loadingSchedules.current.delete(scheduleKey);
    }
  }, [selectedMemberId, isMountedRef]);
  
  /**
   * 특정 스케줄 제거
   */
  const clearSchedule = useCallback((scheduleKey: string) => {
    setDailySchedules(prev => {
      const next = { ...prev };
      delete next[scheduleKey];
      return next;
    });
    setSupplementSchedules(prev => {
      const next = { ...prev };
      delete next[scheduleKey];
      return next;
    });
  }, []);
  
  /**
   * 모든 스케줄 제거
   */
  const clearAllSchedules = useCallback(() => {
    setDailySchedules({});
    setSupplementSchedules({});
    loadingSchedules.current.clear();
  }, []);
  
  return {
    dailySchedules,
    supplementSchedules,
    loadDailySchedule,
    loadSupplementSchedule,
    clearSchedule,
    clearAllSchedules,
  };
};

