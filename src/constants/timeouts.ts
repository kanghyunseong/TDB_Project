/**
 * 타임아웃 상수 정의
 */

// API 요청 타임아웃
export const API_TIMEOUTS = {
  DEFAULT: 30000,        // 30초 (기본 API 요청)
  SHORT: 5000,           // 5초 (빠른 응답 기대)
  LONG: 10000,           // 10초 (긴 작업)
} as const;

// 디바운싱/쓰로틀링
export const DEBOUNCE_DELAYS = {
  DEFAULT: 1000,         // 1초
  SEARCH: 500,           // 0.5초 (검색)
  INPUT: 300,           // 0.3초 (입력)
} as const;

// 주기적 작업 간격
export const INTERVALS = {
  USER_SYNC: 5 * 60 * 1000,      // 5분 (사용자 정보 동기화)
  STATS_REFRESH: 30 * 1000,      // 30초 (통계 새로고침)
  HEALTH_CHECK: 60 * 1000,       // 1분 (헬스 체크)
} as const;

