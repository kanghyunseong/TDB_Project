import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

interface MemberProgress {
  user_id: string;
  user_name: string;
  age: number;
  role: 'parent' | 'child';
  totalScheduled: number;
  completed: number;
  missed: number;
  partial: number;
  progressPercentage: number;
}

interface FamilyStats {
  overallProgress: number;
  totalMembers: number;
  completedMembers: number;
  totalDoses: number;
  completedDoses: number;
  pendingDoses: number;
  missedDoses: number;
  partialDoses: number;
  machineStatus: {
    connected: number;
    total: number;
    lowBattery: number;
  };
  memberProgress: MemberProgress[];
}

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
  color?: string;
  themeColors: any;
  isDark: boolean;
}

interface FamilyDashboardProps {
  familyStats: FamilyStats;
  themeColors: any;
  isDark: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  title, 
  value, 
  color = colors.PRIMARY.DEFAULT,
  themeColors,
  isDark 
}) => (
  <View style={[styles.statCard, { backgroundColor: themeColors.card }]}>
    <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <View style={styles.statContent}>
      <Text style={[styles.statValue, { color: themeColors.text }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: isDark ? '#888' : '#666' }]}>{title}</Text>
    </View>
  </View>
);

const ProgressCircle: React.FC<{ 
  percentage: number; 
  themeColors: any; 
  isDark: boolean;
}> = ({ percentage, themeColors, isDark }) => {
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return colors.SUCCESS.DEFAULT;
    if (percent >= 70) return colors.WARNING.DEFAULT;
    return colors.DANGER.DEFAULT;
  };

  return (
    <View style={styles.progressCircleContainer}>
      <View style={[
        styles.progressCircle,
        { 
          borderColor: isDark ? '#333' : '#f0f0f0',
          backgroundColor: themeColors.card 
        }
      ]}>
        <View style={[
          styles.progressFill,
          {
            backgroundColor: getProgressColor(percentage),
            transform: [{ rotate: `${(percentage / 100) * 360}deg` }]
          }
        ]} />
        <View style={[styles.progressInner, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.progressText, { color: themeColors.text }]}>
            {percentage}%
          </Text>
          <Text style={[styles.progressLabel, { color: isDark ? '#888' : '#666' }]}>
            완료율
          </Text>
        </View>
      </View>
    </View>
  );
};

