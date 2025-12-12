// 통합 타입 정의 파일 - 백엔드 엔티티와 완전 동기화

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';
export type UserRole = 'parent' | 'child';
export type DoseStatus = 'completed' | 'missed' | 'partial';

// Users 엔터티와 동기화 (그룹 기반 구조)
export interface User {
  user_id: string;
  password?: string; // 옵셔널로 변경 (API 응답에서는 포함되지 않음)
  name: string;
  role: UserRole;
  age?: number;
  birthDate?: string;
  k_uid?: string | null; // 키트 RFID UID
  machine_id?: string | null; // 기기 ID (m_uid 대신)
  took_today: number; // 0 또는 1 (boolean 대신 number)
  refresh_token?: string;
  connect?: string; // 호환성을 위한 필드
  created_at?: string;
  updated_at?: string;
  
  // 그룹 관련 정보 (조인된 데이터)
  group_id?: string;
  group_name?: string;
  joined_at?: string;
}

// FamilyMember는 User와 유사하지만 그룹 정보 필수
export interface FamilyMember {
  user_id: string;
  name: string;
  age?: number;
  birthDate?: string;
  k_uid?: string | null;
  machine_id?: string | null;
  took_today: number;
  role: UserRole;
  
  // 그룹 관련 정보 (필수)
  group_id: string;
  group_name?: string;
  joined_at?: string;
}

// Medicine 엔터티와 동기화 (복합 PK: medi_id + group_id)
export interface Medicine {
  medi_id: string;
  group_id: string;
  name: string;
  warning: number; // 서버와 일치: tinyint (number)
  start_date?: string | Date;
  end_date?: string | Date;
  target_users?: string[] | null; // JSON 필드
  listed_only?: number; // 서버와 일치: tinyint (number)
  created_at?: string;
  updated_at?: string;
  
  // UI/API에서 추가로 사용되는 필드들 (서버 엔티티에는 없음)
  slot?: number;
  total?: number;
  remain?: number;
  totalQuantity?: string;
  doseCount?: string;
  memberName?: string;
  memberType?: UserRole;
  user_id?: string; // 편의를 위한 필드
  permission?: 'own' | 'common' | 'manage' | 'others'; // 권한 정보
}

// Machine 엔터티와 동기화
export interface Machine {
  machine_id: string; // ⚠️ m_uid 완전히 제거
  group_id?: string;
  owner: string; // 소유자 user_id
  error_status?: string;
  last_error_at?: string;
  total: number;
  remain: number;
  slot?: number;
  max_slot: number;
  created_at?: string;
  updated_at?: string;
}

// MachineSlot 엔터티와 동기화
export interface MachineSlot {
  machine_id: string;
  slot_number: number;
  medi_id?: string;
  total: number;
  remain: number;
}

// Schedule 엔터티와 동기화
export interface Schedule {
  schedule_id: string;
  group_id?: string;
  user_id?: string;
  medi_id?: string;
  day_of_week: DayOfWeek;
  time_of_day: TimeOfDay;
  dose: number;
  created_at: string;
}

// DoseHistory 엔터티와 동기화
export interface DoseHistory {
  history_id: string;
  group_id?: string;
  user_id: string;
  medi_id: string;
  time_of_day: TimeOfDay;
  dose_date: string;
  scheduled_dose: number;
  actual_dose: number;
  status: DoseStatus;
  completed_at?: string;
  notes?: string;
  created_at?: string;
}

// UserGroup 엔터티와 동기화
export interface UserGroup {
  group_id: string;
  group_name: string;
  parent_user_id?: string;
  created_at: string;
  note?: string;
}

// UserGroupMembership 엔터티와 동기화
export interface UserGroupMembership {
  group_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
}

// 🔥 UI용 확장 타입들
export interface MedicineSchedule {
  medi_id: string;
  user_id: string;
  group_id?: string;
  schedule: Record<DayOfWeek, Record<TimeOfDay, boolean>>;
  totalQuantity?: string;
  doseCount?: string;
  slot?: number;
  warning?: number;
  
  // 시간대별 복용량
  morningDose?: number;
  afternoonDose?: number;
  eveningDose?: number;
  
  // 🔥 메타데이터
  isEmpty?: boolean; // 404로 인한 빈 스케줄임을 명시
}

// 약물 검색 결과 (외부 API)
export interface MedicineSearchResult {
  itemName: string;
  itemSeq: string;
  entpName: string;
  efcyQesitm?: string;
  useMethodQesitm?: string;
  atpnWarnQesitm?: string;
  atpnQesitm?: string;
  intrcQesitm?: string;
  seQesitm?: string;
  depositMethodQesitm?: string;
  packUnit?: string;
  slot?: number;
  warning: number;
  medi_id: string;
}

// 약물 상세 정보
export interface MedicineDetail {
  id: string;
  name: string;
  manufacturer: string;
  ingredients: string[];
  usage: string;
  precautions: string[];
  sideEffects: string[];
  storage: string;
  efficacy: string;
  
  // 외부 API 필드들
  efcyQesitm?: string;
  useMethodQesitm?: string;
  atpnWarnQesitm?: string;
  atpnQesitm?: string;
  intrcQesitm?: string;
  seQesitm?: string;
  depositMethodQesitm?: string;
  
  // 메타정보
  isNotFound?: boolean;
}

