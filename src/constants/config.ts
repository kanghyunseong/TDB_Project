import { Platform } from 'react-native';

// 환경별 설정
const isDevelopment = __DEV__;

// API 설정
export const API_CONFIG = {
  // 개발 환경에서는 로컬 IP, 프로덕션에서는 실제 서버 URL 사용
  BASE_URL: isDevelopment 
    ? 'http://192.168.213.114:3000'  // 개발 환경
    : 'https://your-production-server.com',  // 프로덕션 환경
  
  TIMEOUT: 10000,
  RETRY_COUNT: 3,
};

// 로그 설정
export const LOG_CONFIG = {
  ENABLE_API_LOGS: isDevelopment,
  ENABLE_DEBUG_LOGS: isDevelopment,
  ENABLE_ERROR_LOGS: true,
};

// 앱 설정
export const APP_CONFIG = {
  VERSION: '1.0.0',
  BUILD_NUMBER: Platform.OS === 'ios' ? '1' : 1,
  SUPPORT_EMAIL: 'support@tdb-project.com',
};

// 기능 플래그
export const FEATURE_FLAGS = {
  ENABLE_DRUG_INTERACTION_CHECK: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_ANALYTICS: !isDevelopment,
};

export const API_URL = 'http://your-api-url.com'; 