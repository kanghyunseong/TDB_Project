/**
 * 에러 메시지 상수
 * 일관된 에러 메시지 제공 및 향후 국제화(i18n) 지원 준비
 */

export const ERROR_MESSAGES = {
  // 인증 관련
  AUTH: {
    LOGIN_FAILED: '로그인에 실패했습니다.',
    SIGNUP_FAILED: '회원가입에 실패했습니다.',
    DUPLICATE_ID: '이미 사용 중인 아이디입니다.',
    INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않습니다.',
    TOKEN_EXPIRED: '인증이 만료되었습니다.',
    TOKEN_REFRESH_FAILED: '인증 갱신에 실패했습니다.',
    UNAUTHORIZED: '권한이 없습니다.',
    LOGOUT_FAILED: '로그아웃에 실패했습니다.',
  },

  // 사용자 관련
  USER: {
    NOT_FOUND: '사용자를 찾을 수 없습니다.',
    UPDATE_FAILED: '사용자 정보 업데이트에 실패했습니다.',
    PROFILE_LOAD_FAILED: '사용자 정보를 불러올 수 없습니다.',
    SYNC_FAILED: '사용자 정보 동기화에 실패했습니다.',
  },

  // 가족 관련
  FAMILY: {
    MEMBERS_LOAD_FAILED: '가족 구성원 목록을 불러올 수 없습니다.',
    MEMBER_NOT_FOUND: '가족 구성원을 찾을 수 없습니다.',
    GROUP_NOT_FOUND: '그룹을 찾을 수 없습니다.',
    PARENT_NOT_FOUND: '지정된 보호자 계정을 찾을 수 없습니다.',
    INVALID_GROUP_ID: '그룹 정보가 올바르지 않습니다.',
  },

  // 약물/영양제 관련
  MEDICINE: {
    NOT_FOUND: '약품을 찾을 수 없습니다.',
    LIST_LOAD_FAILED: '약품 목록을 불러올 수 없습니다.',
    DETAILS_LOAD_FAILED: '약품 상세 정보를 조회할 수 없습니다.',
    SAVE_FAILED: '약품 저장에 실패했습니다.',
    DELETE_FAILED: '약품 삭제에 실패했습니다.',
    NO_DETAILS_AVAILABLE: '해당 약품의 상세정보는 현재 제공되지 않습니다.',
  },

  SUPPLEMENT: {
    NOT_FOUND: '영양제를 찾을 수 없습니다.',
    LIST_LOAD_FAILED: '영양제 목록을 불러올 수 없습니다.',
    SAVE_FAILED: '영양제 저장에 실패했습니다.',
    DELETE_FAILED: '영양제 삭제에 실패했습니다.',
  },

  // 스케줄 관련
  SCHEDULE: {
    NOT_FOUND: '스케줄을 찾을 수 없습니다.',
    LOAD_FAILED: '스케줄을 불러올 수 없습니다.',
    SAVE_FAILED: '스케줄 저장에 실패했습니다.',
    DELETE_FAILED: '스케줄 삭제에 실패했습니다.',
    INVALID_TIME: '올바르지 않은 시간입니다.',
  },

  // 복용 기록 관련
  DOSE_HISTORY: {
    LOAD_FAILED: '복용 기록을 불러올 수 없습니다.',
    SAVE_FAILED: '복용 기록 저장에 실패했습니다.',
    COMPLETE_FAILED: '복용 완료 처리에 실패했습니다.',
  },

  // 기기 관련
  MACHINE: {
    NOT_FOUND: '기기를 찾을 수 없습니다.',
    CONNECTION_FAILED: '기기 연결에 실패했습니다.',
    DISPENSER_INFO_FAILED: '디스펜서 정보 조회에 실패했습니다.',
  },

  // 네트워크 관련
  NETWORK: {
    CONNECTION_ERROR: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
    TIMEOUT: '요청 시간이 초과되었습니다.',
    SERVER_ERROR: '서버 오류가 발생했습니다.',
  },

  // QR 관련
  QR: {
    SCAN_FAILED: 'QR 코드 스캔에 실패했습니다.',
    INVALID_DATA: 'QR 코드 데이터가 올바르지 않습니다.',
    PARENT_ID_NOT_FOUND: 'QR 코드에서 보호자 계정 ID를 찾을 수 없습니다.',
  },

  // 입력 검증 관련
  VALIDATION: {
    REQUIRED_FIELDS: '모든 필드를 입력해주세요.',
    INVALID_FORMAT: '입력 형식이 올바르지 않습니다.',
    INVALID_EMAIL: '올바른 이메일 주소를 입력해주세요.',
    PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
    WEAK_PASSWORD: '비밀번호는 8자 이상이어야 합니다.',
  },

  // 일반
  GENERAL: {
    UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
    TRY_AGAIN: '잠시 후 다시 시도해주세요.',
    NO_DATA: '데이터가 없습니다.',
    PERMISSION_DENIED: '권한이 없습니다.',
  },
} as const;

// 성공 메시지
export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: '로그인되었습니다.',
    SIGNUP_SUCCESS: '회원가입이 완료되었습니다.',
    LOGOUT_SUCCESS: '로그아웃되었습니다.',
  },

  USER: {
    UPDATE_SUCCESS: '사용자 정보가 업데이트되었습니다.',
    SYNC_SUCCESS: '사용자 정보가 동기화되었습니다.',
  },

  MEDICINE: {
    SAVE_SUCCESS: '약품이 저장되었습니다.',
    DELETE_SUCCESS: '약품이 삭제되었습니다.',
  },

  SUPPLEMENT: {
    SAVE_SUCCESS: '영양제가 저장되었습니다.',
    DELETE_SUCCESS: '영양제가 삭제되었습니다.',
  },

  SCHEDULE: {
    SAVE_SUCCESS: '스케줄이 저장되었습니다.',
    DELETE_SUCCESS: '스케줄이 삭제되었습니다.',
  },

  DOSE: {
    COMPLETE_SUCCESS: '복용 완료 처리되었습니다.',
  },

  QR: {
    SCAN_SUCCESS: 'QR 코드 스캔 완료',
  },

  GENERAL: {
    REFRESH_SUCCESS: '새로고침 완료',
    SAVE_SUCCESS: '저장되었습니다.',
    DELETE_SUCCESS: '삭제되었습니다.',
  },
} as const;

// 타입 추론 헬퍼
export type ErrorMessage = typeof ERROR_MESSAGES;
export type SuccessMessage = typeof SUCCESS_MESSAGES;

