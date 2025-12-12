import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressCircle from './ProgressCircle';

interface TimeStat {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  label: string;
  scheduled: number;
  actualScheduled: number;
  completed: number;
  missed: number;
  remaining: number;
  excluded: number;
  completionRate: number;
}

interface TimeStatsSectionProps {
  timeStats: TimeStat[];
}

/**
 * 시간대별 현황 섹션 컴포넌트
 */
const TimeStatsSection: React.FC<TimeStatsSectionProps> = ({ timeStats }) => {
  const { colors: themeColors, isDark } = useTheme();

  if (timeStats.length === 0) {
    return null;
  }

  return (
    <View style={[
      styles.timeStatsContainer,
      { backgroundColor: themeColors.card }
    ]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>나의 시간대별 복용 현황</Text>
      {timeStats.map((timeStat) => (
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
  );
};

const styles = StyleSheet.create({
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
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
});

export default React.memo(TimeStatsSection);

