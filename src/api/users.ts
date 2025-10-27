import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { User, ApiResponse } from '../types';

export const userApi = {
  // 사용자 프로필 조회
  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get(API_ENDPOINTS.USER.PROFILE);
    return response.data;
  },

  // 사용자 프로필 수정
  updateProfile: async (userData: Partial<User>): Promise<ApiResponse<User>> => {
    const response = await apiClient.put(API_ENDPOINTS.USER.UPDATE_PROFILE, userData);
    return response.data;
  },

  // 기계 등록
  registerMachine: async (machineId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post(API_ENDPOINTS.USER.REGISTER_MACHINE, { machineId });
    return response.data;
  },

  // 사용자 정보 조회
  getUser: async (userId: string): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.get<ApiResponse<User>>(`/api/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      return {
        success: false,
        error: {
          message: '사용자 정보 조회에 실패했습니다.'
        }
      };
    }
  },

  // 디스펜서 정보 조회 (integrated-server 대응)
  getDispenserInfo: async (userId: string): Promise<ApiResponse<{ machines: any[]; group_id: string }>> => {
    try {
      const response = await apiClient.get<ApiResponse<{ machines: any[]; group_id: string }>>(API_ENDPOINTS.USER.DISPENSER_INFO(userId));
      
      // integrated-server는 ApiResponse 형태로 반환
      return response.data;
    } catch (error) {
      console.error('디스펜서 정보 조회 실패:', error);
      return {
        success: false,
        error: {
          message: '디스펜서 정보 조회에 실패했습니다.'
        }
      };
    }
  },

  // 🔥 가족 구성원 machine_id 동기화 (기존 데이터 수정용)
  syncFamilyMachineId: async (connect: string): Promise<ApiResponse<{ updatedCount: number; machine_id: string | null }>> => {
    try {
      console.log(`[API] 가족 machine_id 동기화 요청: connect=${connect}`);
      const response = await apiClient.post<ApiResponse<{ updatedCount: number; machine_id: string | null }>>(
        '/api/family/sync-family-machine-id',
        { connect }
      );
      console.log(`[API] 가족 machine_id 동기화 응답:`, response.data);
      return response.data;
    } catch (error) {
      console.error('가족 machine_id 동기화 실패:', error);
      return {
        success: false,
        error: {
          message: '가족 구성원 machine_id 동기화에 실패했습니다.'
        }
      };
    }
  },

  // 🔥 디스펜서 등록
  registerDispenser: async (userId: string, machine_id: string): Promise<ApiResponse<User>> => {
    try {
      console.log(`[API] 디스펜서 등록 요청: userId=${userId}, machine_id=${machine_id}`);
      const response = await apiClient.post<ApiResponse<User>>(
        '/api/user/register-dispenser',
        { userId, machine_id }
      );
      console.log(`[API] 디스펜서 등록 응답:`, response.data);
      return response.data;
    } catch (error) {
      console.error('디스펜서 등록 실패:', error);
      return {
        success: false,
        error: {
          message: (error as any)?.response?.data?.message || '디스펜서 등록에 실패했습니다.'
        }
      };
    }
  },

  // 🔥 데일리 키트 등록
  registerDailyKit: async (userId: string, k_uid: string): Promise<ApiResponse<User>> => {
    try {
      console.log(`[API] 데일리 키트 등록 요청: userId=${userId}, k_uid=${k_uid}`);
      const response = await apiClient.post<ApiResponse<User>>(
        '/api/user/register-daily-kit',
        { userId, k_uid }
      );
      console.log(`[API] 데일리 키트 등록 응답:`, response.data);
      return response.data;
    } catch (error) {
      console.error('데일리 키트 등록 실패:', error);
      return {
        success: false,
        error: {
          message: (error as any)?.response?.data?.message || '데일리 키트 등록에 실패했습니다.'
        }
      };
    }
  },

  // 🔥 사용자 디스펜서 machine_id 조회 (getDispenserInfo 사용)
  getUserMachineId: async (userId: string): Promise<ApiResponse<{ machine_id: string | null }>> => {
    try {
      console.log(`[API] 사용자 machine_id 조회 요청: userId=${userId}`);
      
      // 🔥 기존 getDispenserInfo API 사용
      const response = await apiClient.get<ApiResponse<{ machines: any[]; group_id: string }>>(
        API_ENDPOINTS.USER.DISPENSER_INFO(userId)
      );
      
      console.log(`[API] 디스펜서 정보 조회 응답:`, response.data);
      
      if (!response.data.success || !response.data.data?.machines || response.data.data?.machines.length === 0) {
        return {
          success: false,
          error: {
            message: '등록된 디스펜서가 없습니다.'
          }
        };
      }
      
      // 첫 번째 기기의 machine_id 반환
      const firstMachine = response.data.data?.machines[0];
      const result = {
        success: true,
        data: {
          machine_id: firstMachine.machine_id || null
        }
      };
      
      console.log(`[API] 사용자 machine_id 조회 결과:`, result);
      return result;
      
    } catch (error) {
      console.error('사용자 machine_id 조회 실패:', error);
      return {
        success: false,
        error: {
          message: (error as any)?.response?.data?.message || '사용자 machine_id 조회에 실패했습니다.'
        }
      };
    }
  }
}; 