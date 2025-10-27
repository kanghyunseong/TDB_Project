import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@accessToken';
const REFRESH_TOKEN_KEY = '@refreshToken';

interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

// 간단한 JWT 디코딩 함수
function decodeJWT(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

export class TokenDebugger {
  /**
   * 현재 토큰 상태를 상세히 분석
   */
  static async analyzeTokenStatus(): Promise<{
    hasToken: boolean;
    hasRefreshToken: boolean;
    isValid: boolean;
    isExpired: boolean;
    timeUntilExpiry?: number; // 만료까지 남은 시간 (초)
    tokenPayload?: TokenPayload;
    error?: string;
  }> {
    try {
      const accessToken = await AsyncStorage.getItem(TOKEN_KEY);
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      
      console.log('🔍 [TokenDebugger] 토큰 상태 분석 시작');
      console.log('🔍 [TokenDebugger] Access Token 존재:', !!accessToken);
      console.log('🔍 [TokenDebugger] Refresh Token 존재:', !!refreshToken);
      
      if (!accessToken) {
        return {
          hasToken: false,
          hasRefreshToken: !!refreshToken,
          isValid: false,
          isExpired: true,
          error: 'Access Token이 없습니다.'
        };
      }

      try {
        const decoded = decodeJWT(accessToken);
        if (!decoded) {
          throw new Error('토큰 디코딩 실패');
        }
        
        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = decoded.exp < currentTime;
        const timeUntilExpiry = decoded.exp - currentTime;
        
        console.log('🔍 [TokenDebugger] 토큰 디코딩 성공:', {
          sub: decoded.sub,
          type: decoded.type,
          issuedAt: new Date(decoded.iat * 1000).toISOString(),
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
          isExpired,
          timeUntilExpiry: `${timeUntilExpiry}초 (${Math.round(timeUntilExpiry / 60)}분)`
        });
        
        return {
          hasToken: true,
          hasRefreshToken: !!refreshToken,
          isValid: !isExpired,
          isExpired,
          timeUntilExpiry,
          tokenPayload: decoded
        };
      } catch (decodeError) {
        console.error('🔥 [TokenDebugger] 토큰 디코딩 실패:', decodeError);
        return {
          hasToken: true,
          hasRefreshToken: !!refreshToken,
          isValid: false,
          isExpired: true,
          error: '토큰 형식이 올바르지 않습니다.'
        };
      }
    } catch (error) {
      console.error('🔥 [TokenDebugger] 토큰 분석 중 오류:', error);
      return {
        hasToken: false,
        hasRefreshToken: false,
        isValid: false,
        isExpired: true,
        error: '토큰 분석 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 토큰 자동 갱신 상태 모니터링
   */
  static async monitorTokenRefresh(): Promise<void> {
    console.log('🔍 [TokenDebugger] 토큰 모니터링 시작');
    
    const status = await this.analyzeTokenStatus();
    
    if (status.isExpired) {
      console.log('⚠️ [TokenDebugger] 토큰이 만료됨 - 자동 갱신 시도 필요');
    } else if (status.timeUntilExpiry && status.timeUntilExpiry < 300) { // 5분 미만
      console.log('⚠️ [TokenDebugger] 토큰이 곧 만료됨 - 미리 갱신 권장');
    } else {
      console.log('✅ [TokenDebugger] 토큰 상태 정상');
    }
  }

  /**
   * 강제 토큰 갱신 테스트
   */
  static async testTokenRefresh(): Promise<boolean> {
    try {
      console.log('🔧 [TokenDebugger] 강제 토큰 갱신 테스트 시작');
      
      const { apiClient } = await import('../api/client');
      
      // 임의의 API 호출로 토큰 갱신 트리거
      await apiClient.get('/api/user/me'); // 존재하지 않는 엔드포인트로 401 유발
      
      return true;
    } catch (error: any) {
      console.log('🔧 [TokenDebugger] 토큰 갱신 테스트 결과:', error.response?.status);
      return error.response?.status === 401; // 401이면 갱신 시도됨
    }
  }

  /**
   * 로그아웃 필요 여부 판단
   */
  static async shouldLogout(): Promise<boolean> {
    const status = await this.analyzeTokenStatus();
    
    // Access Token과 Refresh Token 모두 없거나 유효하지 않으면 로그아웃
    return !status.hasToken && !status.hasRefreshToken;
  }
} 