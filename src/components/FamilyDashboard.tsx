import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFamilyDashboard } from '../hooks/useFamilyDashboard';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getDoseTimeSettings, DoseTimeSettings } from '../utils/doseTimeSettings';
import ProgressCircle from './dashboard/ProgressCircle';
import StatsGrid from './dashboard/StatsGrid';
import OverallProgress from './dashboard/OverallProgress';
import MemberDetailCard from './dashboard/MemberDetailCard';
import TimeStatsSection from './dashboard/TimeStatsSection';
import MachineStatusSection from './dashboard/MachineStatusSection';
import { StatsCardSkeleton, MemberCardSkeleton, SkeletonLoader } from './common/SkeletonLoader';

interface FamilyDashboardProps {
  connect: string;
  onRefresh?: (medicineId?: string, userId?: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') => void;
}


const FamilyDashboard: React.FC<FamilyDashboardProps> = ({ connect, onRefresh }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const [doseTimeSettings, setDoseTimeSettings] = useState<DoseTimeSettings>({
    morning: '08:00',
    afternoon: '13:00',
    evening: '19:00'
  });
  
  const {
    familyMembers,
    dashboardStats,
    timeBasedStats,
    machineStatus,
    connectedDevices,
    totalDevices,
    todayDetailedSchedule,
    loading,
    error,
    lastUpdated,
    refreshData,
  } = useFamilyDashboard(connect);

  // 🔥 복용 시간 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getDoseTimeSettings();
      setDoseTimeSettings(settings);
    };
    loadSettings();
  }, []);

  // 🔥 화면 포커스 시 대시보드 자동 새로고침 (스케줄/약물 변경 반영)
  // 🔥 의존성 배열을 최소화하여 무한 루프 방지
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log('📱 [FamilyDashboard] 화면 포커스 - 데이터 새로고침');
      }
      // 🔥 refreshData를 직접 호출하되, 무한 루프 방지를 위해 의존성 배열은 비워둠
      // refreshData는 안정적으로 메모이제이션되어 있으므로 안전
      if (connect) {
        refreshData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connect])
  );

  const handleRefresh = () => {
    refreshData();
    onRefresh?.();
  };
  
  // 🔥 상태 업데이트 핸들러 (약물 ID와 시간대 정보 전달)
  const handleStatusUpdate = useCallback(async (medicineId?: string, userId?: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') => {
    // 🔥 데이터 새로고침 완료를 기다림
    await refreshData();
    // 🔥 메인 화면에서도 상태를 업데이트할 수 있도록 정보 전달
    onRefresh?.(medicineId, userId, timeOfDay);
  }, [refreshData, onRefresh]);

  // 🔥 로그인한 사용자의 시간대별 통계만 계산
  const currentUserTimeStats = React.useMemo(() => {
    if (!user?.user_id) return [];
    
    // 현재 사용자의 스케줄 찾기
    const currentUserName = familyMembers.find(m => m.user_id === user.user_id)?.name;
    if (!currentUserName || !todayDetailedSchedule[currentUserName]) return [];
    
    const userSchedule = todayDetailedSchedule[currentUserName];
    
    if (__DEV__) {
    console.log('🔍 [FamilyDashboard] 시간대별 통계 계산:', {
      userName: currentUserName,
      morning: userSchedule.morning?.length || 0,
      afternoon: userSchedule.afternoon?.length || 0,
      evening: userSchedule.evening?.length || 0,
      morningMeds: userSchedule.morning?.map(m => ({ name: m.name, status: m.status })),
      afternoonMeds: userSchedule.afternoon?.map(m => ({ name: m.name, status: m.status })),
      eveningMeds: userSchedule.evening?.map(m => ({ name: m.name, status: m.status }))
    });
    }
    
    // 시간대별 통계 계산
    const timeLabels = {
      morning: '아침',
      afternoon: '점심',
      evening: '저녁'
    };
    
    return (['morning', 'afternoon', 'evening'] as const).map(timeOfDay => {
      const medicines = userSchedule[timeOfDay] || [];
      const scheduled = medicines.length;
      const completed = medicines.filter(m => m.status === 'completed').length;
      const missed = medicines.filter(m => m.status === 'missed').length;
      
      // 🔥 remaining 계산: 서버 로직과 일치 (scheduled - completed - missed)
      // 🔥 pending과 upcoming 모두 포함 (아직 기록되지 않은 모든 약물)
      const remaining = Math.max(0, scheduled - completed - missed);
      
      // 🔥 실제 복용해야 할 약 개수 (제외 상태 제거)
      const actualScheduled = scheduled;
      const completionRate = actualScheduled > 0 ? Math.round((completed / actualScheduled) * 100) : 0;
      
      // 🔥 데이터 검증: scheduled = completed + missed + remaining
      if (__DEV__) {
        const calculatedRemaining = scheduled - completed - missed;
        const statusBasedRemaining = medicines.filter(m => m.status === 'pending' || m.status === 'upcoming').length;
        console.log(`📊 [${timeLabels[timeOfDay]}] 통계:`, {
          scheduled,
          completed,
          missed,
          remaining: calculatedRemaining,
          statusBasedRemaining,
          completionRate: `${completionRate}%`,
          검증: scheduled === completed + missed + calculatedRemaining ? '✅' : '❌'
        });
      }
      
      return {
        timeOfDay,
        label: timeLabels[timeOfDay],
        scheduled,
        actualScheduled, // 🔥 실제 복용해야 할 약 개수
        completed,
        missed,
        remaining,
        excluded: 0, // 제외 상태 제거
        completionRate
      };
    }).filter(stat => stat.scheduled > 0); // 스케줄이 있는 시간대만 표시
  }, [user?.user_id, familyMembers, todayDetailedSchedule]);

  // 🔥 구성원별 상세 카드 목록 메모이제이션 (조건부 블록 밖에서 호출)
  const memberDetailCards = React.useMemo(() => 
    familyMembers.map((member) => {
      const schedule = todayDetailedSchedule[member.name as keyof typeof todayDetailedSchedule] || {
        morning: [],
        afternoon: [],
        evening: []
      };
      
      return (
        <MemberDetailCard
          key={member.user_id}
          member={member}
          schedule={schedule}
          doseTimeSettings={doseTimeSettings}
          currentUserId={user?.user_id || null}
          onStatusUpdate={handleStatusUpdate}
        />
      );
    }),
    [familyMembers, todayDetailedSchedule, doseTimeSettings, user?.user_id, handleStatusUpdate]
  );

  if (loading && !lastUpdated) {
    return (
      <ScrollView style={[
        styles.container,
        { backgroundColor: isDark ? themeColors.background : '#f8fafc' }
      ]}>
        {/* 전체 진행률 스켈레톤 */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <SkeletonLoader width={120} height={24} borderRadius={4} style={styles.marginBottom} />
          <SkeletonLoader width={100} height={100} borderRadius={50} style={styles.center} />
        </View>

        {/* 통계 카드 스켈레톤 */}
        <View style={styles.statsGrid}>
          {[1, 2, 3, 4].map((idx) => (
            <StatsCardSkeleton key={idx} isDark={isDark} />
          ))}
        </View>

        {/* 구성원 카드 스켈레톤 */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <SkeletonLoader width={150} height={20} borderRadius={4} style={styles.marginBottom} />
          {[1, 2, 3].map((idx) => (
            <MemberCardSkeleton key={idx} isDark={isDark} />
          ))}
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={[
        styles.errorContainer,
        { backgroundColor: isDark ? themeColors.background : '#f8fafc' }
      ]}>
        <Text style={[styles.errorText, { color: themeColors.text }]}>오류가 발생했습니다</Text>
        <Text style={[styles.errorMessage, { color: isDark ? '#888' : '#666' }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[
      styles.container,
      { backgroundColor: isDark ? themeColors.background : '#f8fafc' }
    ]} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>가족 복용 현황</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={loading}>
          <Text style={[styles.refreshButton, loading && styles.refreshDisabled]}>
            {loading ? '새로고침 중...' : '새로고침'} 
          </Text>
        </TouchableOpacity>
      </View>

      {/* 전체 진행률 */}
      <OverallProgress
        completionRate={dashboardStats.completionRate}
        totalCompleted={dashboardStats.totalCompleted}
        totalScheduled={dashboardStats.totalScheduled}
        totalExcluded={dashboardStats.totalExcluded}
        memberCount={dashboardStats.memberCount}
      />

      {/* 통계 카드들 */}
      <StatsGrid
        totalCompleted={dashboardStats.totalCompleted}
        totalMissed={dashboardStats.totalMissed}
        totalRemaining={dashboardStats.totalRemaining}
        totalExcluded={dashboardStats.totalExcluded}
      />

      {/* 가족 구성원별 상세 현황 */}
      {familyMembers.length > 0 && (
        <View style={[
          styles.membersContainer,
          { backgroundColor: themeColors.card }
        ]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>구성원별 오늘 복용 현황</Text>
          {memberDetailCards}
        </View>
      )}

      {/* 시간대별 현황 - 로그인한 사용자 기준 */}
      <TimeStatsSection timeStats={currentUserTimeStats} />

      {/* 기기 상태 */}
      <MachineStatusSection
        machineStatus={machineStatus}
        connectedDevices={connectedDevices}
        totalDevices={totalDevices}
      />

      {/* 마지막 업데이트 시간 */}
      {lastUpdated && (
        <View style={styles.footer}>
          <Text style={[styles.lastUpdated, { color: isDark ? '#888' : '#666' }]}>
            마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  marginBottom: {
    marginBottom: 16,
  },
  center: {
    alignSelf: 'center',
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    margin: 16,
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshDisabled: {
    color: '#94a3b8',
  },
  // 구성원별 상세 카드
  membersContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  lastUpdated: {
    fontSize: 12,
  },
});

export default FamilyDashboard; 