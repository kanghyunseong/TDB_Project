import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { ApiResponse, Machine, MachineSlot, DispenserStatus } from '../types/tdb';

// 기기 목록 조회
export const getMachineList = async (): Promise<ApiResponse<Machine[]>> => {
  try {
    console.log('📤 기기 목록 조회 요청');
    
    const response = await apiClient.get(API_ENDPOINTS.MACHINE.LIST);
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data || []
    };
  } catch (error: any) {
    console.error('❌ 기기 목록 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 목록 조회에 실패했습니다.'
      }
    };
  }
};

// 기기 상태 조회
export const getMachineStatus = async (machine_id: string): Promise<ApiResponse<DispenserStatus>> => {
  try {
    console.log('📤 기기 상태 조회:', machine_id);
    
    const response = await apiClient.get(API_ENDPOINTS.MACHINE.STATUS(machine_id));
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 기기 상태 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 상태 조회에 실패했습니다.'
      }
    };
  }
};

// 기기별 약물 잔량 조회
export const getMedicineRemain = async (machine_id: string): Promise<ApiResponse<MachineSlot[]>> => {
  try {
    console.log('📤 약물 잔량 조회:', machine_id);
    
    const response = await apiClient.get(API_ENDPOINTS.MACHINE.REMAIN(machine_id));
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data || []
    };
  } catch (error: any) {
    console.error('❌ 약물 잔량 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '약물 잔량 조회에 실패했습니다.'
      }
    };
  }
};

// 기기별 약물 잔량 조회
export const getMedicineRemainByMachine = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.MACHINE.REMAIN(machine_id));
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기별 약물 잔량 조회에 실패했습니다.',
        statusCode: error.response?.status
      }
    };
  }
};

// 기기 등록 (QR 스캔을 통한 등록)
export const registerMachine = async (userId: string, machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기 등록 요청:', { userId, machine_id });
    
    const response = await apiClient.post(API_ENDPOINTS.USER.REGISTER_MACHINE, {
      userId,
      machine_id
    });
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 기기 등록 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 등록에 실패했습니다.'
      }
    };
  }
};

// 기기 에러 상태 업데이트
export const updateMachineError = async (machine_id: string, error_status: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기 에러 상태 업데이트:', { machine_id, error_status });
    
    const response = await apiClient.post(API_ENDPOINTS.MACHINE.ERROR, {
      machine_id,
      error_status,
      last_error_at: new Date().toISOString()
    });
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 기기 에러 상태 업데이트 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 에러 상태 업데이트에 실패했습니다.'
      }
    };
  }
};

// 기기 정보 업데이트
export const updateMachine = async (machine_id: string, updateData: Partial<Machine>): Promise<ApiResponse<Machine>> => {
  try {
    console.log('📤 기기 정보 업데이트:', { machine_id, updateData });
    
    const response = await apiClient.put(`${API_ENDPOINTS.MACHINE.UPDATE}/${machine_id}`, updateData);
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 기기 정보 업데이트 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 정보 업데이트에 실패했습니다.'
      }
    };
  }
};

// 사용자의 기기 정보 조회
export const getUserMachineInfo = async (userId: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 사용자 기기 정보 조회:', userId);
    
    const response = await apiClient.get(API_ENDPOINTS.USER.DISPENSER_INFO(userId));
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 사용자 기기 정보 조회 실패:', error);
    
    // 404는 기기가 없는 정상적인 상황
    if (error.response?.status === 404) {
      return {
        success: true,
        data: null,
        isEmpty: true, // 🔥 기기가 없음을 명시
        message: '등록된 기기가 없습니다.'
      };
    }
    
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '사용자 기기 정보 조회에 실패했습니다.'
      }
    };
  }
};

// UID 검증 (QR 코드 스캔 시 사용)
export const verifyMachineUID = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기 UID 검증:', machine_id);
    
    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.VERIFY_UID, {
      uid: machine_id,
      uid_type: 'machine'
    });
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 기기 UID 검증 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 UID 검증에 실패했습니다.'
      }
    };
  }
};

// 오늘의 배출 스케줄 조회
export const getTodayDispenseSchedule = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 오늘의 배출 스케줄 조회:', machine_id);
    
    const response = await apiClient.post(API_ENDPOINTS.MACHINE.TODAY_SCHEDULE, {
      machine_id
    });
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 오늘의 배출 스케줄 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '오늘의 배출 스케줄 조회에 실패했습니다.'
      }
    };
  }
};

// 기기별 사용자 목록 조회
export const getUsersByMachine = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기별 사용자 목록 조회:', machine_id);
    
    const response = await apiClient.get(`${API_ENDPOINTS.MACHINE.USERS_BY_MACHINE}?machine_id=${machine_id}`);
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data || []
    };
  } catch (error: any) {
    console.error('❌ 기기별 사용자 목록 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기별 사용자 목록 조회에 실패했습니다.'
      }
    };
  }
};

// 날짜별 스케줄 조회
export const getSchedulesByDate = async (machine_id: string, date: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 날짜별 스케줄 조회:', { machine_id, date });
    
    const response = await apiClient.get(`${API_ENDPOINTS.MACHINE.SCHEDULES_BY_DATE}?machine_id=${machine_id}&date=${date}`);
    
    return {
      success: response.data.success || true,
      data: response.data.data || response.data || []
    };
  } catch (error: any) {
    console.error('❌ 날짜별 스케줄 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '날짜별 스케줄 조회에 실패했습니다.'
      }
    };
  }
}; 