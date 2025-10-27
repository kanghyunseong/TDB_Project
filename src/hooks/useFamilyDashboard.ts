import { useState, useEffect } from 'react';
import {
  getFamilyMembers,
  getDetailedFamilyStats,
  getFamilyMachineStatus,
} from '../services/familyStats';
import { getMemberTodayStats } from '../api/familyStats';
import { getDoseTimeSettings, getHourFromTimeString } from '../utils/doseTimeSettings';

export interface FamilyMember {
  user_id: string;
  name: string;
  role: 'parent' | 'child';
  age?: number;
  completionRate: number;
  todayCompleted: number;
  todayScheduled: number;
}

export interface DashboardStats {
  totalScheduled: number;
  totalCompleted: number;
  totalMissed: number;
  totalRemaining: number;
  totalExcluded: number;
  completionRate: number;
  memberCount: number;
}

export interface TimeBasedStats {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  label: string;
  scheduled: number;
  completed: number;
  missed: number;
  remaining: number;
  excluded: number;
  completionRate: number;
}

export interface MachineStatus {
  machine_id: string;
  isConnected: boolean;
  totalSlots: number;
  activeSlots: number;
  lowStockSlots: number;
  users: Array<{
    user_id: string;
    name: string;
    role: string;
  }>;
}

// 오늘의 상세 복용 스케줄 타입 추가
export interface TodayDetailedSchedule {
  [memberName: string]: {
    morning: Array<{
      name: string;
      status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
      medi_id?: string;
      scheduled_dose?: number;
      actual_dose?: number;
      completed_at?: string;
    }>;
    afternoon: Array<{
      name: string;
      status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
      medi_id?: string;
      scheduled_dose?: number;
      actual_dose?: number;
      completed_at?: string;
    }>;
    evening: Array<{
      name: string;
      status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
      medi_id?: string;
      scheduled_dose?: number;
      actual_dose?: number;
      completed_at?: string;
    }>;
  };
}

export interface UseFamilyDashboardResult {
  // 데이터
  familyMembers: FamilyMember[];
  dashboardStats: DashboardStats;
  timeBasedStats: TimeBasedStats[];
  machineStatus: MachineStatus[];
  connectedDevices: number;
  totalDevices: number;
  todayDetailedSchedule: TodayDetailedSchedule; // 추가
  
  // 상태
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // 메서드
  refreshData: () => void;
}

