import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { ApiResponse, AuthResponse, AuthState, SignupRequest } from '../types/tdb';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 로그인 요청 타입 (임시)
interface LoginRequest {
  user_id: string;
  password: string;
}

// 회원가입 함수
export const signup = async (signupData: SignupRequest): Promise<ApiResponse<AuthResponse>> => {
  try {
    console.log('📤 회원가입 요청:', {
      id: signupData.user_id,
      name: signupData.name,
      accountType: signupData.role,
      hasParentGroupId: !!signupData.parent_user_id
    });

    // 🔥 서버의 SignupDto에 맞게 필드명 변경
    const requestBody = {
      id: signupData.user_id,              // user_id → id (서버 DTO 형식)
      password: signupData.password,
      name: signupData.name,
      birthDate: signupData.birthDate,
      age: signupData.age,
      accountType: signupData.role,        // role → accountType
      role: signupData.role,               // 호환성을 위해 둘 다 전송
      parentUuid: signupData.parent_user_id, // parent_user_id → parentUuid
      groupName: signupData.group_name,    // 🔥 사용자가 입력한 그룹명 전송
      // took_today는 제외 (서버에서 받지 않음)
    };

    const response = await apiClient.post(API_ENDPOINTS.AUTH.SIGNUP, requestBody);

    console.log('📥 회원가입 응답:', {
      success: response.data.success,
      hasData: !!response.data.data,
      hasTokens: !!(response.data.data?.access_token && response.data.data?.refresh_token)
    });

    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        error: {
          message: response.data.message || '회원가입에 실패했습니다.'
        }
      };
    }
  } catch (error: any) {
    console.error('❌ 회원가입 API 에러 상세:', {
      message: error.message,
      responseData: error.response?.data,
      status: error.response?.status,
      statusCode: error.response?.data?.statusCode,
      errorMessage: error.response?.data?.message,
      headers: error.response?.headers
    });

    // 409 Conflict 에러 처리 (중복 아이디)
    if (error.response?.status === 409) {
      console.log('🔴 409 에러 감지 - 중복 아이디');
      return {
        success: false,
        error: {
          message: '이미 사용 중인 아이디입니다.'
        }
      };
    }

    // 400 Bad Request 에러 처리
    if (error.response?.status === 400) {
      console.log('🔴 400 에러 감지:', error.response?.data?.message);
      return {
        success: false,
        error: {
          message: error.response?.data?.message || '입력 정보를 확인해주세요.'
        }
      };
    }

    // 서버에서 반환한 에러 메시지가 있는 경우
    if (error.response?.data?.message) {
      console.log('🔴 서버 에러 메시지:', error.response.data.message);
      return {
        success: false,
        error: {
          message: error.response.data.message
        }
      };
    }

    // 네트워크 에러 처리
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      console.log('🔴 네트워크 에러');
      return {
        success: false,
        error: {
          message: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
        }
      };
    }

    console.log('🔴 기타 에러:', error.message);
    return {
      success: false,
      error: {
        message: error.message || '회원가입 중 오류가 발생했습니다.'
      }
    };
  }
};

// 로그인 함수 (기존 함수 수정)
export const login = async (user_id: string, password: string): Promise<ApiResponse<AuthState>> => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
      user_id,
      password
    });

    console.log('📥 로그인 응답 데이터:', response.data);

    if (response.data.success && response.data.data) {
      // 🔥 서버 응답 형식에 맞게 수정 (user_id로 통일)
      const {
        accessToken,
        refreshToken,
        user_id,  // 🔥 서버에서 user_id로 통일됨
        name,
        role,
        groupId,
        groupName,
        k_uid,
        birthDate,
        age,
        took_today
      } = response.data.data;
      
      // 토큰 저장
      await AsyncStorage.setItem('@accessToken', accessToken);
      await AsyncStorage.setItem('@refreshToken', refreshToken);

      // 사용자 정보 생성
      const userData = {
        user_id,  // 🔥 일관되게 user_id 사용
        name,
        role,
        group_id: groupId,
        group_name: groupName || `${name}님의 가족`,
        k_uid,
        birthDate,
        age,
        took_today: took_today || 0
      };

      await AsyncStorage.setItem('@user', JSON.stringify(userData));

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user_id,  // 🔥 일관되게 user_id 사용
          name,
          role,
          group_id: groupId,
          group_name: groupName || `${name}님의 가족`,
          k_uid,
          birthDate,
          age
        }
      };
    }

    return {
      success: false,
      error: { message: '로그인에 실패했습니다.' }
    };
  } catch (error: any) {
    console.error('❌ 로그인 API 에러:', error);
    return {
      success: false,
      error: { 
        message: error.response?.data?.message || '로그인에 실패했습니다.',
        statusCode: error.response?.status
      }
    };
  }
};

// 토큰 갱신
export const refreshToken = async (token: string): Promise<ApiResponse<{ access_token: string; refresh_token?: string }>> => {
  try {
    console.log('📤 토큰 갱신 요청');

    const response = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
      token: token
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('📥 토큰 갱신 응답:', {
      success: response.data.success
    });

    return {
      success: response.data.success,
      data: response.data.data
    };
  } catch (error: any) {
    console.error('❌ 토큰 갱신 실패:', error);
    return {
      success: false,
      error: {
        message: '토큰 갱신에 실패했습니다.'
      }
    };
  }
};

// 인증 상태 확인
export const verifyAuth = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.AUTH.CHECK_AUTH);
    return {
      success: response.data.success,
      data: response.data.data
    };
  } catch (error: any) {
    console.error('❌ 인증 확인 실패:', error);
    return {
      success: false,
      error: {
        message: '인증 확인에 실패했습니다.'
      }
    };
  }
};

// 호환성을 위한 getToken 함수 (deprecated)
export const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('@accessToken');
    return token;
  } catch (error) {
    console.error('토큰 조회 오류:', error);
    return null;
  }
};

// 로그아웃 함수
export const logout = async (): Promise<void> => {
  try {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  } catch (error) {
    console.error('로그아웃 API 호출 실패:', error);
  } finally {
    // 로컬 저장소 정리
    await AsyncStorage.removeItem('@accessToken');
    await AsyncStorage.removeItem('@refreshToken');
    await AsyncStorage.removeItem('@user');
  }
};

// 인증 확인 함수
export const checkAuth = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('@accessToken');
    if (!token) return false;

    const response = await apiClient.get(API_ENDPOINTS.AUTH.CHECK_AUTH);
    return response.data.success;
  } catch (error) {
    console.error('인증 확인 실패:', error);
    return false;
  }
};