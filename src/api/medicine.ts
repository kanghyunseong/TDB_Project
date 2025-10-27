import axios from 'axios';
import { API_URL, API_ENDPOINTS } from '../constants/api';
import { Medicine, ApiResponse, MedicineSearchResult, MedicineDetail, MedicineSchedule, User, DayOfWeek, TimeOfDay } from '../types/tdb';
import { DAYS, TIMES } from '../constants/schedule';
import { apiClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from './auth';
import { getCurrentUser } from './userStorage';
import medicineDataRaw from '../assets/medicine.json';

// 타입 export (다른 파일에서 사용하기 위해)
export type { Medicine, MedicineSearchResult, MedicineDetail, MedicineSchedule } from '../types/tdb';

// medicine.json 데이터를 배열로 캐스팅
const medicineData: any[] = medicineDataRaw as any[];

/**
 * 로컬 JSON 파일을 통한 의약품 검색
 */
export const searchMedicineByName = async (itemName: string): Promise<MedicineSearchResult[]> => {
  try {
    console.log(`🔍 [searchMedicineByName] 의약품 검색 시작: ${itemName}`);
    
    if (!Array.isArray(medicineData)) {
      console.error('🔥 [searchMedicineByName] medicine.json 데이터가 올바르지 않습니다.');
      return [];
    }

    // 대소문자 구분 없이 부분 일치로 검색
    const searchTerm = itemName.toLowerCase();
    const filteredResults = medicineData.filter((item: any) => {
      const medicineName = item['제품명 [ITEMNAME] '] || '';
      return medicineName.toLowerCase().includes(searchTerm);
    });

    console.log(`✅ [searchMedicineByName] 검색 완료: ${filteredResults.length}개 결과`);

    // 최대 20개 결과만 반환
    const limitedResults = filteredResults.slice(0, 20);

    return limitedResults.map((item: any) => ({
      itemSeq: item['품목일련번호 [ITEMSEQ] '] || '',
      itemName: item['제품명 [ITEMNAME] '] || '',
      entpName: item['업체명 [ENTPNAME] '] || '',
      efcyQesitm: item['문항1(효능효과) [EFCYQESITM] '] || '',
      useMethodQesitm: item['문항2(사용법) [USEMETHODQESITM] '] || '',
      atpnWarnQesitm: item['문항3(주의사항경고) [ATPNWARNQESITM] '] || '',
      atpnQesitm: item['문항4(주의사항) [ATPNQESITM] '] || '',
      intrcQesitm: item['문항5(상호작용) [INTRCQESITM] '] || '',
      seQesitm: item['문항6(부작용) [SEQESITM] '] || '',
      depositMethodQesitm: item['문항7(보관법) [DEPOSITMETHODQESITM] '] || '',
      packUnit: item['포장단위 [PACKUNIT] '] || '',
      warning: 0, // 서버와 일치: tinyint (기본값 0)
      medi_id: item['품목일련번호 [ITEMSEQ] '] || ''
    }));
  } catch (error: any) {
    console.error('🔥 [searchMedicineByName] 의약품 검색 실패:', error);
    return [];
  }
};

/**
 * 사용자별 약물 목록 조회 (그룹 기반)
 */
export const getMedicinesByUser = async (userId: string): Promise<ApiResponse<Medicine[]>> => {
  try {
    console.log(`🔍 [API] 사용자별 약물 조회 (그룹 기반): userId=${userId}`);
    
    // 🔥 query parameter 방식으로 통일 (서버에서 지원하는 형식)
    const response = await apiClient.get<ApiResponse<Medicine[]>>(
      `/api/medicine/list?connect=${userId}`
    );
    
    console.log(`🔍 [API] 사용자별 약물 조회 응답:`, response.data);
    
    // 표준화된 ApiResponse 형식인 경우
    const responseData = response.data;
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
      if (responseData.success && responseData.data) {
        return {
          success: true,
          data: responseData.data
        };
      } else {
        return {
          success: false,
          error: { message: responseData.error?.message || '사용자별 약물 조회에 실패했습니다.' }
        };
      }
    }
    
    // 직접 배열을 반환하는 경우 (하위 호환성)
    if (Array.isArray(responseData)) {
      console.log(`🔄 [API] 직접 배열 응답을 표준 형식으로 변환`);
      return {
        success: true,
        data: responseData
      };
    }
    
    return {
      success: false,
      error: { message: '응답 형식을 해석할 수 없습니다.' }
    };
  } catch (error: any) {
    console.error(`🔥 [API] 사용자별 약물 조회 에러:`, error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '서버와의 통신 오류' }
    };
  }
};

