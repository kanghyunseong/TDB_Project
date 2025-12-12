// ========================================
// 🌐 환경 변수에서 API URL 로드
// ========================================
// .env 파일에서 API_URL을 설정하세요
// 개발 환경: http://localhost:3000 (로컬 개발)
// 프로덕션: 환경변수에서 설정
import { Platform } from 'react-native';
import { API_URL as ENV_API_URL } from '@env';

// Android 에뮬레이터는 10.0.2.2를 사용해야 호스트 머신에 접근 가능
// iOS 시뮬레이터는 localhost 사용 가능
const getDefaultApiUrl = () => {
  if (ENV_API_URL) {
    return ENV_API_URL;
  }
  
  if (Platform.OS === 'android') {
    // Android 에뮬레이터용 (호스트 머신 접근)
    return 'http://10.0.2.2:3000';
  }
  
  // iOS 시뮬레이터 또는 기타
  return 'http://localhost:3000';
};

export const API_URL = getDefaultApiUrl();

console.log('🌐 현재 API URL:', API_URL, `(Platform: ${Platform.OS})`);

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    REGISTER: '/api/auth/register',  // 백엔드 호환성
    LOGOUT: '/api/auth/logout',
    REFRESH_TOKEN: '/api/auth/refresh',
    CHECK_AUTH: '/api/auth/verify',
  },
  USER: {
    PROFILE: '/api/users/profile',
    UPDATE_PROFILE: '/api/users/profile',
    REGISTER_DISPENSER: '/api/users/register-dispenser',
    REGISTER_MACHINE: '/api/users/register-machine',  // machine_id 기반
    DISPENSER_INFO: (userId: string) => `/api/user/${userId}/dispenser-info`,
    GET_MACHINE_ID: (userId: string) => `/api/users/${userId}/machine-id`,
  },
  FAMILY: {
    MEMBERS: '/api/family/members',
    MEMBER: (memberId: string) => `/api/family/member/${memberId}`,
    ADD_MEMBER: '/api/family/add-member',
    UPDATE_MEMBER: (memberId: string) => `/api/family/member/${memberId}`,
    DELETE_MEMBER: (memberId: string) => `/api/family/member/${memberId}`,
    CHECK_MACHINE: (machine_id: string) => `/api/family/check-machine/${machine_id}`,
  },
  MEDICINE: {
    LIST: '/api/medicine/list',  // query parameter 방식: ?connect=userId
    USER_LIST: '/api/medicine/list',  // 통일: query parameter 방식
    DETAIL: (medicineId: string) => `/api/medicine/${medicineId}`,
    ADD: '/api/medicine/add',
    SAVE: '/api/medicine/add',  // 호환성
    UPDATE: (medicineId: string) => `/api/medicine/${medicineId}`,
    DELETE: (connect: string, medicineId: string) => `/api/medicine/${connect}/${medicineId}`,
    SEARCH: '/api/medicine/search',
    SCHEDULE: (medicineId: string) => `/api/medicine/schedule/${medicineId}`,
    SAVE_SCHEDULE: '/api/medicine/schedule',
    DELETE_SCHEDULE: (medicineId: string, memberId: string) => `/api/medicine/schedule/${medicineId}/${memberId}`,
    SLOT_INFO: (machine_id: string) => `/api/medicine/slot-info/${machine_id}`,
    UPDATE_QUANTITY: '/api/medicine/update-quantity',  // 호환성
    // 마스터 데이터 검색 (데이터베이스 기반)
    MASTER_SEARCH: '/api/medicine-master/search',
    MASTER_SEARCH_ALL: '/api/medicine-master/search-all',
    MASTER_REPORT: (reportNo: string) => `/api/medicine-master/report/${reportNo}`,
  },
  SUPPLEMENT: {
    LIST: (memberId: string) => `/api/supplement/list/${memberId}`,
    DETAIL: (supplementId: string) => `/api/supplement/${supplementId}`,
    ADD: '/api/supplement/add',
    SAVE: '/api/supplement/add',  // 호환성
    UPDATE: (supplementId: string) => `/api/supplement/${supplementId}`,
    DELETE: (supplementId: string) => `/api/supplement/${supplementId}`,
    SCHEDULE: (supplementId: string) => `/api/schedule/supplement/${supplementId}`,  // 🔥 수정: /schedule/supplement로 변경
    SAVE_SCHEDULE: '/api/schedule/supplement',  // 🔥 수정: /schedule/supplement로 변경
    DELETE_SCHEDULE: (supplementId: string, memberId: string) => `/api/schedule/supplement/${supplementId}/${memberId}`,  // 🔥 수정
    UPDATE_QUANTITY: '/api/supplement/update-quantity',  // 호환성
    // 마스터 데이터 검색 (데이터베이스 기반)
    MASTER_SEARCH: '/api/tablet-master/search',
    MASTER_REPORT: (reportNo: string) => `/api/tablet-master/report/${reportNo}`,
  },
  MACHINE: {
    LIST: '/api/machine',
    STATUS: (machine_id: string) => `/api/machine/${machine_id}/status`,
    UPDATE: '/api/machine',
    ERROR: '/api/machine/error',
    VERIFY_UID: '/api/machine/verify-uid',
    TODAY_SCHEDULE: '/api/machine/today-schedule',
    MEDICINE_REMAIN: '/api/machine/medicine-remain',
    USERS_BY_MACHINE: '/api/machine/users',
    SCHEDULES_BY_DATE: '/api/machine/schedules',
    REMAIN: (machine_id: string) => `/api/machine/${machine_id}/remain`,
  },
  DISPENSER: {
    RFID_AUTO_DISPENSE: '/api/dispenser/rfid-auto-dispense',  // 🔥 RFID 자동배출 (메인 기능)
    SCHEDULE_DISPENSE: '/api/dispenser/schedule-dispense',  // 스케줄 기반 수동배출 (앱 버튼)
    VERIFY_UID: '/api/dispenser/verify-uid',
    DISPENSE_LIST: '/api/dispenser/dispense-list',
    DISPENSE_RESULT: '/api/dispenser/dispense-result',
    CONFIRM: '/api/dispenser/confirm',
    MACHINE_STATUS: (machine_id: string) => `/api/dispenser/machine/${machine_id}/status`,
  },
      DOSE_HISTORY: {
        LIST: (userId: string) => `/api/dose-history/${userId}`,
        ADD: '/api/dose-history',
        UPDATE: (historyId: string) => `/api/dose-history/${historyId}`,
        DELETE: (historyId: string) => `/api/dose-history/${historyId}`,
        WEEKLY: (userId: string) => `/api/dose-history/${userId}/weekly`,
        MONTHLY: (userId: string) => `/api/dose-history/${userId}/monthly`,
        COMPLETE: '/api/dose-history/complete',  // 복용 완료 처리
        TODAY_PROGRESS: (userId: string) => `/api/dose-history/${userId}/today-progress`,
        TODAY_STATUS: '/api/dose-history/today-status',
        WEEKLY_STATS: (userId: string) => `/api/dose-history/${userId}/weekly-stats`,
        FAMILY_TODAY_SCHEDULES: (group_id: string) => `/api/dose-history/family-today-schedules/${group_id}`,  // 🔥 배치 API
      },
  // 호환성을 위한 추가 엔드포인트
  SCHEDULE: {
    LIST: '/api/schedule/medicine',
    SAVE: '/api/schedule/medicine',
    UPDATE: '/api/schedule/medicine',
    DELETE: '/api/schedule/medicine',
    TODAY: '/api/schedule/today',
    FAMILY_SUMMARY: '/api/schedule/family-summary',
    CURRENT_DOSE: '/api/schedule/current-dose',
    DAILY_SCHEDULE: '/api/schedule/daily',
    COMPLETION: '/api/dose-history/complete',
    DOSE_HISTORY: '/api/schedule/dose-history',
    WEEKLY_STATS: '/api/schedule/weekly-stats',
  },
}; 