import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { WeeklyStats } from '../types/member';
import colors from '../constants/colors';

interface WeeklyStatsCardProps {
  weeklyStats: WeeklyStats;
  themeColors: any;
  isDark: boolean;
  onPress?: () => void;
}

export const WeeklyStatsCard: React.FC<WeeklyStatsCardProps> = ({
  weeklyStats,
  themeColors,
  isDark,
  onPress
}) => {
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return colors.SUCCESS.DEFAULT;
      case 'down': return colors.DANGER.DEFAULT;
      default: return '#666';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'minus';
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'up': return '증가';
      case 'down': return '감소';
      default: return '유지';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.statsCard, { backgroundColor: themeColors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.statsHeader}>
        <View style={styles.statsHeaderLeft}>
          <Icon name="bar-chart-2" size={20} color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.statsTitle, { color: themeColors.text }]}>
            이번 주 통계
          </Text>
        </View>
        <View style={styles.statsHeaderRight}>
          <View style={[styles.trendBadge, { 
            backgroundColor: getTrendColor(weeklyStats.trend) + '20'
          }]}>
            <Icon 
              name={getTrendIcon(weeklyStats.trend)}
              size={12} 
              color={getTrendColor(weeklyStats.trend)} 
            />
            <Text style={[styles.trendText, { 
              color: getTrendColor(weeklyStats.trend)
            }]}>
              {getTrendText(weeklyStats.trend)}
            </Text>
          </View>
          <Icon 
            name="chevron-right" 
            size={18} 
            color={isDark ? '#888' : '#666'} 
            style={styles.chevronIcon}
          />
        </View>
      </View>
      
      <View style={styles.statsContent}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.PRIMARY.DEFAULT }]}>
            {weeklyStats.familyCompletionRate}%
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#888' : '#666' }]}>
            가족 복용률
          </Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.SUCCESS.DEFAULT }]}>
            {weeklyStats.thisWeekDoses}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#888' : '#666' }]}>
            이번 주 복용
          </Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#666' }]}>
            {weeklyStats.lastWeekDoses}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#888' : '#666' }]}>
            지난 주 복용
          </Text>
        </View>
      </View>
      
      {weeklyStats.isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={[styles.loadingText, { color: isDark ? '#888' : '#666' }]}>
            통계 계산 중...
          </Text>
        </View>
      )}
      
      <View style={[styles.tapHint, { borderColor: isDark ? '#333' : '#E0E0E0' }]}>
        <Text style={[styles.tapHintText, { color: isDark ? '#666' : '#999' }]}>
          탭하여 상세 차트 보기
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  statsCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  tapHint: {
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
}); 