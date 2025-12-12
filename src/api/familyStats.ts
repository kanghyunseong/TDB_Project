import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { getCurrentUser } from './userStorage';
import { getFamilyMembers } from './family';
import { logger } from '../utils/logger';

export interface FamilyDashboardData {
  overallProgress: number;
  totalMembers: number;
  completedMembers: number;
  totalDoses: number;
  completedDoses: number;
  pendingDoses: number;
  missedDoses: number;
  partialDoses: number;
  machineStatus: {
    connected: number;
    total: number;
    lowBattery: number;
  };
  todaySchedules: Array<{
    user_id: string;
    user_name: string;
    medi_name: string;
    time_of_day: 'morning' | 'afternoon' | 'evening';
    scheduled_dose: number;
    status: 'completed' | 'missed' | 'partial' | 'pending';
    completed_at?: string;
  }>;
  memberProgress: Array<{
    user_id: string;
    user_name: string;
    age: number;
    role: 'parent' | 'child';
    totalScheduled: number;
    completed: number;
    missed: number;
    partial: number;
    progressPercentage: number;
  }>;
}

/**
 * 오늘의 가족 복용 현황을 조회합니다.
 * 실제 구현된 dose-history API를 사용합니다:
 * /dose-history/family-stats/:connect
 */
export const getFamilyDashboardStats = async (): Promise<{
  success: boolean;
  data?: FamilyDashboardData;
  error?: { message: string };
}> => {
  try {
    console.log('🔍 [getFamilyDashboardStats] 세밀한 가족 대시보드 데이터 수집 시작');
    
    // 현재 사용자 정보에서 connect 값 가져오기
    const currentUser = await getCurrentUser();
    console.log('🔍 [getFamilyDashboardStats] 현재 사용자:', currentUser);
    
    if (!currentUser?.group_id) {
      console.error('❌ [getFamilyDashboardStats] 사용자 그룹 정보가 없습니다');
      return {
        success: false,
        error: { message: '그룹 정보가 올바르지 않습니다.' }
      };
    }
    
    // 1. 가족 구성원 목록 조회
    console.log('📋 [Step 1] 가족 구성원 목록 조회');
    const familyResponse = await getFamilyMembers();
    const familyMembers = familyResponse.success ? familyResponse.data || [] : [];
    console.log('✅ 가족 구성원:', familyMembers.map(m => ({ id: m.user_id, name: m.name, role: m.role })));
    
    // 2. 각 구성원별 오늘 진행률 조회
    console.log('📊 [Step 2] 구성원별 오늘 진행률 수집');
    const memberProgressPromises = familyMembers.map(async (member) => {
      try {
        const progressResponse = await apiClient.get(`/api/dose-history/today-progress/${member.user_id}`);
        return {
          user_id: member.user_id,
          name: member.name,
          role: member.role,
          progress: progressResponse.data.success ? progressResponse.data.data : null
        };
      } catch (error) {
        console.warn(`⚠️ ${member.name} 진행률 조회 실패:`, error);
        return {
          user_id: member.user_id,
          name: member.name,
          role: member.role,
          progress: null
        };
      }
    });
    
    const memberProgressResults = await Promise.all(memberProgressPromises);
    console.log('✅ 구성원별 진행률:', memberProgressResults);
    
    // 3. 전체 가족 통계 조회
    console.log('📈 [Step 3] 전체 가족 통계 조회');
    const familyStatsResponse = await apiClient.get(`/api/dose-history/family-stats/${currentUser.group_id}`);
    console.log('✅ 가족 통계 응답:', familyStatsResponse.data);
    
    if (familyStatsResponse.data.success) {
      const serverData = familyStatsResponse.data.data;
      console.log('🔍 [Step 4] 서버 데이터 세부 분석:', {
        total_scheduled: serverData?.total_scheduled,
        total_completed: serverData?.total_completed,
        completion_rate: serverData?.completion_rate,
        member_count: serverData?.member_count
      });
      
      // 4. 구성원별 세밀한 진행률 수집 및 분석
      console.log('🔬 [Step 5] 구성원별 세밀한 데이터 분석');
      
      // 🔥 familyMembers가 배열인지 확인
      if (!Array.isArray(familyMembers) || familyMembers.length === 0) {
        console.warn('⚠️ [getFamilyDashboardStats] familyMembers가 배열이 아니거나 비어있음');
        // 빈 데이터로 기본 구조 반환
        return {
          success: true,
          data: {
            overallProgress: serverData?.completion_rate || 0,
            totalMembers: serverData?.member_count || 0,
            completedMembers: 0,
            totalDoses: serverData?.total_scheduled || 0,
            completedDoses: serverData?.total_completed || 0,
            pendingDoses: (serverData?.total_scheduled || 0) - (serverData?.total_completed || 0),
            missedDoses: 0,
            partialDoses: 0,
            machineStatus: {
              connected: 0,
              total: 0,
              lowBattery: 0,
            },
            todaySchedules: [],
            memberProgress: [],
          }
        };
      }
      
             const memberDetailedProgress = await Promise.all(
         familyMembers.map(async (member) => {
           try {
             // 구성원별 오늘 진행률 조회 (실제 구현된 API 사용)
             // URL 인코딩을 적용하여 공백 등 특수문자 처리
             const encodedUserId = encodeURIComponent(member.user_id);
             console.log(`📊 [${member.name}] API 호출: /dose-history/today-progress/${encodedUserId}`);
             const progressResponse = await apiClient.get(`/api/dose-history/today-progress/${encodedUserId}`);
             
             let detailData = null;
             // 오늘 상세 현황은 query parameter 방식으로 호출
             try {
               console.log(`📊 [${member.name}] API 호출: /dose-history/today-status?user_id=${encodedUserId}`);
               const detailResponse = await apiClient.get('/api/dose-history/today-status', {
                 params: { user_id: member.user_id } // axios가 자동으로 인코딩 처리
               });
               detailData = detailResponse.data.success ? detailResponse.data.data : null;
             } catch (detailError) {
               console.warn(`⚠️ ${member.name} 상세 현황 API 미구현:`, (detailError as any)?.response?.status);
               detailData = null;
             }
             
             const progressData = progressResponse.data.success ? progressResponse.data.data : null;
             
             console.log(`📊 ${member.name} 세부 데이터:`, {
               detail: detailData,
               progress: progressData
             });
             
             return {
               ...member,
               detailData,
               progressData,
               scheduled: progressData?.scheduled || 0,
               completed: progressData?.completed || 0,
               completion_rate: progressData?.completion_rate || 0,
               // 시간대별 데이터 (서버에서 제공되지 않으면 추정)
               morning_scheduled: Math.floor((progressData?.scheduled || 0) / 3),
               afternoon_scheduled: Math.floor((progressData?.scheduled || 0) / 3),
               evening_scheduled: Math.floor((progressData?.scheduled || 0) / 3),
               morning_completed: Math.floor((progressData?.completed || 0) / 3),
               afternoon_completed: Math.floor((progressData?.completed || 0) / 3),
               evening_completed: Math.floor((progressData?.completed || 0) / 3)
             };
           } catch (error) {
             console.warn(`⚠️ ${member.name} 세부 데이터 수집 실패:`, error);
             return {
               ...member,
               detailData: null,
               progressData: null,
               scheduled: 0,
               completed: 0,
               completion_rate: 0,
               morning_scheduled: 0,
               afternoon_scheduled: 0,
               evening_scheduled: 0,
               morning_completed: 0,
               afternoon_completed: 0,
               evening_completed: 0
             };
           }
         })
       );
      
      console.log('✅ 구성원별 세밀한 분석 결과:', memberDetailedProgress);
      
      // 실제 구성원 데이터로부터 전체 통계 재계산
      const realTotalScheduled = memberDetailedProgress.reduce((sum, member) => sum + member.scheduled, 0);
      const realTotalCompleted = memberDetailedProgress.reduce((sum, member) => sum + member.completed, 0);
      
      // 서버 데이터와 구성원 분석 데이터 비교
      const serverTotalScheduled = serverData?.total_scheduled || 0;
      const serverTotalCompleted = serverData?.total_completed || 0;
      const serverCompletionRate = serverData?.completion_rate || 0;
      
      console.log('📈 데이터 비교 분석:', {
        서버통계: { scheduled: serverTotalScheduled, completed: serverTotalCompleted, rate: serverCompletionRate },
        구성원합산: { scheduled: realTotalScheduled, completed: realTotalCompleted },
        차이: { 
          scheduled: Math.abs(serverTotalScheduled - realTotalScheduled),
          completed: Math.abs(serverTotalCompleted - realTotalCompleted) 
        }
      });
      
      // 더 정확한 데이터 선택 (구성원 합산 데이터가 있으면 우선 사용)
      const finalScheduled = realTotalScheduled > 0 ? realTotalScheduled : serverTotalScheduled;
      const finalCompleted = realTotalCompleted > 0 ? realTotalCompleted : serverTotalCompleted;
      const finalCompletionRate = finalScheduled > 0 ? Math.round((finalCompleted / finalScheduled) * 100) : serverCompletionRate;
      
             // 5. 세밀한 시간 기반 복용 현황 분석
       console.log('⏰ [Step 6] 시간 기반 복용 현황 분석');
       const now = new Date();
       const currentHour = now.getHours();
       
       // 구성원별 시간대별 세분화 분석
       const timeBasedAnalysis = memberDetailedProgress.map(member => {
         // 실제 API 데이터나 추정 데이터 사용
         return {
           user_id: member.user_id,
           name: member.name,
           morning: {
             scheduled: member.morning_scheduled,
             completed: member.morning_completed
           },
           afternoon: {
             scheduled: member.afternoon_scheduled,
             completed: member.afternoon_completed
           },
           evening: {
             scheduled: member.evening_scheduled,
             completed: member.evening_completed
           }
         };
       });
       
       console.log('📅 구성원별 시간대 분석:', timeBasedAnalysis);
       
       // 전체 시간대별 합산
       const totalTimeAnalysis = timeBasedAnalysis.reduce((acc, member) => ({
         morning: {
           scheduled: acc.morning.scheduled + member.morning.scheduled,
           completed: acc.morning.completed + member.morning.completed
         },
         afternoon: {
           scheduled: acc.afternoon.scheduled + member.afternoon.scheduled,
           completed: acc.afternoon.completed + member.afternoon.completed
         },
         evening: {
           scheduled: acc.evening.scheduled + member.evening.scheduled,
           completed: acc.evening.completed + member.evening.completed
         }
       }), {
         morning: { scheduled: 0, completed: 0 },
         afternoon: { scheduled: 0, completed: 0 },
         evening: { scheduled: 0, completed: 0 }
       });
       
       // 현재 시간 기준 예상 완료량 계산
       let expectedCompletedByNow = 0;
       if (currentHour >= 9) expectedCompletedByNow += totalTimeAnalysis.morning.scheduled;
       if (currentHour >= 14) expectedCompletedByNow += totalTimeAnalysis.afternoon.scheduled;
       if (currentHour >= 19) expectedCompletedByNow += totalTimeAnalysis.evening.scheduled;
       
       // 실제 완료된 복용과 놓친 복용 계산
       const missedDoses = Math.max(0, expectedCompletedByNow - finalCompleted);
       const remainingDoses = Math.max(0, finalScheduled - finalCompleted);
       
       console.log('🧮 세밀한 복용 현황 계산:', {
         현재시간: `${currentHour}시`,
         시간대별통계: totalTimeAnalysis,
         전체예정: finalScheduled,
         전체완료: finalCompleted,
         시간기준예상완료: expectedCompletedByNow,
         놓친복용: missedDoses,
         남은복용: remainingDoses,
         진행률: finalCompletionRate
       });
       
      // 구성원별 세부 진행률 분석
      const memberProgress = memberDetailedProgress.map(member => {
        // 🔥 오늘 복용해야 할 약 기준으로 진행률 계산 (100% 초과 방지)
        const progressPercentage = member.scheduled > 0 
          ? Math.min(100, Math.round((member.completed / member.scheduled) * 100))
          : 0;
        const memberData = {
          user_id: member.user_id,
          user_name: member.name,
          age: member.age || 0,
          role: member.role,
          totalScheduled: member.scheduled,
          completed: member.completed,
          missed: Math.max(0, member.scheduled - member.completed),
          partial: 0, // 현재 API에서 제공되지 않음
          progressPercentage: progressPercentage
        };
         
         console.log(`👤 ${member.name} 진행률 분석:`, {
           scheduled: member.scheduled,
           completed: member.completed,
           completion_rate: member.completion_rate,
           progressPercentage: progressPercentage,
           isCompleted: progressPercentage >= 100
         });
         
         return memberData;
       });
       
       // 6. 스마트 약통 상태 세밀한 분석
       console.log('📱 [Step 7] 스마트 약통 상태 세밀한 분석');
       const machineAnalysis = familyMembers.map(member => {
         const hasDevice = !!member.k_uid;
         const completionRate = memberDetailedProgress.find(m => m.user_id === member.user_id)?.completion_rate || 0;
         const isLowCompletion = completionRate < 70;
         
         return {
           user_id: member.user_id,
           name: member.name,
           hasDevice,
           k_uid: member.k_uid,
           isConnected: hasDevice,
           needsAttention: isLowCompletion,
           completionRate
         };
       });
       
       console.log('🔌 약통 연결 분석:', machineAnalysis);
       
       const transformedData: FamilyDashboardData = {
         overallProgress: finalCompletionRate,
         totalMembers: familyMembers.length,
         completedMembers: memberProgress.filter(m => m.progressPercentage >= 100).length,
         totalDoses: finalScheduled,
         completedDoses: finalCompleted,
         pendingDoses: remainingDoses,
         missedDoses: missedDoses,
         partialDoses: 0, // 현재 API에서 제공되지 않음
         machineStatus: {
           connected: machineAnalysis.filter(m => m.isConnected).length,
           total: machineAnalysis.filter(m => m.hasDevice).length,
           lowBattery: 0, // 실제 배터리 정보 API 부족
         },
         todaySchedules: [],
         memberProgress: memberProgress,
       };
      
             console.log('✅ [getFamilyDashboardStats] 세밀한 대시보드 데이터 생성 완료:', {
         전체진행률: transformedData.overallProgress,
         구성원수: transformedData.totalMembers,
         완료구성원: transformedData.completedMembers,
         전체복용: transformedData.totalDoses,
         완료복용: transformedData.completedDoses,
         남은복용: transformedData.pendingDoses,
         놓친복용: transformedData.missedDoses,
         연결된약통: transformedData.machineStatus.connected,
         전체약통: transformedData.machineStatus.total,
         구성원세부: transformedData.memberProgress.map(m => ({
           이름: m.user_name,
           역할: m.role,
           진행률: m.progressPercentage,
           완료: m.completed,
           예정: m.totalScheduled
         }))
       });
       
       return {
         success: true,
         data: transformedData
       };
    } else {
      console.error('❌ [getFamilyDashboardStats] 대시보드 데이터 조회 실패:', familyStatsResponse.data.error);
      return {
        success: false,
        error: familyStatsResponse.data.error || { message: '대시보드 데이터를 불러올 수 없습니다.' }
      };
    }
  } catch (error) {
    console.error('❌ [getFamilyDashboardStats] API 호출 에러:', error);
    return {
      success: false,
      error: { 
        message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.' 
      }
    };
  }
};

