// 타입 정의
export type UserRole = 'parent' | 'child';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// 사용자 타입 (그룹 기반)
export interface User {
  user_id: string;
  name: string;
  role?: UserRole; // 선택적으로 변경 (조인된 데이터)
  group_id?: string;
  group_name?: string;
  password?: string;
  k_uid?: string | null;
  birthDate?: string | null;
  age?: number | null;
  took_today: number; // 0 또는 1
  refresh_token?: string | null;
}

// 기계 타입 (그룹 기반)
export interface Machine {
  machine_id: string;
  group_id: string;
  max_slot: number;
  error_status?: string;
  last_error_at?: string;
}

// 기계 슬롯 타입
export interface MachineSlot {
  machine_id: string;
  slot_number: number;
  medi_id?: string;
  total: number;
  remain: number;
}

// 약품 타입 (그룹 기반)
export interface Medicine {
  medi_id: string;
  group_id: string;
  name: string;
  warning: number; // tinyint (0 또는 1)
  start_date?: Date | string;
  end_date?: Date | string;
  target_users?: string[] | null;
  listed_only?: boolean;
  slot?: number;
  totalQuantity?: string;
  remain?: number;
  total?: number;
}

// 일정 타입 (그룹 기반)
export interface Schedule {
  schedule_id: string;
  group_id: string;
  user_id?: string;
  medi_id?: string;
  day_of_week: DayOfWeek;
  time_of_day?: TimeOfDay;
  dose: number;
  created_at: string;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status?: number;
    statusCode?: number;
  };
  isNotFound?: boolean;
}

// 메인 타입 정의들을 tdb.ts에서 가져옴
export * from './tdb';

// React Navigation 관련 타입들
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Home: undefined;
  MedicineList: undefined;
  MedicineDetail: { medicineId: string };
  AddMedicine: undefined;
  EditMedicine: { medicineId: string };
  MedicineSchedule: { medicineId: string; memberId: string };
  MedicineScheduleEdit: { medicineId: string; memberId: string };
  SupplementList: undefined;
  SupplementDetail: { supplementId: string };
  AddSupplement: undefined;
  EditSupplement: { supplementId: string };
  SupplementSchedule: { supplementId: string; memberId: string };
  QRScanner: undefined;
  Settings: undefined;
  FamilyManagement: undefined;
  AddFamilyMember: undefined;
  Statistics: undefined;
  Notifications: undefined;
};

export type TabParamList = {
  Home: undefined;
  Medicine: undefined;
  Supplement: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Main: undefined;
};

// Form 관련 타입들 (호환성 유지)
export interface FormField {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
}

export interface FormData {
  [key: string]: string | number | boolean | undefined;
}

// 네비게이션 관련 타입들
export interface NavigationProps {
  navigation: any;
  route: any;
}

// 유틸리티 타입들
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export type LoadingState = {
  loading: boolean;
  error: string | null;
}; 