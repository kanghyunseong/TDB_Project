import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';
import { Medicine, FamilyMember } from '../../types/tdb';
import { formatDateForDisplay } from '../../utils/dateUtils';
import { getTodayScheduleForMedicine, TodaySchedule } from '../../utils/scheduleUtils';
import { DailySchedule } from '../../hooks/useScheduleData';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface MedicineItemProps {
  medicine: Medicine;
  index: number;
  selectedMember: FamilyMember | null;
  userType: 'parent' | 'child' | null;
  familyMembers: FamilyMember[];
  dailySchedules: Record<string, DailySchedule>;
  doseCompletionStatus: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    morningMissed?: boolean;
    afternoonMissed?: boolean;
    eveningMissed?: boolean;
  }>;
  isLoadingDoseStatus?: boolean; // 🔥 로딩 상태 추가
  themeColors: any;
  isDark: boolean;
  onViewDetail: (medicine: Medicine) => void;
  onNavigateToSchedule: (medicine: Medicine) => void;
  onDelete: (medicine: Medicine) => void;
  onCompleteDose: (medicine: Medicine, timeOfDay: 'morning' | 'afternoon' | 'evening') => Promise<void>;
  renderRightActions: (progress: any, dragX: any, onDelete: () => void) => React.ReactNode;
  getOwnerInfo: (medicine: Medicine) => { isOwn: boolean; isManaged: boolean; ownerName: string };
  getMedicineDisplayInfo: (medicine: Medicine, todaySchedule: TodaySchedule) => {
    name: string;
    scheduleText: string;
    isScheduledDay: boolean;
    todayTotal: number;
  };
}

