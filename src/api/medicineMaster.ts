import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { ApiResponse } from '../types/tdb';

/**
 * 마스터 데이터 타입
 */
export interface MedicineMaster {
  report_no: string;
  name: string;
  company_name: string;
  license_no: string;
  product_shape: string;
  shape: string;
  dispos: string;
  primary_function: string;
  intake_method: string;
  precautions: string;
  side_effects?: string;  // 🔥 부작용 필드 추가
  storage_method: string;
  shelf_life: string;
  raw_materials: string;
  standard_spec: string;
  permit_date: string;
  create_date: string;
  last_update_date: string;
  created_at: Date;
  updated_at: Date;
}

export interface TabletMaster {
  report_no: string;
  name: string;
  company_name: string;
  license_no: string;
  product_shape: string;
  shape: string;
  dispos: string;
  primary_function: string;
  intake_method: string;
  precautions: string;
  side_effects?: string;  // 🔥 부작용 필드 추가
  storage_method: string;
  shelf_life: string;
  raw_materials: string;
  standard_spec: string;
  permit_date: string;
  create_date: string;
  last_update_date: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 의약품 마스터 데이터 검색
 */
export const searchMedicineMaster = async (
  query: string,
  limit: number = 20
): Promise<ApiResponse<MedicineMaster[]>> => {
  try {
    const response = await apiClient.get<ApiResponse<MedicineMaster[]>>(
      `${API_ENDPOINTS.MEDICINE.MASTER_SEARCH}?query=${encodeURIComponent(query.trim())}&limit=${limit}`
    );
    return response.data;
  } catch (error: any) {
    // 🔥 로그아웃 중이거나 인증 에러인 경우 조용히 처리
    if (error?.response?.status === 401 || error?.message?.includes('인증이 만료되었습니다')) {
      if (__DEV__) {
        console.log('🔒 [searchMedicineMaster] 인증 만료 - 조용히 처리');
      }
      return {
        success: false,
        error: {
          message: '인증이 만료되었습니다.',
          statusCode: 401,
        },
        data: [],
      };
    }
    
    if (__DEV__) {
      console.error('🔥 [searchMedicineMaster] 검색 실패:', error);
    }
    return {
      success: false,
      error: {
        message: error?.response?.data?.message || '의약품 검색에 실패했습니다.',
        statusCode: error?.response?.status,
      },
      data: [],
    };
  }
};

/**
 * 건강기능식품 마스터 데이터 검색
 */
export const searchTabletMaster = async (
  query: string,
  limit: number = 20
): Promise<ApiResponse<TabletMaster[]>> => {
  try {
    const response = await apiClient.get<ApiResponse<TabletMaster[]>>(
      `${API_ENDPOINTS.SUPPLEMENT.MASTER_SEARCH}?query=${encodeURIComponent(query.trim())}&limit=${limit}`
    );
    return response.data;
  } catch (error: any) {
    // 🔥 로그아웃 중이거나 인증 에러인 경우 조용히 처리
    if (error?.response?.status === 401 || error?.message?.includes('인증이 만료되었습니다')) {
      if (__DEV__) {
        console.log('🔒 [searchTabletMaster] 인증 만료 - 조용히 처리');
      }
      return {
        success: false,
        error: {
          message: '인증이 만료되었습니다.',
          statusCode: 401,
        },
        data: [],
      };
    }
    
    if (__DEV__) {
      console.error('🔥 [searchTabletMaster] 검색 실패:', error);
    }
    return {
      success: false,
      error: {
        message: error?.response?.data?.message || '건강기능식품 검색에 실패했습니다.',
        statusCode: error?.response?.status,
      },
      data: [],
    };
  }
};

/**
 * 제품신고번호로 의약품 마스터 데이터 조회
 */
export const findMedicineMasterByReportNo = async (
  reportNo: string
): Promise<MedicineMaster | null> => {
  try {
    const response = await apiClient.get<ApiResponse<MedicineMaster>>(
      API_ENDPOINTS.MEDICINE.MASTER_REPORT(reportNo)
    );
    
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    console.error('🔥 [findMedicineMasterByReportNo] 조회 실패:', error);
    return null;
  }
};

/**
 * 제품신고번호로 건강기능식품 마스터 데이터 조회
 */
export const findTabletMasterByReportNo = async (
  reportNo: string
): Promise<TabletMaster | null> => {
  try {
    const response = await apiClient.get<ApiResponse<TabletMaster>>(
      API_ENDPOINTS.SUPPLEMENT.MASTER_REPORT(reportNo)
    );
    
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    console.error('🔥 [findTabletMasterByReportNo] 조회 실패:', error);
    return null;
  }
};

/**
 * 제품명으로 의약품 마스터 데이터 검색 (유연한 매칭)
 */
export const findMedicineMasterByName = async (
  medicineName: string
): Promise<MedicineMaster | null> => {
  try {
    // 먼저 정확한 이름으로 검색
    const exactResult = await searchMedicineMaster(medicineName, 1);
    if (exactResult.success && exactResult.data && exactResult.data.length > 0) {
      const found = exactResult.data.find(
        (item) => item.name === medicineName || item.name.toLowerCase() === medicineName.toLowerCase()
      );
      if (found) return found;
    }

    // 부분 매칭으로 검색
    const partialResult = await searchMedicineMaster(medicineName, 20);
    if (partialResult.success && partialResult.data && partialResult.data.length > 0) {
      // 가장 유사한 항목 찾기
      const searchLower = medicineName.toLowerCase();
      const found = partialResult.data.find((item) => {
        const itemName = item.name.toLowerCase();
        return (
          itemName.includes(searchLower) ||
          searchLower.includes(itemName) ||
          itemName.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '') ===
            searchLower.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '')
        );
      });
      if (found) return found;
      
      // 첫 번째 결과 반환
      return partialResult.data[0];
    }

    return null;
  } catch (error) {
    console.error('🔥 [findMedicineMasterByName] 검색 실패:', error);
    return null;
  }
};

/**
 * 제품명으로 건강기능식품 마스터 데이터 검색 (유연한 매칭)
 */
export const findTabletMasterByName = async (
  tabletName: string
): Promise<TabletMaster | null> => {
  try {
    // 먼저 정확한 이름으로 검색
    const exactResult = await searchTabletMaster(tabletName, 1);
    if (exactResult.success && exactResult.data && exactResult.data.length > 0) {
      const found = exactResult.data.find(
        (item) => item.name === tabletName || item.name.toLowerCase() === tabletName.toLowerCase()
      );
      if (found) return found;
    }

    // 부분 매칭으로 검색
    const partialResult = await searchTabletMaster(tabletName, 20);
    if (partialResult.success && partialResult.data && partialResult.data.length > 0) {
      // 가장 유사한 항목 찾기
      const searchLower = tabletName.toLowerCase();
      const found = partialResult.data.find((item) => {
        const itemName = item.name.toLowerCase();
        return (
          itemName.includes(searchLower) ||
          searchLower.includes(itemName) ||
          itemName.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '') ===
            searchLower.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '')
        );
      });
      if (found) return found;
      
      // 첫 번째 결과 반환
      return partialResult.data[0];
    }

    return null;
  } catch (error) {
    console.error('🔥 [findTabletMasterByName] 검색 실패:', error);
    return null;
  }
};

