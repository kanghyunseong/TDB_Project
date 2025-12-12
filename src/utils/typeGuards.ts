
import { User, FamilyMember, UserRole } from '../types/tdb';
import axios, { AxiosError } from 'axios';

export function isUser(obj: any): obj is User {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    ['parent', 'child'].includes(obj.role) &&
    typeof obj.took_today === 'number'
  );
}

export function isFamilyMember(obj: any): obj is FamilyMember {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    ['parent', 'child'].includes(obj.role) &&
    typeof obj.group_id === 'string' &&
    typeof obj.took_today === 'number'
  );
}

export function isUserRole(value: any): value is UserRole {
  return value === 'parent' || value === 'child';
}

export interface StoredUser {
  user_id: string;
  name: string;
  role: UserRole;
  group_id?: string;
  group_name?: string;
  age?: number;
  birthDate?: string;
  k_uid?: string | null;
  took_today: number;
  accessToken?: string;
  refreshToken?: string;
}

export function isStoredUser(obj: any): obj is StoredUser {
  // 🔥 더 관대한 검증 - 필수 필드만 체크
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    // role은 선택적으로 체크 (없을 수도 있음)
    (!obj.role || isUserRole(obj.role)) &&
    // took_today도 선택적으로 체크 (없으면 기본값 사용)
    (obj.took_today === undefined || typeof obj.took_today === 'number')
  );
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
  };
  isEmpty?: boolean;  // 빈 데이터 여부
}

export function isApiResponse<T>(obj: any): obj is ApiResponse<T> {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.success === 'boolean'
  );
}

export function isSuccessResponse<T>(obj: any): obj is ApiResponse<T> & { success: true; data: T } {
  return (
    isApiResponse(obj) &&
    obj.success === true &&
    obj.data !== undefined &&
    obj.data !== null
  );
}

export function isErrorResponse(obj: any): obj is ApiResponse & { success: false } {
  return (
    isApiResponse(obj) &&
    obj.success === false
  );
}

export function isAxiosError(error: any): error is AxiosError {
  return axios.isAxiosError(error);
}

export function isEmptyResponse(obj: any): obj is ApiResponse & { isEmpty: true } {
  return (
    isApiResponse(obj) &&
    obj.isEmpty === true
  );
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function safeString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

export function safeArray<T>(value: any, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export default {
  isUser,
  isFamilyMember,
  isUserRole,
  isStoredUser,
  isApiResponse,
  isSuccessResponse,
  isErrorResponse,
  isEmptyResponse,
  safeJsonParse,
  safeNumber,
  safeString,
  safeArray,
  isDefined,
  isNonEmptyString,
};