const MedicineItem: React.FC<MedicineItemProps> = ({
  medicine,
  selectedMember,
  userType,
  familyMembers,
  dailySchedules,
  doseCompletionStatus,
  isLoadingDoseStatus = false, // 🔥 로딩 상태 prop 추가
  themeColors,
  isDark,
  onViewDetail,
  onNavigateToSchedule,
  onDelete,
  onCompleteDose,
  renderRightActions,
  getOwnerInfo,
  getMedicineDisplayInfo,
}) => {
  const handleViewMedicineDetail = () => {
    if (__DEV__) {
      console.log('🔥 [MedicineItem] 의약품 상세보기:', medicine.name, medicine.medi_id);
    }
    onViewDetail(medicine);
  };

  const handleSchedulePress = () => {
    onNavigateToSchedule(medicine);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '없음';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const checkIsTargetUser = () => {
    if (!selectedMember) return false;
    
    // 🔥 자녀 계정의 경우 항상 본인이 대상인지만 확인
    if (userType === 'child') {
      if (!medicine.target_users || medicine.target_users.length === 0) {
        return true; // 가족 공통 약물
      }
      return medicine.target_users.includes(selectedMember.user_id);
    }
    
    // 🔥 보호자 계정의 경우 기존 로직 유지
    if (!medicine.target_users || medicine.target_users.length === 0) {
      return true;
    }
    
    return medicine.target_users.includes(selectedMember.user_id);
  };

  const isTargetUser = checkIsTargetUser();
  const ownerInfo = getOwnerInfo(medicine);

  const analyzeMedicineType = (): 'family_common' | 'personal_only' | 'partial_common' | 'others_only' => {
    if (!medicine.target_users || medicine.target_users.length === 0) {
      return 'family_common';
    }
    
    const targetCount = medicine.target_users.length;
    const totalMembers = familyMembers.length;
    
    if (targetCount === totalMembers) {
      return 'family_common';
    } else if (targetCount === 1) {
      if (medicine.target_users.includes(selectedMember?.user_id || '')) {
        return 'personal_only';
      } else {
        return 'others_only';
      }
    } else {
      return 'partial_common';
    }
  };

  const medicineType = analyzeMedicineType();

  const getCardStyle = () => {
    const baseStyle = {
      ...styles.medicineCard,
      backgroundColor: isDark ? themeColors.card : 'white',
    };

    // 🔥 자녀 계정의 경우 색깔 표시 로직 개선
    if (userType === 'child') {
      if (medicineType === 'family_common') {
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: colors.PRIMARY.DEFAULT,
          backgroundColor: isDark ? themeColors.card : '#F0F8FF',
        };
      } else if (isTargetUser) {
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: colors.SUCCESS.DEFAULT,
          backgroundColor: isDark ? themeColors.card : '#F0FFF0',
        };
      } else {
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: '#FF6B6B',
          backgroundColor: isDark ? themeColors.card : '#FFE5E5',
        };
      }
    }

    switch (medicineType) {
      case 'family_common':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: colors.PRIMARY.DEFAULT,
          backgroundColor: isDark ? themeColors.card : '#F0F8FF',
        };
      case 'personal_only':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: colors.SUCCESS.DEFAULT,
          backgroundColor: isDark ? themeColors.card : '#F0FFF0',
        };
      case 'partial_common':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: '#FFA500',
          backgroundColor: isDark ? themeColors.card : '#FFF8DC',
        };
      case 'others_only':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: '#FF6B6B',
          backgroundColor: isDark ? themeColors.card : '#FFE5E5',
        };
      default:
        return baseStyle;
    }
  };

  // 🔥 target_users 기반으로 올바른 스케줄 키 생성
  // target_users 배열의 첫 번째 요소를 문자열로 변환하여 안정화
  const actualTargetUserId = useMemo(() => {
    if (medicine.target_users && medicine.target_users.length > 0) {
      return String(medicine.target_users[0]);
    }
    return selectedMember?.user_id || '';
  }, [medicine.target_users?.join(','), selectedMember?.user_id]);
  
  const scheduleKey = useMemo(() => {
    return `${medicine.medi_id}_${actualTargetUserId}`;
  }, [medicine.medi_id, actualTargetUserId]);

  // 🔥 statusKey 계산 (복용 상태용)
  const statusKey = useMemo(() => {
    return `${medicine.medi_id}_${actualTargetUserId}`;
  }, [medicine.medi_id, actualTargetUserId]);

  // 🔥 dailySchedule 참조 안정화
  const dailySchedule = useMemo(() => {
    return dailySchedules[scheduleKey];
  }, [dailySchedules, scheduleKey]);

  // 🔥 스케줄이 로드되었는지 확인
  const isScheduleLoaded = useMemo(() => {
    return !!dailySchedule;
  }, [dailySchedule]);

  // 🔥 복용 상태가 로드되었는지 확인
  const isDoseStatusLoaded = useMemo(() => {
    return !!doseCompletionStatus[statusKey];
  }, [doseCompletionStatus, statusKey]);

  // 🔥 전체 데이터 로딩 완료 여부 (스케줄과 복용 상태 모두 필요)
  // 🔥 로딩이 완전히 끝나고 데이터가 모두 준비되었을 때만 true
  const isDataReady = useMemo(() => {
    // 로딩 중이면 아직 준비되지 않음
    if (isLoadingDoseStatus) {
      return false;
    }
    // 스케줄과 복용 상태가 모두 로드되어야 함
    return isScheduleLoaded && isDoseStatusLoaded;
  }, [isScheduleLoaded, isDoseStatusLoaded, isLoadingDoseStatus]);

  // 🔥 오늘의 스케줄 계산을 useMemo로 안정화하여 깜빡임 방지
  // getTodayScheduleForMedicine는 외부 순수 함수이므로 의존성에서 제외
  const prevTodayScheduleRef = useRef<TodaySchedule | null>(null);
  
  const todaySchedule = useMemo(() => {
    // 🔥 데이터가 준비되지 않았으면 이전 스케줄 유지 (깜빡임 방지)
    if ((!isDataReady || isLoadingDoseStatus) && prevTodayScheduleRef.current) {
      return prevTodayScheduleRef.current;
    }
    
    const schedule = getTodayScheduleForMedicine(medicine, dailySchedule);
    prevTodayScheduleRef.current = schedule; // 🔥 안정적인 값 저장
    return schedule;
  }, [medicine.medi_id, medicine.target_users, dailySchedule, isLoadingDoseStatus, isDataReady]);

  // 🔥 displayInfo 계산을 useMemo로 안정화하여 깜빡임 방지
  // getMedicineDisplayInfo는 useCallback으로 안정화된 함수이므로 의존성에서 제외 가능
  const displayInfo = useMemo(() => {
    return getMedicineDisplayInfo(medicine, todaySchedule);
  }, [medicine.medi_id, medicine.name, todaySchedule]);
  
  // 🔥 completionStatus 객체를 useMemo로 안정화하여 깜빡임 방지
  // 🔥 doseCompletionStatus가 업데이트되는 동안 이전 상태를 유지하여 깜빡임 방지
  const prevCompletionStatusRef = useRef<{
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    morningMissed?: boolean;
    afternoonMissed?: boolean;
    eveningMissed?: boolean;
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
    
    // 🔥 기본값 반환 (깜빡임 방지를 위해 항상 일관된 값 반환)
    const defaultStatus = {
      morning: false,
      afternoon: false,
      evening: false,
      morningMissed: false,
      afternoonMissed: false,
      eveningMissed: false,
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
  
  // 🔥 현재 시간대 확인 함수
  const getCurrentTimeOfDay = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour >= 5 && currentHour < 11) {
      return 'morning';
    } else if (currentHour >= 11 && currentHour < 17) {
      return 'afternoon';
    } else {
      return 'evening';
    }
  }, []);
  
  // 🔥 놓침 상태 계산 (서버에서 반환된 missed 상태 또는 시간 기반 판단)
  const morningMissed = useMemo(() => {
    // 🔥 서버에서 명시적으로 missed 상태가 반환된 경우
    if (completionStatus.morningMissed) return true;
    // 🔥 시간 기반 판단: 스케줄이 있지만 완료되지 않고 시간이 지난 경우
    if (!todaySchedule || todaySchedule.morning === 0) return false;
    if (morningCompleted) return false;
    // 아침 시간대가 지났는지 확인 (11시 이후)
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 11;
  }, [todaySchedule, morningCompleted, completionStatus.morningMissed]);
  
  const afternoonMissed = useMemo(() => {
    // 🔥 서버에서 명시적으로 missed 상태가 반환된 경우
    if (completionStatus.afternoonMissed) return true;
    // 🔥 시간 기반 판단: 스케줄이 있지만 완료되지 않고 시간이 지난 경우
    if (!todaySchedule || todaySchedule.afternoon === 0) return false;
    if (afternoonCompleted) return false;
    // 점심 시간대가 지났는지 확인 (17시 이후)
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 17;
  }, [todaySchedule, afternoonCompleted, completionStatus.afternoonMissed]);
  
  const eveningMissed = useMemo(() => {
    // 🔥 서버에서 명시적으로 missed 상태가 반환된 경우
    if (completionStatus.eveningMissed) return true;
    // 🔥 시간 기반 판단: 스케줄이 있지만 완료되지 않고 시간이 지난 경우
    if (!todaySchedule || todaySchedule.evening === 0) return false;
    if (eveningCompleted) return false;
    // 저녁 시간대는 다음날 5시 이전까지는 놓침으로 표시하지 않음 (당일 저녁은 아직 기회가 있음)
    // 단, 다음날 5시 이후면 놓침으로 표시
    const now = new Date();
    const currentHour = now.getHours();
    // 다음날 5시 이후 (즉, 오늘 저녁을 놓친 경우)
    return currentHour >= 0 && currentHour < 5;
  }, [todaySchedule, eveningCompleted, completionStatus.eveningMissed]);
  
  // 🔥 allCompleted 이전 값 유지를 위한 ref
  const prevCalculatedAllCompletedRef = useRef<boolean | null>(null);
  
  // 🔥 allCompleted 계산을 useMemo로 안정화하여 깜빡임 방지
  // 🔥 데이터가 모두 준비되고 로딩이 완료된 후에만 계산
  const calculatedAllCompleted = useMemo(() => {
    // 🔥 데이터가 준비되지 않았거나 로딩 중이면 이전 상태 유지 (깜빡임 방지)
    if (!isDataReady || isLoadingDoseStatus) {
      if (prevCalculatedAllCompletedRef.current !== null) {
        return prevCalculatedAllCompletedRef.current;
      }
      return false; // 초기값
    }
    
    // 🔥 스케줄이 없거나 유효하지 않은 경우 false 반환
    if (!todaySchedule || !todaySchedule.isScheduledDay) {
      const result = false;
      prevCalculatedAllCompletedRef.current = result;
      return result;
    }
    
    // 🔥 모든 시간대가 완료되었는지 확인 (데이터가 준비된 후에만)
    const morningOk = todaySchedule.morning === 0 || morningCompleted;
    const afternoonOk = todaySchedule.afternoon === 0 || afternoonCompleted;
    const eveningOk = todaySchedule.evening === 0 || eveningCompleted;
    
    const result = morningOk && afternoonOk && eveningOk;
    prevCalculatedAllCompletedRef.current = result;
    return result;
  }, [
    isDataReady, // 🔥 데이터 준비 여부 확인
    todaySchedule?.isScheduledDay,
    todaySchedule?.morning,
    todaySchedule?.afternoon,
    todaySchedule?.evening,
    morningCompleted,
    afternoonCompleted,
    eveningCompleted,
    isLoadingDoseStatus
  ]);
  
  // 🔥 안정적인 allCompleted 상태 관리 (깜빡임 방지)
  // 🔥 초기값은 계산된 값으로 설정하되, 이후에는 안정적으로 유지
  const [allCompleted, setAllCompleted] = useState<boolean>(() => calculatedAllCompleted);
  const prevAllCompletedRef = useRef<boolean>(calculatedAllCompleted);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const stableAllCompletedRef = useRef<boolean>(calculatedAllCompleted); // 🔥 안정적인 값 저장
  
  // 🔥 실제로 변경된 경우에만 업데이트 (깜빡임 방지)
  useEffect(() => {
    // 🔥 데이터가 준비되지 않았거나 로딩 중이면 이전 안정적인 값을 유지 (깜빡임 방지)
    if (!isDataReady || isLoadingDoseStatus) {
      // 🔥 로딩 중에는 안정적인 값으로 복원
      if (allCompleted !== stableAllCompletedRef.current) {
        setAllCompleted(stableAllCompletedRef.current);
        prevAllCompletedRef.current = stableAllCompletedRef.current;
      }
      // 🔥 로딩 중에는 이전 타임아웃도 모두 취소
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      return;
    }
    
    // 🔥 초기 마운트 시에는 즉시 업데이트
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      setAllCompleted(calculatedAllCompleted);
      prevAllCompletedRef.current = calculatedAllCompleted;
      stableAllCompletedRef.current = calculatedAllCompleted; // 🔥 안정적인 값 저장
      return;
    }
    
    // 🔥 이전 값과 같으면 업데이트하지 않음
    if (prevAllCompletedRef.current === calculatedAllCompleted) {
      return;
    }
    
    // 🔥 스케줄이 없으면 즉시 false로 설정
    if (!todaySchedule?.isScheduledDay) {
      if (allCompleted !== false) {
        setAllCompleted(false);
        prevAllCompletedRef.current = false;
        stableAllCompletedRef.current = false; // 🔥 안정적인 값 저장
      }
      return;
    }
    
    // 🔥 이전 타임아웃 취소
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // 🔥 데이터가 준비된 후 안정화를 위한 짧은 딜레이 (깜빡임 방지)
    updateTimeoutRef.current = setTimeout(() => {
      // 🔥 데이터가 준비되고 로딩이 완료된 후에만 업데이트
      if (isDataReady && !isLoadingDoseStatus && prevAllCompletedRef.current !== calculatedAllCompleted) {
        setAllCompleted(calculatedAllCompleted);
        prevAllCompletedRef.current = calculatedAllCompleted;
        stableAllCompletedRef.current = calculatedAllCompleted; // 🔥 안정적인 값 저장
        prevCalculatedAllCompletedRef.current = calculatedAllCompleted; // 🔥 계산된 값도 저장
      }
    }, 200); // 200ms 딜레이로 안정화
    
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [calculatedAllCompleted, todaySchedule?.isScheduledDay, allCompleted, isLoadingDoseStatus, isDataReady]);

  return (
    <Swipeable
      renderRightActions={(progress, dragX) =>
        renderRightActions(progress, dragX, () => onDelete(medicine))
      }
      enabled={userType === 'parent'}
    >
      <View style={[
        styles.simpleMedicineCard,
        getCardStyle(),
        {
          backgroundColor: isDark ? themeColors.card : 'white',
        }
      ]}>
        <View style={styles.medicineInfo}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.medicineName, { color: themeColors.text, flex: 1 }]}>{medicine.name}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              {/* 약물 성격에 따른 상태 표시 */}
              {medicineType === 'family_common' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="users" size={16} color="#007AFF" />
                  <Text style={{ color: '#007AFF', fontSize: 12, marginLeft: 4 }}>
                    가족 공통
                  </Text>
                </View>
              ) : ownerInfo.isOwn ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="check-circle" size={16} color="#28A745" />
                  <Text style={{ color: '#28A745', fontSize: 12, marginLeft: 4 }}>내 약물</Text>
                </View>
              ) : ownerInfo.isManaged ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="shield" size={16} color="#FFA500" />
                  <Text style={{ color: '#FFA500', fontSize: 12, marginLeft: 4 }}>관리 약물</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="lock" size={16} color="#FF6B6B" />
                  <Text style={{ color: '#FF6B6B', fontSize: 12, marginLeft: 4 }}>타인 약물</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.medicineDetails}>
            <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
              총량: {medicine.totalQuantity || '-'}정 | 남은 개수: {medicine.remain || '-'}정
            </Text>
            <Text style={[styles.medicineDetail, { color: colors.PRIMARY.DEFAULT, fontWeight: 'bold' }]}>
              슬롯: {medicine.slot || '-'}번
            </Text>
          </View>

          {/* 🔥 시간대별 복용량 표시 */}
          <View style={styles.medicineDetails}>
            <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
              시작일: {formatDateForDisplay(medicine.start_date)}
            </Text>
            <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
              종료일: {formatDateForDisplay(medicine.end_date)}
            </Text>
          </View>
          
          {/* 🔥 복용 완료 상태 확인 및 조건부 렌더링 */}
          {(ownerInfo.isOwn || ownerInfo.isManaged || medicineType === 'family_common') && (() => {
            // 🔥 스케줄이 로드되지 않았거나 로딩 중일 때 스켈레톤 UI 표시 (깜빡임 방지)
            if (!isScheduleLoaded || isLoadingDoseStatus) {
              return (
                <View style={[
                  styles.doseCompletionSection,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                ]}>
                  <SkeletonLoader width="100%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
                  <SkeletonLoader width="70%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                  </View>
                </View>
              );
            }
            
            // 🔥 스케줄이 없는 날은 표시하지 않음
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
                  <SkeletonLoader width="70%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                    <SkeletonLoader width={60} height={20} borderRadius={10} />
                  </View>
                </View>
              );
            }
            
            // 🔥 재고 부족이나 기간 만료인 경우 스케줄 표시 안함
            if (todaySchedule.reason === 'no_stock') {
              return (
                <View style={[
                  styles.doseCompletionSection,
                  { backgroundColor: isDark ? '#2a1a1a' : '#FFE5E5' }
                ]}>
                  <Text style={[styles.sectionTitle, { color: colors.DANGER.DEFAULT, marginBottom: 8, textAlign: 'center' }]}>
                    ⚠️ 재고 부족
                  </Text>
                  <Text style={[styles.medicineDetail, { color: isDark ? '#888' : '#666', textAlign: 'center', fontSize: 12 }]}>
                    약물 재고가 부족합니다. 새로운 약을 추가해주세요.
                  </Text>
                </View>
              );
            }
            
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
                    복용 기간이 만료되었습니다. 의사와 상담 후 연장하세요.
                  </Text>
                </View>
              );
            }
            
            // 🔥 실제 복용 완료 상태 계산 (데이터가 준비된 후에만)
            // 🔥 렌더링 시점에 직접 계산하여 최신 상태 보장
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
              // 🔥 아직 복용하지 않은 시간대가 있는 경우 스케줄 정보 표시 (체크 버튼은 대시보드에서 처리)
              return (
                <View style={[
                  styles.doseCompletionSection,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                ]}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 8, textAlign: 'center' }]}>
                    📋 오늘의 복용 스케줄: {displayInfo.scheduleText}
                  </Text>
                  
                  {/* 🔥 완료/놓침 시간대 표시 */}
                  <View style={styles.completedTimeSlots}>
                    {morningCompleted && todaySchedule.morning > 0 && (
                      <View style={styles.completedBadge}>
                        <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                        <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>아침 완료</Text>
                      </View>
                    )}
                    {morningMissed && (
                      <View style={styles.missedBadge}>
                        <Feather name="x-circle" size={12} color={colors.DANGER.DEFAULT} />
                        <Text style={[styles.missedText, { color: colors.DANGER.DEFAULT }]}>아침 놓침</Text>
                      </View>
                    )}
                    {afternoonCompleted && todaySchedule.afternoon > 0 && (
                      <View style={styles.completedBadge}>
                        <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                        <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>점심 완료</Text>
                      </View>
                    )}
                    {afternoonMissed && (
                      <View style={styles.missedBadge}>
                        <Feather name="x-circle" size={12} color={colors.DANGER.DEFAULT} />
                        <Text style={[styles.missedText, { color: colors.DANGER.DEFAULT }]}>점심 놓침</Text>
                      </View>
                    )}
                    {eveningCompleted && todaySchedule.evening > 0 && (
                      <View style={styles.completedBadge}>
                        <Feather name="check-circle" size={12} color={colors.SUCCESS.DEFAULT} />
                        <Text style={[styles.completedText, { color: colors.SUCCESS.DEFAULT }]}>저녁 완료</Text>
                      </View>
                    )}
                    {eveningMissed && (
                      <View style={styles.missedBadge}>
                        <Feather name="x-circle" size={12} color={colors.DANGER.DEFAULT} />
                        <Text style={[styles.missedText, { color: colors.DANGER.DEFAULT }]}>저녁 놓침</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[styles.medicineDetail, { color: isDark ? '#888' : '#666', textAlign: 'center', fontSize: 12, marginTop: 8 }]}>
                    💡 복용 체크는 대시보드에서 진행해주세요
                  </Text>
                </View>
              );
            }
          })()}

          {/* 🔥 오늘 스케줄이 없는 경우 안내 메시지 */}
          {isTargetUser && !todaySchedule.isScheduledDay && (
            <View style={[
              styles.noScheduleSection,
              { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }
            ]}>
              <Text style={[styles.noScheduleText, { color: isDark ? '#888' : '#666' }]}>
                오늘은 복용하지 않는 날입니다
              </Text>
            </View>
          )}
          
          {/* 버튼 영역 - 권한별 구분 */}
          <View style={styles.medicineActions}>
            {/* 🔥 상세정보는 모든 사용자가 볼 수 있도록 수정 */}
            <TouchableOpacity
              style={[styles.actionButton, styles.detailButton]}
              onPress={handleViewMedicineDetail}
            >
              <Feather name="info" size={16} color={colors.PRIMARY.DEFAULT} />
              <Text style={[styles.actionButtonText, { color: colors.PRIMARY.DEFAULT }]}>
                상세정보
              </Text>
            </TouchableOpacity>
            
            {/* 🔥 수정: 권한에 따른 스케줄 버튼 제어 - 보호자는 모든 약품 편집 가능 */}
            {(() => {
              // 🎯 실제 소유자 확인
              let actualOwnerId: string | null = null;
              if (medicine.target_users && medicine.target_users.length > 0) {
                actualOwnerId = medicine.target_users[0];
              }
              const actualOwner = actualOwnerId ? familyMembers.find(m => m.user_id === actualOwnerId) : null;
              
              // 🎯 선택된 사용자가 실제 소유자인지 확인
              const isSelectedUserOwner = actualOwnerId === selectedMember?.user_id;
              
              // 🎯 보호자가 자녀로 선택했을 때, 보호자에게 할당된 약물은 편집 불가
              const isOthersOnly = !isTargetUser && medicineType !== 'family_common';
              // 보호자가 자녀로 선택했을 때, 보호자 자신의 약물은 편집 불가
              const isParentViewingOwnMedicine = userType === 'parent' && actualOwner?.role === 'parent' && !isSelectedUserOwner;
              
              // 🎯 스케줄 권한: 
              // 1. 가족 공통 약물: 부모와 자녀 둘 다 스케줄 등록 가능
              // 2. 부모에게만 약물 부여: 부모만 가능, 자녀는 타인 약물로 표시 (스케줄 불가)
              // 3. 자녀에게만 약물 부여: 부모가 자녀로 선택한 경우에만 스케줄 조정 가능, 부모가 자신을 선택한 경우 스케줄 불가
              // 4. 자녀는 본인 약물 또는 가족 공통 약물의 스케줄 등록 가능
              
              // 🔥 부모가 자신을 선택한 상태에서 자녀 전용 약물인지 확인
              const isParentViewingSelfWithChildOnlyMedicine = 
                userType === 'parent' && 
                medicineType === 'others_only' && 
                actualOwner?.role === 'child' && 
                !isSelectedUserOwner; // 자녀가 소유자이고 부모가 선택됨
              
              const hasSchedulePermission = 
                // 보호자 권한: 
                // - 가족 공통 약물이거나
                // - 자녀의 약물이면서 자신을 선택하지 않은 경우 (자녀로 선택한 경우) 또는
                // - 본인 약물(단, 자녀로 선택했을 때 본인 약물 제외)
                // 단, 부모가 자신을 선택한 상태에서 자녀 전용 약물인 경우 제외
                (userType === 'parent' && !isParentViewingSelfWithChildOnlyMedicine && (
                  medicineType === 'family_common' || 
                  (actualOwner?.role === 'child' && !isSelectedUserOwner) || // 자녀의 약물이지만 자신을 선택한 경우 제외
                  (!isParentViewingOwnMedicine && isSelectedUserOwner) // 본인 약물이면서 자녀로 선택하지 않은 경우
                )) ||
                // 자녀 권한: 가족 공통 약물이거나 본인 약물
                (userType === 'child' && (medicineType === 'family_common' || (!isOthersOnly && isSelectedUserOwner)));
              
              return (
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    styles.scheduleButton,
                    !hasSchedulePermission && { 
                      opacity: 0.3,
                      backgroundColor: '#f0f0f0'
                    }
                  ]}
                  onPress={hasSchedulePermission ? handleSchedulePress : undefined}
                  disabled={!hasSchedulePermission}
                >
                  <Feather 
                    name={hasSchedulePermission ? 'calendar' : 'lock'} 
                    size={16} 
                    color={hasSchedulePermission ? colors.SUCCESS.DEFAULT : '#ccc'} 
                  />
                  <Text style={[
                    styles.actionButtonText, 
                    { 
                      color: hasSchedulePermission ? colors.SUCCESS.DEFAULT : '#ccc'
                    }
                  ]}>
                    {hasSchedulePermission ? '스케줄' : '접근 불가'}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </View>
          
          {/* 🔥 타인 약물 정보 표시 - 보호자는 관리 가능한 정보로 표시 */}
          {!isTargetUser && ownerInfo && (
            <View style={{ 
              marginTop: 8, 
              padding: 8, 
              backgroundColor: medicineType === 'others_only' ? (isDark ? '#FF6B6B20' : '#FFE5E5') : (isDark ? '#007AFF20' : '#E3F2FD'), 
              borderRadius: 6 
            }}>
              <Text style={{ 
                color: medicineType === 'others_only' ? '#FF6B6B' : '#007AFF', 
                fontSize: 12, 
                textAlign: 'center' 
              }}>
                {(() => {
                  // 🔥 실제 소유자를 찾아서 정확한 메시지 표시 (보호자/자녀 계정 공통)
                  if (medicineType === 'others_only') {
                    // 🔥 target_users를 먼저 확인하여 실제 소유자 찾기
                    if (medicine.target_users && medicine.target_users.length > 0) {
                      const ownerId = medicine.target_users[0];
                      const owner = familyMembers.find(m => m.user_id === ownerId);
                      if (owner) {
                        // 보호자인 경우
                        if (owner.role === 'parent') {
                          return userType === 'parent' 
                            ? '보호자의 개인 약물 (보호자 관리 가능)'
                            : '보호자의 개인 약물';
                        }
                        // 자녀인 경우
                        return userType === 'parent'
                          ? `${owner.name}의 개인 약물 (보호자 관리 가능)`
                          : `${owner.name}의 개인 약물`;
                      }
                    }
                    // ownerInfo.ownerName이 있으면 사용 (fallback)
                    if (ownerInfo.ownerName) {
                      const ownerFromName = familyMembers.find(m => m.name === ownerInfo.ownerName);
                      if (ownerFromName) {
                        if (ownerFromName.role === 'parent') {
                          return userType === 'parent'
                            ? '보호자의 개인 약물 (보호자 관리 가능)'
                            : '보호자의 개인 약물';
                        }
                        return userType === 'parent'
                          ? `${ownerInfo.ownerName}의 개인 약물 (보호자 관리 가능)`
                          : `${ownerInfo.ownerName}의 개인 약물`;
                      }
                      // 이름으로 찾지 못한 경우
                      return userType === 'parent'
                        ? `${ownerInfo.ownerName}의 개인 약물 (보호자 관리 가능)`
                        : `${ownerInfo.ownerName}의 개인 약물`;
                    }
                    return userType === 'parent'
                      ? '자녀의 개인 약물 (보호자 관리 가능)'
                      : '다른 가족 구성원의 개인 전용 약물';
                  }
                  // 가족 공통 약물
                  return '가족 공통 약물';
                })()}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  simpleMedicineCard: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicineCard: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  medicineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  medicineDetail: {
    fontSize: 13,
    color: '#666',
  },
  doseCompletionSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noScheduleSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noScheduleText: {
    fontSize: 14,
    fontStyle: 'italic',
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
  medicineActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  detailButton: {
    backgroundColor: colors.WHITE,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  scheduleButton: {
    backgroundColor: colors.WHITE,
    borderColor: colors.SUCCESS.DEFAULT,
  },
  checkButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  checkButtonText: {
    color: colors.WHITE,
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '600',
  },
  missedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  missedText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default React.memo(MedicineItem);

