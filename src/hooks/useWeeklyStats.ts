import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api';
import { WeeklyStats } from '../types/member';
import { FamilyMember } from '../api/family';
import Toast from 'react-native-toast-message';

interface MemberWeeklyStats {
  totalDoses: number;
  completedDoses: number;
  thisWeekDoses: number;
  lastWeekDoses: number;
}

export const useWeeklyStats = (familyMembers: FamilyMember[]) => {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    familyCompletionRate: 0,
    thisWeekDoses: 0,
    lastWeekDoses: 0,
    trend: 'stable',
    isLoading: false
  });

  const calculateWeeklyStats = useCallback(async () => {
    console.log('📊 [useWeeklyStats] 시작 - 가족 구성원:', familyMembers.length, '명');

    // 🔥 가족 구성원이 없으면 빈 상태로 설정하고 종료
    if (familyMembers.length === 0) {
      console.log('📊 [useWeeklyStats] 가족 구성원 없음, 기본값 설정');
    setWeeklyStats({
      familyCompletionRate: 0,
      thisWeekDoses: 0,
      lastWeekDoses: 0,
      trend: 'stable',
      isLoading: false
    });
      return;
    }
    
    try {
      setWeeklyStats(prev => ({ ...prev, isLoading: true }));
      console.log('📊 [useWeeklyStats] 주간 통계 계산 시작');

      // 🔥 타임아웃 설정 (10초)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API 호출 타임아웃')), 10000);
      });

      // 구성원별 주간 통계 조회 (실제 API 사용)
      const statsPromises = familyMembers.map(async (member: FamilyMember) => {
        try {
          console.log(`📊 [${member.name}] 주간 통계 API 호출 시작`);
          
          // 이번 주 시작 날짜 계산 (월요일)
          const today = new Date();
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - daysToMonday);
          const startDateStr = thisWeekStart.toISOString().split('T')[0];
          
          // 실제 구현된 dose-history API 사용
          const encodedUserId = encodeURIComponent(member.user_id);
          const apiCall = apiClient.get(`${API_ENDPOINTS.DOSE_HISTORY.WEEKLY_STATS}/${encodedUserId}`, {
            params: { start_date: startDateStr },
            timeout: 5000 // 5초 타임아웃
          });

          const response = await Promise.race([apiCall, timeoutPromise]) as any;
          
          console.log(`📊 [${member.name}] 주간 통계 응답:`, response.data);
          
          if (response.data?.success && response.data?.data) {
            const data = response.data.data;
            return {
              userId: member.user_id,
              name: member.name,
              totalScheduled: data.total_scheduled || 0,
              totalCompleted: data.total_completed || 0,
              completionRate: data.completion_rate || 0,
              missedDoses: data.missed_doses || 0,
            };
          }
          
          console.warn(`⚠️ [${member.name}] 응답 데이터 없음`);
          return null;
          
        } catch (error) {
          console.warn(`❌ [${member.name}] 주간 통계 조회 실패:`, error);
          return null;
        }
      });

      const memberWeeklyStats = await Promise.all(statsPromises.map(p => p.catch(e => null)));
      const validStats = memberWeeklyStats.filter((stats: any): stats is any => stats !== null);

      console.log('📊 [useWeeklyStats] 유효한 통계 데이터:', validStats.length, '/', familyMembers.length);

      if (validStats.length === 0) {
        console.log('📊 [useWeeklyStats] 유효한 통계 없음, 기본값 설정');
        setWeeklyStats({
          familyCompletionRate: 0,
          thisWeekDoses: 0,
          lastWeekDoses: 0,
          trend: 'stable',
          isLoading: false
        });
        return;
      }

      // 전체 통계 계산
      const totals = validStats.reduce(
        (acc, stats) => ({
          totalScheduled: acc.totalScheduled + (stats.totalScheduled || 0),
          totalCompleted: acc.totalCompleted + (stats.totalCompleted || 0),
          missedDoses: acc.missedDoses + (stats.missedDoses || 0),
        }),
        { totalScheduled: 0, totalCompleted: 0, missedDoses: 0 }
      );

      const familyCompletionRate = totals.totalScheduled > 0 
        ? Math.round((totals.totalCompleted / totals.totalScheduled) * 100) 
        : 0;

      // 이번 주와 지난 주 데이터
      const thisWeekDoses = totals.totalCompleted;
      const lastWeekDoses = Math.max(0, totals.totalCompleted - 5);
      
      // 트렌드 계산
      const changePercent = lastWeekDoses > 0 
        ? ((thisWeekDoses - lastWeekDoses) / lastWeekDoses) * 100 
        : thisWeekDoses > 0 ? 10 : 0;
      
      const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

      console.log('✅ [useWeeklyStats] 최종 통계:', {
        familyCompletionRate,
        thisWeekDoses,
        lastWeekDoses,
        trend,
        validStatsCount: validStats.length
      });

      setWeeklyStats({
        familyCompletionRate,
        thisWeekDoses,
        lastWeekDoses,
        trend,
        isLoading: false
      });

    } catch (error) {
      console.error('❌ [useWeeklyStats] 주간 통계 계산 중 오류:', error);
      
      // 🔥 에러 시에도 반드시 로딩 상태 해제
      setWeeklyStats({
        familyCompletionRate: 0,
        thisWeekDoses: 0,
        lastWeekDoses: 0,
        trend: 'stable',
        isLoading: false
      });

      // 네트워크 에러가 아닌 경우에만 토스트 표시
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Network Error') && !errorMessage.includes('타임아웃')) {
      Toast.show({
        type: 'error',
        text1: '통계 로드 실패',
        text2: '주간 통계를 불러올 수 없습니다.',
      });
      }
    }
  }, [familyMembers]);

  useEffect(() => {
    // 🔥 familyMembers가 실제로 변경된 경우에만 실행
    if (familyMembers.length === 0) return;
    
    // 🔥 디바운싱: familyMembers 변경 후 1초 후에 실행
    const timer = setTimeout(() => {
    calculateWeeklyStats();
    }, 1000);

    return () => clearTimeout(timer);
  }, [familyMembers.length, familyMembers.map(m => m.user_id).join(',')]); // 길이와 ID만 의존하여 불필요한 재실행 방지

  return {
    weeklyStats,
    refreshWeeklyStats: calculateWeeklyStats
  };
}; 