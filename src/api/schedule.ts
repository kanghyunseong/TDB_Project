import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { Schedule, ApiResponse } from '../types';
import { getCurrentUser } from './userStorage';

// 연령 검증 API (그룹 기반)
export const validateUserAge = async (userId: string) => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.get(`/api/schedule/validate-age/${userId}?group_id=${currentUser.group_id}`);
    console.log('🔍 [API] 연령 검증 결과 (그룹 기반):', response.data);
    return response.data;
  } catch (error) {
    console.error('🚨 [API] 연령 검증 오류:', error);
    throw error;
  }
};

export const scheduleApi = {
  // 일정 목록 조회 (그룹 기반)
  getList: async (): Promise<ApiResponse<Schedule[]>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.get(`${API_ENDPOINTS.SCHEDULE.LIST}?group_id=${currentUser.group_id}`);
    return response.data;
  },

  // 일정 저장 (그룹 기반)
  save: async (schedule: Omit<Schedule, 'schedule_id' | 'created_at'>): Promise<ApiResponse<Schedule>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const scheduleWithGroup = {
      ...schedule,
      group_id: currentUser.group_id
    };

    const response = await apiClient.post(API_ENDPOINTS.SCHEDULE.SAVE, scheduleWithGroup);
    return response.data;
  },

  // 일정 수정 (그룹 기반)
  update: async (scheduleId: string, schedule: Partial<Schedule>): Promise<ApiResponse<Schedule>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const scheduleWithGroup = {
      ...schedule,
      group_id: currentUser.group_id
    };

    const response = await apiClient.put(`${API_ENDPOINTS.SCHEDULE.UPDATE}/${scheduleId}`, scheduleWithGroup);
    return response.data;
  },

  // 일정 삭제 (그룹 기반)
  delete: async (scheduleId: string): Promise<ApiResponse<void>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.delete(`${API_ENDPOINTS.SCHEDULE.DELETE}/${scheduleId}?group_id=${currentUser.group_id}`);
    return response.data;
  },

  // 오늘의 일정 조회 (그룹 기반)
  getToday: async (): Promise<ApiResponse<Schedule[]>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.get(`${API_ENDPOINTS.SCHEDULE.TODAY}?group_id=${currentUser.group_id}`);
    return response.data;
  },

  // 가족 일정 요약 조회 (그룹 기반)
  getFamilySummary: async (): Promise<ApiResponse<Schedule[]>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.get(`${API_ENDPOINTS.SCHEDULE.FAMILY_SUMMARY}?group_id=${currentUser.group_id}`);
    return response.data;
  },

  // 현재 시간 기준 복용량 조회 (그룹 기반)
  getCurrentDose: async (medicineId: string, userId: string): Promise<ApiResponse<{
    dose: number;
    timeSlot: string;
    nextDose?: { timeSlot: string; dose: number };
  }>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const response = await apiClient.get(
      `${API_ENDPOINTS.SCHEDULE.CURRENT_DOSE}/${medicineId}/${userId}?group_id=${currentUser.group_id}`
    );
    return response.data;
  },

  // 하루 전체 복용 스케줄 조회 (그룹 기반)
  getDailySchedule: async (medicineId: string, userId: string, date?: string): Promise<ApiResponse<{
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
  }>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const params = new URLSearchParams({ group_id: currentUser.group_id });
    if (date) params.append('date', date);

    const url = `${API_ENDPOINTS.SCHEDULE.DAILY_SCHEDULE}/${medicineId}/${userId}?${params.toString()}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  // 복용 완료 처리 (그룹 기반)
  completeDose: async (
    medicineId: string,
    userId: string,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    actualDose?: number,
    notes?: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.group_id) {
        throw new Error('그룹 정보를 찾을 수 없습니다.');
      }

      console.log(`🔥 [scheduleApi] 복용 완료 처리 (그룹 기반): ${medicineId}/${userId}/${timeOfDay}`);
      
      // integrated-server의 dose-history API 형식으로 호출
      const response = await apiClient.post(API_ENDPOINTS.DOSE_HISTORY.COMPLETE, {
        group_id: currentUser.group_id,
        user_id: userId,
        medi_id: medicineId,
        time_of_day: timeOfDay,
        actual_dose: actualDose || 1,
        notes
      });
      
      console.log(`✅ [scheduleApi] 복용 완료 API 응답:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('🔥 [scheduleApi] 복용 완료 처리 실패:', error);
      throw error;
    }
  },

  // 복용 기록 조회 (그룹 기반)
  getDoseHistory: async (
    medicineId: string,
    userId: string,
    date?: string
  ): Promise<ApiResponse<any[]>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const params = new URLSearchParams({ group_id: currentUser.group_id });
    if (date) params.append('date', date);

    const url = `${API_ENDPOINTS.SCHEDULE.DOSE_HISTORY}/${medicineId}/${userId}?${params.toString()}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  // 주간 통계 조회 (그룹 기반)
  getWeeklyStats: async (
    userId: string,
    medicineId?: string
  ): Promise<ApiResponse<{
    totalScheduled: number;
    totalCompleted: number;
    completionRate: number;
    dailyStats: Array<{
      date: string;
      scheduled: number;
      completed: number;
      rate: number;
    }>;
  }>> => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id) {
      throw new Error('그룹 정보를 찾을 수 없습니다.');
    }

    const params = new URLSearchParams({ group_id: currentUser.group_id });
    if (medicineId) params.append('medicineId', medicineId);

    const url = `${API_ENDPOINTS.SCHEDULE.WEEKLY_STATS}/${userId}?${params.toString()}`;
    const response = await apiClient.get(url);
    return response.data;
  },
}; 