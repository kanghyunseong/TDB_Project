import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressCircle from './ProgressCircle';

interface OverallProgressProps {
  completionRate: number;
  totalCompleted: number;
  totalScheduled: number;
  totalExcluded: number;
  memberCount: number;
}

/**
 * 전체 진행률 섹션 컴포넌트
 */
const OverallProgress: React.FC<OverallProgressProps> = ({
  completionRate,
  totalCompleted,
  totalScheduled,
  totalExcluded,
  memberCount,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  return (
    <View style={[
      styles.overallProgressContainer,
      { backgroundColor: themeColors.card }
    ]}>
      <ProgressCircle
        percentage={completionRate}
        size={120}
        strokeWidth={8}
        color="#10b981"
      />
      <View style={styles.overallProgressText}>
        <Text style={[styles.progressTitle, { color: themeColors.text }]}>전체 복용률</Text>
        <Text style={[styles.progressSubtitle, { color: isDark ? '#888' : '#666' }]}>
          {totalCompleted}/{totalScheduled - totalExcluded} 완료
        </Text>
        <Text style={[styles.progressMembers, { color: isDark ? '#888' : '#666' }]}>
          가족 구성원 {memberCount}명
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default React.memo(OverallProgress);

