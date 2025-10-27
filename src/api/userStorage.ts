import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types';

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
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
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
      return null;
    }

    const parsedUser: User = JSON.parse(userData);
    
    console.log('현재 사용자 정보 (그룹 기반):', parsedUser);
    return parsedUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};