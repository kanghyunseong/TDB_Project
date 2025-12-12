import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { signup as apiSignup, login as apiLogin, logout as apiLogout, checkAuth as apiCheckAuth } from '../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, UserRole } from '../types/tdb';
import { SignupData } from '../types/auth';
import { saveUser, getCurrentUser, syncUserWithServer } from '../api/userStorage';
import { INTERVALS } from '../constants/timeouts';
import { setLoggingOutFlag } from '../api/client';

interface AuthContextType {
    user: any;
    token: string | null;
    isLogin: boolean;
    login: (id: string, password: string) => Promise<any>;
    signup: (data: any) => Promise<any>;
    logout: () => void;
    setIsLogin: (value: boolean) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = '@user';
const TOKEN_KEY = '@accessToken';
const REFRESH_TOKEN_KEY = '@refreshToken';

// 글로벌 로그아웃 핸들러 타입
type LogoutHandler = () => Promise<void>;
let globalLogoutHandler: LogoutHandler | null = null;

// 글로벌 로그아웃 핸들러 설정 함수 (API 클라이언트에서 사용)
export const setGlobalLogoutHandler = (handler: LogoutHandler) => {
    globalLogoutHandler = handler;
};

// 글로벌 로그아웃 실행 함수 (API 클라이언트에서 사용)
export const executeGlobalLogout = async () => {
    // 🔥 로그아웃 시작 시 플래그 설정 (401 에러로 인한 Toast 방지)
    setLoggingOutFlag(true);
    
    try {
        if (globalLogoutHandler) {
            await globalLogoutHandler();
        }
    } finally {
        // 🔥 로그아웃 완료 후 플래그 해제
        setLoggingOutFlag(false);
    }
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthState | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLogin, setIsLogin] = useState(false);
    const [loading, setLoading] = useState(true); // 초기값을 true로 설정

    // 앱 실행 시 user/token 복원 및 검증
    useEffect(() => {
        const loadAndVerifyUser = async () => {
            try {
                setLoading(true); // 로딩 시작
                const storedUser = await AsyncStorage.getItem(USER_KEY);
                const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
                const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
                
                if (storedUser && storedToken) {
                    console.log('📱 저장된 토큰 발견, 유효성 검증 중...');
                    
                    // 토큰 유효성 검증
                    const isValid = await apiCheckAuth();
                    
                    if (isValid) {
                        const parsedUser = JSON.parse(storedUser);
                        setUser(parsedUser);
                        setToken(storedToken);
                        setIsLogin(true);
                        console.log('✅ 토큰 유효성 검증 성공, 사용자 정보 복원:', parsedUser.name);
                    } else {
                        console.log('❌ 토큰이 만료되었거나 유효하지 않음, 로그아웃 처리');
                        await performLogout();
                    }
                } else {
                    console.log('📱 저장된 토큰이 없음, 로그인 필요');
                    await performLogout();
                }
            } catch (error) {
                console.error('❌ 사용자 정보 복원 및 검증 중 에러:', error);
                await performLogout();
            } finally {
                setLoading(false); // 로딩 완료
            }
        };
        
        loadAndVerifyUser();
    }, []);

    // 로그아웃 처리 함수 (내부용) - useCallback으로 안정화
    const performLogout = useCallback(async () => {
        setUser(null);
        setToken(null);
        setIsLogin(false);
        
        // 로컬 데이터 삭제
        await AsyncStorage.removeItem(USER_KEY);
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        await AsyncStorage.removeItem('userInfo');
    }, []);

