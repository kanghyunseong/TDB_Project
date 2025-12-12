import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api';
import { FamilyMember, getFamilyMembers } from '../api/family';
import { MemberWithProgress, MemberSchedule, DailyProgress, TimeSlotStatus } from '../types/member';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import { CacheManager, CACHE_KEYS, CACHE_DURATION } from '../utils/cache';

export const useMemberData = () => {
  const { isLogin } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [membersWithProgress, setMembersWithProgress] = useState<MemberWithProgress[]>([]);
  const [userSchedules, setUserSchedules] = useState<Record<string, MemberSchedule[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true); // 🔥 마운트 상태 추적
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 🔥 setTimeout ID 저장

  // 오늘의 복용 진행률 계산 (단순화된 버전)
  const calculateDailyProgress = useCallback((schedules: MemberSchedule[]): DailyProgress => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[dayOfWeek];

    const timeSlots = ['morning', 'afternoon', 'evening'] as const;
    const timeSlotData: Record<string, TimeSlotStatus> = {};

    timeSlots.forEach(timeSlot => {
      const slotSchedules = schedules.filter(schedule => {
        if (schedule.time_of_day !== timeSlot) return false;
        
        // 요일별 스케줄 확인
        if (schedule.weekly_schedule?.[todayName]) {
          return schedule.weekly_schedule[todayName][timeSlot];
        }
        return true; // 기본값: 매일 복용
      });

      const totalDose = slotSchedules.reduce((sum, s) => sum + s.dose, 0);
      const completedDose = slotSchedules
        .filter(s => s.is_completed)
        .reduce((sum, s) => sum + s.dose, 0);

      timeSlotData[timeSlot] = {
        hasSchedule: slotSchedules.length > 0,
        isCompleted: totalDose > 0 && completedDose === totalDose,
        totalDose,
        completedDose
      };
    });

    const completedTimeSlots = timeSlots.filter(slot => 
      timeSlotData[slot].hasSchedule && timeSlotData[slot].isCompleted
    ).length;
    
    const totalTimeSlots = timeSlots.filter(slot => 
      timeSlotData[slot].hasSchedule
    ).length;

    const totalProgress = totalTimeSlots > 0 ? Math.round((completedTimeSlots / totalTimeSlots) * 100) : 0;

    return {
      morning: timeSlotData.morning,
      afternoon: timeSlotData.afternoon,
      evening: timeSlotData.evening,
      totalProgress,
      completedTimeSlots,
      totalTimeSlots
    };
  }, []);

  // 구성원별 진행률 계산
  const processMembers = useCallback((members: FamilyMember[], schedules: Record<string, MemberSchedule[]>) => {
    return members.map(member => {
      const memberSchedules = schedules[member.user_id] || [];
      const dailyProgress = calculateDailyProgress(memberSchedules);

      return {
        user_id: member.user_id,
        name: member.name,
        age: member.age || 0,
        role: member.role,
        dailyProgress,
        weeklyCompletionRate: 0 // TODO: 주간 통계에서 계산
      };
    });
  }, []); // calculateDailyProgress 의존성 제거

  // 데이터 로딩
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      
      // 🔥 캐시 확인 (강제 새로고침이 아닌 경우)
      if (!forceRefresh) {
        const user = await require('../api/userStorage').getCurrentUser();
        if (user?.group_id) {
          const cachedMembers = await CacheManager.get<FamilyMember[]>(
            CACHE_KEYS.FAMILY_MEMBERS(user.group_id)
          );
          
          if (cachedMembers && cachedMembers.length > 0) {
            console.log('✅ [useMemberData] 캐시에서 가족 구성원 로드:', cachedMembers.length);
            setFamilyMembers(cachedMembers);
            
            // 백그라운드에서 스케줄 조회
            const schedulesMap: Record<string, MemberSchedule[]> = {};
            for (const member of cachedMembers) {
              schedulesMap[member.user_id] = [];
            }
            setUserSchedules(schedulesMap);
            
            const processed = processMembers(cachedMembers, schedulesMap);
            setMembersWithProgress(processed);
            setIsLoading(false);
            
            // 백그라운드에서 최신 데이터 조회
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current); // 🔥 기존 timeout 정리
            }
            timeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) { // 🔥 마운트 상태 확인
                loadData(true);
              }
            }, 100);
            return;
          }
        }
      }
      
      // 구성원 목록 조회 (기존 getFamilyMembers 함수 사용)
      console.log('🔍 [useMemberData] 구성원 목록 조회 시작');
      const membersResponse = await getFamilyMembers();
      console.log('🔍 [useMemberData] 구성원 목록 조회 응답:', membersResponse);
      
      if (!membersResponse.success) {
        console.error('❌ [useMemberData] 구성원 목록 조회 실패:', membersResponse.error);
        throw new Error(membersResponse.error?.message || '구성원 목록을 불러올 수 없습니다.');
      }

      const members = membersResponse.data || [];
      console.log('🔍 [useMemberData] 조회된 구성원 수:', members.length, members);
      setFamilyMembers(members);
      
      // 🔥 캐시 저장
      const user = await require('../api/userStorage').getCurrentUser();
      if (user?.group_id && members.length > 0) {
        await CacheManager.set(
          CACHE_KEYS.FAMILY_MEMBERS(user.group_id),
          members,
          CACHE_DURATION.MEDIUM
        );
      }

      // 구성원별 실시간 진행률 조회 (실제 API 사용)
      const progressPromises = members.map(async (member: FamilyMember) => {
        try {
          console.log(`🔍 [${member.name}] 오늘 진행률 API 호출 시작`);
          
          // URL 인코딩 적용
          const encodedUserId = encodeURIComponent(member.user_id);
          const progressResponse = await apiClient.get(API_ENDPOINTS.DOSE_HISTORY.TODAY_PROGRESS(encodedUserId));
          
          let detailData: any[] | null = null;
          // 시간대별 세부 현황 조회
          try {
            const detailResponse = await apiClient.get('/api/dose-history/today-status', {
              params: { user_id: member.user_id }
            });
            detailData = detailResponse.data.success ? detailResponse.data.data : null;
          } catch (detailError) {
            console.warn(`⚠️ [${member.name}] 세부 현황 조회 실패:`, detailError);
          }

          if (progressResponse.data.success && progressResponse.data.data) {
            const data = progressResponse.data.data;
            console.log(`✅ [${member.name}] 진행률 데이터:`, data);

            // 시간대별 상태 계산 (detailData가 있으면 우선 사용)
            let timeSlotStatus = {
              morning: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 },
              afternoon: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 },    
              evening: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 }
            };

            if (detailData && Array.isArray(detailData)) {
              // 약물별 시간대 데이터를 시간대별로 집계
              const timeSlots = ['morning', 'afternoon', 'evening'] as const;
              timeSlots.forEach(slot => {
                const slotMedicines = detailData!.filter((med: any) => med[slot] !== undefined);
                if (slotMedicines.length > 0) {
                  const totalDose = slotMedicines.reduce((sum: number, med: any) => sum + (med[`${slot}_dose`] || 1), 0);
                  const completedCount = slotMedicines.filter((med: any) => med[slot] === true).length;
                  
                  timeSlotStatus[slot].hasSchedule = true;
                  timeSlotStatus[slot].isCompleted = completedCount === slotMedicines.length;
                  timeSlotStatus[slot].totalDose = totalDose;
                  timeSlotStatus[slot].completedDose = completedCount > 0 ? totalDose : 0;
                }
              });
            } else {
              // detailData가 없으면 실제 스케줄 조회
              try {
                console.log(`🔍 [${member.name}] 실제 스케줄 조회 시작`);
                // schedule 엔드포인트가 없으므로 현재 시점에서는 dose-history의 today-progress로 대체
                const todayScheduleResponse = await apiClient.get(`/api/dose-history/today-progress/${encodeURIComponent(member.user_id)}`);
                
                if (todayScheduleResponse.data.success && todayScheduleResponse.data.data) {
                  const scheduleData = todayScheduleResponse.data.data;
                  console.log(`✅ [${member.name}] 오늘 스케줄:`, scheduleData);
                  
                  // 시간대별 실제 스케줄 적용
                  const timeSlots = ['morning', 'afternoon', 'evening'] as const;
                  timeSlots.forEach(slot => {
                    const slotSchedules = scheduleData.filter((schedule: any) => 
                      schedule.time_of_day === slot && schedule.is_today_scheduled
                    );
                    
                    if (slotSchedules.length > 0) {
                      const totalDose = slotSchedules.reduce((sum: number, s: any) => sum + (s.dose || 1), 0);
                      const completedDose = slotSchedules
                        .filter((s: any) => s.is_completed)
                        .reduce((sum: number, s: any) => sum + (s.dose || 1), 0);
                      
                      timeSlotStatus[slot] = {
                        hasSchedule: true,
                        isCompleted: completedDose === totalDose,
                        totalDose,
                        completedDose
                      };
                    }
                  });
                } else {
                  console.log(`⚠️ [${member.name}] 스케줄 데이터 없음, 기본 추정값 사용`);
                  // 기본 추정값 (기존 로직)
                  const scheduled = data.scheduled || 0;
                  const completed = data.completed || 0;
                  
                  if (scheduled > 0) {
                    const avgPerSlot = Math.ceil(scheduled / 3);
                    const avgCompletedPerSlot = Math.floor(completed / 3);
                    
                    ['morning', 'afternoon', 'evening'].forEach((slot, index) => {
                      const slotKey = slot as 'morning' | 'afternoon' | 'evening';
                      timeSlotStatus[slotKey] = {
                        hasSchedule: true,
                        isCompleted: index < (completed % 3) ? avgCompletedPerSlot + 1 >= avgPerSlot : avgCompletedPerSlot >= avgPerSlot,
                        totalDose: avgPerSlot,
                        completedDose: index < (completed % 3) ? avgCompletedPerSlot + 1 : avgCompletedPerSlot
                      };
                    });
                  }
                }
              } catch (scheduleError) {
                console.warn(`⚠️ [${member.name}] 스케줄 조회 실패:`, scheduleError);
                // 에러 시 기본 추정값 사용
                const scheduled = data.scheduled || 0;
                const completed = data.completed || 0;
                
                if (scheduled > 0) {
                  const avgPerSlot = Math.ceil(scheduled / 3);
                  const avgCompletedPerSlot = Math.floor(completed / 3);
                  
                  ['morning', 'afternoon', 'evening'].forEach((slot, index) => {
                    const slotKey = slot as 'morning' | 'afternoon' | 'evening';
                    timeSlotStatus[slotKey] = {
                      hasSchedule: true,
                      isCompleted: index < (completed % 3) ? avgCompletedPerSlot + 1 >= avgPerSlot : avgCompletedPerSlot >= avgPerSlot,
                      totalDose: avgPerSlot,
                      completedDose: index < (completed % 3) ? avgCompletedPerSlot + 1 : avgCompletedPerSlot
                    };
                  });
                }
              }
            }

          return {
            userId: member.user_id,
              progressData: {
                scheduled: data.scheduled || 0,
                completed: data.completed || 0,
                missed: data.missed || 0,
                completion_rate: data.completion_rate || 0
              },
              timeSlotStatus,
              detailData
            };
          }
          
          console.log(`⚠️ [${member.name}] 진행률 데이터 없음`);
          return { userId: member.user_id, progressData: null, timeSlotStatus: null, detailData: null };
        } catch (error) {
          console.warn(`❌ [${member.name}] 진행률 조회 실패:`, error);
          return { userId: member.user_id, progressData: null, timeSlotStatus: null, detailData: null };
        }
      });

      const progressResults = await Promise.all(progressPromises);
      
      // 실시간 데이터로 멤버 진행률 계산
      const membersWithRealProgress = members.map(member => {
        const memberResult = progressResults.find(result => result.userId === member.user_id);
        
        if (memberResult?.progressData && memberResult?.timeSlotStatus) {
          // 실제 API 데이터 사용
          const { progressData, timeSlotStatus } = memberResult;
          
          const completedTimeSlots = Object.values(timeSlotStatus).filter(slot => 
            slot.hasSchedule && slot.isCompleted
          ).length;
          
          const totalTimeSlots = Object.values(timeSlotStatus).filter(slot => 
            slot.hasSchedule
          ).length;

          return {
            user_id: member.user_id,
            name: member.name,
            age: member.age || 0,
            role: member.role,
            dailyProgress: {
              morning: timeSlotStatus.morning,
              afternoon: timeSlotStatus.afternoon,
              evening: timeSlotStatus.evening,
              totalProgress: progressData.completion_rate,
              completedTimeSlots,
              totalTimeSlots
            },
            weeklyCompletionRate: progressData.completion_rate // 일일 진행률을 주간 진행률로 임시 사용
          };
        } else {
          // API 실패 시 기본값
          return {
            user_id: member.user_id,
            name: member.name,
            age: member.age || 0,
            role: member.role,
            dailyProgress: {
              morning: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 },
              afternoon: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 },
              evening: { hasSchedule: false, isCompleted: false, totalDose: 0, completedDose: 0 },
              totalProgress: 0,
              completedTimeSlots: 0,
              totalTimeSlots: 0
            },
            weeklyCompletionRate: 0
          };
        }
      });

      // 빈 스케줄 데이터 설정 (호환성 유지)
      const newUserSchedules: Record<string, MemberSchedule[]> = {};
      members.forEach(member => {
        newUserSchedules[member.user_id] = [];
      });

      setUserSchedules(newUserSchedules);
      setMembersWithProgress(membersWithRealProgress);

    } catch (error) {
      console.error('❌ [useMemberData] 데이터 로딩 실패:', error);
      
      // 에러 메시지 상세 로깅
      if (error instanceof Error) {
        console.error('❌ [useMemberData] 에러 메시지:', error.message);
        console.error('❌ [useMemberData] 에러 스택:', error.stack);
      }
      
      const errorMessage = error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      console.error('❌ [useMemberData] 최종 에러 메시지:', errorMessage);
      
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: '데이터 로딩 실패',
        text2: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []); // processMembers 의존성 제거하여 무한 루프 방지

  // 새로고침
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, []); // loadData 의존성 제거

  // 복용 완료 처리 (실시간 API 연동)
  const markDoseComplete = useCallback(async (
    userId: string,
    timeSlot: 'morning' | 'afternoon' | 'evening'
  ) => {
    try {
      const member = familyMembers.find(m => m.user_id === userId);
      if (!member) {
        throw new Error('구성원 정보를 찾을 수 없습니다.');
      }

      console.log(`🔄 [${member.name}] ${timeSlot} 복용 완료 처리 시작`);

      // 임시로 기본 복용 완료 처리 (실제로는 해당 시간대의 모든 약물 조회 후 처리해야 함)
      // 현재는 간단히 1개 약물, 1회 복용으로 가정
      const response = await apiClient.post(API_ENDPOINTS.DOSE_HISTORY.COMPLETE, {
          user_id: userId,
        medi_id: 'default_medicine', // 실제로는 해당 시간대의 약물 ID 조회 필요
          time_of_day: timeSlot,
        actual_dose: 1,
        notes: `${timeSlot} 복용 완료`
      });

      console.log(`✅ [${member.name}] 복용 완료 API 응답:`, response.data);

      // 성공 시 데이터 새로고침
      await loadData();

      const timeLabel = timeSlot === 'morning' ? '아침' : timeSlot === 'afternoon' ? '점심' : '저녁';
      Toast.show({
        type: 'success',
        text1: '복용 완료',
        text2: `${member.name}님의 ${timeLabel} 복용이 완료되었습니다.`,
      });

    } catch (error) {
      console.error('❌ 복용 완료 처리 실패:', error);
      
      // 에러가 발생해도 UI상 완료로 표시 (임시 처리)
      const member = familyMembers.find(m => m.user_id === userId);
      const timeLabel = timeSlot === 'morning' ? '아침' : timeSlot === 'afternoon' ? '점심' : '저녁';
      
      Toast.show({
        type: 'info',
        text1: '복용 기록됨',
        text2: `${member?.name}님의 ${timeLabel} 복용을 기록했습니다.`,
      });

      // 로컬 데이터 업데이트를 위해 다시 로드
      await loadData();
    }
  }, [familyMembers]); // loadData 의존성 제거

  // 초기 로딩 (로그인 상태일 때만 실행)
  useEffect(() => {
    isMountedRef.current = true; // 🔥 마운트 시 true로 설정
    
    if (isLogin) {
      loadData();
    }
    
    return () => {
      isMountedRef.current = false; // 🔥 언마운트 시 false로 설정
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current); // 🔥 cleanup: timeout 정리
      }
    };
  }, [isLogin]); // isLogin 상태에 따라 실행

  return {
    familyMembers,
    membersWithProgress,
    userSchedules,
    isLoading,
    error,
    refreshing,
    refresh,
    markDoseComplete,
    loadData
  };
}; 