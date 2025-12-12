import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../../contexts/ThemeContext';
import DoseStatusIcon from './DoseStatusIcon';
import { apiClient } from '../../api/client';

interface Medicine {
  name: string;
  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
  medi_id?: string;
  scheduled_dose?: number;
  notes?: string; // 🔥 배출 기록 확인용
  actual_dose?: number; // 🔥 배출 수량 확인용
}

interface TimeSlotCardProps {
  label: string;
  time: string;
  medicines: Medicine[];
  backgroundColor: string;
  userId: string;
  currentUserId: string | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  onStatusUpdate?: (medicineId?: string, userId?: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') => void;
}

/**
 * 시간대별 복용 상태 카드 컴포넌트
 */
const TimeSlotCard: React.FC<TimeSlotCardProps> = ({ 
  label, 
  time, 
  medicines, 
  backgroundColor, 
  userId, 
  currentUserId, 
  timeOfDay, 
  onStatusUpdate 
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [updating, setUpdating] = useState(false);
  // 🔥 낙관적 업데이트를 위한 로컬 상태 관리
  const [localMedicineStatuses, setLocalMedicineStatuses] = useState<Record<string, 'completed' | 'missed' | 'pending' | 'upcoming' | 'excluded'>>({});
  
  // 🔥 약이 없으면 카드를 렌더링하지 않음
  if (medicines.length === 0) {
    return null;
  }
  
  // 🔥 배출 기록이 있는지 확인 (notes에 "Machine:" 또는 "스케줄 기반 자동배출" 포함 여부)
  // 🔥 24시간 기준 초기화: 오늘 날짜의 완료 기록만 체크 가능
  const hasDispensedMedicines = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return medicines.some(m => {
      // 🔥 이미 완료된 항목이지만 오늘 날짜가 아니면 체크 불가
      if (m.status === 'completed') {
        // completed_at 날짜 확인 (medicines에 completed_at이 전달되는지 확인 필요)
        // 일단 상태만으로 판단하고, useFamilyDashboard에서 이미 필터링되어 옴
        return false; // 완료된 항목은 체크 불가
      }
      
      const notes = m.notes || '';
      const isDispensed = notes.includes('Machine:') || notes.includes('스케줄 기반 자동배출');
      // 배출 기록이 있고, pending 상태인 경우만 체크 가능
      return isDispensed && m.status === 'pending';
    });
  }, [medicines]);
  
  // 🔥 pending 상태인 약이 있는지 확인 (배출 기록이 없는 경우)
  const hasPendingMedicines = useMemo(() => {
    return medicines.some(m => {
      // 🔥 완료된 항목은 체크 불가
      if (m.status === 'completed') {
        return false;
      }
      return m.status === 'pending' && !(m.notes?.includes('Machine:') || m.notes?.includes('스케줄 기반 자동배출'));
    });
  }, [medicines]);
  
  // 🔥 현재 시간이 복용 체크 가능한 시간 범위 내에 있는지 확인
  // 🔥 새로 등록한 스케줄은 시간 범위가 지나도 체크 가능하도록 예외 처리
  const isWithinCheckTimeRange = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 시간대별 체크 가능 범위
    // 아침: 6시 ~ 12시 (6 <= hour < 12)
    // 점심: 12시 ~ 18시 (12 <= hour < 18)
    // 저녁: 18시 ~ 24시 (18 <= hour < 24)
    let isInRange = false;
    switch (timeOfDay) {
      case 'morning':
        isInRange = currentHour >= 6 && currentHour < 12;
        break;
      case 'afternoon':
        isInRange = currentHour >= 12 && currentHour < 18;
        break;
      case 'evening':
        isInRange = currentHour >= 18 && currentHour < 24;
        break;
      default:
        isInRange = false;
    }
    
    // 🔥 시간 범위가 지났지만, 새로 등록한 스케줄(pending 상태)은 체크 가능
    // 오늘 날짜의 pending 상태 약물은 시간 범위와 관계없이 체크 가능
    if (!isInRange) {
      const hasNewPendingSchedule = medicines.some(m => {
        // pending 상태이고, 오늘 날짜의 스케줄인 경우
        return m.status === 'pending';
      });
      return hasNewPendingSchedule;
    }
    