export const useFamilyDashboard = (connect: string): UseFamilyDashboardResult => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalScheduled: 0,
    totalCompleted: 0,
    totalMissed: 0,
    totalRemaining: 0,
    totalExcluded: 0,
    completionRate: 0,
    memberCount: 0,
  });
  const [timeBasedStats, setTimeBasedStats] = useState<TimeBasedStats[]>([]);
  const [machineStatus, setMachineStatus] = useState<MachineStatus[]>([]);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [totalDevices, setTotalDevices] = useState(0);
  const [todayDetailedSchedule, setTodayDetailedSchedule] = useState<TodayDetailedSchedule>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 🔥 복용 상태 판단 (백엔드 status + 사용자 설정 시간 기반)
  const getDoseStatus = async (
    backendStatus: 'completed' | 'missed' | 'partial' | null,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    scheduleCreatedAt?: string  // 🔥 스케줄 생성 시간 추가
  ): Promise<'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded'> => {
    // 백엔드에서 명시적으로 기록된 상태가 있으면 그대로 사용
    if (backendStatus === 'completed') return 'completed';
    if (backendStatus === 'missed') return 'missed';
    if (backendStatus === 'partial') return 'completed'; // partial도 일단 완료로 표시
    
    // 🔥 사용자 설정 시간 불러오기
    const settings = await getDoseTimeSettings();
    
    // 기록이 없는 경우 (status = null) 시간 기준으로 판단
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // 🔥 설정된 복용 시간 가져오기
    const timeSlotHours = {
      morning: getHourFromTimeString(settings.morning),
      afternoon: getHourFromTimeString(settings.afternoon),
      evening: getHourFromTimeString(settings.evening)
    };
    
    const startHour = timeSlotHours[timeOfDay];
    
    // 🔥 스케줄이 오늘 생성되었고, 복용 시간이 이미 지났으면 'excluded'
    if (scheduleCreatedAt && !backendStatus) {
      const scheduleCreatedDate = new Date(scheduleCreatedAt);
      const isCreatedToday = scheduleCreatedDate >= todayStart && scheduleCreatedDate <= now;
      
      if (isCreatedToday) {
        const doseTime = new Date();
        doseTime.setHours(startHour, 0, 0, 0);
        
        // 스케줄 생성 시간이 복용 시간보다 늦으면 제외
        if (scheduleCreatedDate > doseTime) {
          console.log(`⏭️ [getDoseStatus] 제외: ${timeOfDay}, 생성시간 ${scheduleCreatedDate.toLocaleTimeString()}, 복용시간 ${doseTime.toLocaleTimeString()}`);
          return 'excluded';
        }
      }
    }
    
    // 현재 시간을 분 단위로 변환 (비교를 위해)
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60;
    
    // 🔥 설정 시간이 되면 바로 'pending' (복용 확인 필요)
    if (currentTimeInMinutes >= startTimeInMinutes) {
      // 저녁의 경우 자정 이후 새벽 6시까지는 아직 pending
      if (timeOfDay === 'evening' && currentHour < 6) {
        return 'pending';
      }
      return 'pending'; // 설정 시간 지남 = 확인 필요
    }
    
    // 아직 복용 시간이 안 됐으면 'upcoming'
    return 'upcoming';
  };

  const fetchData = async () => {
    if (!connect) return;
    
    setLoading(true);
    setError(null);

    try {
      console.log(`[useFamilyDashboard] 데이터 로드 시작: ${connect}`);

      // 🔥 상세 가족 통계 조회 (한 번의 API 호출로 대부분의 데이터 획득)
      const detailedStatsResponse = await getDetailedFamilyStats(connect);
      
      if (detailedStatsResponse.success && detailedStatsResponse.data) {
        const { summary, timeBasedStats: timeStats, memberStats } = detailedStatsResponse.data;
        
        // 대시보드 통계 설정
        setDashboardStats({
          totalScheduled: summary.total_scheduled,
          totalCompleted: summary.total_completed,
          totalMissed: summary.total_missed,
          totalRemaining: summary.total_remaining,
          totalExcluded: 0, // 초기값, 나중에 상세 스케줄에서 계산
          completionRate: summary.completion_rate,
          memberCount: summary.member_count,
        });

        // 시간대별 통계 설정
        setTimeBasedStats(timeStats || []);

        // 멤버 통계를 FamilyMember 형식으로 변환
        const members: FamilyMember[] = (memberStats || []).map((member: any) => ({
          user_id: member.user_id,
          name: member.name,
          role: member.role,
          completionRate: member.completionRate,
          todayCompleted: member.completed,
          todayScheduled: member.scheduled,
        }));
        setFamilyMembers(members);

        console.log('[useFamilyDashboard] 상세 통계 로드 완료:', {
          stats: summary,
          timeStats: timeStats?.length,
          members: members.length,
          memberDetails: members.map(m => ({
            name: m.name,
            scheduled: m.todayScheduled,
            completed: m.todayCompleted,
            rate: m.completionRate + '%'
          }))
        });

        // 🔥 각 구성원별 오늘의 상세 스케줄 조회
        console.log('[useFamilyDashboard] 구성원별 상세 스케줄 조회 시작');
        const detailedSchedulePromises = members.map(async (member) => {
          try {
            const memberTodayResponse = await getMemberTodayStats(member.user_id);
            if (memberTodayResponse.success && memberTodayResponse.data) {
              const memberData = memberTodayResponse.data;
              
              // 시간대별로 분류
              const timeSlotSchedule: {
                morning: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                }>;
                afternoon: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                }>;
                evening: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                }>;
              } = {
                morning: [],
                afternoon: [],
                evening: []
              };
              
              if (memberData.todaySchedules) {
                // 🔥 비동기 처리를 위해 Promise.all 사용
                await Promise.all(memberData.todaySchedules.map(async (schedule: any) => {
                  // 🔥 백엔드 status와 사용자 설정 시간을 고려해서 최종 상태 결정
                  const status = await getDoseStatus(schedule.status, schedule.time_of_day, schedule.schedule_created_at);
                  
                  const medicineInfo = {
                    name: schedule.medi_name,
                    status,
                    medi_id: schedule.medi_id,
                    scheduled_dose: schedule.scheduled_dose,
                    actual_dose: schedule.actual_dose,
                    completed_at: schedule.completed_at
                  };
                  
                  // 타입 안전한 방식으로 시간대 접근
                  const timeOfDay = schedule.time_of_day as 'morning' | 'afternoon' | 'evening';
                  if (timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening') {
                    timeSlotSchedule[timeOfDay].push(medicineInfo);
                  }
                }));
              }
              
              return {
                memberName: member.name,
                schedule: timeSlotSchedule
              };
            }
            
            return {
              memberName: member.name,
              schedule: {
                morning: [],
                afternoon: [],
                evening: []
              }
            };
          } catch (error) {
            console.warn(`구성원 ${member.name}의 상세 스케줄 조회 실패:`, error);
            return {
              memberName: member.name,
              schedule: {
                morning: [],
                afternoon: [],
                evening: []
              }
            };
          }
        });
        
        const detailedScheduleResults = await Promise.all(detailedSchedulePromises);
        
        // 결과를 TodayDetailedSchedule 형태로 변환
        const detailedScheduleMap: TodayDetailedSchedule = {};
        detailedScheduleResults.forEach(result => {
          detailedScheduleMap[result.memberName] = result.schedule;
        });
        
        // 🔥 excluded 상태 카운트 계산
        let excludedCount = 0;
        Object.values(detailedScheduleMap).forEach(schedule => {
          excludedCount += schedule.morning.filter(m => m.status === 'excluded').length;
          excludedCount += schedule.afternoon.filter(m => m.status === 'excluded').length;
          excludedCount += schedule.evening.filter(m => m.status === 'excluded').length;
        });
        
        // 🔥 dashboardStats 업데이트 (totalExcluded 포함)
        setDashboardStats(prev => ({
          ...prev,
          totalExcluded: excludedCount,
          totalRemaining: prev.totalRemaining - excludedCount // 남음에서 제외된 것 빼기
        }));
        
        setTodayDetailedSchedule(detailedScheduleMap);
        console.log('[useFamilyDashboard] 상세 스케줄 로드 완료:', detailedScheduleMap, '제외된 약:', excludedCount);
      }

      // 🔥 기기 상태 조회
      const machineResponse = await getFamilyMachineStatus(connect);
      
      if (machineResponse.success && machineResponse.data) {
        const { connectedDevices: connected, totalDevices: total, machineStatus: machines } = machineResponse.data;
        
        setConnectedDevices(connected);
        setTotalDevices(total);
        setMachineStatus(machines || []);

        console.log('[useFamilyDashboard] 기기 상태 로드 완료:', {
          connected,
          total,
          machines: machines?.length,
        });
      }

      setLastUpdated(new Date());
      console.log('[useFamilyDashboard] 모든 데이터 로드 완료');

    } catch (err) {
      console.error('[useFamilyDashboard] 데이터 로드 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [connect]);

  const refreshData = () => {
    fetchData();
  };

  return {
    // 데이터
    familyMembers,
    dashboardStats,
    timeBasedStats,
    machineStatus,
    connectedDevices,
    totalDevices,
    todayDetailedSchedule,
    
    // 상태
    loading,
    error,
    lastUpdated,
    
    // 메서드
    refreshData,
  };
}; 