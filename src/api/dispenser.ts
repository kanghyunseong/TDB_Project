import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { ApiResponse } from '../types/tdb';

// 🔥 RFID 자동배출 - 메인 기능
// RFID 태그 인식 시 자동으로 오늘의 스케줄에 따라 약 배출
export const rfidAutoDispense = async (
  k_uid: string,
  machine_id: string
): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 RFID 자동배출 요청:', { k_uid, machine_id });

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.RFID_AUTO_DISPENSE, {
      k_uid,
      machine_id
    });

    console.log('📥 RFID 자동배출 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ RFID 자동배출 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || 'RFID 자동배출에 실패했습니다.'
      }
    };
  }
};

// 스케줄 기반 수동배출 (앱에서 버튼 클릭 시)
export const scheduleDispense = async (
  machine_id: string,
  userId: string,
  medicineId: string,
  slot: number,
  quantity: number = 1,
  reason?: string
): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 스케줄 기반 수동배출 요청 (앱 버튼):', {
      machine_id,
      userId,
      medicineId,
      slot,
      quantity,
      reason
    });

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.SCHEDULE_DISPENSE, {
      machine_id,
      userId,
      medicineId,
      slot,
      quantity,
      reason
    });

    console.log('📥 스케줄 기반 수동배출 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 스케줄 기반 수동배출 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '스케줄 기반 수동배출에 실패했습니다.'
      }
    };
  }
};

// UID 검증 (QR 스캔 시 사용)
export const verifyUID = async (uid: string, uid_type: 'kit' | 'machine'): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 UID 검증 요청:', { uid, uid_type });

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.VERIFY_UID, {
      uid,
      uid_type
    });

    console.log('📥 UID 검증 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ UID 검증 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || 'UID 검증에 실패했습니다.'
      }
    };
  }
};

// 배출 목록 조회 (k_uid 기반)
export const getDispenseList = async (k_uid: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 배출 목록 조회:', k_uid);

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.DISPENSE_LIST, {
      k_uid
    });

    console.log('📥 배출 목록 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 배출 목록 조회 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '배출 목록 조회에 실패했습니다.'
      }
    };
  }
};

// 배출 결과 전송
export const sendDispenseResult = async (resultData: {
  machine_id: string;
  k_uid: string;
  medi_id: string;
  slot_number: number;
  success: boolean;
  quantity_dispensed: number;
  error_message?: string;
  timestamp: string;
}): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 배출 결과 전송:', resultData);

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.DISPENSE_RESULT, resultData);

    console.log('📥 배출 결과 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 배출 결과 전송 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '배출 결과 전송에 실패했습니다.'
      }
    };
  }
};

// 복용 완료 확인
export const confirmTaken = async (uid: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 복용 완료 확인:', uid);

    const response = await apiClient.post(API_ENDPOINTS.DISPENSER.CONFIRM, {
      uid
    });

    console.log('📥 복용 완료 응답:', response.data);

    return {
      success: response.data.success || true,
      data: response.data.data || response.data
    };
  } catch (error: any) {
    console.error('❌ 복용 완료 확인 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '복용 완료 확인에 실패했습니다.'
      }
    };
  }
};

// 기기 상태 조회
export const getMachineStatus = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기 상태 조회:', machine_id);

    const response = await apiClient.get(API_ENDPOINTS.DISPENSER.MACHINE_STATUS(machine_id));

    console.log('📥 기기 상태 응답:', response.data);

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

// 기기 연결 테스트
export const testMachineConnection = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    console.log('📤 기기 연결 테스트:', machine_id);

    // 기기 상태 조회를 통해 연결 상태 확인
    const response = await getMachineStatus(machine_id);
    
    if (response.success) {
      return {
        success: true,
        data: {
          machine_id,
          connected: true,
          last_check: new Date().toISOString(),
          status: response.data
        }
      };
    }

    return {
      success: false,
      error: {
        message: '기기에 연결할 수 없습니다.'
      }
    };
  } catch (error: any) {
    console.error('❌ 기기 연결 테스트 실패:', error);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || '기기 연결 테스트에 실패했습니다.'
      }
    };
  }
};


// 🔥 슬롯 디버깅 API
export const debugSlots = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get(`/api/dispenser/debug/slots/${machine_id}`);
    return response.data;
  } catch (error) {
    console.error('슬롯 디버깅 API 오류:', error);
    return {
      success: false,
      error: (error as any)?.response?.data?.message || '슬롯 디버깅에 실패했습니다.'
    };
  }
};

// 🔥 데이터베이스 상태 디버깅 API
export const debugDatabase = async (machine_id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get(`/api/dispenser/debug/database/${machine_id}`);
    return response.data;
  } catch (error) {
    console.error('데이터베이스 디버깅 API 오류:', error);
    return {
      success: false,
      error: (error as any)?.response?.data?.message || '데이터베이스 디버깅에 실패했습니다.'
    };
  }
}; 