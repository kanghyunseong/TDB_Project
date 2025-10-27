import { apiClient } from './client';
import { API_ENDPOINTS, API_URL } from '../constants/api';
import { getCurrentUser } from './userStorage';
import Toast from 'react-native-toast-message';
import { FamilyMember as TDBFamilyMember, Medicine, MedicineSchedule, NutritionalSupplement, SupplementSchedule, DayOfWeek, TimeOfDay, Schedule, NewMedicine } from '../types/tdb';
import axios from 'axios';
import { User, ApiResponse } from '../types';
import { getToken } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_KEY } from '../utils/storage';
import { DISPENSER_CONFIG } from '../constants/dispenser';

export type FamilyMember = TDBFamilyMember;

// 필요하다면 확장 타입만 별도 선언
export type UIMedicine = Medicine & {
  memberName: string;
  memberType: 'parent' | 'child';
  schedule: string;
};

export type UISupplement = NutritionalSupplement & {
  memberName: string;
  memberType: 'parent' | 'child';
  schedule: string;
};

// API 에러 처리 함수
const handleApiError = <T>(error: unknown, defaultMessage: string): T | null => {
  if (error instanceof Error) {
    const errorMessage = error.message;
    if (errorMessage.includes('404')) {
      // 404 에러는 데이터가 없는 정상적인 상황이므로 조용히 처리
      console.log('데이터가 없습니다 (404):', defaultMessage);
      return null;
    } else {
      Toast.show({ type: 'error', text1: errorMessage });
    }
  } else {
    Toast.show({ type: 'error', text1: defaultMessage });
  }
  return null;
};

// 가족 구성원 목록 조회 (그룹 기반)
export const getFamilyMembers = async (): Promise<ApiResponse<FamilyMember[]>> => {
  try {
    console.log('🔍 [getFamilyMembers] 가족 구성원 조회 시작 (그룹 기반)');
    
    const userData = await getCurrentUser();
    console.log('🔍 [getFamilyMembers] getCurrentUser 결과:', userData);

    if (!userData?.user_id || !userData?.group_id) {
      console.log('❌ [getFamilyMembers] 사용자 ID 또는 그룹 ID가 없습니다. userData:', userData);
      return {
        success: false,
        error: {
          message: '사용자 정보가 없습니다.'
        }
      };
    }

    const token = await getToken();
    console.log('🔍 [getFamilyMembers] 토큰 확인:', token ? '존재함' : '없음');
    if (!token) {
      return {
        success: false,
        error: {
          message: '인증 토큰이 없습니다. 다시 로그인해주세요.'
        }
      };
    }

    // 새로운 그룹 기반 API 엔드포인트 사용
    const requestUrl = `${API_URL}${API_ENDPOINTS.FAMILY.MEMBERS}?group_id=${userData.group_id}`;
    console.log('🔍 [getFamilyMembers] API 요청 URL (그룹 기반):', requestUrl);
    
    const response = await axios.get<{ success: boolean; data: FamilyMember[] }>(
      requestUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('🔍 [getFamilyMembers] API 응답 상태:', response.status);
    console.log('🔍 [getFamilyMembers] API 응답 데이터:', response.data);

    if (!response.data) {
      return {
        success: false,
        error: {
          message: '서버 응답이 없습니다.'
        }
      };
    }

    // integrated-server는 { success: true, data: [...] } 형식으로 응답
    if (!response.data.success || !response.data.data) {
      return {
        success: false,
        error: {
          message: response.data.success === false ? '가족 구성원 조회 실패' : '응답 데이터가 없습니다.'
        }
      };
    }

    const familyMembers = response.data.data;
    
    return {
      success: true,
      data: familyMembers
    };
  } catch (error: any) {
    console.error('가족 구성원 조회 에러:', error);
    console.error('에러 상세정보:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
      headers: error.config?.headers
    });

    // 401 에러 처리
    if (error.response?.status === 401) {
      return {
        success: false,
        error: {
          message: '인증이 만료되었습니다. 다시 로그인해주세요.'
        }
      };
    }

    // 400 에러 처리 (그룹 정보 없음)
    if (error.response?.status === 400) {
      return {
        success: false,
        error: {
          message: '그룹 정보가 설정되지 않았습니다. 설정을 확인해주세요.'
        }
      };
    }

    // 404 에러 처리
    if (error.response?.status === 404) {
      return {
        success: false,
        error: {
          message: '가족 구성원 정보를 찾을 수 없습니다. 가족 설정을 확인해주세요.'
        }
      };
    }

    // 기타 HTTP 에러 처리
    if (error.response?.status) {
      return {
        success: false,
        error: {
          message: `서버 오류 (${error.response.status}): ${error.response?.data?.message || error.message}`
        }
      };
    }

    // 네트워크 에러 등
    return {
      success: false,
      error: {
        message: error.message || '가족 구성원 조회에 실패했습니다.'
      }
    };
  }
};