const MemberProgressCard: React.FC<{
  member: MemberProgress;
  themeColors: any;
  isDark: boolean;
}> = ({ member, themeColors, isDark }) => {
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return colors.SUCCESS.DEFAULT;
    if (percent >= 70) return colors.WARNING.DEFAULT;
    return colors.DANGER.DEFAULT;
  };

  const getProgressIcon = (percent: number) => {
    if (percent >= 90) return 'check-circle';
    if (percent >= 70) return 'clock';
    return 'alert-circle';
  };

  const getRoleIcon = (role: string) => {
    return role === 'parent' ? 'user' : 'users';
  };

  const progressColor = getProgressColor(member.progressPercentage);

  return (
    <View style={[styles.memberCard, { backgroundColor: themeColors.card }]}>
      <View style={styles.memberHeader}>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameContainer}>
            <Icon 
              name={getRoleIcon(member.role)} 
              size={16} 
              color={colors.PRIMARY.DEFAULT} 
              style={styles.roleIcon}
            />
            <Text style={[styles.memberName, { color: themeColors.text }]}>
              {member.user_name}
            </Text>
            <Text style={[styles.memberAge, { color: isDark ? '#888' : '#666' }]}>
              ({member.age}세)
            </Text>
          </View>
          <View style={[styles.progressBadge, { backgroundColor: `${progressColor}20` }]}>
            <Icon name={getProgressIcon(member.progressPercentage)} size={14} color={progressColor} />
            <Text style={[styles.progressBadgeText, { color: progressColor }]}>
              {member.progressPercentage}%
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.memberStats}>
        <View style={styles.memberStatRow}>
          <View style={styles.memberStatItem}>
            <Text style={[styles.memberStatValue, { color: colors.SUCCESS.DEFAULT }]}>
              {member.completed}
            </Text>
            <Text style={[styles.memberStatLabel, { color: isDark ? '#888' : '#666' }]}>
              완료
            </Text>
          </View>
          <View style={styles.memberStatItem}>
            <Text style={[styles.memberStatValue, { color: colors.DANGER.DEFAULT }]}>
              {member.missed}
            </Text>
            <Text style={[styles.memberStatLabel, { color: isDark ? '#888' : '#666' }]}>
              놓침
            </Text>
          </View>
          <View style={styles.memberStatItem}>
            <Text style={[styles.memberStatValue, { color: themeColors.text }]}>
              {member.totalScheduled}
            </Text>
            <Text style={[styles.memberStatLabel, { color: isDark ? '#888' : '#666' }]}>
              전체
            </Text>
          </View>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  backgroundColor: progressColor,
                  width: `${member.progressPercentage}%`
                }
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({
  familyStats,
  themeColors,
  isDark
}) => {
  const getStatusMessage = () => {
    if (familyStats.overallProgress >= 90) {
      return { text: "🎉 가족 모두 잘하고 있어요!", color: colors.SUCCESS.DEFAULT };
    } else if (familyStats.overallProgress >= 70) {
      return { text: "👍 좋은 복용 패턴이에요!", color: colors.WARNING.DEFAULT };
    } else {
      return { text: "💪 조금 더 신경써주세요!", color: colors.DANGER.DEFAULT };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          📊 오늘의 가족 복용 현황
        </Text>
        <Text style={[styles.subtitle, { color: statusMessage.color }]}>
          {statusMessage.text}
        </Text>
      </View>

      {/* 메인 진행률 */}
      <View style={[styles.mainProgressCard, { backgroundColor: themeColors.card }]}>
        <ProgressCircle 
          percentage={familyStats.overallProgress} 
          themeColors={themeColors}
          isDark={isDark}
        />
        <View style={styles.mainStats}>
          <Text style={[styles.mainStatsTitle, { color: themeColors.text }]}>
            전체 복용 현황
          </Text>
          <Text style={[styles.mainStatsValue, { color: isDark ? '#888' : '#666' }]}>
            {familyStats.completedDoses}/{familyStats.totalDoses} 완료
          </Text>
        </View>
      </View>

      {/* 통계 카드들 */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="users"
          title="완료한 구성원"
          value={`${familyStats.completedMembers}/${familyStats.totalMembers}`}
          color={colors.PRIMARY.DEFAULT}
          themeColors={themeColors}
          isDark={isDark}
        />
        <StatCard
          icon="check-circle"
          title="완료된 복용"
          value={familyStats.completedDoses}
          color={colors.SUCCESS.DEFAULT}
          themeColors={themeColors}
          isDark={isDark}
        />
        <StatCard
          icon="clock"
          title="남은 복용"
          value={familyStats.pendingDoses}
          color={colors.WARNING.DEFAULT}
          themeColors={themeColors}
          isDark={isDark}
        />
        <StatCard
          icon="x-circle"
          title="놓친 복용"
          value={familyStats.missedDoses}
          color={colors.DANGER.DEFAULT}
          themeColors={themeColors}
          isDark={isDark}
        />
      </View>

      {/* 구성원별 세부 진행률 */}
      {familyStats.memberProgress && familyStats.memberProgress.length > 0 && (
        <View style={styles.memberProgressSection}>
          <View style={styles.sectionHeader}>
            <Icon name="users" size={20} color={colors.PRIMARY.DEFAULT} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              구성원별 세부 현황
            </Text>
          </View>
          {familyStats.memberProgress.map((member) => (
            <MemberProgressCard
              key={member.user_id}
              member={member}
              themeColors={themeColors}
              isDark={isDark}
            />
          ))}
        </View>
      )}

      {/* 스마트 약통 상태 */}
      <View style={[styles.machineStatusCard, { backgroundColor: themeColors.card }]}>
        <View style={styles.machineHeader}>
          <Icon name="wifi" size={20} color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.machineTitle, { color: themeColors.text }]}>
            스마트 약통 상태
          </Text>
        </View>
        <View style={styles.machineStats}>
          <View style={styles.machineStatItem}>
            <Text style={[styles.machineStatValue, { color: colors.SUCCESS.DEFAULT }]}>
              {familyStats.machineStatus.connected}
            </Text>
            <Text style={[styles.machineStatLabel, { color: isDark ? '#888' : '#666' }]}>
              연결됨
            </Text>
          </View>
          <View style={styles.machineStatDivider} />
          <View style={styles.machineStatItem}>
            <Text style={[styles.machineStatValue, { color: themeColors.text }]}>
              {familyStats.machineStatus.total}
            </Text>
            <Text style={[styles.machineStatLabel, { color: isDark ? '#888' : '#666' }]}>
              총 기기
            </Text>
          </View>
          {familyStats.machineStatus.lowBattery > 0 && (
            <>
              <View style={styles.machineStatDivider} />
              <View style={styles.machineStatItem}>
                <Text style={[styles.machineStatValue, { color: colors.DANGER.DEFAULT }]}>
                  {familyStats.machineStatus.lowBattery}
                </Text>
                <Text style={[styles.machineStatLabel, { color: isDark ? '#888' : '#666' }]}>
                  배터리 부족
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 10,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  mainProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressCircleContainer: {
    marginRight: 20,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: colors.PRIMARY.DEFAULT,
  },
  progressInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  mainStats: {
    flex: 1,
  },
  mainStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mainStatsValue: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: (screenWidth - 60) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    lineHeight: 14,
  },
  machineStatusCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  machineTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  machineStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  machineStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  machineStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  machineStatLabel: {
    fontSize: 12,
  },
  machineStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  // 구성원별 진행률 섹션 스타일
  memberProgressSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // 구성원 카드 스타일
  memberCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  memberHeader: {
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleIcon: {
    marginRight: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  memberAge: {
    fontSize: 14,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  memberStats: {
    marginTop: 8,
  },
  memberStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  memberStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  memberStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  memberStatLabel: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarBackground: {
    height: '100%',
    width: '100%',
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
}); 