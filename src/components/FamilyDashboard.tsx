import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useFamilyDashboard } from '../hooks/useFamilyDashboard';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getDoseTimeSettings, DoseTimeSettings } from '../utils/doseTimeSettings';

interface FamilyDashboardProps {
  connect: string;
  onRefresh?: () => void;
}

interface ProgressCircleProps {
  percentage: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor?: string;
}

// 복용 상태 아이콘 컴포넌트
const DoseStatusIcon: React.FC<{ 
  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
  size?: number;
}> = ({ status, size = 20 }) => {
  const getIconConfig = () => {
    switch (status) {
      case 'completed':
        return { name: 'check-circle', color: '#10b981' };
      case 'pending':
        return { name: 'clock', color: '#f59e0b' };
      case 'missed':
        return { name: 'x-circle', color: '#ef4444' };
      case 'upcoming':
        return { name: 'circle', color: '#6b7280' };
      case 'excluded':
        return { name: 'minus-circle', color: '#9ca3af' };
      default:
        return { name: 'circle', color: '#6b7280' };
    }
  };

  const { name, color } = getIconConfig();
  return <Icon name={name} size={size} color={color} />;
};

// 시간대별 복용 상태 카드
const TimeSlotCard: React.FC<{
  label: string;
  time: string;
  medicines: Array<{
    name: string;
    status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
    medi_id?: string;
    scheduled_dose?: number;
  }>;
  backgroundColor: string;
  userId: string;
  currentUserId: string | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  onStatusUpdate?: () => void;
}> = ({ label, time, medicines, backgroundColor, userId, currentUserId, timeOfDay, onStatusUpdate }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [updating, setUpdating] = React.useState(false);
  
  // 🔥 약이 없으면 카드를 렌더링하지 않음
  if (medicines.length === 0) {
    return null;
  }
  
  // 🔥 pending 상태인 약이 있는지 확인
  const hasPendingMedicines = medicines.some(m => m.status === 'pending');
  
  // 🔥 복용 완료 처리
  const handleMarkCompleted = async (completed: boolean) => {
    setUpdating(true);
    try {
      const { apiClient } = require('../api/client');
      
      // pending 상태인 모든 약 처리
      const pendingMedicines = medicines.filter(m => m.status === 'pending');
      
      for (const medicine of pendingMedicines) {
        await apiClient.post('/api/dose-history/complete', {
          user_id: userId,
          medi_id: medicine.medi_id,
          time_of_day: timeOfDay,
          actual_dose: completed ? (medicine.scheduled_dose || 1) : 0,
          notes: completed ? '수동 체크 - 복용 완료' : '수동 체크 - 복용 안 함'
        });
      }
      
      // 성공 후 새로고침
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('복용 상태 업데이트 실패:', error);
    } finally {
      setUpdating(false);
    }
  };
  
  return (
    <View style={[
      styles.timeSlotCard,
      { backgroundColor }
    ]}>
      <View style={styles.timeSlotHeader}>
        <Text style={[styles.timeSlotLabel, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.timeSlotTime, { color: isDark ? '#888' : '#666' }]}>{time}</Text>
      </View>
      
      {/* 약 목록 - 세로 배치로 변경 */}
      <View style={styles.medicinesListContainer}>
        {medicines.map((medicine, index) => (
          <View 
            key={index} 
            style={[
              styles.modernMedicineItem,
              { 
                backgroundColor: isDark ? '#ffffff08' : '#00000005',
                borderLeftColor: 
                  medicine.status === 'completed' ? '#10b981' : 
                  medicine.status === 'pending' ? '#f59e0b' : 
                  medicine.status === 'missed' ? '#ef4444' : 
                  medicine.status === 'excluded' ? '#9ca3af' : '#6b7280'
              }
            ]}
          >
            <View style={styles.medicineItemLeft}>
              <DoseStatusIcon status={medicine.status} size={18} />
              <Text 
                style={[
                  styles.modernMedicineName,
                  { 
                    color: themeColors.text,
                    textDecorationLine: medicine.status === 'completed' || medicine.status === 'excluded' ? 'line-through' : 'none',
                    opacity: medicine.status === 'completed' || medicine.status === 'excluded' ? 0.5 : 1
                  }
                ]}
                numberOfLines={2}
              >
                {medicine.name}
              </Text>
            </View>
            {medicine.status === 'pending' && (
              <View style={[styles.statusBadge, { backgroundColor: '#f59e0b20' }]}>
                <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>대기중</Text>
              </View>
            )}
            {medicine.status === 'excluded' && (
              <View style={[styles.statusBadge, { backgroundColor: '#9ca3af20' }]}>
                <Text style={[styles.statusBadgeText, { color: '#6b7280' }]}>제외</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      
      {/* 🔥 복용 확인 버튼 (현재 로그인한 사용자의 pending 상태일 때만 표시) */}
      {hasPendingMedicines && !updating && userId === currentUserId && (
        <View style={styles.iconOnlyButtonsContainer}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: '#10b981' }]}
            onPress={() => handleMarkCompleted(true)}
            activeOpacity={0.7}
          >
            <Icon name="check" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: '#ef4444' }]}
            onPress={() => handleMarkCompleted(false)}
            activeOpacity={0.7}
          >
            <Icon name="x" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
      
      {updating && (
        <View style={styles.updatingContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={[styles.updatingText, { color: isDark ? '#888' : '#666' }]}>업데이트 중...</Text>
        </View>
      )}
    </View>
  );
};

const ProgressCircle: React.FC<ProgressCircleProps> = ({ 
  percentage, 
  size, 
  strokeWidth, 
  color, 
  backgroundColor 
}) => {
  const { isDark } = useTheme();
  const defaultBgColor = backgroundColor || (isDark ? '#333' : '#f0f0f0');
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={[
      styles.progressCircleContainer,
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: defaultBgColor 
      }
    ]}>
      {/* 진행률 표시를 위한 오버레이 */}
      <View 
        style={[
          styles.progressOverlay,
          { 
            width: size - strokeWidth * 2, 
            height: size - strokeWidth * 2,
            borderRadius: (size - strokeWidth * 2) / 2,
            borderWidth: strokeWidth / 2,
            borderColor: color,
            borderTopColor: color,
            borderRightColor: percentage > 25 ? color : defaultBgColor,
            borderBottomColor: percentage > 50 ? color : defaultBgColor,
            borderLeftColor: percentage > 75 ? color : defaultBgColor,
          }
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: size / 6, fontWeight: 'bold', color }}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
};

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

  const handleRefresh = () => {
    refreshData();
    onRefresh?.();
  };

  // 🔥 로그인한 사용자의 시간대별 통계만 계산
  const currentUserTimeStats = React.useMemo(() => {
    if (!user?.user_id) return [];
    
    // 현재 사용자의 스케줄 찾기
    const currentUserName = familyMembers.find(m => m.user_id === user.user_id)?.name;
    if (!currentUserName || !todayDetailedSchedule[currentUserName]) return [];
    
    const userSchedule = todayDetailedSchedule[currentUserName];
    
    console.log('🔍 [FamilyDashboard] 시간대별 통계 계산:', {
      userName: currentUserName,
      morning: userSchedule.morning?.length || 0,
      afternoon: userSchedule.afternoon?.length || 0,
      evening: userSchedule.evening?.length || 0,
      morningMeds: userSchedule.morning?.map(m => ({ name: m.name, status: m.status })),
      afternoonMeds: userSchedule.afternoon?.map(m => ({ name: m.name, status: m.status })),
      eveningMeds: userSchedule.evening?.map(m => ({ name: m.name, status: m.status }))
    });
    
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
      const excluded = medicines.filter(m => m.status === 'excluded').length;
      const remaining = medicines.filter(m => m.status === 'pending' || m.status === 'upcoming').length;
      
      // 🔥 실제 복용해야 할 약 개수 (제외된 약은 빼기)
      const actualScheduled = scheduled - excluded;
      const completionRate = actualScheduled > 0 ? Math.round((completed / actualScheduled) * 100) : 0;
      
      console.log(`📊 [${timeLabels[timeOfDay]}] scheduled: ${scheduled}, excluded: ${excluded}, actualScheduled: ${actualScheduled}, completed: ${completed}, rate: ${completionRate}%`);
      
      return {
        timeOfDay,
        label: timeLabels[timeOfDay],
        scheduled,
        actualScheduled, // 🔥 실제 복용해야 할 약 개수
        completed,
        missed,
        remaining,
        excluded,
        completionRate
      };
    }).filter(stat => stat.scheduled > 0); // 스케줄이 있는 시간대만 표시
  }, [user?.user_id, familyMembers, todayDetailedSchedule]);

  if (loading && !lastUpdated) {
    return (
      <View style={[
        styles.loadingContainer,
        { backgroundColor: isDark ? themeColors.background : '#f8fafc' }
      ]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, { color: themeColors.text }]}>가족 대시보드 로딩 중...</Text>
      </View>
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
      <View style={[
        styles.overallProgressContainer,
        { backgroundColor: themeColors.card }
      ]}>
        <ProgressCircle
          percentage={dashboardStats.completionRate}
          size={120}
          strokeWidth={8}
          color="#10b981"
        />
        <View style={styles.overallProgressText}>
          <Text style={[styles.progressTitle, { color: themeColors.text }]}>전체 복용률</Text>
          <Text style={[styles.progressSubtitle, { color: isDark ? '#888' : '#666' }]}>
            {dashboardStats.totalCompleted}/{dashboardStats.totalScheduled} 완료
          </Text>
          <Text style={[styles.progressMembers, { color: isDark ? '#888' : '#666' }]}>
            가족 구성원 {dashboardStats.memberCount}명
          </Text>
        </View>
      </View>

      {/* 통계 카드들 */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { 
          backgroundColor: isDark ? '#1e3a8a20' : '#dbeafe' 
        }]}>
          <Icon name="check-circle" size={24} color="#1d4ed8" />
          <Text style={[styles.statNumber, { color: '#1d4ed8' }]}>
            {dashboardStats.totalCompleted}
          </Text>
          <Text style={[styles.statLabel, { color: '#1e40af' }]}>완료</Text>
        </View>
        
        <View style={[styles.statCard, { 
          backgroundColor: isDark ? '#dc262620' : '#fed7d7' 
        }]}>
          <Icon name="x-circle" size={24} color="#dc2626" />
          <Text style={[styles.statNumber, { color: '#dc2626' }]}>
            {dashboardStats.totalMissed}
          </Text>
          <Text style={[styles.statLabel, { color: '#b91c1c' }]}>놓침</Text>
        </View>
        
        <View style={[styles.statCard, { 
          backgroundColor: isDark ? '#d9770620' : '#fef3c7' 
        }]}>
          <Icon name="clock" size={24} color="#d97706" />
          <Text style={[styles.statNumber, { color: '#d97706' }]}>
            {dashboardStats.totalRemaining}
          </Text>
          <Text style={[styles.statLabel, { color: '#92400e' }]}>남음</Text>
        </View>
        
        <View style={[styles.statCard, { 
          backgroundColor: isDark ? '#6b728020' : '#e5e7eb' 
        }]}>
          <Icon name="minus-circle" size={24} color="#6b7280" />
          <Text style={[styles.statNumber, { color: '#6b7280' }]}>
            {dashboardStats.totalExcluded}
          </Text>
          <Text style={[styles.statLabel, { color: '#4b5563' }]}>제외</Text>
        </View>
      </View>

      {/* 가족 구성원별 상세 현황 */}
      {familyMembers.length > 0 && (
        <View style={[
          styles.membersContainer,
          { backgroundColor: themeColors.card }
        ]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>구성원별 오늘 복용 현황</Text>
          {familyMembers.map((member) => {
            const schedule = todayDetailedSchedule[member.name as keyof typeof todayDetailedSchedule] || {
              morning: [],
              afternoon: [],
              evening: []
            };
            
            // 🔥 제외된 약 개수 계산
            const excludedCount = [
              ...schedule.morning,
              ...schedule.afternoon,
              ...schedule.evening
            ].filter(med => med.status === 'excluded').length;
            
            // 🔥 실제 복용해야 할 약 개수 (전체 - 제외)
            const actualScheduled = member.todayScheduled - excludedCount;
            
            // 🔥 정확한 완료율 재계산
            const actualCompletionRate = actualScheduled > 0 
              ? Math.round((member.todayCompleted / actualScheduled) * 100)
              : 0;
            
            // 🔥 디버깅: 스케줄 데이터 확인
            console.log(`🔍 [FamilyDashboard] ${member.name}의 스케줄:`, {
              morning: schedule.morning.length,
              afternoon: schedule.afternoon.length,
              evening: schedule.evening.length,
              excludedCount,
              originalScheduled: member.todayScheduled,
              actualScheduled,
              completed: member.todayCompleted,
              originalRate: member.completionRate,
              actualRate: actualCompletionRate
            });
            
            // 🔥 모든 시간대가 비어있으면 카드를 렌더링하지 않음
            const hasAnyMedicines = schedule.morning.length > 0 || schedule.afternoon.length > 0 || schedule.evening.length > 0;
            
            console.log(`🔍 [FamilyDashboard] ${member.name} 카드 표시 여부:`, hasAnyMedicines);
            
            if (!hasAnyMedicines) {
              return null;
            }
            
            return (
              <View key={member.user_id} style={[
                styles.memberDetailCard,
                { backgroundColor: isDark ? '#2a2a2a' : '#ffffff' }
              ]}>
                <View style={styles.memberHeader}>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: themeColors.text }]}>{member.name}</Text>
                    <Text style={[styles.memberRole, { color: isDark ? '#888' : '#666' }]}>
                      {member.role === 'parent' ? '보호자' : '자녀'}
                    </Text>
                  </View>
                  <View style={styles.memberStats}>
                    <ProgressCircle
                      percentage={actualCompletionRate}
                      size={50}
                      strokeWidth={3}
                      color={actualCompletionRate >= 80 ? '#10b981' : actualCompletionRate >= 50 ? '#f59e0b' : '#ef4444'}
                    />
                    <Text style={[styles.memberStatsText, { color: isDark ? '#888' : '#666' }]}>
                      {member.todayCompleted}/{actualScheduled}
                    </Text>
                  </View>
                </View>
                
                {/* 시간대별 복용 상세 */}
                <View style={styles.timeScheduleContainer}>
                  <TimeSlotCard
                    label="아침"
                    time={doseTimeSettings.morning}
                    medicines={schedule.morning}
                    backgroundColor={isDark ? '#1e293b' : '#f8fafc'}
                    userId={member.user_id}
                    currentUserId={user?.user_id || null}
                    timeOfDay="morning"
                    onStatusUpdate={refreshData}
                  />
                  <TimeSlotCard
                    label="점심"
                    time={doseTimeSettings.afternoon}
                    medicines={schedule.afternoon}
                    backgroundColor={isDark ? '#1e293b' : '#f8fafc'}
                    userId={member.user_id}
                    currentUserId={user?.user_id || null}
                    timeOfDay="afternoon"
                    onStatusUpdate={refreshData}
                  />
                  <TimeSlotCard
                    label="저녁"
                    time={doseTimeSettings.evening}
                    medicines={schedule.evening}
                    backgroundColor={isDark ? '#1e293b' : '#f8fafc'}
                    userId={member.user_id}
                    currentUserId={user?.user_id || null}
                    timeOfDay="evening"
                    onStatusUpdate={refreshData}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 시간대별 현황 - 로그인한 사용자 기준 */}
      {currentUserTimeStats.length > 0 && (
        <View style={[
          styles.timeStatsContainer,
          { backgroundColor: themeColors.card }
        ]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>나의 시간대별 복용 현황</Text>
          {currentUserTimeStats.map((timeStat) => (
            <View key={timeStat.timeOfDay} style={[
              styles.timeStatRow,
              { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
            ]}>
              <View style={styles.timeStatInfo}>
                <Text style={[styles.timeStatLabel, { color: themeColors.text }]}>{timeStat.label}</Text>
                <Text style={[styles.timeStatDetails, { color: isDark ? '#888' : '#666' }]}>
                  {timeStat.completed}/{timeStat.actualScheduled} 
                  {timeStat.remaining > 0 && ` (${timeStat.remaining}개 남음)`}
                  {timeStat.missed > 0 && ` (${timeStat.missed}개 놓침)`}
                  {timeStat.excluded > 0 && ` (${timeStat.excluded}개 제외)`}
                </Text>
              </View>
              <ProgressCircle
                percentage={timeStat.completionRate}
                size={60}
                strokeWidth={4}
                color={timeStat.completionRate >= 80 ? '#10b981' : timeStat.completionRate >= 50 ? '#f59e0b' : '#ef4444'}
              />
            </View>
          ))}
        </View>
      )}

      {/* 기기 상태 */}
      <View style={[
        styles.machineContainer,
        { backgroundColor: themeColors.card }
      ]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>스마트 기기 현황</Text>
        <View style={styles.machineStatusRow}>
          <Text style={[styles.machineStatusText, { color: themeColors.text }]}>
            연결된 기기: {connectedDevices}/{totalDevices}
          </Text>
          <View style={[
            styles.connectionStatus,
            { backgroundColor: connectedDevices === totalDevices ? '#10b981' : '#f59e0b' }
          ]}>
            <Text style={styles.connectionStatusText}>
              {connectedDevices === totalDevices ? '정상' : '일부 미연결'}
            </Text>
          </View>
        </View>
        
        {machineStatus.map((machine) => (
          <View key={machine.machine_id} style={[
            styles.machineCard,
            { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
          ]}>
            <View style={styles.machineHeader}>
              <Text style={[styles.machineId, { color: themeColors.text }]}>기기 : {machine.machine_id}</Text>
              <View style={[
                styles.machineConnectionDot,
                { backgroundColor: machine.isConnected ? '#10b981' : '#ef4444' }
              ]} />
            </View>
            <Text style={[styles.machineDetails, { color: isDark ? '#888' : '#666' }]}>
              활성 슬롯: {machine.activeSlots}/{machine.totalSlots}
              {machine.lowStockSlots > 0 && ` (부족: ${machine.lowStockSlots}개)`}
            </Text>
            <Text style={[styles.machineUsers, { color: isDark ? '#888' : '#666' }]}>
              사용자: {machine.users.map(u => u.name).join(', ')}
            </Text>
          </View>
        ))}
      </View>

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
  progressCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
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
  overallProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  overallProgressText: {
    marginLeft: 20,
    flex: 1,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressSubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  progressMembers: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  memberDetailCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
  },
  memberStats: {
    alignItems: 'center',
  },
  memberStatsText: {
    fontSize: 12,
    marginTop: 4,
  },
  // 시간대별 스케줄
  timeScheduleContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  timeSlotCard: {
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  timeSlotHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  timeSlotLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  timeSlotTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  medicinesContainer: {
    minHeight: 60,
  },
  medicineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  medicineName: {
    fontSize: 11,
    marginLeft: 6,
    flex: 1,
  },
  pendingBadge: {
    fontSize: 12,
    marginLeft: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginHorizontal: 3,
    minHeight: 32,
  },
  completedButton: {
    backgroundColor: '#10b981',
  },
  missedButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  // 현대적인 버튼 스타일
  modernActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modernCompletedButton: {
    backgroundColor: '#10b981',
  },
  modernMissedButton: {
    backgroundColor: '#ef4444',
  },
  buttonIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  modernActionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  updatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  updatingText: {
    fontSize: 11,
    marginLeft: 6,
  },
  noMedicines: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // 울트라 현대적 약 리스트 스타일
  medicinesListContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  modernMedicineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  medicineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  modernMedicineName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // 아이콘 전용 버튼 스타일
  iconOnlyButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  timeStatsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeStatInfo: {
    flex: 1,
  },
  timeStatLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeStatDetails: {
    fontSize: 14,
  },
  machineContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  machineStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  machineStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  machineCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineId: {
    fontSize: 14,
    fontWeight: '600',
  },
  machineConnectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  machineDetails: {
    fontSize: 12,
    marginBottom: 4,
  },
  machineUsers: {
    fontSize: 12,
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