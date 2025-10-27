import { UserRole } from './index';

// User 타입은 src/types/index.ts에서 관리하므로 이 파일은 auth 관련 타입만 정의

// 회원가입 시 사용되는 타입 (그룹 기반)
export interface SignupData {
  user_id: string;
  password: string;
  name: string;
  birthDate: string;
  age: number;
  role: UserRole;
  group_name?: string; // 새 그룹 생성 시
  parent_user_id?: string; // 기존 그룹 가입 시
  took_today: number;
}

// 로그인 시 사용되는 타입
export interface LoginData {
  id: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user_id: string;
  name: string;
  role: UserRole;
  group_id: string;
  group_name: string;
  k_uid: string | null;
  birthDate: string | null;
  age: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
} 