// 특정 사용자의 약 목록 조회 (그룹 기반)
export const getMedicineList = async (userId: string): Promise<ApiResponse<Medicine[]>> => {
  try {
    console.log('🔍 [API] 약 목록 조회 시작 (그룹 기반):', userId);
    
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: {
          message: '인증 토큰이 없습니다.'
        }
      };
    }

    // 🔥 서버에서 지원하는 query parameter 방식으로 통일
    const apiUrl = `${API_URL}/api/medicine/list?connect=${userId}`;
    console.log('🔍 [API] 요청 URL (그룹 기반):', apiUrl);

    const response = await axios.get<{ success: boolean; data: Medicine[] }>(
      apiUrl,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('🔍 [API] 약 목록 응답:', response.data);

    if (!response.data.success) {
      return {
        success: false,
        error: {
          message: '약 목록 조회에 실패했습니다.'
        }
      };
    }

    return {
      success: true,
      data: response.data.data || []
    };
  } catch (error: any) {
    console.error('❌ [API] 약 목록 조회 에러:', error);
    
    if (error.response?.status === 404) {
      return {
        success: true,
        data: [] // 404는 빈 배열 반환
      };
    }

    return {
      success: false,
      error: {
        message: error.response?.data?.message || '약 목록 조회에 실패했습니다.'
      }
    };
  }
};