// 영양제 관련 타입들
export interface NutritionalSupplement {
  id: string;
  name: string;
  dosage?: string;
  totalQuantity?: string;
  doseCount?: string;
  startDate: string;
  endDate: string;
  dispenserSlot?: string | number;
  slot?: number; // 약물과 동일한 필드명 추가
  memberId: string;
  memberName?: string;
  memberType?: UserRole;
  schedule?: string;
  manufacturer: string;
  ingredients?: string;
  precautions?: string;
  primaryFunction?: string;
  intakeMethod?: string;
  target_users?: string[] | null;
  targetUsers?: string[] | null; // 하위 호환성을 위해 추가
  start_date?: string; // 약물과 동일한 필드명 추가 (하위 호환성)
  end_date?: string; // 약물과 동일한 필드명 추가 (하위 호환성)
}

export interface SupplementSchedule {
  supplementId: string;
  memberId: string;
  schedule: {
    [day: string]: {
      morning: boolean;
      lunch: boolean;
      dinner: boolean;
    };
  };
  totalQuantity?: string;
  doseCount?: string;
  dispenserSlot?: number;
}

// API 응답 타입
export interface ApiError {
  message: string;
  statusCode?: number;
  code?: string; // 에러 코드 (예: 'AGE_RESTRICTION')
  warnings?: string[]; // 경고 메시지 배열
}

export interface ApiError {
  message: string;
  statusCode?: number;
  code?: string; // 에러 코드 (예: 'AGE_RESTRICTION')
  warnings?: string[]; // 경고 메시지 배열
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  isNotFound?: boolean; // 호환성을 위해 추가
  isEmpty?: boolean; // 🔥 404로 인한 빈 결과임을 명시
}

// QR 코드 관련 타입 (machine_id로 통일)
export interface QRCodeData {
  type: 'link' | 'kit' | 'machine';
  uid_type?: 'kit' | 'machine';
  k_uid?: string;
  machine_id?: string; // ⚠️ m_uid 완전히 제거
  createdAt?: string;
}

export interface DeviceVerifyResult {
  confirmed: boolean;
  type: 'kit' | 'machine' | 'unknown';
  user?: User;
  machine_id?: string; // ⚠️ m_uid 완전히 제거
  k_uid?: string; // 키트 UID
  qr_data?: string;
}

// 디스펜서 관련 타입들
export interface TodayScheduleResponse {
  status: 'ok';
  weekday: string;
  schedule: {
    morning: { medi_id: string; dose: number }[];
    afternoon: { medi_id: string; dose: number }[];
    evening: { medi_id: string; dose: number }[];
  };
}

export interface MedicineRemainInfo {
  medi_id: string;
  name: string;
  total: number;
  remain: number;
  slot?: number;
}

export interface DispenserStatus {
  machine_id: string; // ⚠️ 실제 하드웨어 UID
  group_id: string; // 가족 그룹 ID
  max_slot: number; // 최대 슬롯 수 (3개 고정)
  slots: {
    slot_number: number;
    medi_id?: string;
    medicine_name?: string;
    total: number;
    remain: number;
    warning_threshold: number;
    is_empty: boolean;
  }[];
  last_updated: string;
  error_status?: string;
}

// 통계 관련 타입들
export interface WeeklyStats {
  user_id: string;
  user_name: string;
  group_id: string;
  total_doses: number;
  completed_doses: number;
  compliance_rate: number;
  week_start: string;
  week_end: string;
  daily_stats: {
    date: string;
    scheduled: number;
    completed: number;
    rate: number;
  }[];
}

// 유틸리티 타입들
export interface UserInfo {
  user_id: string;
  name: string;
  role: UserRole;
  group_id?: string;
}

export interface GroupBasedRequest {
  group_id?: string;
  user_id?: string;
}

// 🔥 새로 추가: 통합된 약물-기기 정보
export interface MedicineWithMachineInfo extends Medicine {
  machine_info?: {
    machine_id: string;
    slot: number;
    total: number;
    remain: number;
    error_status?: string;
    last_error_at?: string;
    max_slot: number;
  };
  permission_info?: {
    can_view: boolean;
    can_edit: boolean;
    can_schedule: boolean;
    is_owner: boolean;
    target_type: 'family_common' | 'personal' | 'others_only';
  };
}

// 새 약물 등록용 타입
export interface NewMedicine extends Omit<Medicine, 'medi_id' | 'group_id'> {
  memberName?: string;
  memberType?: 'parent' | 'child';
  user_id?: string;
}

// 새 영양제 등록용 타입
export interface NewSupplement extends Omit<NutritionalSupplement, 'supplement_id' | 'group_id'> {
  memberName?: string;
  memberType?: 'parent' | 'child';
  user_id?: string;
}

// Auth 응답 타입 (서버 응답 형태)
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    user_id: string;
    name: string;
    role: UserRole;
    group_id?: string;
    group_name?: string;
    k_uid?: string;
    birthDate?: string;
    age?: number;
  };
}

// 클라이언트에서 사용하는 Auth 상태 타입
export interface AuthState {
  accessToken: string;
  refreshToken: string;
  user_id: string;
  name: string;
  role: UserRole;
  group_id?: string;
  group_name?: string;
  k_uid?: string;
  birthDate?: string;
  age?: number;
}

// 회원가입 요청 타입
export interface SignupRequest {
  user_id: string;
  password: string;
  name: string;
  birthDate: string;
  age: number;
  role: UserRole;
  group_name?: string;
  parent_user_id?: string;
  took_today: number;
} 