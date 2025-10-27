// 🔥 DB 명세서 기반 디스펜서 상수 정의
export const DISPENSER_CONFIG = {
  MAX_SLOTS: 3, // DB 명세서의 max_slot 기본값
  SLOT_NUMBERS: [1, 2, 3] as const,
  WARNING_THRESHOLD: 10, // 잔량 부족 경고 기준
  ERROR_RESET_HOURS: 24, // 에러 상태 자동 리셋 시간
} as const;

// 슬롯 상태 타입
export type SlotStatus = 'empty' | 'filled' | 'low' | 'error';

// 에러 상태 타입 (DB 명세서 기준)
export type ErrorStatus = 
  | 'slot_empty' 
  | 'medicine_low' 
  | 'mechanical_error' 
  | 'dispense_failed'
  | ''
  | null;

// 기기 상태 관리
export const MACHINE_STATUS = {
  NORMAL: '',
  SLOT_EMPTY: 'slot_empty',
  MEDICINE_LOW: 'medicine_low',
  MECHANICAL_ERROR: 'mechanical_error',
  DISPENSE_FAILED: 'dispense_failed',
} as const; 