    // 글로벌 로그아웃 핸들러 등록
    useEffect(() => {
        setGlobalLogoutHandler(performLogout);
        
        // 🔥 user나 isLogin이 없으면 interval 생성하지 않음
        if (!user?.user_id || !isLogin) {
            return () => {
                globalLogoutHandler = null;
            };
        }
        
        // 🔥 주기적 사용자 정보 동기화 (5분마다)
        const syncInterval = setInterval(async () => {
            try {
                // 최신 user 정보를 다시 가져와서 사용 (stale closure 방지)
                const currentUser = await getCurrentUser();
                if (currentUser?.user_id) {
                    if (__DEV__) {
                        console.log('[AuthContext] 주기적 사용자 정보 동기화');
                    }
                    const syncedUser = await syncUserWithServer(currentUser.user_id);
                    if (syncedUser) {
                        // User 타입을 AuthState로 변환 (accessToken, refreshToken은 기존 값 유지)
                        setUser(prev => ({
                            ...syncedUser,
                            accessToken: prev?.accessToken,
                            refreshToken: prev?.refreshToken,
                        } as AuthState));
                    }
                }
            } catch (error) {
                // 🔥 동기화 실패 시 조용히 처리 (로그만 기록)
                if (__DEV__) {
                    console.error('[AuthContext] 사용자 정보 동기화 실패:', error);
                }
            }
        }, INTERVALS.USER_SYNC); // 🔥 상수 사용
        
        // 컴포넌트 언마운트 시 핸들러 제거 및 interval 정리
        return () => {
            globalLogoutHandler = null;
            clearInterval(syncInterval);
        };
    }, [user?.user_id, isLogin, performLogout]); // 🔥 performLogout 의존성 추가

    const login = async (id: string, password: string) => {
        try {
            console.log('로그인 시도 (그룹 기반):', { id, password });
            const response = await apiLogin(id, password);
            console.log('로그인 응답 (그룹 기반):', response);
            
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || '로그인 실패');
            }

            const { 
                accessToken, 
                refreshToken, 
                user_id,
                name, 
                role, 
                group_id,
                group_name,
                k_uid, 
                birthDate, 
                age
            } = response.data;

            if (!accessToken || !refreshToken) {
                throw new Error('토큰이 없습니다');
            }

            const userData: any = {
                user_id,
                name,
                age,
                birthDate,
                k_uid,
                took_today: 0,
                group_id,
                role,
                group_name,
                accessToken,
                refreshToken
            };

            // 토큰 저장
            await AsyncStorage.setItem(TOKEN_KEY, accessToken);
            await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

            // 사용자 정보 저장
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
            
            setUser(userData);
            setToken(accessToken);
            setIsLogin(true);
            
            return { success: true, data: userData };
        } catch (error: any) {
            console.error('로그인 에러:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            
            throw new Error(error.message || '로그인에 실패했습니다.');
        }
    };

    const signup = async (data: {
        user_id: string;
        password: string;
        name: string;
        birthDate: string;
        age: number;
        role: UserRole;
        group_name?: string;
        parent_user_id?: string;
        took_today: number;
    }) => {
        try {
            console.log('회원가입 시도 (그룹 기반):', data);
            const response = await apiSignup({
                user_id: data.user_id,
                password: data.password,
                name: data.name,
                birthDate: data.birthDate,
                age: data.age,
                role: data.role,
                group_name: data.group_name, // 새 그룹 생성 시
                parent_user_id: data.parent_user_id, // 기존 그룹 가입 시
                took_today: 0
            });
            console.log('회원가입 응답 (그룹 기반):', response);
            
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || '회원가입에 실패했습니다.');
            }

            // 회원가입 성공 시 자동 로그인하지 않고 단순히 성공 응답만 반환
            console.log('회원가입 성공! 로그인 화면으로 이동합니다.');
            
            return { 
                success: true, 
                data: {
                    message: '회원가입이 완료되었습니다. 로그인해주세요.',
                    user_id: data.user_id
                }
            };
        } catch (error: any) {
            console.error('회원가입 에러:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            
            return { 
                success: false, 
                error: { 
                    message: error.response?.data?.message || error.message || '회원가입에 실패했습니다.' 
                }
            };
        }
    };

    const logout = async () => {
        try {
            // 🔥 로그아웃 시작 시 플래그 설정 (401 에러로 인한 Toast 방지)
            setLoggingOutFlag(true);
            
            // API 로그아웃 시도 (실패해도 로컬 로그아웃은 진행)
            try {
                await apiLogout();
            } catch (error) {
                console.error('로그아웃 API 에러:', error);
            }
        } catch (error) {
            console.error('로그아웃 중 에러:', error);
        } finally {
            // 로컬 로그아웃 처리
            await performLogout();
            // 🔥 로그아웃 완료 후 플래그 해제
            setLoggingOutFlag(false);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLogin,
            login,
            signup,
            logout,
            setIsLogin,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
} 