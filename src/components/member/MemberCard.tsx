import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { MemberWithProgress } from '../../types/member';
import colors from '../../constants/colors';

interface MemberCardProps {
  member: MemberWithProgress;
  onPress: (member: MemberWithProgress) => void;
  onDoseComplete: (userId: string, timeSlot: 'morning' | 'afternoon' | 'evening') => void;
  themeColors: any;
  isDark: boolean;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  onPress,
  onDoseComplete,
  themeColors,
  isDark
}) => {
  const getProgressColor = (rate: number) => {
    if (rate >= 80) return colors.SUCCESS.DEFAULT;
    if (rate >= 60) return '#FFA500';
    return colors.DANGER.DEFAULT;
  };

  const renderTimeSlotButton = (
    timeSlot: 'morning' | 'afternoon' | 'evening',
    icon: string,
    label: string
  ) => {
    const slotData = member.dailyProgress[timeSlot];
    const isCompleted = slotData.isCompleted;
    const hasSchedule = slotData.hasSchedule;

    if (!hasSchedule) {
      return (
        <View style={[styles.timeSlotButton, styles.noScheduleButton]}>
          <Icon name={icon} size={14} color="#ccc" />
          <Text style={[styles.timeSlotButtonText, { color: '#ccc' }]}>
            {label}
          </Text>
          <Text style={[styles.noScheduleText]}>없음</Text>
        </View>
      );
    }

    const buttonStyle = isCompleted 
      ? [styles.timeSlotButton, styles.completedButton]
      : [styles.timeSlotButton, styles.pendingButton];

    const textColor = isCompleted ? colors.WHITE : colors.PRIMARY.DEFAULT;

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={() => !isCompleted && onDoseComplete(member.user_id, timeSlot)}
        disabled={isCompleted}
      >
        <Icon 
          name={isCompleted ? 'check' : icon} 
          size={14} 
          color={textColor} 
        />
        <Text style={[styles.timeSlotButtonText, { color: textColor }]}>
          {label}
        </Text>
        {isCompleted && (
          <Text style={[styles.completedLabel, { color: textColor }]}>
            완료
          </Text>
        )}
        {!isCompleted && slotData.totalDose > 0 && (
          <Text style={[styles.doseText, { color: textColor }]}>
            {slotData.totalDose}정
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.memberCard, { backgroundColor: themeColors.card }]}
      onPress={() => onPress(member)}
    >
      {/* 구성원 정보 헤더 */}
      <View style={styles.memberHeader}>
        <View style={styles.memberInfo}>
          <View style={[
            styles.memberAvatar, 
            { backgroundColor: member.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT }
          ]}>
            <Text style={styles.memberAvatarText}>
              {member.role === 'parent' ? 'P' : 'C'}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: themeColors.text }]}>
              {member.name}
            </Text>
            <Text style={[styles.memberRole, { color: isDark ? '#888' : '#666' }]}>
              {member.age}세 • {member.role === 'parent' ? '부모' : '자녀'}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressInfo}>
          <Text style={[
            styles.progressPercentage, 
            { color: getProgressColor(member.dailyProgress.totalProgress) }
          ]}>
            {member.dailyProgress.totalProgress}%
          </Text>
          <Text style={[styles.progressDetail, { color: isDark ? '#888' : '#666' }]}>
            {member.dailyProgress.completedTimeSlots}/{member.dailyProgress.totalTimeSlots} 완료
          </Text>
        </View>
      </View>

      {/* 진행률 바 */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${member.dailyProgress.totalProgress}%`,
                backgroundColor: getProgressColor(member.dailyProgress.totalProgress)
              }
            ]} 
          />
        </View>
      </View>

      {/* 시간대별 복용 버튼 */}
      <View style={styles.timeSlotContainer}>
        {renderTimeSlotButton('morning', 'sunrise', '아침')}
        {renderTimeSlotButton('afternoon', 'sun', '점심')}
        {renderTimeSlotButton('evening', 'moon', '저녁')}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  memberCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: colors.WHITE,
    fontSize: 18,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
  },
  progressInfo: {
    alignItems: 'flex-end',
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  progressDetail: {
    fontSize: 12,
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timeSlotContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  completedButton: {
    backgroundColor: colors.SUCCESS.DEFAULT,
    borderColor: colors.SUCCESS.DEFAULT,
  },
  pendingButton: {
    backgroundColor: 'transparent',
    borderColor: colors.PRIMARY.DEFAULT,
  },
  noScheduleButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  timeSlotButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  completedLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  doseText: {
    fontSize: 10,
    marginLeft: 4,
  },
  noScheduleText: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
}); 