// 약 정보 저장 (추가/수정)
export const saveMedicine = async (
  memberId: string,
  medicineData: Medicine,
  medicineId?: string
): Promise<ApiResponse<Medicine>> => {
  try {
    console.log('=== 약 정보 저장 시작 ===');
    console.log('memberId:', memberId);
    console.log('medicineData 원본:', JSON.stringify(medicineData, null, 2));
    console.log('medicineId:', medicineId);
    console.log('medicineData.slot 타입:', typeof medicineData.slot);
    console.log('medicineData.slot 값:', medicineData.slot);
    
    // 사용자 정보 조회하여 machine_id 확인
    const user = await getCurrentUser();
    if (!user?.user_id) {
      throw new Error('사용자 정보가 없습니다.');
    }
    
    // 테스트 환경을 위해 machine_id 체크를 주석 처리
    // if (!user.machine_id) {
    //   throw new Error('디스펜서가 등록되어 있지 않습니다. 디스펜서를 먼저 등록해주세요.');
    // }
    console.log('사용자 정보 확인 완료:', user.user_id);

    // 기존 약 목록 조회하여 사용 중인 slot 확인
    const existingMedicinesResponse = await getMedicineList(memberId);
    const existingMedicines = existingMedicinesResponse.success ? existingMedicinesResponse.data || [] : [];

    // 사용자가 지정한 슬롯이 있으면 그것을 사용, 없으면 자동 할당
    const userSelectedSlot = medicineData.slot;
    const isValidUserSlot = userSelectedSlot && 
                           typeof userSelectedSlot === 'number' && 
                           userSelectedSlot >= 1 && 
                           userSelectedSlot <= DISPENSER_CONFIG.MAX_SLOTS;
    
    if (!isValidUserSlot) {
      console.log('슬롯이 지정되지 않음 또는 유효하지 않음, 자동 할당 시작:', userSelectedSlot);
      // 사용 중인 slot 번호 목록
      const usedSlots = existingMedicines
        .filter(med => med.medi_id !== medicineData.medi_id) // 현재 수정 중인 약 제외
        .map(med => med.slot)
        .filter((slot): slot is number => slot !== undefined);

      // 1번부터 순차적으로 사용 가능한 slot 찾기
      let availableSlot = 1;
      while (usedSlots.includes(availableSlot) && availableSlot <= DISPENSER_CONFIG.MAX_SLOTS) {
        availableSlot++;
      }

      if (availableSlot > DISPENSER_CONFIG.MAX_SLOTS) {
        throw new Error(`사용 가능한 디스펜서 슬롯이 없습니다. (최대 ${DISPENSER_CONFIG.MAX_SLOTS}개)`);
      }

      // slot 자동 할당
      medicineData.slot = availableSlot;
      console.log('자동 할당된 슬롯:', availableSlot);
    } else {
      // 사용자가 선택한 슬롯이 이미 사용 중인지 확인
      const usedSlots = existingMedicines
        .filter(med => med.medi_id !== medicineData.medi_id) // 현재 수정 중인 약 제외
        .map(med => med.slot)
        .filter((slot): slot is number => slot !== undefined);
      
      if (usedSlots.includes(userSelectedSlot)) {
        throw new Error(`${userSelectedSlot}번 슬롯은 이미 사용 중입니다. 다른 슬롯을 선택해주세요.`);
      }
      
      console.log('사용자가 지정한 슬롯 사용:', userSelectedSlot);
    }

    // medicineId가 "new"이거나 없으면 POST (새로 추가), 실제 ID가 있으면 PUT (수정)
    const isNewMedicine = !medicineId || medicineId === 'new';
    const endpoint = isNewMedicine
      ? API_ENDPOINTS.MEDICINE.ADD // '/medicine' (POST)
      : API_ENDPOINTS.MEDICINE.UPDATE(medicineData.medi_id); // '/medicine/{medi_id}' (PUT)
    
    const method = isNewMedicine ? 'post' : 'put';
    console.log('약 정보 저장 요청:', { endpoint, method, data: medicineData, isNewMedicine, medicineId });
    
    // 서버에서 기대하는 데이터 형식으로 변환
    const requestData = {
      connect: memberId, // connect 필드 추가
      medi_id: medicineData.medi_id,
      name: medicineData.name,
      warning: medicineData.warning,
      start_date: medicineData.start_date,
      end_date: medicineData.end_date,
      slot: medicineData.slot, // 슬롯 정보 추가
      target_users: medicineData.target_users, // 🔥 누락된 target_users 필드 추가
    };
    
    const response = await apiClient[method]<ApiResponse<Medicine>>(endpoint, requestData);
    console.log('약 정보 저장 응답:', response.data);
    
    return {
      success: true,
      data: response.data.data
    };
  } catch (error: any) {
    console.error('약 정보 저장 에러:', error.response?.data || error.message);
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || '약 정보 저장에 실패했습니다.'
      }
    };
  }
};