/**
 * 구성원별 오늘의 복용 상세 현황을 조회합니다.
 */
export const getMemberTodayStats = async (userId: string): Promise<{
  success: boolean;
  data?: {
    user_id: string;
    user_name: string;
    todaySchedules: Array<{
      medi_id: string;
      medi_name: string;
      time_of_day: 'morning' | 'afternoon' | 'evening';
      scheduled_dose: number;
      actual_dose?: number;
      status: 'completed' | 'missed' | 'partial' | 'pending';
      completed_at?: string;
      machine_remain?: number;
    }>;
    summary: {
      totalScheduled: number;
      completed: number;
      missed: number;
      partial: number;
      pending: number;
      progressPercentage: number;
    };
  };
  error?: { message: string };
}> => {
  try {
    console.log('🔍 [getMemberTodayStats] 구성원 오늘 통계 조회:', userId);
    
    // 구성원의 오늘 진행률 조회를 today-progress 엔드포인트로 변경
    const response = await apiClient.get(`/api/dose-history/today-progress/${userId}`);
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: response.data.error || { message: '구성원 통계를 불러올 수 없습니다.' }
      };
    }
  } catch (error) {
    console.error('❌ [getMemberTodayStats] API 호출 에러:', error);
    return {
      success: false,
      error: { 
        message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.' 
      }
    };
  }
};

