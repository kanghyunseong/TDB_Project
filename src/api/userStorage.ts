import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types';
import { isStoredUser, StoredUser, safeJsonParse } from '../utils/typeGuards';

// 키 상수 정의
const STORAGE_KEYS = {
  USER: '@user',
  TOKEN: '@token',
} as const;

// 로그인 응답에서 사용자 저장용 타입
interface LoginUserData {
  user_id: string;
  name: string;
  role: UserRole;
  group_id: string;
  group_name: string;
  birthDate: string;
  age: number;
  k_uid: string | null;
  accessToken: string;
  refreshToken: string;
}

// 사용자 데이터 저장
export const saveUser = async (userData: LoginUserData | User | undefined | null) => {
  try {
    if (userData === undefined || userData === null) {
      // 값이 없으면 저장 대신 삭제
      await removeUser();
      return true;
    }

    // LoginUserData를 User 형식으로 변환
    const userToSave: User = {
      user_id: userData.user_id,
      name: userData.name,
      role: userData.role,
      group_id: (userData as LoginUserData).group_id || (userData as User).group_id,
      group_name: (userData as LoginUserData).group_name || (userData as User).group_name,
      birthDate: userData.birthDate,
      age: userData.age,
      k_uid: userData.k_uid,
      took_today: (userData as User).took_today || 0,
      refresh_token: (userData as LoginUserData).refreshToken || (userData as User).refresh_token
    };

    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userToSave));
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
};

// 사용자 데이터 불러오기
export const getUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (!userData) {
      return null;
    }
    
    const parsed = safeJsonParse<any>(userData, null);
    
    // 🔥 필수 필드만 체크
    if (!parsed || !parsed.user_id || !parsed.name) {
      console.error('❌ [getUser] 필수 필드 없음:', parsed);
      return null;
    }
    
    return parsed as User;
  } catch (error) {
    console.error('❌ [getUser] 에러:', error);
    return null;
  }
};

// 사용자 데이터 삭제 (로그아웃)
export const removeUser = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    return true;
  } catch (error) {
    console.error('Error removing user data:', error);
    return false;
  }
};

// 모든 데이터 삭제
export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};

// 현재 로그인된 사용자 정보 가져오기 (그룹 기반)
export const getCurrentUser = async () => {
  try {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (!userData) {
      console.log('⚠️ [getCurrentUser] AsyncStorage에 사용자 정보 없음');
      return null;
    }

    const parsedUser = safeJsonParse<User | null>(userData, null);
    
    if (!parsedUser) {
      console.error('❌ [getCurrentUser] JSON 파싱 실패');
      return null;
    }
    
    // 🔥 user_id만 있어도 유효한 것으로 간주 (name은 선택적)
    if (!parsedUser.user_id) {
      console.error('❌ [getCurrentUser] 필수 필드(user_id) 없음');
      return null;
    }
    
    if (!parsedUser.name) {
      console.warn('⚠️ [getCurrentUser] 사용자 이름이 없습니다. 기본값 사용.');
      parsedUser.name = '사용자';
    }
    
    console.log('✅ [getCurrentUser] 사용자 정보 로드 성공:', {
      user_id: parsedUser.user_id,
      name: parsedUser.name,
      role: parsedUser.role,
      group_id: parsedUser.group_id
    });
    
    return parsedUser;
  } catch (error) {
    console.error('❌ [getCurrentUser] 에러:', error);
    return null;
  }
};

// 🔥 서버에서 최신 사용자 정보를 가져와 로컬과 동기화
export const syncUserWithServer = async (userId: string): Promise<User | null> => {
  try {
    const apiClient = require('./client').default;
    const API_ENDPOINTS = require('../constants/api').API_ENDPOINTS;
    
    console.log('🔄 [syncUserWithServer] 서버와 사용자 정보 동기화 시작:', userId);
    
    const response = await apiClient.get(API_ENDPOINTS.USER.PROFILE);
    
    if (response.data?.success && response.data?.data) {
      const serverData = response.data.data;
      const localUser = await getCurrentUser();
      
      // 서버 데이터와 로컬 토큰 정보 병합
      // 🔥 localUser가 null일 수 있으므로 안전하게 처리
      const updatedUser: User = {
        ...(localUser || {}),
        user_id: serverData.user_id || userId,
        name: serverData.name || localUser?.name || '사용자',
        age: serverData.age ?? localUser?.age ?? 0,
        birthDate: serverData.birthDate || localUser?.birthDate || '',
        group_id: serverData.group_id || localUser?.group_id || '',
        group_name: serverData.group_name || localUser?.group_name || '',
        k_uid: serverData.k_uid || localUser?.k_uid || null,
        took_today: serverData.took_today ?? localUser?.took_today ?? 0,
        role: serverData.role || localUser?.role || 'child',
        refresh_token: localUser?.refresh_token, // 로컬 토큰 유지
      };
      
      // 로컬 스토리지 업데이트
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      console.log('✅ [syncUserWithServer] 동기화 완료:', updatedUser.name);
      
      return updatedUser;
    }
    
    console.warn('⚠️ [syncUserWithServer] 서버 응답에 데이터 없음');
    return null;
  } catch (error) {
    console.error('❌ [syncUserWithServer] 동기화 실패:', error);
    // 동기화 실패해도 로컬 데이터는 계속 사용
    return await getCurrentUser();
  }
};

// 🔥 사용자 정보 업데이트 (중앙 집중식)
export const updateUser = async (updates: Partial<User>): Promise<boolean> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('업데이트할 사용자 정보가 없습니다');
      return false;
    }
    
    const updatedUser = {
      ...currentUser,
      ...updates,
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    console.log('✅ 사용자 정보 업데이트 완료');
    return true;
  } catch (error) {
    console.error('❌ 사용자 정보 업데이트 실패:', error);
    return false;
  }
};