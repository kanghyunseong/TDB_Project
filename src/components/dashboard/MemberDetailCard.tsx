import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressCircle from './ProgressCircle';
import TimeSlotCard from './TimeSlotCard';
import { DoseTimeSettings } from '../../utils/doseTimeSettings';
import { TodayDetailedSchedule } from '../../hooks/useFamilyDashboard';

interface FamilyMember {
  user_id: string;
  name: string;
  role: 'parent' | 'child';
  todayScheduled: number;
  todayCompleted: number;
}

interface MemberDetailCardProps {
  member: FamilyMember;
  schedule: TodayDetailedSchedule[string];
  doseTimeSettings: DoseTimeSettings;
  currentUserId: string | null;
  onStatusUpdate: (medicineId?: string, userId?: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') => void;
}

/**
 * 구성원별 상세 카드 컴포넌트
 */
const MemberDetailCard: React.FC<MemberDetailCardProps> = ({
  member,
  schedule,
  doseTimeSettings,
  currentUserId,
  onStatusUpdate,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  // 🔥 실제 복용해야 할 약 개수 (제외 상태 제거)
  const actualScheduled = useMemo(() => 
    member.todayScheduled,
    [member.todayScheduled]
  );
  
  // 🔥 정확한 완료율 재계산
  const actualCompletionRate = useMemo(() => 
    actualScheduled > 0 
      ? Math.round((member.todayCompleted / actualScheduled) * 100)
      : 0,
    [member.todayCompleted, actualScheduled]
  );
  
  // 🔥 모든 시간대가 비어있으면 카드를 렌더링하지 않음
  const hasAnyMedicines = useMemo(() => 
    schedule.morning.length > 0 || schedule.afternoon.length > 0 || schedule.evening.length > 0,
    [schedule]
  );
  
  if (!hasAnyMedicines) {
    return null;
  }
  
  return (
    <View style={[
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
          currentUserId={currentUserId}
          timeOfDay="morning"
          onStatusUpdate={onStatusUpdate}
        />
        <TimeSlotCard
          label="점심"
          time={doseTimeSettings.afternoon}
          medicines={schedule.afternoon}
          backgroundColor={isDark ? '#1e293b' : '#f8fafc'}
          userId={member.user_id}
          currentUserId={currentUserId}
          timeOfDay="afternoon"
          onStatusUpdate={onStatusUpdate}
        />
        <TimeSlotCard
          label="저녁"
          time={doseTimeSettings.evening}
          medicines={schedule.evening}
          backgroundColor={isDark ? '#1e293b' : '#f8fafc'}
          userId={member.user_id}
          currentUserId={currentUserId}
          timeOfDay="evening"
          onStatusUpdate={onStatusUpdate}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  timeScheduleContainer: {
    flexDirection: 'column',
    gap: 12,
  },
});

export default React.memo(MemberDetailCard);

