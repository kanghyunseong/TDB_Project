/**
 * 통일된 에러 처리 유틸리티
 */

import { AxiosError } from 'axios';
import Toast from 'react-native-toast-message';
import { isAxiosError } from './typeGuards';

export interface ErrorInfo {
  message: string;
  statusCode?: number;
  isNetworkError?: boolean;
  isAuthError?: boolean;
  isNotFound?: boolean;
}

/**
 * 에러를 분석하여 구조화된 정보 반환
 */
export const parseError = (error: unknown): ErrorInfo => {
  if (isAxiosError(error)) {
    const statusCode = error.response?.status;
    const data = error.response?.data as { message?: string } | undefined;
    
    return {
      message: data?.message || error.message || '알 수 없는 오류가 발생했습니다.',
      statusCode,
      isNetworkError: !error.response && (error.code === 'NETWORK_ERROR' || error.message === 'Network Error'),
      isAuthError: statusCode === 401 || statusCode === 403,
      isNotFound: statusCode === 404,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      isAuthError: error.message.includes('인증이 만료되었습니다'),
    };
  }
  
  return {
    message: '알 수 없는 오류가 발생했습니다.',
  };
};

/**
 * 에러를 사용자에게 표시 (Toast)
 */
export const showErrorToast = (error: unknown, defaultMessage?: string) => {
  const errorInfo = parseError(error);
  
  // 404 에러는 조용히 처리 (데이터 없음은 정상)
  if (errorInfo.isNotFound) {
    return;
  }
  
  // 네트워크 에러는 특별 메시지
  if (errorInfo.isNetworkError) {
    Toast.show({
      type: 'error',
      text1: '네트워크 오류',
      text2: '인터넷 연결을 확인해주세요',
    });
    return;
  }
  
  // 인증 에러는 특별 메시지 (인터셉터에서 이미 처리됨)
  if (errorInfo.isAuthError) {
    return; // 인터셉터에서 이미 처리
  }
  
  // 일반 에러
  Toast.show({
    type: 'error',
    text1: defaultMessage || '오류 발생',
    text2: errorInfo.message,
  });
};

/**
 * 에러를 로그에 기록 (개발 환경에서만)
 */
export const logError = (context: string, error: unknown) => {
  if (__DEV__) {
    const errorInfo = parseError(error);
    console.error(`[${context}]`, {
      message: errorInfo.message,
      statusCode: errorInfo.statusCode,
      error,
    });
  }
};