// 약 스케줄 저장
export const saveMedicineSchedule = async (
  medi_id: string,
  user_id: string,
  schedule: Record<DayOfWeek, Record<TimeOfDay, boolean>>,
  totalQuantity?: string,
  doseCount?: string
): Promise<ApiResponse<MedicineSchedule>> => {
  try {
    console.log('🔥 saveMedicineSchedule 시작:', {
      medi_id,
      user_id,
      schedule,
      totalQuantity,
      doseCount
    });

    // 현재 로그인된 사용자 정보 가져오기
    const userJson = await AsyncStorage.getItem('@user');
    const currentUser = userJson ? JSON.parse(userJson) : null;
    const requestUserId = currentUser ? currentUser.user_id : null;

    // doseCount 안전하게 보정
    const safeDoseCount = doseCount && !isNaN(Number(doseCount)) && Number(doseCount) > 0 ? doseCount : '1';

    // 체크된 항목들을 배열로 변환 (서버가 기대하는 형식)
    const scheduleData = Object.entries(schedule).reduce((acc: any[], [day, times]: [string, Record<TimeOfDay, boolean>]) => {
      Object.entries(times).forEach(([time, checked]: [string, boolean]) => {
        if (checked) {
          acc.push({
            day_of_week: day,
            time_of_day: time,
            dose: Number(safeDoseCount) // 복용량을 숫자로 변환
          });
        }
      });
      return acc;
    }, []);

    console.log('🔍 변환된 스케줄 데이터:', scheduleData);

    const requestData = {
      memberId: user_id,
      schedule: scheduleData, // 배열 형태로 전달
      totalQuantity,
      doseCount: safeDoseCount,
      requestUserId // 실제 요청한 사용자 ID 추가
    };

    console.log('🔍 서버로 전송할 요청 데이터:', JSON.stringify(requestData, null, 2));
    const scheduleUrl = API_ENDPOINTS.MEDICINE.SCHEDULE(medi_id);
    console.log('🔍 요청 URL:', scheduleUrl);

    // 🔥 주의: family.ts에서는 apiClient 사용 (토큰 자동 처리)
    const response = await apiClient.post<ApiResponse<MedicineSchedule>>(scheduleUrl, requestData);

    console.log('✅ 스케줄 저장 성공:', response.data);

    return {
      success: true,
      data: response.data.data
    };
  } catch (error: any) {
    console.error('❌ saveMedicineSchedule error:', error);
    
    // 더 자세한 에러 로깅
    if (error?.response) {
      console.error('서버 응답 에러:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      });
    } else {
      console.error('네트워크 또는 기타 에러:', error.message);
    }
    
    return {
      success: false,
      error: {
        message: error?.response?.data?.message || error?.message || '약 스케줄 저장에 실패했습니다.'
      }
    };
  }
};

// 약 스케줄 조회
export const getMedicineSchedule = async (
  medi_id: string,
  user_id: string
): Promise<MedicineSchedule | null> => {
  try {
    console.log(`🔍 getMedicineSchedule 시작: medi_id=${medi_id}, user_id=${user_id}`);
    
    const response = await apiClient.get(API_ENDPOINTS.MEDICINE.SCHEDULE(medi_id), {
      params: { memberId: user_id }
    });

    console.log('🔍 스케줄 조회 원본 응답:', response.data);

    // 스케줄 데이터 변환
    const responseData = response.data?.data;
    if (!responseData) {
      console.log('📝 스케줄 데이터가 없어서 기본값 반환');
      return {
        medi_id,
        user_id,
        schedule: {
          mon: { morning: false, afternoon: false, evening: false },
          tue: { morning: false, afternoon: false, evening: false },
          wed: { morning: false, afternoon: false, evening: false },
          thu: { morning: false, afternoon: false, evening: false },
          fri: { morning: false, afternoon: false, evening: false },
          sat: { morning: false, afternoon: false, evening: false },
          sun: { morning: false, afternoon: false, evening: false }
        },
        totalQuantity: '',
        doseCount: '',
        slot: 1
      };
    }

    // 🔥 시간대별 복용량 처리
    let morningDose = 0, afternoonDose = 0, eveningDose = 0;
    let totalQuantity = '';
    let slot = 1;
    
    // 🔥 서버가 시간대별 복용량을 제공하는 경우 추출
    if (responseData.morningDose !== undefined) {
      morningDose = Number(responseData.morningDose) || 0;
    }
    if (responseData.afternoonDose !== undefined) {
      afternoonDose = Number(responseData.afternoonDose) || 0;
    }
    if (responseData.eveningDose !== undefined) {
      eveningDose = Number(responseData.eveningDose) || 0;
    }
    
    // 🔥 기존 정보 추출
    totalQuantity = responseData.totalQuantity || '';
    slot = responseData.slot || 1;
    
    // 🔥 하위 호환성을 위한 doseCount (가장 큰 복용량 사용)
    const doseCount = Math.max(morningDose, afternoonDose, eveningDose);
    
    console.log(`🔍 시간대별 복용량 추출:`, {
      morning: morningDose,
      afternoon: afternoonDose,
      evening: eveningDose,
      doseCount,
      totalQuantity,
      slot
    });

    // 객체 형태의 스케줄 데이터를 처리
    const schedule = responseData.schedule || {};
    console.log(`🔍 스케줄 객체:`, schedule);
    
    const result = {
      medi_id,
      user_id,
      schedule,
      totalQuantity,
      doseCount: doseCount.toString(),
      // 🔥 시간대별 복용량 추가
      morningDose,
      afternoonDose,
      eveningDose,
      slot
    };
    
    console.log('✅ 최종 변환된 스케줄:', result);
    
    return result;
  } catch (error: unknown) {
    // 🔥 타입 가드를 사용한 안전한 에러 처리
    const isAxiosError = (err: unknown): err is { 
      response?: { 
        status?: number; 
        data?: any; 
        statusText?: string; 
      }; 
      config?: { 
        url?: string; 
        method?: string; 
      } 
    } => {
      return typeof err === 'object' && err !== null && 'response' in err;
    };
    
    const getErrorMessage = (err: unknown): string => {
      if (isAxiosError(err)) {
        return err.response?.data?.message || `HTTP ${err.response?.status}`;
      }
      if (err instanceof Error) {
        return err.message;
      }
      return '알 수 없는 오류';
    };
    
    console.error('❌ getMedicineSchedule 에러:', error);
    
    // 404 에러는 스케줄이 없는 정상적인 상황으로 처리
    if (isAxiosError(error) && error.response?.status === 404) {
      console.log('📝 스케줄이 없는 약입니다 (404):', medi_id);
      return {
        medi_id,
        user_id,
        schedule: {
          mon: { morning: false, afternoon: false, evening: false },
          tue: { morning: false, afternoon: false, evening: false },
          wed: { morning: false, afternoon: false, evening: false },
          thu: { morning: false, afternoon: false, evening: false },
          fri: { morning: false, afternoon: false, evening: false },
          sat: { morning: false, afternoon: false, evening: false },
          sun: { morning: false, afternoon: false, evening: false }
        },
        totalQuantity: '',
        doseCount: '',
        slot: 1
      };
    }
    
    // 다른 에러들은 로그만 출력하고 null 반환
    if (isAxiosError(error)) {
      console.error('서버 응답 에러:', {
        status: error.response?.status,
        statusText: error.response?.statusText || 'Unknown',
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
    } else {
      console.error('기타 에러:', getErrorMessage(error));
    }
    
    // 🔥 중요: 404가 아닌 에러의 경우에도 null 대신 기본값 반환하여 UI 안정성 확보
    console.log('❌ 에러로 인해 기본 스케줄 반환');
    return {
      medi_id,
      user_id,
      schedule: {
        mon: { morning: false, afternoon: false, evening: false },
        tue: { morning: false, afternoon: false, evening: false },
        wed: { morning: false, afternoon: false, evening: false },
        thu: { morning: false, afternoon: false, evening: false },
        fri: { morning: false, afternoon: false, evening: false },
        sat: { morning: false, afternoon: false, evening: false },
        sun: { morning: false, afternoon: false, evening: false }
      },
      totalQuantity: '',
      doseCount: '',
      slot: 1
    };
  }
};

// 가족 구성원 추가
export const addFamilyMember = async (memberData: Omit<FamilyMember, 'id'>): Promise<ApiResponse<FamilyMember>> => {
  try {
    const response = await apiClient.post<ApiResponse<FamilyMember>>(API_ENDPOINTS.FAMILY.ADD_MEMBER, memberData);
    return {
      success: true,
      data: response.data.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || '가족 구성원 추가에 실패했습니다.'
      }
    };
  }
};

// 가족 구성원 정보 수정
export const updateFamilyMember = async (
  memberId: string,
  memberData: Partial<FamilyMember>
): Promise<ApiResponse<FamilyMember>> => {
  try {
    const memberUrl = API_ENDPOINTS.FAMILY.MEMBER(memberId);
    const response = await apiClient.put<ApiResponse<FamilyMember>>(
      memberUrl,
      memberData
    );
    return {
      success: true,
      data: response.data.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || '가족 구성원 정보 수정에 실패했습니다.'
      }
    };
  }
};

// 가족 구성원 삭제
export const deleteFamilyMember = async (memberId: string): Promise<ApiResponse<void>> => {
  try {
    const deleteUrl = API_ENDPOINTS.FAMILY.DELETE_MEMBER(memberId);
    await apiClient.delete(deleteUrl);
    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || '가족 구성원 삭제에 실패했습니다.'
      }
    };
  }
};