    return isInRange;
  }, [timeOfDay, medicines]);
  
  // 🔥 개별 약물 복용 완료 처리 (24시간 기준 초기화 적용)
  const handleMarkMedicineCompleted = async (medicine: Medicine, completed: boolean) => {
    // 🔥 이미 완료된 약물은 처리하지 않음
    if (medicine.status === 'completed' || medicine.status === 'missed') {
      return;
    }
    
    // 🔥 낙관적 업데이트: 즉시 로컬 상태 변경
    const newStatus = completed ? 'completed' : 'missed';
    setLocalMedicineStatuses(prev => ({
      ...prev,
      [medicine.medi_id || '']: newStatus
    }));
    
    setUpdating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
        const notes = medicine.notes || '';
        const isDispensed = notes.includes('Machine:') || notes.includes('스케줄 기반 자동배출');
        
      // 🔥 오늘 날짜 정보를 notes에 추가 (24시간 기준 초기화 추적용)
      const todayNote = `[${today}]`;
        const updatedNotes = isDispensed 
        ? `${notes} | ${todayNote} ${completed ? '수동 체크 - 복용 완료' : '수동 체크 - 복용 안 함'}`
        : `${todayNote} ${completed ? '수동 체크 - 복용 완료' : '수동 체크 - 복용 안 함'}`;
        
      // 🔥 서버의 completeDose는 이미 오늘 날짜만 처리하도록 되어 있음
        await apiClient.post('/api/dose-history/complete', {
          user_id: userId,
          medi_id: medicine.medi_id,
          time_of_day: timeOfDay,
          actual_dose: completed ? (medicine.actual_dose || medicine.scheduled_dose || 1) : 0,
          notes: updatedNotes
        });
      
      // 성공 후 새로고침 (서버 데이터와 동기화)
      // 🔥 약물 ID와 시간대 정보를 전달하여 메인 화면에서도 상태 업데이트
      if (onStatusUpdate) {
        onStatusUpdate(medicine.medi_id, userId, timeOfDay);
      }
    } catch (error) {
      console.error('복용 상태 업데이트 실패:', error);
      // 🔥 에러 발생 시 로컬 상태 롤백
      setLocalMedicineStatuses(prev => {
        const next = { ...prev };
        delete next[medicine.medi_id || ''];
        return next;
      });
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
        {medicines.map((medicine, index) => {
          // 🔥 로컬 상태가 있으면 우선 사용 (낙관적 업데이트)
          const localStatus = localMedicineStatuses[medicine.medi_id || ''];
          const effectiveStatus: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded' = 
            localStatus || medicine.status;
          
          // 🔥 이 약물이 체크 가능한지 확인 (로컬 상태 반영)
          const canCheck = effectiveStatus === 'pending' || 
            (effectiveStatus !== 'completed' && effectiveStatus !== 'missed' && effectiveStatus !== 'excluded' &&
             medicine.notes && (medicine.notes.includes('Machine:') || medicine.notes.includes('스케줄 기반 자동배출')));
          const showButtons = canCheck && !updating && userId === currentUserId && isWithinCheckTimeRange;
          
          return (
          <View 
            key={index} 
            style={[
              styles.modernMedicineItem,
              { 
                backgroundColor: isDark ? '#ffffff08' : '#00000005',
                borderLeftColor: 
                    effectiveStatus === 'completed' ? '#10b981' : 
                    effectiveStatus === 'pending' ? '#f59e0b' : 
                    effectiveStatus === 'missed' ? '#ef4444' : 
                    effectiveStatus === 'excluded' ? '#9ca3af' : '#6b7280'
              }
            ]}
          >
            <View style={styles.medicineItemLeft}>
                <DoseStatusIcon status={effectiveStatus} size={18} />
              <Text 
                style={[
                  styles.modernMedicineName,
                  { 
                    color: themeColors.text,
                      textDecorationLine: effectiveStatus === 'completed' || effectiveStatus === 'excluded' ? 'line-through' : 'none',
                      opacity: effectiveStatus === 'completed' || effectiveStatus === 'excluded' ? 0.5 : 1
                  }
                ]}
                numberOfLines={2}
              >
                {medicine.name}
              </Text>
            </View>
              <View style={styles.medicineItemRight}>
                {/* 🔥 대기중/배출완료 배지는 pending 상태일 때만 표시 */}
                {effectiveStatus === 'pending' && (
              <View style={[styles.statusBadge, { backgroundColor: '#f59e0b20' }]}>
                <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>
                  {medicine.notes && (medicine.notes.includes('Machine:') || medicine.notes.includes('스케줄 기반 자동배출')) 
                    ? '배출완료' 
                    : '대기중'}
                </Text>
              </View>
            )}
                {/* 🔥 완료 상태 배지 */}
                {effectiveStatus === 'completed' && (
                  <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#10b981' }]}>완료</Text>
                  </View>
                )}
                {/* 🔥 놓침 상태 배지 */}
                {effectiveStatus === 'missed' && (
                  <View style={[styles.statusBadge, { backgroundColor: '#ef444420' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>놓침</Text>
                  </View>
                )}
                {effectiveStatus === 'excluded' && (
              <View style={[styles.statusBadge, { backgroundColor: '#9ca3af20' }]}>
                <Text style={[styles.statusBadgeText, { color: '#6b7280' }]}>제외</Text>
              </View>
            )}
                {/* 🔥 개별 약물 체크/X 버튼 (pending 상태일 때만 표시) */}
                {showButtons && (
                  <View style={styles.individualButtonsContainer}>
          <TouchableOpacity
                      style={[styles.individualIconButton, { backgroundColor: '#10b981' }]}
                      onPress={() => handleMarkMedicineCompleted(medicine, true)}
            activeOpacity={0.7}
          >
                      <Icon name="check" size={16} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
                      style={[styles.individualIconButton, { backgroundColor: '#ef4444' }]}
                      onPress={() => handleMarkMedicineCompleted(medicine, false)}
            activeOpacity={0.7}
          >
                      <Icon name="x" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
              </View>
            </View>
          );
        })}
      </View>
      
      {updating && (
        <View style={styles.updatingContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={[styles.updatingText, { color: isDark ? '#888' : '#666' }]}>업데이트 중...</Text>
        </View>
      )}
    </View>
  );
};

const TimeSlotCardMemo = React.memo(TimeSlotCard, (prevProps, nextProps) => {
  // props 비교 최적화: medicines 배열과 주요 props만 비교
  return (
    prevProps.label === nextProps.label &&
    prevProps.time === nextProps.time &&
    prevProps.userId === nextProps.userId &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.timeOfDay === nextProps.timeOfDay &&
    prevProps.backgroundColor === nextProps.backgroundColor &&
    prevProps.medicines.length === nextProps.medicines.length &&
    prevProps.medicines.every((med, idx) => 
      med.name === nextProps.medicines[idx]?.name &&
      med.status === nextProps.medicines[idx]?.status
    )
  );
});

const styles = StyleSheet.create({
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
  medicineItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  individualButtonsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 4,
  },
  individualIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
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
});

TimeSlotCardMemo.displayName = 'TimeSlotCard';

export default TimeSlotCardMemo;

