import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { MedicineCardSkeleton, SkeletonLoader } from '../common/SkeletonLoader';
import colors from '../../constants/colors';
import { Medicine } from '../../types/tdb';
import MedicineItem from './MedicineItem';
import { DailySchedule } from '../../hooks/useScheduleData';
import { FamilyMember } from '../../types/tdb';

interface MedicineListProps {
  medicines: Medicine[];
  loading: boolean;
  maxSlot: number;
  selectedMember: FamilyMember | null;
  userType: 'parent' | 'child' | null;
  familyMembers: FamilyMember[];
  dailySchedules: Record<string, DailySchedule>;
  doseCompletionStatus: Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>;
  loadingDoseStatus?: Set<string>; // 🔥 로딩 상태 추가
  themeColors: any;
  isDark: boolean;
  onViewDetail: (medicine: Medicine) => void;
  onNavigateToSchedule: (medicine: Medicine) => void;
  onDelete: (medicine: Medicine) => void;
  onCompleteDose: (medicine: Medicine, timeOfDay: 'morning' | 'afternoon' | 'evening') => Promise<void>;
  renderRightActions: (progress: any, dragX: any, onDelete: () => void) => React.ReactNode;
  getOwnerInfo: (medicine: Medicine) => { isOwn: boolean; isManaged: boolean; ownerName: string };
  getMedicineDisplayInfo: (medicine: Medicine, todaySchedule: any) => {
    name: string;
    scheduleText: string;
    isScheduledDay: boolean;
    todayTotal: number;
  };
}

/**
 * 약물 목록 컴포넌트
 * - 슬롯별로 그룹화하여 표시
 * - 빈 상태 처리
 * - 로딩 상태 처리
 */
const MedicineList: React.FC<MedicineListProps> = ({
  medicines,
  loading,
  maxSlot,
  selectedMember,
  userType,
  familyMembers,
  dailySchedules,
  doseCompletionStatus,
  loadingDoseStatus = new Set(), // 🔥 로딩 상태 기본값
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
  // 🔥 슬롯별로 약물 그룹화
  const groupedMedicines = React.useMemo(() => {
    const grouped: Record<number, Medicine[]> = {};
    
    // 슬롯별로 초기화
    for (let i = 1; i <= maxSlot; i++) {
      grouped[i] = [];
    }
    
    // 약물을 슬롯별로 분류
    medicines.forEach(medicine => {
      const slot = medicine.slot || 1;
      if (slot >= 1 && slot <= maxSlot) {
        if (!grouped[slot]) {
          grouped[slot] = [];
        }
        grouped[slot].push(medicine);
      }
    });
    
    return grouped;
  }, [medicines, maxSlot]);
  
  // 🔥 슬롯 키 배열 생성 (1번부터 maxSlot번까지)
  const slotKeys = React.useMemo(() => {
    return Array.from({ length: maxSlot }, (_, i) => i + 1);
  }, [maxSlot]);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {slotKeys.map((slot) => (
          <View key={slot} style={styles.slotContainer}>
            <View style={[styles.slotHeader, { backgroundColor: themeColors.card }]}>
              <SkeletonLoader width={100} height={20} borderRadius={4} />
            </View>
            {[1, 2, 3].map((idx) => (
              <MedicineCardSkeleton key={idx} isDark={isDark} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  
  if (medicines.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.noMedicineText, { color: themeColors.text }]}>
          ✨ 어서오세요! 복용중인 약이 없습니다.
        </Text>
        <Text style={[styles.noMedicineSubText, { color: themeColors.text }]}>
          상단의 "약 검색" 버튼을 눌러 약을 등록해주세요.
        </Text>
        <View style={[styles.emptyGuideContainer, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.emptyGuideText, { color: colors.PRIMARY.DEFAULT }]}>
            💊 약 등록 방법:
          </Text>
          <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>
            1. 상단의 "약 검색" 버튼 클릭
          </Text>
          <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>
            2. 약 이름이나 성분으로 검색
          </Text>
          <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>
            3. 복용 스케줄 설정
          </Text>
          <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>
            4. 디스펜서 슬롯 할당
          </Text>
        </View>
      </View>
    );
  }
  
  // 🔥 렌더링된 슬롯 최적화 (groupedMedicines 변경 시에만 재계산)
  const renderedSlots = slotKeys.map((slot) => {
    const slotMedicines = groupedMedicines[slot];
    
    if (slotMedicines.length === 0) return null;
    
    return (
      <View key={slot} style={styles.slotContainer}>
        <View style={styles.slotHeader}>
          <View style={[styles.slotBadge, { backgroundColor: colors.PRIMARY.DEFAULT }]}>
            <Feather name="package" size={16} color={colors.WHITE} />
            <Text style={styles.slotBadgeText}>
              {slot}번
            </Text>
          </View>
          <Text style={[styles.slotLabel, { color: isDark ? '#888' : '#666' }]}>
            디스펜서
          </Text>
        </View>
        {slotMedicines.map((medicine, idx) => {
          // 🔥 로딩 상태 확인 (target_users 기반)
          let actualTargetUserId = selectedMember?.user_id || '';
          if (medicine.target_users && medicine.target_users.length > 0) {
            actualTargetUserId = medicine.target_users[0];
          }
          const statusKey = `${medicine.medi_id}_${actualTargetUserId}`;
          const isLoadingDoseStatus = loadingDoseStatus.has(statusKey);
          
          return (
            <MedicineItem
              key={`${medicine.medi_id}-${medicine.slot}-${idx}`}
              medicine={medicine}
              index={idx}
              selectedMember={selectedMember}
              userType={userType}
              familyMembers={familyMembers}
              dailySchedules={dailySchedules}
              doseCompletionStatus={doseCompletionStatus}
              isLoadingDoseStatus={isLoadingDoseStatus}
              themeColors={themeColors}
              isDark={isDark}
              onViewDetail={onViewDetail}
              onNavigateToSchedule={onNavigateToSchedule}
              onDelete={onDelete}
              onCompleteDose={onCompleteDose}
              renderRightActions={renderRightActions}
              getOwnerInfo={getOwnerInfo}
              getMedicineDisplayInfo={getMedicineDisplayInfo}
            />
          );
        })}
      </View>
    );
  }).filter(Boolean);
  
  return (
    <View>
      {renderedSlots.length > 0 ? renderedSlots : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.noMedicineText, { color: themeColors.text }]}>
            등록된 약이 없습니다.
          </Text>
          <Text style={[styles.noMedicineSubText, { color: themeColors.text }]}>
            상단의 "약 검색" 버튼을 눌러 약을 등록해주세요.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  noMedicineText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  noMedicineSubText: {
    fontSize: 12,
    marginTop: 5,
  },
  emptyGuideContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  emptyGuideText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyGuideStep: {
    fontSize: 13,
    marginTop: 4,
  },
  slotContainer: {
    marginBottom: 20,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 10,
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.WHITE,
  },
  slotLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default React.memo(MedicineList);