/**
 * 그룹 기반 약물 목록 조회 (connect → user_id 변경)
 */
export const getMedicineList = async (userId?: string): Promise<ApiResponse<Medicine[]>> => {
  try {
    let userIdToUse = userId;
    
    // user_id가 제공되지 않은 경우 현재 사용자의 ID 사용
    if (!userIdToUse) {
      const currentUser = await getCurrentUser();
      if (!currentUser?.user_id) {
        return {
          success: false,
          error: { message: '사용자 정보를 찾을 수 없습니다.' }
        };
      }
      userIdToUse = currentUser.user_id;
    }
    
    console.log(`🔍 [API] 그룹 기반 약물 조회: user_id=${userIdToUse}`);
    
    // 그룹 기반 약물 목록 조회 API
    const response = await apiClient.get<ApiResponse<Medicine[]>>(
      `/api/medicine/list?connect=${userIdToUse}`
    );
    
    console.log(`🔍 [API] 그룹 기반 약물 조회 응답:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error(`🔥 [API] 그룹 기반 약물 조회 에러:`, error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '서버와의 통신 오류' }
    };
  }
};

/**
 * 약물 저장 (신규/수정) - 그룹 기반
 */
export const saveMedicine = async (
  medicineData: Partial<Medicine> & { target_users?: string[] | null }
): Promise<ApiResponse<Medicine>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.group_id || !currentUser?.user_id) {
      return {
        success: false,
        error: { message: '사용자 정보를 찾을 수 없습니다.' }
      };
    }

    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    console.log(`🔍 [API] 약물 저장 요청 (그룹 기반):`, {
      group_id: currentUser.group_id,
      medicineData,
      requestUser: currentUser.user_id
    });

    // 🔥 API_ENDPOINTS 사용
    const endpoint = `${API_URL}${API_ENDPOINTS.MEDICINE.ADD}`;
    const response = await axios.post<ApiResponse<Medicine>>(endpoint, {
      ...medicineData,
      group_id: currentUser.group_id,
      target_users: medicineData.target_users,
      type: 'medicine'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`🔍 [API] 약물 저장 응답:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('약물 저장 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '약물 저장에 실패했습니다.' }
    };
  }
};

/**
 * 약물 삭제 - 그룹 기반
 */
export const deleteMedicine = async (connect: string, medi_id: string): Promise<ApiResponse<void>> => {
  try {
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    console.log(`🔍 [API] 약물 삭제 요청:`, { connect, medi_id });

    // 🔥 API_ENDPOINTS 사용
    const response = await axios.delete<ApiResponse<void>>(
      `${API_URL}${API_ENDPOINTS.MEDICINE.DELETE(connect, medi_id)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`🔍 [API] 약물 삭제 응답:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('약물 삭제 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '약물 삭제에 실패했습니다.' }
    };
  }
};

/**
 * V3 스케줄 저장: 요일×시간별 개별 복용량 지원 (매트릭스 뷰용)
 */
export const saveMedicineScheduleV3 = async (
  medicineId: string,
  memberId: string,
  matrixSchedule: Record<DayOfWeek, Record<TimeOfDay, { enabled: boolean; dose: number }>>,
  totalQuantity?: string,
  requestUserId?: string  // 🔥 요청자 정보 추가
): Promise<ApiResponse<any>> => {
  try {
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    // 매트릭스 데이터를 개별 스케줄 항목으로 변환
    const scheduleItems = [];
    
    for (const day of DAYS) {
      for (const time of TIMES) {
        const cellData = matrixSchedule[day]?.[time];
        if (cellData?.enabled && cellData.dose > 0) {
          scheduleItems.push({
            day_of_week: day,
            time_of_day: time,
            dose_count: cellData.dose,
            enabled: true
          });
        }
      }
    }

    console.log(`🔥 [API V3] 매트릭스 스케줄 저장: ${medicineId}/${memberId}`, {
      totalItems: scheduleItems.length,
      scheduleItems
    });

    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.SCHEDULE.SAVE}/${medicineId}/${memberId}`,
      {
        schedule_items: scheduleItems,
        total_quantity: totalQuantity || '1',
        version: 'v3',
        matrix_enabled: true,
        request_user_id: requestUserId  // 🔥 요청자 정보 전달
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log(`✅ [API V3] 매트릭스 스케줄 저장 완료:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error('🔥 [API V3] 매트릭스 스케줄 저장 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '스케줄 저장에 실패했습니다.' }
    };
  }
};

/**
 * 약물 스케줄 저장 (개선된 버전)
 */
export const saveMedicineScheduleV2 = async (
  medicineId: string,
  memberId: string,
  schedule: Record<DayOfWeek, Record<TimeOfDay, boolean>>,
  totalQuantity?: string,
  timeDoses?: {
    morningDose?: number;
    afternoonDose?: number;
    eveningDose?: number;
  }
): Promise<ApiResponse<any>> => {
  try {
    // 현재 로그인된 사용자 정보 가져오기
    const userJson = await AsyncStorage.getItem('@user');
    const currentUser = userJson ? JSON.parse(userJson) : null;
    const requestUserId = currentUser ? currentUser.user_id : null;
    
    console.log('🔥 saveMedicineScheduleV2 호출:', {
      medicineId,
      memberId,
      totalQuantity,
      timeDoses,
      requestUserId,
      isManagingOthers: requestUserId !== memberId
    });
    
    // 체크된 값만 배열로 변환
    const scheduleArr: { day_of_week: DayOfWeek; time_of_day: TimeOfDay; dose: number }[] = [];
    DAYS.forEach(day => {
      TIMES.forEach(time => {
        if (schedule[day as DayOfWeek][time as TimeOfDay]) {
          // 시간대별 복용량 적용
          let dose = 1; // 기본값
          if (timeDoses) {
            if (time === 'morning' && timeDoses.morningDose) {
              dose = timeDoses.morningDose;
            } else if (time === 'afternoon' && timeDoses.afternoonDose) {
              dose = timeDoses.afternoonDose;
            } else if (time === 'evening' && timeDoses.eveningDose) {
              dose = timeDoses.eveningDose;
            }
          }
          
          scheduleArr.push({
            day_of_week: day as DayOfWeek,
            time_of_day: time as TimeOfDay,
            dose: dose
          });
        }
      });
    });

    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    // 백엔드로 저장 요청
    const response = await axios.post<ApiResponse<any>>(
      `${API_URL}${API_ENDPOINTS.SCHEDULE.SAVE}/${medicineId}`,
      {
        memberId,
        schedule: scheduleArr,
        totalQuantity,
        morningDose: timeDoses?.morningDose,
        afternoonDose: timeDoses?.afternoonDose,
        eveningDose: timeDoses?.eveningDose,
        requestUserId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('스케줄 저장 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '스케줄 저장에 실패했습니다.' }
    };
  }
};

/**
 * 약물 스케줄 조회
 */
export const getMedicineSchedule = async (
  medicineId: string, 
  memberId: string
): Promise<ApiResponse<any[]>> => {
  try {
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    const response = await apiClient.get<ApiResponse<any[]>>(
      `${API_ENDPOINTS.SCHEDULE.LIST}/${medicineId}?memberId=${memberId}`
    );
    
    return response.data;
  } catch (error: any) {
    // 404 에러는 스케줄이 없는 정상적인 상황으로 처리
    if (error?.response?.status === 404) {
      console.log(`📝 스케줄이 없는 약입니다: medicineId=${medicineId}, memberId=${memberId}`);
      return {
        success: true,
        data: [] // 빈 배열 반환
      };
    }
    
    console.error('스케줄 조회 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '스케줄 조회에 실패했습니다.' }
    };
  }
};

/**
 * 약물 스케줄 삭제
 */
export const deleteMedicineSchedule = async (
  medicineId: string, 
  memberId: string
): Promise<ApiResponse<void>> => {
  try {
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    const response = await axios.delete<ApiResponse<void>>(
      `${API_URL}${API_ENDPOINTS.SCHEDULE.DELETE}/${medicineId}/${memberId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('스케줄 삭제 에러:', error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '스케줄 삭제에 실패했습니다.' }
    };
  }
};

/**
 * 현재 복용량 조회
 */
export const getCurrentDose = async (
  medicineId: string, 
  userId: string
): Promise<ApiResponse<any>> => {
  try {
    console.log(`🔍 [API] 현재 복용량 조회: medicineId=${medicineId}, userId=${userId}`);
    
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    const response = await axios.get<ApiResponse<any>>(
      `${API_URL}${API_ENDPOINTS.SCHEDULE.CURRENT_DOSE}/${medicineId}/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`🔍 [API] 현재 복용량 응답:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error(`🔥 [API] 현재 복용량 조회 에러:`, error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '현재 복용량 조회에 실패했습니다.' }
    };
  }
};

/**
 * 하루 스케줄 조회
 */
export const getDailySchedule = async (
  medicineId: string, 
  userId: string, 
  date?: string
): Promise<ApiResponse<any>> => {
  try {
    console.log(`🔍 [API] 하루 스케줄 조회: medicineId=${medicineId}, userId=${userId}, date=${date}`);
    
    const token = await getToken();
    if (!token) {
      return {
        success: false,
        error: { message: '인증 토큰이 없습니다.' }
      };
    }

    const url = `${API_URL}${API_ENDPOINTS.SCHEDULE.DAILY_SCHEDULE}/${medicineId}/${userId}${date ? `?date=${date}` : ''}`;
    const response = await axios.get<ApiResponse<any>>(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`🔍 [API] 하루 스케줄 응답:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error(`🔥 [API] 하루 스케줄 조회 에러:`, error);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '하루 스케줄 조회에 실패했습니다.' }
    };
  }
};

/**
 * 약물 상세 정보 조회
 */
export const getMedicineDetails = async (medicineId: string): Promise<ApiResponse<MedicineDetail> & { isNotFound?: boolean }> => {
  try {
    console.log(`🔍 [getMedicineDetails] 약물 상세정보 조회 시작: ${medicineId}`);
    
    // 현재 사용자 정보 가져오기
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.user_id) {
      return {
        success: false,
        error: { message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.' }
      };
    }

    const url = API_ENDPOINTS.MEDICINE.DETAIL(medicineId);
    console.log(`🔍 [getMedicineDetails] API 요청 URL: ${url}?connect=${currentUser.user_id}`);

    // 🔥 connect 파라미터를 추가하여 사용자 정보 포함
    const response = await apiClient.get<ApiResponse<MedicineDetail>>(url, {
      params: {
        connect: currentUser.user_id
      },
      timeout: 10000, // 10초 타임아웃 설정
    });
    
    console.log(`✅ [getMedicineDetails] 성공적으로 상세정보 조회 완료`);
    return response.data;
  } catch (error: any) {
    console.log(`❌ [getMedicineDetails] 에러 발생:`);
    console.log(`  medicineId: ${medicineId}`);
    console.log(`  error.response?.status: ${error?.response?.status}`);
    console.log(`  error.response?.data: ${JSON.stringify(error?.response?.data)}`);
    console.log(`  error.message: ${error?.message}`);
    console.log(`  error 전체:`, error);
    
    // 🔥 네트워크 에러 특별 처리
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      console.error('🌐 [getMedicineDetails] 네트워크 연결 문제로 상세정보 조회에 실패했습니다.');
      return {
        success: false,
        error: { message: '네트워크 연결 문제로 약물 상세정보를 조회할 수 없습니다. 인터넷 연결을 확인해 주세요.' }
      };
    }
    
    // 🔥 404 에러인 경우 특별 처리
    if (error?.response?.status === 404) {
      console.log('💡 [getMedicineDetails] 404 에러 - 해당 약품의 상세정보가 제공되지 않음');
      return {
        success: false,
        isNotFound: true, // 404임을 명시적으로 표시
        error: { message: '해당 약품의 상세정보는 현재 제공되지 않습니다.' }
      };
    }
    
    // 🔥 권한 에러 처리
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      console.log('🔒 [getMedicineDetails] 권한 에러 - 접근 권한이 없음');
      return {
        success: false,
        error: { message: '약물 상세정보에 접근할 권한이 없습니다.' }
      };
    }
    
    // 다른 에러들
    console.error('🔥 [getMedicineDetails] 예상치 못한 에러:', error?.response?.data?.message || error?.message);
    return {
      success: false,
      error: { message: error?.response?.data?.message || error?.message || '약물 상세 정보 조회에 실패했습니다.' }
    };
  }
};

// 기존 함수들 (하위 호환성 유지)
export const getMedicines = getMedicinesByUser;
export const addMedicine = saveMedicine;
export const updateMedicine = saveMedicine;
export const saveMedicineSchedule = saveMedicineScheduleV2;
export const getMedicineById = getMedicineDetails;