// 약 정보 삭제
export const deleteMedicine = async (memberId: string, medicineId: string): Promise<boolean> => {
  try {
    if (!memberId || !medicineId) {
      console.error('memberId 또는 medicineId가 없습니다.');
      Toast.show({
        type: 'error',
        text1: '약 삭제 실패',
        text2: '필수 정보가 누락되었습니다.',
      });
      return false;
    }
    
    console.log(`🔍 삭제 API 호출: memberId=${memberId}, medicineId=${medicineId}`);
    
    // 🔥 업데이트된 삭제 API: connect와 medicineId 파라미터 사용
    const response = await apiClient.delete(`${API_URL}${API_ENDPOINTS.MEDICINE.DELETE(memberId, medicineId)}`);
    
    console.log(`✅ 약 삭제 성공: ${medicineId}`, response.data);
    
    // 성공 메시지 표시
    Toast.show({
      type: 'success',
      text1: '약 삭제 완료',
      text2: '약이 성공적으로 삭제되었습니다.',
    });
    
    return true;
  } catch (error: any) {
    console.error('약 삭제 실패:', error);
    
    // 🔥 404 에러는 이미 삭제된 것으로 간주하고 성공 처리
    if (error?.response?.status === 404) {
      console.log(`✅ 약이 이미 삭제되었거나 존재하지 않습니다: ${medicineId}`);
      Toast.show({
        type: 'info',
        text1: '약 삭제 완료',
        text2: '약이 이미 삭제되었습니다.',
      });
      return true;
    }
    
    // 🔥 500 에러에 대한 구체적인 처리
    if (error?.response?.status === 500) {
      console.error(`🔥 서버 내부 오류로 약 삭제 실패: ${medicineId}`);
      Toast.show({
        type: 'error',
        text1: '서버 오류',
        text2: '서버에서 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
      return false;
    }
    
    // 더 자세한 에러 정보 로그
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('서버 응답 에러:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      
      // 서버에서 제공하는 구체적인 에러 메시지 사용
      const serverMessage = error.response?.data?.message || error.response?.data?.error;
      if (serverMessage) {
        Toast.show({
          type: 'error',
          text1: '약 삭제 실패',
          text2: serverMessage,
        });
        return false;
      }
    }
    
    // 기본 에러 처리
    Toast.show({
      type: 'error',
      text1: '약 삭제 실패',
      text2: '약 삭제 중 오류가 발생했습니다.',
    });
    
    return false;
  }
};

export const updateMedicineQuantity = async (medicineId: string, memberId: string, doseCount: number) => {
  try {
    const response = await apiClient.put(`${API_ENDPOINTS.MEDICINE.UPDATE_QUANTITY}/${medicineId}/quantity`, {
      memberId,
      doseCount
    });
    return response.data;
  } catch (error) {
    console.error('복용량 업데이트 실패:', error);
    throw error;
  }
};

// 영양제 목록 조회
export const getSupplementList = async (memberId: string): Promise<NutritionalSupplement[] | null> => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.SUPPLEMENT.LIST(memberId)}`);
    return response.data.data;
  } catch (error) {
    return handleApiError(error, '영양제 목록 조회 실패') as NutritionalSupplement[] | null;
  }
};

// 영양제 정보 저장 (추가/수정)
export const saveSupplement = async (
  memberId: string,
  supplementData: Omit<NutritionalSupplement, 'id'>,
  supplementId?: string
): Promise<NutritionalSupplement | null> => {
  try {
    console.log('🔥 [saveSupplement] 파라미터 체크:', { memberId, supplementId, memberName: supplementData.memberName });
    
    if (!memberId || memberId === 'undefined') {
      throw new Error('유효하지 않은 memberId입니다.');
    }
    
    const endpoint = supplementId === 'new' 
      ? `${API_ENDPOINTS.SUPPLEMENT.SAVE}/${memberId}`
      : `${API_ENDPOINTS.SUPPLEMENT.SAVE}/${memberId}/${supplementId}`;
    
    // 🔥 서버가 기대하는 데이터 형식으로 변환
    const requestData = {
      name: supplementData.name,
      manufacturer: supplementData.manufacturer,
      ingredients: supplementData.ingredients,
      primaryFunction: supplementData.primaryFunction,
      intakeMethod: supplementData.intakeMethod,
      precautions: supplementData.precautions,
      startDate: supplementData.startDate,
      endDate: supplementData.endDate,
      memberName: supplementData.memberName,
      memberType: supplementData.memberType,
      target_users: supplementData.target_users,
    };
    
    console.log('영양제 저장 요청:', { endpoint, data: requestData });
    
    const method = supplementId === 'new' ? 'post' : 'put';
    const response = await apiClient[method](endpoint, requestData);
    
    console.log('영양제 저장 응답:', response.data);
    
    // 🔥 서버 응답이 성공인 경우 저장된 데이터 반환
    if (response.data) {
      return {
        ...supplementData,
        id: response.data.medi_id || `supplement_${Date.now()}`,
      } as NutritionalSupplement;
    }
    
    return null;
  } catch (error) {
    console.error('영양제 저장 에러:', error);
    return handleApiError(error, '영양제 정보 저장 실패') as NutritionalSupplement | null;
  }
};

// 영양제 스케줄 저장
export const saveSupplementSchedule = async (
  supplementId: string,
  memberId: string,
  schedule: SupplementSchedule['schedule'],
  totalQuantity?: string,
  doseCount?: string
): Promise<SupplementSchedule | null> => {
  try {
    const response = await apiClient.post(`${API_ENDPOINTS.SUPPLEMENT.SCHEDULE}/${supplementId}`, {
      memberId,
      schedule,
      ...(totalQuantity !== undefined ? { totalQuantity } : {}),
      ...(doseCount !== undefined ? { doseCount } : {}),
    });
    console.log('saveSupplementSchedule response:', response.data);
    return response.data.data;
  } catch (error) {
    const err = error as any;
    console.error('saveSupplementSchedule error:', err, err?.response, err?.response?.data, err?.message);
    return handleApiError(error, '영양제 스케줄 저장 실패') as SupplementSchedule | null;
  }
};

// 영양제 스케줄 조회
export const getSupplementSchedule = async (
  supplementId: string,
  memberId: string
): Promise<SupplementSchedule | null> => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.SUPPLEMENT.SCHEDULE}/${supplementId}`, {
      params: { memberId }
    });
    return response.data.data;
  } catch (error) {
    return handleApiError(error, '영양제 스케줄 조회 실패') as SupplementSchedule | null;
  }
};

