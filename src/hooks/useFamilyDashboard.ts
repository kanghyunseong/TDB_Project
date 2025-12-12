import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import {
  getFamilyMembers,
  getDetailedFamilyStats,
  getFamilyMachineStatus,
} from '../services/familyStats';
import { getMemberTodayStats, getFamilyTodaySchedules } from '../api/familyStats';
import { getDoseTimeSettings, getHourFromTimeString } from '../utils/doseTimeSettings';
import { logger } from '../utils/logger';

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
      status: 'completed' | 'pending' | 'missed' | 'upcoming';
      medi_id?: string;
      scheduled_dose?: number;
      actual_dose?: number;
      completed_at?: string;
    }>;
    afternoon: Array<{
      name: string;
      status: 'completed' | 'pending' | 'missed' | 'upcoming';
      medi_id?: string;
      scheduled_dose?: number;
      actual_dose?: number;
      completed_at?: string;
    }>;
    evening: Array<{
      name: string;
      status: 'completed' | 'pending' | 'missed' | 'upcoming';
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
  refreshData: () => Promise<void>;
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

  // 🔥 컴포넌트 마운트 상태 추적 (unmount 시 상태 업데이트 방지)
  const isMountedRef = useRef(true);

  // 🔥 시간 설정 캐싱 (한 번만 불러오기)
  const doseTimeSettingsCache = useRef<{
    settings: Awaited<ReturnType<typeof getDoseTimeSettings>> | null;
    timeSlotHours: { morning: number; afternoon: number; evening: number } | null;
  }>({ settings: null, timeSlotHours: null });

  // 🔥 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🔥 시간 설정 로드 (최초 1회만)
  const loadDoseTimeSettings = useCallback(async () => {
    if (!doseTimeSettingsCache.current.settings) {
      const settings = await getDoseTimeSettings();
      doseTimeSettingsCache.current.settings = settings;
      doseTimeSettingsCache.current.timeSlotHours = {
        morning: getHourFromTimeString(settings.morning),
        afternoon: getHourFromTimeString(settings.afternoon),
        evening: getHourFromTimeString(settings.evening)
      };
    }
    return doseTimeSettingsCache.current.timeSlotHours!;
  }, []);

  // 🔥 복용 상태 판단 (백엔드 status + 시간 범위 기반)
  // 🔥 서버의 getFamilyTodaySchedules에서 이미 24시간 기준 초기화 및 새로운 스케줄 체크를 완료했으므로
  // 🔥 클라이언트에서는 서버에서 반환한 상태를 그대로 사용
  const getDoseStatus = useCallback(async (
    backendStatus: 'completed' | 'missed' | 'partial' | null,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    scheduleCreatedAt?: string,  // 🔥 스케줄 생성 시간 추가
    completedAt?: string  // 🔥 완료 시간 추가
  ): Promise<'completed' | 'pending' | 'missed' | 'upcoming'> => {
    // 🔥 서버에서 명시적으로 기록된 상태가 있으면 그대로 사용
    // 🔥 서버에서 이미 새로운 스케줄 체크를 완료했으므로 클라이언트에서는 추가 체크 불필요
    if (backendStatus === 'completed') {
      if (__DEV__) {
        console.log(`✅ [getDoseStatus] completed 상태 그대로 반환: timeOfDay=${timeOfDay}, completed_at=${completedAt}`);
      }
      return 'completed';
    }
    
    if (backendStatus === 'missed') {
      if (__DEV__) {
        console.log(`✅ [getDoseStatus] missed 상태 그대로 반환: timeOfDay=${timeOfDay}, completed_at=${completedAt}`);
      }
      return 'missed';
    }
    
    if (backendStatus === 'partial') {
      if (__DEV__) {
        console.log(`✅ [getDoseStatus] partial 상태를 completed로 변환: timeOfDay=${timeOfDay}`);
      }
      return 'completed'; // partial도 일단 완료로 표시
    }
    
    // 🔥 backendStatus가 null인 경우에만 시간 기반 판단
    if (__DEV__) {
      console.log(`⚠️ [getDoseStatus] backendStatus가 null이므로 시간 기반 판단: timeOfDay=${timeOfDay}`);
    }
    
    // 기록이 없는 경우 (status = null) 시간 기준으로 판단
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // 🔥 캐시된 시간 설정 사용 (비동기 호출 제거)
    const timeSlotHours = await loadDoseTimeSettings();
    
    const startHour = timeSlotHours[timeOfDay];
    
    // 🔥 체크 가능한 시간 범위 (TimeSlotCard와 일치)
    // 아침: 6시 ~ 12시
    // 점심: 12시 ~ 18시
    // 저녁: 18시 ~ 24시 (또는 다음날 6시까지)
    let checkRangeStart: number;
    let checkRangeEnd: number;
    
    switch (timeOfDay) {
      case 'morning':
        checkRangeStart = 6;
        checkRangeEnd = 12;
        break;
      case 'afternoon':
        checkRangeStart = 12;
        checkRangeEnd = 18;
        break;
      case 'evening':
        checkRangeStart = 18;
        checkRangeEnd = 24; // 자정까지
        break;
      default:
        checkRangeStart = startHour;
        checkRangeEnd = startHour + 2;
    }
    
    // 🔥 현재 시간이 복용 범위 내에 있는지 확인
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const rangeStartMinutes = checkRangeStart * 60;
    const rangeEndMinutes = checkRangeEnd * 60;
    
    // 🔥 복용 시간 범위 전 → upcoming (다가오는 복용)
    if (currentTimeInMinutes < rangeStartMinutes) {
      return 'upcoming';
    }
    
    // 🔥 복용 시간 범위 내 → pending (복용 확인 필요, 체크/X 버튼 표시)
    // 저녁의 경우 자정 넘어가면 다음날 아침 6시까지는 pending 유지
    if (timeOfDay === 'evening' && currentHour < 6) {
      return 'pending';
    }
    
    if (currentTimeInMinutes >= rangeStartMinutes && currentTimeInMinutes < rangeEndMinutes) {
      return 'pending';
    }
    
    // 🔥 복용 시간 범위 후 → pending (사용자가 명시적으로 체크/X를 눌러야만 missed/completed로 변경)
    // 🔥 새로 등록한 스케줄은 시간이 지났어도 pending으로 유지 (사용자 액션 필요)
    if (scheduleCreatedAt && !backendStatus) {
      const scheduleCreatedDate = new Date(scheduleCreatedAt);
      const isCreatedToday = scheduleCreatedDate >= todayStart && scheduleCreatedDate <= now;
      
      if (isCreatedToday) {
        // 🔥 오늘 새로 등록한 스케줄은 시간이 지났어도 pending으로 유지
        // 사용자가 명시적으로 체크/X 버튼을 눌러야만 상태가 변경됨
        return 'pending';
      }
    }
    
    // 🔥 기존 스케줄이고 시간 범위를 지났지만 기록이 없는 경우
    // 이 경우도 pending으로 유지 (사용자가 명시적으로 체크/X를 눌러야 함)
    return 'pending';
  }, [loadDoseTimeSettings]);

  // 🔥 로딩 중이면 중복 호출 방지
  const isFetchingRef = useRef(false);

  const fetchData = React.useCallback(async () => {
    if (!connect) return;
    
    // 🔥 이미 로딩 중이면 중복 호출 방지
    if (isFetchingRef.current) {
      logger.debug('[useFamilyDashboard] 이미 로딩 중이므로 중복 호출 방지');
      return;
    }
    
    isFetchingRef.current = true;
    // 🔥 마운트 상태 확인 후 상태 업데이트
    if (isMountedRef.current) {
    setLoading(true);
    setError(null);
    }

    try {
      logger.debug(`[useFamilyDashboard] 데이터 로드 시작: ${connect}`);

      // 🔥 병렬 처리: 시간 설정 로드, 통계 조회, 기기 상태 조회를 동시에 실행
      const [_, detailedStatsResponse, machineResponse] = await Promise.all([
        loadDoseTimeSettings(), // 캐싱된 값이면 즉시 반환
        getDetailedFamilyStats(connect), // 상세 가족 통계 조회
        getFamilyMachineStatus(connect).catch(() => ({ success: false, data: null })) // 기기 상태 조회 (실패해도 계속 진행)
      ]);
      
      if (detailedStatsResponse.success && detailedStatsResponse.data) {
        const { summary, timeBasedStats: timeStats, memberStats } = detailedStatsResponse.data;
        
        // 🔥 마운트 상태 확인
        if (!isMountedRef.current) return;

        // 멤버 통계를 FamilyMember 형식으로 변환
        const members: FamilyMember[] = (memberStats || []).map((member: any) => ({
          user_id: member.user_id,
          name: member.name,
          role: member.role,
          completionRate: member.completionRate,
          todayCompleted: member.completed,
          todayScheduled: member.scheduled,
        }));
        
        // 대시보드 통계 설정
        if (isMountedRef.current) {
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

          // 멤버 목록 설정
        setFamilyMembers(members);
        }

        logger.debug('[useFamilyDashboard] 상세 통계 로드 완료:', {
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

        // 🔥 배치 API 사용: 모든 구성원의 오늘 스케줄을 한 번에 조회
        logger.debug('[useFamilyDashboard] 배치 API로 구성원별 상세 스케줄 조회 시작');
        
        // 🔥 배치 API 호출 시도
        const batchResponse = await getFamilyTodaySchedules(connect).catch(() => ({ success: false, data: null }));
        
        let detailedScheduleMap: TodayDetailedSchedule = {};
        
        if (batchResponse.success && batchResponse.data && batchResponse.data.members) {
          // 🔥 배치 API 성공: 배치 API 응답을 TodayDetailedSchedule 형식으로 변환
          logger.debug('[useFamilyDashboard] 배치 API 성공, 데이터 변환 중');
          
          await Promise.all(
            batchResponse.data.members.map(async (memberData) => {
              const timeSlotSchedule: {
                morning: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                  notes?: string; // 🔥 배출 기록
                }>;
                afternoon: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                  notes?: string; // 🔥 배출 기록
                }>;
                evening: Array<{
                  name: string;
                  status: 'completed' | 'pending' | 'missed' | 'upcoming';
                  medi_id?: string;
                  scheduled_dose?: number;
                  actual_dose?: number;
                  completed_at?: string;
                  notes?: string; // 🔥 배출 기록
                }>;
              } = {
                morning: [],
                afternoon: [],
                evening: []
              };
              
              // 약물 스케줄 처리
              if (memberData.medicines && memberData.medicines.length > 0) {
                if (__DEV__) {
                  console.log(`🔍 [약물 스케줄 처리 시작] ${memberData.name}: ${memberData.medicines.length}개 약물`);
                  memberData.medicines.forEach((schedule: any) => {
                    console.log(`  - ${schedule.name} (${schedule.time_of_day}): status=${schedule.status}, completed_at=${schedule.completed_at}, schedule_created_at=${schedule.schedule_created_at}`);
                  });
                }
                
                const medicineStatusPromises = memberData.medicines.map((schedule: any) => {
                  return getDoseStatus(schedule.status, schedule.time_of_day, schedule.schedule_created_at, schedule.completed_at);
                });
                const medicineStatuses = await Promise.all(medicineStatusPromises);
                
                memberData.medicines.forEach((schedule: any, index: number) => {
                  const status = medicineStatuses[index];
                  const timeOfDay = schedule.time_of_day as 'morning' | 'afternoon' | 'evening';
                  
                  // 🔥 서버에서 이미 24시간 기준 초기화 및 새로운 스케줄 체크를 완료했으므로
                  // 🔥 getDoseStatus에서 반환된 상태를 그대로 사용
                  // 🔥 서버의 getFamilyTodaySchedules에서 DATE(dh.dose_date) = :today로 필터링하므로
                  // 🔥 이미 오늘 날짜의 기록만 전달됨
                  let finalStatus = status;
                  
                  if (__DEV__) {
                    console.log(`✅ [최종 상태] ${schedule.name} (${timeOfDay}): 서버상태=${schedule.status} → 최종상태=${finalStatus}`);
                  }
                  
                  if (timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening') {
                    timeSlotSchedule[timeOfDay].push({
                      name: schedule.name,
                      status: finalStatus,
                      medi_id: schedule.medi_id,
                      scheduled_dose: schedule.scheduled_dose,
                      actual_dose: schedule.actual_dose,
                      completed_at: schedule.completed_at,
                      notes: schedule.notes // 🔥 배출 기록 전달
                    });
                  }
                });
              }
              
              // 영양제 스케줄 처리
              if (memberData.supplements && memberData.supplements.length > 0) {
                const supplementStatusPromises = memberData.supplements.map((schedule: any) =>
                  getDoseStatus(schedule.status, schedule.time_of_day, schedule.schedule_created_at, schedule.completed_at)
                );
                const supplementStatuses = await Promise.all(supplementStatusPromises);
                
                memberData.supplements.forEach((schedule: any, index: number) => {
                  const status = supplementStatuses[index];
                  const timeOfDay = schedule.time_of_day as 'morning' | 'afternoon' | 'evening';
                  
                  // 🔥 서버에서 이미 24시간 기준 초기화 및 새로운 스케줄 체크를 완료했으므로
                  // 🔥 getDoseStatus에서 반환된 상태를 그대로 사용
                  // 🔥 서버의 getFamilyTodaySchedules에서 DATE(dh.dose_date) = :today로 필터링하므로
                  // 🔥 이미 오늘 날짜의 기록만 전달됨
                  let finalStatus = status;
                  
                  if (timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening') {
                    timeSlotSchedule[timeOfDay].push({
                      name: schedule.name,
                      status: finalStatus,
                      medi_id: schedule.medi_id,
                      scheduled_dose: schedule.scheduled_dose,
                      actual_dose: schedule.actual_dose,
                      completed_at: schedule.completed_at,
                      notes: schedule.notes // 🔥 배출 기록 전달
                    });
                  }
                });
              }
              
              detailedScheduleMap[memberData.name] = timeSlotSchedule;
            })
          );
          
          logger.debug('[useFamilyDashboard] 배치 API로 상세 스케줄 로드 완료:', {
            memberCount: batchResponse.data.members.length,
            scheduleMap: Object.keys(detailedScheduleMap)
          });
          
          // 🔥 마운트 상태 확인
          if (!isMountedRef.current) return;
          
          // 🔥 배치 API 성공 시에도 todayDetailedSchedule 업데이트
          if (isMountedRef.current) {
            setTodayDetailedSchedule(detailedScheduleMap);
            logger.debug('[useFamilyDashboard] 배치 API로 todayDetailedSchedule 업데이트 완료');
          }
        } else {
          // 🔥 배치 API 실패 시 기존 방식으로 폴백 (호환성 유지)
          logger.warn('[useFamilyDashboard] 배치 API 실패, 기존 방식으로 폴백');
          
          // 기존 개별 API 호출 방식
          const detailedSchedulePromises = members.map(async (member) => {
          try {
            const { getMedicineList, getSupplementSchedule } = require('../api/family');
            
            // 🔥 최적화: 약물 스케줄과 약물 목록을 병렬로 조회
            const [memberTodayResponse, medicineListResponse] = await Promise.all([
              getMemberTodayStats(member.user_id),
              getMedicineList(member.user_id).catch(() => ({ success: false, data: [] })) // 실패해도 계속 진행
            ]);
            
            // 시간대별로 분류
            const timeSlotSchedule: {
              morning: Array<{
                name: string;
                status: 'completed' | 'pending' | 'missed' | 'upcoming';
                medi_id?: string;
                scheduled_dose?: number;
                actual_dose?: number;
                completed_at?: string;
              }>;
              afternoon: Array<{
                name: string;
                status: 'completed' | 'pending' | 'missed' | 'upcoming';
                medi_id?: string;
                scheduled_dose?: number;
                actual_dose?: number;
                completed_at?: string;
              }>;
              evening: Array<{
                name: string;
                status: 'completed' | 'pending' | 'missed' | 'upcoming';
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
            
            // 약물 스케줄 처리
            if (memberTodayResponse.success && memberTodayResponse.data) {
              const memberData = memberTodayResponse.data;
              
              if (memberData.todaySchedules) {
                logger.debug(`🔍 [useFamilyDashboard] ${member.name}의 스케줄 조회:`, {
                  totalSchedules: memberData.todaySchedules.length,
                  schedules: memberData.todaySchedules.map((s: any) => ({
                    name: s.medi_name,
                    timeOfDay: s.time_of_day,
                    status: s.status,
                    created_at: s.schedule_created_at
                  }))
                });
                
                // 🔥 getDoseStatus 호출을 배치로 처리 (병렬 처리)
                const statusPromises = memberData.todaySchedules.map((schedule: any) => 
                  getDoseStatus(schedule.status, schedule.time_of_day, schedule.schedule_created_at, schedule.completed_at)
                );
                const statuses = await Promise.all(statusPromises);
                
                // 🔥 상태를 받은 후 한 번에 처리
                memberData.todaySchedules.forEach((schedule: any, index: number) => {
                  let status = statuses[index];
                  
                  // 🔥 새로운 스케줄이 등록된 경우: 스케줄 생성 시간이 완료 시간보다 나중이면 완료 상태 무시
                  if (status === 'completed' && schedule.schedule_created_at && schedule.completed_at) {
                    const scheduleCreatedDate = new Date(schedule.schedule_created_at);
                    const completedDate = new Date(schedule.completed_at);
                    
                    // 🔥 스케줄 생성 시간이 완료 시간보다 나중이면, 새로운 스케줄이므로 완료 상태 무시
                    if (scheduleCreatedDate > completedDate) {
                      status = 'pending'; // 새로운 스케줄이므로 복용 완료 필요
                      logger.debug(`🔄 [useFamilyDashboard] 새로운 스케줄 감지 - 완료 상태 무시: ${schedule.medi_name} (${schedule.time_of_day})`);
                    }
                  }
                  
                  logger.debug(`🔍 [useFamilyDashboard] ${member.name} - ${schedule.medi_name} (${schedule.time_of_day}):`, {
                    backendStatus: schedule.status,
                    calculatedStatus: status,
                    created_at: schedule.schedule_created_at,
                    completed_at: schedule.completed_at
                  });
                  
                  const medicineInfo = {
                    name: schedule.medi_name,
                    status,
                    medi_id: schedule.medi_id,
                    scheduled_dose: schedule.scheduled_dose,
                    actual_dose: schedule.actual_dose,
                    completed_at: schedule.completed_at
                  };
                  
                  const timeOfDay = schedule.time_of_day as 'morning' | 'afternoon' | 'evening';
                  if (timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening') {
                    timeSlotSchedule[timeOfDay].push(medicineInfo);
                  }
                });
                
                logger.debug(`✅ [useFamilyDashboard] ${member.name}의 최종 스케줄:`, {
                  morning: timeSlotSchedule.morning.length,
                  afternoon: timeSlotSchedule.afternoon.length,
                  evening: timeSlotSchedule.evening.length
                });
              }
            }
            
            // 2. 영양제 스케줄 조회 및 추가
            try {
              if (medicineListResponse.success && medicineListResponse.data) {
                // supplement_로 시작하는 것만 필터링 (영양제)
                const supplements = medicineListResponse.data.filter((item: any) => 
                  item.medi_id && item.medi_id.startsWith('supplement_')
                );
                
                logger.debug(`[useFamilyDashboard] ${member.name}의 영양제: ${supplements.length}개`);
                
                // 영양제가 없으면 스킵
                if (supplements.length === 0) {
                  return {
                    memberName: member.name,
                    schedule: timeSlotSchedule
                  };
                }
                
                // 🔥 영양제 스케줄 조회를 병렬 처리
                const supplementSchedulePromises = supplements.map(async (supplement: any) => {
                  try {
                    const scheduleData = await getSupplementSchedule(supplement.medi_id, member.user_id);
                    return { supplement, scheduleData };
                  } catch (suppError) {
                    if (__DEV__) {
                      console.warn(`[useFamilyDashboard] ${member.name}의 영양제 ${supplement.name} 스케줄 조회 실패:`, suppError);
                    }
                    return { supplement, scheduleData: null };
                  }
                });
                
                const supplementSchedules = await Promise.all(supplementSchedulePromises);
                
                // 오늘 요일 확인 (한 번만)
                const today = new Date();
                const dayOfWeek = today.getDay();
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const todayName = dayNames[dayOfWeek];
                const todayShortName = shortDayNames[dayOfWeek];
                
                // 🔥 모든 영양제의 상태를 한 번에 계산
                const supplementStatusPromises: Promise<'completed' | 'pending' | 'missed' | 'upcoming'>[] = [];
                const supplementInfos: Array<{
                  supplement: any;
                  scheduleData: any;
                  timeSlots: Array<{ key: string; dose: number }>;
                }> = [];
                
                supplementSchedules.forEach(({ supplement, scheduleData }) => {
                  if (scheduleData && scheduleData.schedule) {
                    const todaySchedule = scheduleData.schedule[todayName] || scheduleData.schedule[todayShortName];
                    
                    if (todaySchedule) {
                      const timeSlots = [
                        { key: 'morning', dose: todaySchedule.morning ? (todaySchedule.morningDose || scheduleData.morningDose || 1) : 0 },
                        { key: 'afternoon', dose: todaySchedule.afternoon ? (todaySchedule.afternoonDose || scheduleData.afternoonDose || 1) : 0 },
                        { key: 'evening', dose: todaySchedule.evening ? (todaySchedule.eveningDose || scheduleData.eveningDose || 1) : 0 }
                      ];
                      
                      timeSlots.forEach(slot => {
                        if (slot.dose > 0) {
                          supplementStatusPromises.push(getDoseStatus(null, slot.key as 'morning' | 'afternoon' | 'evening'));
                          supplementInfos.push({ supplement, scheduleData, timeSlots: [slot] });
                        }
                      });
                    }
                  }
                });
                
                // 🔥 모든 상태를 한 번에 계산
                const supplementStatuses = await Promise.all(supplementStatusPromises);
                
                // 🔥 상태를 받은 후 한 번에 처리
                supplementInfos.forEach((info, index) => {
                  const status = supplementStatuses[index];
                  const slot = info.timeSlots[0];
                  
                  const supplementInfo = {
                    name: info.supplement.name,
                    status,
                    medi_id: info.supplement.medi_id,
                    scheduled_dose: slot.dose,
                    actual_dose: undefined,
                    completed_at: undefined
                  };
                  
                  (timeSlotSchedule[slot.key as 'morning' | 'afternoon' | 'evening'] as any[]).push(supplementInfo);
                });
              }
            } catch (suppListError) {
              logger.warn(`[useFamilyDashboard] ${member.name}의 영양제 목록 조회 실패:`, suppListError);
            }
            
            return {
              memberName: member.name,
              schedule: timeSlotSchedule
            };
          } catch (error) {
            logger.warn(`구성원 ${member.name}의 상세 스케줄 조회 실패:`, error);
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
        
          // 🔥 Promise.all 사용 (각 promise 내부에서 이미 에러 처리됨)
          let detailedScheduleResults;
          try {
            detailedScheduleResults = await Promise.all(detailedSchedulePromises);
          } catch (error) {
            // 🔥 전체 실패 시 빈 스케줄로 처리
            logger.error('[useFamilyDashboard] 스케줄 조회 전체 실패:', error);
            detailedScheduleResults = members.map(member => ({
              memberName: member.name,
              schedule: {
                morning: [],
                afternoon: [],
                evening: []
              }
            }));
          }
          
          // 🔥 마운트 상태 확인
          if (!isMountedRef.current) return;
          
          // 결과를 TodayDetailedSchedule 형태로 변환
          const detailedScheduleMap: TodayDetailedSchedule = {};
          detailedScheduleResults.forEach(result => {
            detailedScheduleMap[result.memberName] = result.schedule;
          });
          
          // 🔥 dashboardStats 업데이트 (제외 상태 제거)
          if (isMountedRef.current) {
            setDashboardStats(prev => {
              // 제외 상태를 제거했으므로 모든 스케줄이 실제 복용 대상
              const actualScheduled = prev.totalScheduled;
              // 정확한 복용률 계산
              const actualCompletionRate = actualScheduled > 0 
                ? Math.round((prev.totalCompleted / actualScheduled) * 100) 
                : 0;
              
              return {
            ...prev,
            totalExcluded: 0, // 제외 상태 제거
                totalRemaining: prev.totalRemaining, // 남음은 그대로
                completionRate: actualCompletionRate
              };
            });
          
          setTodayDetailedSchedule(detailedScheduleMap);
          }
          logger.debug('[useFamilyDashboard] 상세 스케줄 로드 완료 (폴백):', detailedScheduleMap);
        }
        
        // 🔥 배치 API 성공 시에는 이미 setTodayDetailedSchedule이 호출되었으므로
        // 🔥 여기서는 추가 작업 불필요 (중복 방지)
      }

      // 🔥 마운트 상태 확인
      if (!isMountedRef.current) return;

      // 🔥 기기 상태 설정 (이미 병렬로 조회됨)
      if (machineResponse.success && machineResponse.data) {
        const { connectedDevices: connected, totalDevices: total, machineStatus: machines } = machineResponse.data;
        
        if (isMountedRef.current) {
        setConnectedDevices(connected);
        setTotalDevices(total);
        setMachineStatus(machines || []);
        }

        logger.debug('[useFamilyDashboard] 기기 상태 로드 완료:', {
          connected,
          total,
          machines: machines?.length,
        });
      }

      if (isMountedRef.current) {
      setLastUpdated(new Date());
      }
      logger.debug('[useFamilyDashboard] 모든 데이터 로드 완료');

    } catch (err) {
      logger.error('[useFamilyDashboard] 데이터 로드 실패:', err);
      // 🔥 마운트 상태 확인 후 에러 상태 업데이트
      if (isMountedRef.current) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      }
    } finally {
      // 🔥 마운트 상태 확인 후 로딩 상태 업데이트
      if (isMountedRef.current) {
      setLoading(false);
      }
      isFetchingRef.current = false; // 🔥 로딩 완료 플래그 해제
    }
  }, [connect, loadDoseTimeSettings, getDoseStatus]);

  // 🔥 connect가 변경될 때만 fetchData 실행 (무한 루프 방지)
  useEffect(() => {
    if (connect) {
    fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  const refreshData = useCallback(async () => {
    if (connect) {
      // 🔥 이미 로딩 중이면 완료될 때까지 기다림
      if (isFetchingRef.current) {
        // 🔥 최대 5초까지 기다림
        let waitCount = 0;
        while (isFetchingRef.current && waitCount < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        // 🔥 여전히 로딩 중이면 새로 호출
        if (isFetchingRef.current) {
          logger.debug('[useFamilyDashboard] 기존 요청이 완료되지 않아 새로 호출');
        }
      }
      await fetchData();
    }
  }, [connect, fetchData]);

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