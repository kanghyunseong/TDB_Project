export interface TimeSlotStatus {
  hasSchedule: boolean;
  isCompleted: boolean;
  totalDose: number;
  completedDose: number;
}

export interface DailyProgress {
  morning: TimeSlotStatus;
  afternoon: TimeSlotStatus;
  evening: TimeSlotStatus;
  totalProgress: number; // 0-100%
  completedTimeSlots: number;
  totalTimeSlots: number;
}

export interface WeeklyStats {
  familyCompletionRate: number;
  thisWeekDoses: number;
  lastWeekDoses: number;
  trend: 'up' | 'down' | 'stable';
  isLoading: boolean;
}

export interface MemberWithProgress {
  user_id: string;
  name: string;
  age: number;
  role: 'parent' | 'child';
  dailyProgress: DailyProgress;
  weeklyCompletionRate: number;
}

export interface MemberSchedule {
  schedule_id: string;
  medicine: {
    medi_id: string;
    name: string;
  };
  time_of_day: 'morning' | 'afternoon' | 'evening';
  dose: number;
  is_completed: boolean;
  weekly_schedule?: Record<string, Record<string, boolean>>;
}

export interface AddMemberFormData {
  name: string;
  age: number;
  role: 'parent' | 'child';
  email?: string;
  phone?: string;
} 