// 영양제 정보 삭제
export const deleteSupplement = async (memberId: string, supplementId: string): Promise<boolean> => {
  try {
    await apiClient.delete(`${API_ENDPOINTS.SUPPLEMENT.SAVE}/${memberId}/${supplementId}`);
    // 삭제 성공 토스트 메시지 추가
    Toast.show({
      type: 'success',
      text1: '영양제가 삭제되었습니다.',
      text2: '목록에서 제거되었습니다.',
    });
    return true;
  } catch (error) {
    return handleApiError(error, '영양제 정보 삭제 실패') === null;
  }
};

// 영양제 수량 업데이트
export const updateSupplementQuantity = async (supplementId: string, memberId: string, doseCount: number) => {
  try {
    const response = await apiClient.put(`${API_ENDPOINTS.SUPPLEMENT.UPDATE_QUANTITY}/${supplementId}/quantity`, {
      memberId,
      doseCount
    });
    return response.data;
  } catch (error) {
    console.error('영양제 복용량 업데이트 실패:', error);
    throw error;
  }
};

export const deleteMedicineSchedule = async (medi_id: string, user_id: string) => {
  try {
    const response = await apiClient.delete(`${API_ENDPOINTS.MEDICINE.DELETE_SCHEDULE(medi_id, user_id)}`);
    return response.data;
  } catch (error: any) {
    console.error('약 스케줄 삭제 에러:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteSupplementSchedule = async (supplementId: string, memberId: string) => {
  try {
    const response = await apiClient.delete(`${API_ENDPOINTS.SUPPLEMENT.DELETE_SCHEDULE(supplementId, memberId)}`);
    return response.data;
  } catch (error: any) {
    console.error('영양제 스케줄 삭제 에러:', error.response?.data || error.message);
    throw error;
  }
};

// 가족 API 모듈
export const familyApi = {
  // 가족 구성원 목록 조회
  getMembers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.FAMILY.MEMBERS);
      return response.data;
    } catch (error) {
      const data = handleApiError<User[]>(error, '가족 구성원 조회 실패');
      return { 
        success: false,
        error: {
          message: '가족 구성원 조회 실패',
          status: data === null ? 404 : 500
        }
      };
    }
  },

  // 가족 구성원 조회
  getMember: async (userId: string): Promise<ApiResponse<User | null>> => {
    try {
      const memberUrl = API_ENDPOINTS.FAMILY.MEMBER(userId);
      const response = await apiClient.get(memberUrl);
      return response.data;
    } catch (error) {
      const data = handleApiError<User>(error, '가족 구성원 조회 실패');
      return { 
        success: false,
        error: {
          message: '가족 구성원 조회 실패',
          status: data === null ? 404 : 500
        }
      };
    }
  },

  // 가족 구성원 추가
  addMember: async (userData: Omit<User, 'user_id'>): Promise<ApiResponse<User | null>> => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.FAMILY.ADD_MEMBER, userData);
      return response.data;
    } catch (error) {
      const data = handleApiError<User>(error, '가족 구성원 추가 실패');
      return { 
        success: false,
        error: {
          message: '가족 구성원 추가 실패',
          status: data === null ? 404 : 500
        }
      };
    }
  },

  // 가족 구성원 수정
  updateMember: async (userId: string, userData: Partial<User>): Promise<ApiResponse<User | null>> => {
    try {
      const memberUrl = API_ENDPOINTS.FAMILY.MEMBER(userId);
      const response = await apiClient.put(memberUrl, userData);
      return response.data;
    } catch (error) {
      const data = handleApiError<User>(error, '가족 구성원 수정 실패');
      return { 
        success: false,
        error: {
          message: '가족 구성원 수정 실패',
          status: data === null ? 404 : 500
        }
      };
    }
  },

  // 가족 구성원 삭제
  deleteMember: async (userId: string): Promise<ApiResponse<void>> => {
    try {
      const deleteUrl = API_ENDPOINTS.FAMILY.DELETE_MEMBER(userId);
      const response = await apiClient.delete(deleteUrl);
      return response.data;
    } catch (error) {
      handleApiError<void>(error, '가족 구성원 삭제 실패');
      return { 
        success: false,
        error: {
          message: '가족 구성원 삭제 실패',
          status: 500
        }
      };
    }
  },
}; 