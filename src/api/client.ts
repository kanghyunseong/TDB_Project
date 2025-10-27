import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { API_URL, API_ENDPOINTS } from '../constants/api';
import { ApiResponse } from '../types/tdb';
import { executeGlobalLogout } from '../contexts/AuthContext';

// 상수 키 정의
const TOKEN_KEY = '@accessToken';
const REFRESH_TOKEN_KEY = '@refreshToken';
const USER_KEY = '@user';

// InternalAxiosRequestConfig 타입 확장
interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// API 클라이언트 생성
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,  // 타임아웃 30초
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// API URL 로깅 (개발 환경에서만)
if (__DEV__) {
  console.log('🌐 API 클라이언트 설정:', {
    baseURL: API_URL,
    timeout: 30000,
    timestamp: new Date().toISOString()
  });
}

// 엔드포인트 URL 생성 헬퍼 함수
export const createEndpointUrl = (endpoint: string) => {
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${formattedEndpoint}`;
  if (__DEV__) {
    console.log('생성된 엔드포인트 URL:', url);
  }
  return url;
};

// 토큰 갱신 관련 변수
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// 토큰 갱신 구독자 관리
const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshToken = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

// 토큰 갱신 함수 - integrated-server 형식에 맞춤
const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('리프레시 토큰이 없습니다.');
    }

    console.log('🔄 토큰 갱신 시도...');

    // integrated-server의 refresh API 호출
    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`,
      { token: refreshToken },
      {
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // integrated-server 응답 형식: { success: true, data: { access_token, refresh_token } }
    if (!response.data.success || !response.data.data || !response.data.data.access_token) {
      throw new Error('토큰 갱신 응답 형식 오류');
    }
    
    const accessToken = response.data.data.access_token;
    const newRefreshToken = response.data.data.refresh_token || refreshToken;

    // 토큰 저장
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

    console.log('✅ 토큰 갱신 성공');
    return accessToken;
  } catch (error) {
    console.error('❌ 토큰 갱신 실패:', error);
    // 토큰 갱신 실패 시 글로벌 로그아웃 처리
    try {
      await executeGlobalLogout();
    } catch (logoutError) {
      console.error('글로벌 로그아웃 실패:', logoutError);
      // 로그아웃 실패 시에도 로컬 토큰 정리
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    }
    throw error;
  }
};

// Request 인터셉터
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      
      if (__DEV__) {
        console.log('📤 API 요청:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          fullURL: `${config.baseURL}${config.url}`,
          hasToken: !!token
        });
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('토큰 조회 실패:', error);
      return config;
    }
  },
  (error) => {
    console.error('요청 인터셉터 에러:', error);
    return Promise.reject(error);
  }
);

// Response 인터셉터
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (__DEV__) {
      console.log('📥 API 응답 성공:', {
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status
      });
    }
    return response;
  },
  async (error: AxiosError<{ message?: string; statusCode?: number }>) => {
    // 정상적인 404 에러들 (데이터가 없는 경우) - 로깅 없이 처리
    const normalNotFoundCases = [
      'schedule/medicine/',
      'supplement/list/',
      'medicine/list/',
      'family/member/',
      'dose-history',
    ];

    if (error.response?.status === 404) {
      const url = error.config?.url || '';
      const isNormalNotFound = normalNotFoundCases.some(pattern => url.includes(pattern));
      
      if (isNormalNotFound) {
        return Promise.resolve({
          data: {
            success: true,
            data: url.includes('supplement/list/') || url.includes('medicine/list/') ? [] : null,
            message: '데이터가 없습니다.'
          }
        });
      }
    }

    // 네트워크 에러 처리
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      console.error('🚨 네트워크 연결 오류:', {
        baseURL: API_URL,
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
      
      Toast.show({
        type: 'error',
        text1: '서버 연결 오류',
        text2: '네트워크 연결을 확인해주세요',
      });
      
      return Promise.reject(error);
    }

    const originalRequest = error.config as CustomInternalAxiosRequestConfig;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 401 에러 (토큰 만료) 처리
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // 토큰 갱신 중이면 대기
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshToken();
        isRefreshing = false;
        onRefreshToken(newToken);
        
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        
        // 토큰 갱신 실패 시 글로벌 로그아웃 호출
        try {
          await executeGlobalLogout();
        } catch (logoutError) {
          console.error('글로벌 로그아웃 실패:', logoutError);
        }
        
        Toast.show({
          type: 'error',
          text1: '인증이 만료되었습니다',
          text2: '다시 로그인해주세요',
        });

        return Promise.reject(new Error('인증이 만료되었습니다. 다시 로그인해주세요.'));
      }
    }

    // 기타 에러 로깅
    if (!normalNotFoundCases.some(pattern => (error.config?.url || '').includes(pattern))) {
      console.error('🚨 API 에러:', {
        status: error.response?.status,
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        message: error.response?.data?.message || error.message
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;