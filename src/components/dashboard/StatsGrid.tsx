import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../../contexts/ThemeContext';

interface StatsGridProps {
  totalCompleted: number;
  totalMissed: number;
  totalRemaining: number;
  totalExcluded: number; // 제거 예정이지만 호환성을 위해 유지
}

/**
 * 통계 카드 그리드 컴포넌트
 */
const StatsGrid: React.FC<StatsGridProps> = ({ 
  totalCompleted, 
  totalMissed, 
  totalRemaining, 
  totalExcluded 
}) => {
  const { isDark } = useTheme();

  return (
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, { 
        backgroundColor: isDark ? '#1e3a8a20' : '#dbeafe' 
      }]}>
        <Icon name="check-circle" size={24} color="#1d4ed8" />
        <Text style={[styles.statNumber, { color: '#1d4ed8' }]}>
          {totalCompleted}
        </Text>
        <Text style={[styles.statLabel, { color: '#1e40af' }]}>완료</Text>
      </View>
      
      <View style={[styles.statCard, { 
        backgroundColor: isDark ? '#dc262620' : '#fed7d7' 
      }]}>
        <Icon name="x-circle" size={24} color="#dc2626" />
        <Text style={[styles.statNumber, { color: '#dc2626' }]}>
          {totalMissed}
        </Text>
        <Text style={[styles.statLabel, { color: '#b91c1c' }]}>놓침</Text>
      </View>
      
      <View style={[styles.statCard, { 
        backgroundColor: isDark ? '#d9770620' : '#fef3c7' 
      }]}>
        <Icon name="clock" size={24} color="#d97706" />
        <Text style={[styles.statNumber, { color: '#d97706' }]}>
          {totalRemaining}
        </Text>
        <Text style={[styles.statLabel, { color: '#92400e' }]}>남음</Text>
      </View>
      
      {/* 제외 카드 제거 */}
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default React.memo(StatsGrid);

