import { LOG_CONFIG } from '../constants/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static formatMessage(level: LogLevel, tag: string, message: any, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase();
    return `[${timestamp}] ${levelUpper} [${tag}] ${message}`;
  }

  static debug(tag: string, message: any, ...args: any[]): void {
    if (LOG_CONFIG.ENABLE_DEBUG_LOGS) {
      console.log(this.formatMessage('debug', tag, message), ...args);
    }
  }

  static info(tag: string, message: any, ...args: any[]): void {
    if (LOG_CONFIG.ENABLE_API_LOGS) {
      console.log(this.formatMessage('info', tag, message), ...args);
    }
  }

  static warn(tag: string, message: any, ...args: any[]): void {
    if (LOG_CONFIG.ENABLE_ERROR_LOGS) {
      console.warn(this.formatMessage('warn', tag, message), ...args);
    }
  }

  static error(tag: string, message: any, ...args: any[]): void {
    if (LOG_CONFIG.ENABLE_ERROR_LOGS) {
      console.error(this.formatMessage('error', tag, message), ...args);
    }
  }

  // API 관련 전용 로거
  static apiRequest(url: string, method: string, data?: any): void {
    if (LOG_CONFIG.ENABLE_API_LOGS) {
      console.log(`🌐 API 요청: ${method.toUpperCase()} ${url}`, data ? { data } : '');
    }
  }

  static apiResponse(url: string, status: number, data?: any): void {
    if (LOG_CONFIG.ENABLE_API_LOGS) {
      const statusEmoji = status >= 200 && status < 300 ? '✅' : '❌';
      console.log(`${statusEmoji} API 응답: ${status} ${url}`, data ? { data } : '');
    }
  }

  static apiError(url: string, error: any): void {
    if (LOG_CONFIG.ENABLE_ERROR_LOGS) {
      console.error(`❌ API 에러: ${url}`, error);
    }
  }
}

export default Logger; 