/**
 * 🔥 배치 API: 가족 전체의 오늘 스케줄 한 번에 조회
 */
export const getFamilyTodaySchedules = async (group_id: string): Promise<{
  success: boolean;
  data?: {
    members: Array<{
      user_id: string;
      name: string;
      medicines: Array<{
        medi_id: string;
        name: string;
        time_of_day: 'morning' | 'afternoon' | 'evening';
        scheduled_dose: number;
        actual_dose?: number;
        status: 'completed' | 'missed' | 'partial' | null;
        completed_at?: string;
        schedule_created_at?: string;
        notes?: string; // 🔥 배출 기록 확인용
      }>;
      supplements: Array<{
        medi_id: string;
        name: string;
        time_of_day: 'morning' | 'afternoon' | 'evening';
        scheduled_dose: number;
        actual_dose?: number;
        status: 'completed' | 'missed' | 'partial' | null;
        completed_at?: string;
        schedule_created_at?: string;
        notes?: string; // 🔥 배출 기록 확인용
      }>;
    }>;
  };
  error?: { message: string };
}> => {
  try {
    logger.debug('🔍 [getFamilyTodaySchedules] 배치 API 호출:', group_id);
    
    const response = await apiClient.get(
      `/api/dose-history/family-today-schedules/${group_id}`
    );
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: response.data.error || { message: '가족 오늘 스케줄 조회에 실패했습니다.' }
      };
    }
  } catch (error) {
    logger.error('❌ [getFamilyTodaySchedules] API 호출 에러:', error);
    return {
      success: false,
      error: { 
        message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.' 
      }
    };
  }
};

/**
 * 스마트 약통 상태를 조회합니다.
 */
export const getMachineStatuses = async (): Promise<{
  success: boolean;
  data?: Array<{
    machine_id: string;
    owner: string;
    medicines: Array<{
      medi_id: string;
      medi_name: string;
      total: number;
      remain: number;
      slot: number;
    }>;
    error_status?: string;
    last_error_at?: string;
    battery_level?: number;
    is_connected: boolean;
  }>;
  error?: { message: string };
}> => {
  try {
    console.log('🔍 [getMachineStatuses] 스마트 약통 상태 조회');
    
    // 전체 약통 상태를 family-status로 조회 (connect 기반)
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('사용자 그룹 정보를 찾을 수 없습니다.');
    }
    const response = await apiClient.get(`/api/machine/family-status`, {
      params: { group_id: currentUser.group_id }
    });
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: response.data.error || { message: '약통 상태를 불러올 수 없습니다.' }
      };
    }
  } catch (error) {
    console.error('❌ [getMachineStatuses] API 호출 에러:', error);
    return {
      success: false,
      error: { 
        message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.' 
      }
    };
  }
}; 