import { DayOfWeek, TimeOfDay } from '../types/tdb';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const TIMES = ['morning', 'afternoon', 'evening'] as const;

export type Schedule = Record<DayOfWeek, Record<TimeOfDay, boolean>>;

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: '아침',
  afternoon: '점심',
  evening: '저녁'
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일'
};

export const createEmptySchedule = (): Schedule => {
  const schedule: Schedule = {
    mon: { morning: false, afternoon: false, evening: false },
    tue: { morning: false, afternoon: false, evening: false },
    wed: { morning: false, afternoon: false, evening: false },
    thu: { morning: false, afternoon: false, evening: false },
    fri: { morning: false, afternoon: false, evening: false },
    sat: { morning: false, afternoon: false, evening: false },
    sun: { morning: false, afternoon: false, evening: false }
  };
  return schedule;
};

export const groupBySlot = (medicines: Array<{ dispenserSlot?: string | number }>) => {
  const grouped: Record<string, typeof medicines> = {};
  medicines.forEach(medicine => {
    const slot = medicine.dispenserSlot?.toString() || '기타';
    if (!grouped[slot]) {
      grouped[slot] = [];
    }
    grouped[slot].push(medicine);
  });
  return grouped;
};

export const getScheduleSummary = (schedule: Schedule): string => {
  const summary: string[] = [];
  
  DAYS.forEach(day => {
    const times = TIMES.filter(time => schedule[day][time]);
    if (times.length > 0) {
      summary.push(`${DAY_LABELS[day]}(${times.map(time => TIME_LABELS[time]).join(', ')})`);
    }
  });
  
  return summary.join(', ') || '스케줄 없음';
}; 