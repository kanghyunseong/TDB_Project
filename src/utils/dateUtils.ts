/**
 * 날짜 필드 타입 변환 유틸리티
 */

/**
 * Date 객체 또는 string을 string으로 변환
 */
export function formatDateField(date: string | Date | undefined): string | undefined {
  if (!date) return undefined;
  
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
  }
  
  return date;
}

/**
 * string 또는 Date를 Date 객체로 변환
 */
export function parseDateField(date: string | Date | undefined): Date | undefined {
  if (!date) return undefined;
  
  if (date instanceof Date) {
    return date;
  }
  
  return new Date(date);
}

/**
 * 날짜 필드를 안전하게 포맷팅 (표시용)
 */
export function formatDateForDisplay(date: string | Date | undefined): string {
  if (!date) return '없음';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return typeof date === 'string' ? date : '날짜 오류';
  }
} 