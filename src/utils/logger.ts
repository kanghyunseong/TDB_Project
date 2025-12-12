/**
 * 로깅 유틸리티
 * 개발 환경에서만 로그 출력, 프로덕션에서는 에러만 기록
 */

const isDevelopment = __DEV__;

/**
 * 로그 레벨
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 로그 포맷팅
 */
const formatLog = (level: LogLevel, message: string, data?: any): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
  }
  
  return `${prefix} ${message}`;
};

/**
 * 로거 클래스
 */
class Logger {
  /**
   * 디버그 로그 (개발 환경에서만)
   */
  debug(message: string, data?: any): void {
    if (isDevelopment) {
      console.log(formatLog(LogLevel.DEBUG, message, data));
    }
  }

  /**
   * 정보 로그 (개발 환경에서만)
   */
  log(message: string, data?: any): void {
    if (isDevelopment) {
      console.log(formatLog(LogLevel.INFO, message, data));
    }
  }

  /**
   * 경고 로그 (개발 환경에서만)
   */
  warn(message: string, data?: any): void {
    if (isDevelopment) {
      console.warn(formatLog(LogLevel.WARN, message, data));
    }
  }

  /**
   * 에러 로그 (항상 출력, 프로덕션에서는 에러 트래킹 서비스로 전송)
   */
  error(message: string, error?: any): void {
    const formattedLog = formatLog(LogLevel.ERROR, message, error);
    console.error(formattedLog);
    
    // 프로덕션 환경에서는 에러 트래킹 서비스로 전송
    if (!isDevelopment) {
      // TODO: Sentry 또는 다른 에러 트래킹 서비스 연동
      // Sentry.captureException(error, { extra: { message } });
    }
  }

  /**
   * API 요청 로그
   */
  apiRequest(method: string, url: string, data?: any): void {
    if (isDevelopment) {
      console.log(`📤 [API Request] ${method} ${url}`, data);
    }
  }

  /**
   * API 응답 로그
   */
  apiResponse(method: string, url: string, status: number, data?: any): void {
    if (isDevelopment) {
      const emoji = status >= 200 && status < 300 ? '📥' : '🚨';
      console.log(`${emoji} [API Response] ${method} ${url} (${status})`, data);
    }
  }

  /**
   * 성능 측정 시작
   */
  timeStart(label: string): void {
    if (isDevelopment) {
      console.time(label);
    }
  }

  /**
   * 성능 측정 종료
   */
  timeEnd(label: string): void {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }

  /**
   * 그룹 시작
   */
  group(label: string): void {
    if (isDevelopment) {
      console.group(label);
    }
  }

  /**
   * 그룹 종료
   */
  groupEnd(): void {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
}

// 싱글톤 인스턴스 export
export const logger = new Logger();

// 기본 export
export default logger;
