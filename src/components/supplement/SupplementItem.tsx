import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';
import { NutritionalSupplement, FamilyMember } from '../../types/tdb';
import { DailySchedule } from '../../hooks/useScheduleData';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface SupplementItemProps {
  supplement: NutritionalSupplement;
  selectedMember: FamilyMember | null;
  userType: 'parent' | 'child' | null;
  supplementSchedules: Record<string, DailySchedule>;
  doseCompletionStatus?: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>;
  isLoadingDoseStatus?: boolean; // 🔥 로딩 상태 추가
  isDark: boolean;
  themeColors: any;
  onViewDetail: (supplement: NutritionalSupplement) => void;
  onDelete: (supplement: NutritionalSupplement) => void;
  onScheduleEdit: (supplement: NutritionalSupplement) => void;
  renderRightActions: (progress: any, dragX: any, onDelete: () => void) => React.ReactNode;
  getTodayScheduleForSupplement: (supplement: NutritionalSupplement, dailySchedule: DailySchedule | undefined) => any;
  getMedicineDisplayInfo: (supplement: any, todaySchedule: any) => any;
}

const SupplementItem: React.FC<SupplementItemProps> = React.memo(({
  supplement,
  selectedMember,
  userType,
  supplementSchedules,
  doseCompletionStatus = {}, // 🔥 복용 완료 상태 추가
  isLoadingDoseStatus = false, // 🔥 로딩 상태 추가
  isDark,
  themeColors,
  onViewDetail,
  onDelete,
  onScheduleEdit,
  renderRightActions,
  getTodayScheduleForSupplement,
  getMedicineDisplayInfo,
}) => {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '날짜 없음';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // 🔥 영양제도 3색 테두리 시스템 적용
  const analyzeSupplementType = () => {
    const currentUserId = selectedMember?.user_id;
    const targetUsers = supplement.target_users;
    
    // 권한 체크: 가족 공통이거나 현재 사용자가 포함된 경우
    const isTargetUser = !targetUsers || 
                        targetUsers.length === 0 || 
                        targetUsers.includes(currentUserId || '');
    
    let borderColor: string;
    let statusText: string;
    let bottomMessage: string;
    let canSchedule: boolean;
    
    if (!targetUsers || targetUsers.length === 0) {
      // 가족 공통 영양제 - 파란색
      borderColor = '#007AFF';
      statusText = '🔵 가족 공통';
      bottomMessage = '모든 가족 구성원이 복용 가능합니다';
      canSchedule = true;
    } else if (isTargetUser) {
      // 개인 영양제이지만 내가 복용하는 영양제 - 노란색
      borderColor = '#FFD700';
      statusText = '🟡 내 영양제';
      bottomMessage = '나에게 지정된 영양제입니다';
      canSchedule = true;
    } else {
      // 개인 영양제이고 다른 사람이 복용하는 영양제 - 빨간색
      borderColor = '#FF6B6B';
      statusText = '🔴 타인 영양제';
      bottomMessage = '다른 사람이 복용하는 영양제입니다';
      canSchedule = userType === 'parent'; // 보호자는 모든 영양제 관리 가능
    }
    
    return {
      type: isTargetUser ? 'accessible' : 'others_only' as const,
      borderColor,
      statusText,
      canSchedule,
      bottomMessage
    };
  };

  const supplementTypeInfo = analyzeSupplementType();

  // 🔥 영양제 스케줄 정보 가져오기 (useMemo로 안정화)
  // target_users 배열의 첫 번째 요소를 문자열로 변환하여 안정화
  const actualTargetUserId = useMemo(() => {
    if (supplement.target_users && supplement.target_users.length > 0) {
      return String(supplement.target_users[0]);
    }
    return selectedMember?.user_id || '';
  }, [supplement.target_users?.join(','), selectedMember?.user_id]);
  
  const scheduleKey = useMemo(() => {
    return `${supplement.id}_${actualTargetUserId}`;
  }, [supplement.id, actualTargetUserId]);

  // 🔥 statusKey 계산 (복용 상태용)
  const statusKey = useMemo(() => {
    return `${supplement.id}_${actualTargetUserId}`;
  }, [supplement.id, actualTargetUserId]);

  // 🔥 dailySchedule 참조 안정화
  const dailySchedule = useMemo(() => {
    return supplementSchedules[scheduleKey];
  }, [supplementSchedules, scheduleKey]);

  // 🔥 스케줄이 로드되었는지 확인
  const isScheduleLoaded = useMemo(() => {
    return !!dailySchedule;
  }, [dailySchedule]);

  // 🔥 복용 상태가 로드되었는지 확인
  const isDoseStatusLoaded = useMemo(() => {
    return !!doseCompletionStatus[statusKey];
  }, [doseCompletionStatus, statusKey]);

  // 🔥 전체 데이터 로딩 완료 여부 (스케줄과 복용 상태 모두 필요)
  const isDataReady = useMemo(() => {
    // 로딩 중이면 아직 준비되지 않음
    if (isLoadingDoseStatus) {
      return false;
    }
    // 스케줄과 복용 상태가 모두 로드되어야 함
    return isScheduleLoaded && isDoseStatusLoaded;
  }, [isScheduleLoaded, isDoseStatusLoaded, isLoadingDoseStatus]);

  // 🔥 completionStatus 객체를 useMemo로 안정화하여 깜빡임 방지
  const prevCompletionStatusRef = useRef<{
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  } | null>(null);
  
  const completionStatus = useMemo(() => {
    // 🔥 로딩 중이면 이전 상태를 유지 (깜빡임 방지)
    if (isLoadingDoseStatus && prevCompletionStatusRef.current) {
      return prevCompletionStatusRef.current;
    }
    
    const status = doseCompletionStatus[statusKey];
    // 🔥 상태가 존재하면 사용하고 저장
    if (status) {
      prevCompletionStatusRef.current = status;
      return status;
    }
    
    // 🔥 기본값 반환
    const defaultStatus = {
      morning: false,
      afternoon: false,
      evening: false
    };
    
    // 🔥 이전 상태가 없으면 기본값 저장
    if (!prevCompletionStatusRef.current) {
      prevCompletionStatusRef.current = defaultStatus;
    }
    
    return prevCompletionStatusRef.current;
  }, [doseCompletionStatus, statusKey, isLoadingDoseStatus]);

  // 🔥 완료 상태를 useMemo로 안정화하여 깜빡임 방지
  const morningCompleted = useMemo(() => completionStatus.morning, [completionStatus.morning]);
  const afternoonCompleted = useMemo(() => completionStatus.afternoon, [completionStatus.afternoon]);
  const eveningCompleted = useMemo(() => completionStatus.evening, [completionStatus.evening]);

  // 🔥 오늘의 스케줄 계산을 useMemo로 안정화하여 깜빡임 방지
  // getTodayScheduleForSupplement는 외부 순수 함수이므로 의존성에서 제외
  const prevTodayScheduleRef = useRef<any>(null);
  
  const todaySchedule = useMemo(() => {
    // 🔥 데이터가 준비되지 않았으면 이전 스케줄 유지 (깜빡임 방지)
    if ((!isDataReady || isLoadingDoseStatus) && prevTodayScheduleRef.current) {
      return prevTodayScheduleRef.current;
    }
    
    // 🔥 스케줄이 로드되지 않았으면 기본값 반환
    if (!dailySchedule) {
      const defaultSchedule = {
        isScheduledDay: false,
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
      };
      prevTodayScheduleRef.current = defaultSchedule;
      return defaultSchedule;
    }
    
    const schedule = getTodayScheduleForSupplement(supplement, dailySchedule);
    prevTodayScheduleRef.current = schedule; // 🔥 안정적인 값 저장
    return schedule;
  }, [supplement.id, supplement.target_users?.join(','), dailySchedule, isLoadingDoseStatus, isDataReady]);

  // 🔥 displayInfo 계산을 useMemo로 안정화하여 깜빡임 방지
  // getMedicineDisplayInfo는 useCallback으로 안정화된 함수이므로 의존성에서 제외 가능
  const displayInfo = useMemo(() => {
    return getMedicineDisplayInfo(supplement as any, todaySchedule);
  }, [supplement.id, supplement.name, todaySchedule]);

  // 🔥 isTargetUser 계산 (스케줄 표시에 필요)
  const isTargetUser = !supplement.target_users || 
                      supplement.target_users.length === 0 || 
                      supplement.target_users.includes(selectedMember?.user_id || '');

  const handleViewSupplementDetail = () => {
    if (__DEV__) {
      console.log('🔥 [SupplementItem] 영양제 상세보기:', supplement.name, supplement.id || supplement.name);
    }
    onViewDetail(supplement);
  };

  const handleSupplementScheduleEdit = () => {
    onScheduleEdit(supplement);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Swipeable
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, () => onDelete(supplement))
        }
        enabled={userType === 'parent'}
      >
        <View style={[
          styles.simpleMedicineCard,
          {
            backgroundColor: isDark ? themeColors.card : 'white',
            borderColor: supplementTypeInfo.borderColor,
            borderWidth: 2, // 테두리 강조
          }
        ]}>
          {/* 상태 표시 */}
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, { color: supplementTypeInfo.borderColor }]}>
              {supplementTypeInfo.statusText}
            </Text>
          </View>

          <View style={styles.medicineInfo}>
            <Text style={[styles.medicineName, { color: themeColors.text }]}>{supplement.name}</Text>
            <View style={styles.medicineDetails}>
              <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
                제조사: {supplement.manufacturer || '정보 없음'}
              </Text>
              <Text style={[styles.medicineDetail, { color: colors.PRIMARY.DEFAULT, fontWeight: 'bold' }]}>
                슬롯: {supplement.dispenserSlot || '미배정'}번
              </Text>
            </View>
            <View style={styles.medicineDetails}>
              <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
                시작일: {formatDate(supplement.startDate)}
              </Text>
              <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
                종료일: {formatDate(supplement.endDate)}
              </Text>
            </View>

            {/* 🔥 오늘의 복용 스케줄 표시 */}
            {isTargetUser && (() => {
              // 🔥 스케줄이 로드되지 않았거나 로딩 중일 때 스켈레톤 UI 표시 (깜빡임 방지)
              if (!isScheduleLoaded || isLoadingDoseStatus) {
                return (
                  <View style={[
                    styles.doseCompletionSection,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                  ]}>
                    <SkeletonLoader width="100%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
                    <SkeletonLoader width="80%" height={16} borderRadius={4} />
                  </View>
                );
              }
              
              // 🔥 스케줄이 있는 날만 표시
              if (!todaySchedule.isScheduledDay) {
                return null;
              }
              
              // 🔥 복용 상태가 아직 로드되지 않았을 때도 스켈레톤 UI 표시
              if (!isDoseStatusLoaded) {
                return (
                  <View style={[
                    styles.doseCompletionSection,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                  ]}>
                    <SkeletonLoader width="100%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
                    <SkeletonLoader width="80%" height={16} borderRadius={4} />
                  </View>
                );
              }
              
              // 🔥 기간 만료인 경우 스케줄 표시 안함
              if (todaySchedule.reason === 'expired') {
                return (
                  <View style={[
                    styles.doseCompletionSection,
                    { backgroundColor: isDark ? '#2a1a1a' : '#FFE5E5' }
                  ]}>
                    <Text style={[styles.sectionTitle, { color: colors.DANGER.DEFAULT, marginBottom: 8, textAlign: 'center' }]}>
                      ⚠️ 복용 기간 만료
                    </Text>
                    <Text style={[styles.medicineDetail, { color: isDark ? '#888' : '#666', textAlign: 'center', fontSize: 12 }]}>
                      복용 기간이 만료되었습니다.
                    </Text>
                  </View>
                );
              }
              
              // 🔥 실제 복용 완료 상태 계산 (데이터가 준비된 후에만)
              const renderAllCompleted = (() => {
                // 🔥 데이터가 준비되지 않았으면 false 반환 (스켈레톤 UI 표시)
                if (!isDataReady || isLoadingDoseStatus) {
                  return false;
                }
                
                // 🔥 스케줄이 없으면 false
                if (!todaySchedule || !todaySchedule.isScheduledDay) {
                  return false;
                }
                
                // 🔥 모든 시간대가 완료되었는지 확인
                const morningOk = todaySchedule.morning === 0 || morningCompleted;
                const afternoonOk = todaySchedule.afternoon === 0 || afternoonCompleted;
                const eveningOk = todaySchedule.evening === 0 || eveningCompleted;
                
                return morningOk && afternoonOk && eveningOk;
              })();
              
              if (renderAllCompleted) {
                // 🔥 모든 복용이 완료된 경우 완료 메시지 표시
                return (
                  <View style={[
                    styles.completionMessageSection,
                    { backgroundColor: isDark ? '#1a3d1a' : '#E8F5E8' }
                  ]}>
                    <View style={styles.completionIconContainer}>
                      <Feather name="check-circle" size={20} color={colors.SUCCESS.DEFAULT} />
                    </View>
                    <Text style={[styles.completionMessage, { color: colors.SUCCESS.DEFAULT }]}>
                      오늘의 복용이 완료되었습니다! 🎉
                    </Text>
                    <Text style={[styles.completionSubMessage, { color: themeColors.text }]}>
                      총 {todaySchedule.total}정 복용 완료
                    </Text>
                  </View>
                );
              } else {
                // 🔥 아직 복용하지 않은 시간대가 있는 경우 스케줄 정보 표시
                return (
                  <View style={[
                    styles.doseCompletionSection,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                  ]}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 8, textAlign: 'center' }]}>
                      📋 오늘의 복용 스케줄: {displayInfo.scheduleText}
                    </Text>
                    
                    {/* 🔥 완료된 시간대 표시 */}
                    <View style={styles.completedTimeSlots}>
                      {morningCompleted && todaySchedule.morning > 0 && (
                        <View style={styles.completedBadge}>
                          <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                          <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>아침 완료</Text>
                        </View>
                      )}
                      {afternoonCompleted && todaySchedule.afternoon > 0 && (
                        <View style={styles.completedBadge}>
                          <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                          <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>점심 완료</Text>
                        </View>
                      )}
                      {eveningCompleted && todaySchedule.evening > 0 && (
                        <View style={styles.completedBadge}>
                          <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                          <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>저녁 완료</Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={[styles.medicineDetail, { color: isDark ? '#888' : '#666', textAlign: 'center', fontSize: 12, marginTop: 8 }]}>
                      🔥 RFID 태그를 디스펜서에 인식하면 자동으로 배출됩니다
                    </Text>
                  </View>
                );
              }
            })()}

            {/* 🔥 오늘 스케줄이 없는 경우 안내 메시지 (스케줄이 로드된 경우에만 표시) */}
            {isTargetUser && isScheduleLoaded && !todaySchedule.isScheduledDay && (
              <View style={[
                styles.noScheduleSection,
                { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }
              ]}>
                <Text style={[styles.noScheduleText, { color: isDark ? '#888' : '#666' }]}>
                  오늘은 복용하지 않는 날입니다
                </Text>
              </View>
            )}
            
            {/* 버튼 영역 */}
            <View style={styles.medicineActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.detailButton]}
                onPress={handleViewSupplementDetail}
              >
                <Feather name="info" size={16} color={colors.PRIMARY.DEFAULT} />
                <Text style={[styles.actionButtonText, { color: colors.PRIMARY.DEFAULT }]}>상세정보</Text>
              </TouchableOpacity>
              
              {/* 스케줄 버튼 - 타인 영양제인 경우 비활성화 */}
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  styles.scheduleButton,
                  !supplementTypeInfo.canSchedule && { 
                    opacity: 0.3,
                    backgroundColor: '#f0f0f0'
                  }
                ]}
                onPress={supplementTypeInfo.canSchedule ? handleSupplementScheduleEdit : undefined}
                disabled={!supplementTypeInfo.canSchedule}
              >
                <Feather 
                  name={supplementTypeInfo.canSchedule ? 'calendar' : 'lock'} 
                  size={16} 
                  color={supplementTypeInfo.canSchedule ? colors.SUCCESS.DEFAULT : '#ccc'} 
                />
                <Text style={[
                  styles.actionButtonText, 
                  { 
                    color: supplementTypeInfo.canSchedule ? colors.SUCCESS.DEFAULT : '#ccc'
                  }
                ]}>
                  {supplementTypeInfo.canSchedule ? '스케줄' : '접근 불가'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 하단 안내 메시지 */}
            <View style={[styles.bottomMessage, { backgroundColor: supplementTypeInfo.borderColor + '10' }]}>
              <Text style={[styles.bottomMessageText, { color: supplementTypeInfo.borderColor }]}>
                💡 {supplementTypeInfo.bottomMessage}
              </Text>
            </View>
          </View>
        </View>
      </Swipeable>
    </SafeAreaView>
  );
});

SupplementItem.displayName = 'SupplementItem';

const styles = StyleSheet.create({
  simpleMedicineCard: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  medicineInfo: {
    marginTop: 8,
  },
  medicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  medicineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  medicineDetail: {
    fontSize: 13,
  },
  doseCompletionSection: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noScheduleSection: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  noScheduleText: {
    fontSize: 13,
    textAlign: 'center',
  },
  completionMessageSection: {
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.SUCCESS.DEFAULT,
    alignItems: 'center',
  },
  completionIconContainer: {
    marginBottom: 8,
  },
  completionMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  completionSubMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  completedTimeSlots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  medicineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  detailButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  scheduleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.SUCCESS.DEFAULT,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomMessage: {
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  bottomMessageText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default SupplementItem;

