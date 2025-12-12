import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, BottomTabParamList } from '../types/navigation';
import { getFamilyMembers, getMedicineList, getMedicineSchedule, type FamilyMember, deleteMedicine, getSupplementList, getSupplementSchedule, deleteSupplement as deleteSupplementAPI } from '../api/family';
import { type Medicine, type MedicineSchedule, type User, NutritionalSupplement } from '../types/tdb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { Swipeable } from 'react-native-gesture-handler';
import { getCurrentUser } from '../api/userStorage';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../api/users';
import { DEBOUNCE_DELAYS } from '../constants/timeouts';

import { scheduleApi } from '../api/schedule'; 
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api';
import { StockWarningBanner } from '../components/StockWarningBanner';
import DrugInteractionAlert from '../components/common/DrugInteractionAlert';
import { useDrugInteractions } from '../hooks/useDrugInteractions';
import { DrugInteractionValidator } from '../utils/drugInteractionValidator';
import { useScheduleData } from '../hooks/useScheduleData';
import { getTodayScheduleForMedicine, getTodayScheduleForSupplement } from '../utils/scheduleUtils';
import MedicineItem from '../components/medicine/MedicineItem';
import MedicineList from '../components/medicine/MedicineList';
import { formatDateForDisplay } from '../utils/dateUtils';
import { getMedicineRemainByMachine } from '../api/machine';
import { scheduleDispense } from '../api/dispenser';
import TodayScheduleDisplayModal from '../components/TodayScheduleDisplayModal';
import MedicineExtensionModal from '../components/MedicineExtensionModal';
import MemberSelector from '../components/member/MemberSelector';
import DateHeader from '../components/common/DateHeader';
import { MedicineCardSkeleton, SkeletonLoader } from '../components/common/SkeletonLoader';
import SectionHeader from '../components/common/SectionHeader';
import MedicineHeader from '../components/medicine/MedicineHeader';
import SupplementItem from '../components/supplement/SupplementItem';
import { logger } from '../utils/logger';
import { useDoseCompletion } from '../hooks/useDoseCompletion';
import { useMedicineActions } from '../hooks/useMedicineActions';

type MainHomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const SELECTED_MEMBER_KEY = '@selected_member_id';
const USER_KEY = '@user';

function maskConnectID(connectId: string) {
  if (!connectId || connectId.length < 3) return connectId;
  return '*'.repeat(connectId.length - 2) + connectId.slice(-2);
}

function MainHomeScreen() {
  const { colors: themeColors, isDark } = useTheme();
  const [medicineList, setMedicineList] = useState<Medicine[]>([]);
  const [supplementList, setSupplementList] = useState<NutritionalSupplement[]>([]);
  const [loading, setLoading] = useState(true);
  // 🔥 세분화된 로딩 상태 관리
  const [loadingStates, setLoadingStates] = useState({
    familyMembers: true,
    medicines: true,
    supplements: true,
    schedules: true,
    doseStatus: true,
  });
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [parentConnect, setParentConnect] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editingSupplement, setEditingSupplement] = useState<NutritionalSupplement | null>(null);
  const [maxSlot, setMaxSlot] = useState(3); // 맥스 슬롯 설정 state 추가
  const [userType, setUserType] = useState<'parent' | 'child' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpiredBanner, setShowExpiredBanner] = useState(true);
  const [medicineSchedules, setMedicineSchedules] = useState<Record<string, MedicineSchedule | null>>({});
  // 🔥 복용 완료 상태 관리 state 추가 (놓침 상태 포함)
  const [doseCompletionStatus, setDoseCompletionStatus] = useState<Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    morningMissed?: boolean;
    afternoonMissed?: boolean;
    eveningMissed?: boolean;
  }>>({});
  // 🔥 복용 완료 상태 로딩 추적 (깜빡임 방지)
  const [loadingDoseStatus, setLoadingDoseStatus] = useState<Set<string>>(new Set());
  
  // 🔥 컴포넌트 마운트 상태 추적 (unmount 시 요청 취소용)
  const isMountedRef = useRef(true);
  
  // 🔥 약물 상호작용 검사 훅 사용
  const {
    interactionResult,
    showInteractionAlert,
    setShowInteractionAlert,
    checkFamilyDrugInteractions,
    invalidateCaches: invalidateInteractionCaches,
  } = useDrugInteractions(familyMembers);
  
  // 🔥 스케줄 데이터 훅 사용
  const {
    dailySchedules,
    supplementSchedules,
    loadDailySchedule,
    loadSupplementSchedule,
    clearSchedule,
    clearAllSchedules,
  } = useScheduleData(selectedMember?.user_id || null, isMountedRef);
  
  // 🔥 배출 모달 상태 관리
  const [todayScheduleModalVisible, setTodayScheduleModalVisible] = useState(false);
  
  // 🔥 연장 시스템 상태 관리
  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [medicineToExtend, setMedicineToExtend] = useState<Medicine | null>(null);

  const { logout } = useAuth();

  // 🔥 멤버 선택 핸들러 (훅보다 먼저 정의 필요)
  const handleSelectMember = useCallback(async (member: FamilyMember) => {
    try {
      logger.log('멤버 선택 시도', { name: member.name });
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      const user = JSON.parse(userJson) as User;
      if (user.role === 'child' && member.role === 'parent') {
        Toast.show({
          type: 'error',
          text1: '서브 계정으로는 메인 계정을 선택할 수 없습니다.',
          position: 'bottom',
        });
        return;
      }
      
      setSelectedMember(member);
      setIsExpanded(false);
      await AsyncStorage.setItem(SELECTED_MEMBER_KEY, member.user_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '멤버 선택 실패';
      Toast.show({
        type: 'error',
        text1: errorMessage,
      });
    }
  }, []);

  // 🔥 복용 완료 상태 개별 조회 함수 (상태 반환하도록 수정)
  const loadDoseCompletionStatus = useCallback(async (medicineId: string, userId: string): Promise<{
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    morningMissed?: boolean;
    afternoonMissed?: boolean;
    eveningMissed?: boolean;
  }> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiClient.get(
        `${API_ENDPOINTS.DOSE_HISTORY.TODAY_STATUS}?user_id=${userId}&medi_id=${medicineId}&date=${today}`
      );

      if (response.data.success && response.data.data) {
        const status = response.data.data;
        
        // 🔥 서버 응답 형식 확인 (completion_status 또는 직접 반환)
        const completionStatus = {
          morning: status.completion_status?.morning || status.morning || false,
          afternoon: status.completion_status?.afternoon || status.afternoon || false,
          evening: status.completion_status?.evening || status.evening || false,
          // 🔥 놓침 상태도 포함
          morningMissed: status.morningMissed || false,
          afternoonMissed: status.afternoonMissed || false,
          eveningMissed: status.eveningMissed || false,
        };
        
        // 🔥 상태 업데이트는 호출하는 쪽에서 배치로 처리
        return completionStatus;
      }
      return { morning: false, afternoon: false, evening: false, morningMissed: false, afternoonMissed: false, eveningMissed: false };
    } catch (error) {
      logger.error('복용 완료 상태 조회 실패', error);
      return { morning: false, afternoon: false, evening: false, morningMissed: false, afternoonMissed: false, eveningMissed: false };
    }
  }, []);

  // 🔥 복용 완료 훅 사용
  const {
    completingDose,
    handleCompleteDose,
    handleCompleteDoseWithTarget,
    handleCompleteDailySchedule,
  } = useDoseCompletion({
    selectedMember,
    dailySchedules,
    loadDailySchedule,
    loadDoseCompletionStatus,
    setDoseCompletionStatus,
    handleSelectMember,
  });

  // 🔥 약물/영양제 액션 훅 사용
  const {
    handleDeleteMedicine,
    handleDeleteSupplement,
  } = useMedicineActions({
    setMedicineList,
    setSupplementList,
    invalidateInteractionCaches,
    checkFamilyDrugInteractions: async (forceRefresh?: boolean) => {
      await checkFamilyDrugInteractions(forceRefresh);
    },
    // 🔥 약물 삭제 시 스케줄 캐시 무효화 함수 전달
    clearScheduleCache: (medicineId: string, userId: string) => {
      const scheduleKey = `${medicineId}_${userId}`;
      clearSchedule(scheduleKey);
      console.log(`[MainHomeScreen] 스케줄 캐시 무효화: ${scheduleKey}`);
    },
  });

  // 🔥 복용 기간 만료 임박 체크 함수
  const checkMedicineExpiry = (medicine: Medicine): { isExpiring: boolean; daysRemaining: number } => {
    if (!medicine.end_date) {
      return { isExpiring: false, daysRemaining: 0 };
    }

    const endDate = new Date(medicine.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 2일 이하 남으면 연장 알림
    return {
      isExpiring: daysRemaining <= 2 && daysRemaining >= 0,
      daysRemaining
    };
  };

  // 🔥 만료 임박 약물 자동 체크 및 연장 모달 표시
  const checkAndShowExpiringMedicines = async () => {
    if (!medicineList || medicineList.length === 0 || !selectedMember) {
      return;
    }

    // 선택된 멤버의 약물 중 만료 임박한 것들 찾기
    const expiringMedicines = medicineList.filter(medicine => {
      // 해당 사용자가 복용 대상인지 확인
      const isTargetUser = !medicine.target_users || 
                          medicine.target_users.length === 0 || 
                          medicine.target_users.includes(selectedMember.user_id);
      
      if (!isTargetUser) return false;

      const { isExpiring } = checkMedicineExpiry(medicine);
      return isExpiring;
    });

    if (expiringMedicines.length > 0) {
      // 첫 번째 만료 임박 약물에 대해 연장 모달 표시
      const firstExpiringMedicine = expiringMedicines[0];
      console.log('🔥 만료 임박 약물 발견:', firstExpiringMedicine.name);
      
      setMedicineToExtend(firstExpiringMedicine);
      setExtensionModalVisible(true);
    }
  };
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 컴포넌트 unmount 시 스케줄 캐시 정리
      clearAllSchedules();
          };
  }, [clearAllSchedules]);

  // 🔥 개별 사용자 약물 상호작용 검사 함수 (기존 함수 유지)
  const checkDrugInteractions = async (medicines: Medicine[]) => {
    try {
      logger.log('개별 사용자 상호작용 검사 시작', { medicineCount: medicines.length });

      if (medicines.length < 2) {
        logger.debug('약물이 2개 미만이므로 상호작용 검사 생략');
        return null;
      }
      
      const result = await DrugInteractionValidator.validateDrugInteractions(medicines);
      logger.debug('개별 검사 결과', {
        hasInteractions: result.hasInteractions,
        interactionsCount: result.interactions?.length || 0
      });
      
      return result;
    } catch (error) {
      logger.error('개별 상호작용 검사 중 오류', error);
      return null;
    }
  };

  // 🔥 약물별 warning 상태 업데이트 함수
  const updateMedicineWarnings = async (medicines: Medicine[], interactionResult: any) => {
    if (!interactionResult) {
      logger.debug('상호작용 결과가 없어서 warning 업데이트 생략');
      return;
    }

    try {
      logger.log('약물별 warning 상태 업데이트 시작');
      
      // 상호작용이 있는 약물들의 이름 수집
      const dangerousMedicineNames = new Set<string>();
      
      if (interactionResult.interactions && Array.isArray(interactionResult.interactions)) {
        interactionResult.interactions.forEach((interaction: any) => {
          // DrugInteraction 객체에서 drugA, drugB 속성 사용
          if (interaction.drugA) {
            dangerousMedicineNames.add(interaction.drugA);
          }
          if (interaction.drugB) {
            dangerousMedicineNames.add(interaction.drugB);
          }
        });
      }
      
      logger.debug('상호작용이 있는 약물명들', { 
        medicineNames: Array.from(dangerousMedicineNames) 
      });
      
      // 약물명을 medi_id로 매핑
      const dangerousMedicineIds = new Set<string>();
      medicines.forEach(medicine => {
        if (dangerousMedicineNames.has(medicine.name)) {
          dangerousMedicineIds.add(medicine.medi_id);
        }
      });
      
      logger.debug('상호작용이 있는 약물 ID들', { 
        medicineIds: Array.from(dangerousMedicineIds) 
      });
      
      // 각 약물의 warning 상태 업데이트
      const updatePromises = medicines.map(async (medicine) => {
        const shouldHaveWarning = dangerousMedicineIds.has(medicine.medi_id);
        const currentWarning = medicine.warning || 0; // number로 처리
        const newWarningValue = shouldHaveWarning ? 1 : 0; // boolean을 number로 변환
        
        if (newWarningValue !== currentWarning) {
          console.log(`🔄 [Warning] ${medicine.name} warning 상태 변경: ${currentWarning} → ${newWarningValue}`);
          
          try {
            await apiClient.put(`/api/medicine/${medicine.medi_id}`, {
              warning: newWarningValue // number 값으로 전송
            });
            
            console.log(`✅ [Warning] ${medicine.name} warning 업데이트 완료`);
          } catch (error) {
            console.error(`🔥 [Warning] ${medicine.name} warning 업데이트 실패:`, error);
          }
        } else {
          console.log(`✅ [Warning] ${medicine.name} warning 상태 동일함 (${currentWarning})`);
        }
      });
      
      await Promise.all(updatePromises);
      console.log('🎯 [Warning] 모든 약물의 warning 상태 업데이트 완료');
      
    } catch (error) {
      console.error('🔥 [Warning] warning 상태 업데이트 중 오류:', error);
    }
  };

  const navigation = useNavigation<MainHomeScreenNavigationProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'Home'>>();

  // 🔥 복용 완료 상태 일괄 조회 함수 추가
  const loadAllDoseCompletionStatus = useCallback(async (userId: string, medicineIds: string[]) => {
    try {
      if (medicineIds.length === 0) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      // 🔥 medi_id 없이 호출하면 모든 약물의 상태를 한 번에 조회
      const response = await apiClient.get(API_ENDPOINTS.DOSE_HISTORY.TODAY_STATUS, {
        params: {
          user_id: userId,
          date: today
          // medi_id를 전달하지 않으면 모든 약물 상태 반환
        }
      });
      
      if (response.data.success && response.data.data) {
        const statusData = response.data.data;
        
        // API 응답이 배열인 경우 (모든 약물 상태)
        if (Array.isArray(statusData)) {
          const newStatus: Record<string, {
            morning: boolean;
            afternoon: boolean;
            evening: boolean;
          }> = {};
          
          statusData.forEach((item: any) => {
            if (item.medi_id) {
              const statusKey = `${item.medi_id}_${userId}`;
              newStatus[statusKey] = {
                morning: item.morning || false,
                afternoon: item.afternoon || false,
                evening: item.evening || false
              };
            }
          });
          
          setDoseCompletionStatus(prev => ({ ...prev, ...newStatus }));
          
          if (__DEV__) {
            console.log(`✅ [DoseStatus] 일괄 조회 완료: ${Object.keys(newStatus).length}개 약물`);
          }
        }
      }
    } catch (error: any) {
      if (__DEV__) {
        logger.error('일괄 조회 에러', error);
      }
      // 에러 발생 시 개별 조회로 폴백하지 않음 (성능 저하 방지)
    }
  }, []);

  // 🔥 약물 목록이 변경될 때마다 스케줄과 복용 완료 상태 로드 (최적화)
  useEffect(() => {
    if (medicineList.length > 0 && selectedMember) {
      if (__DEV__) {
      logger.debug('약물 목록 변경 감지', { medicineCount: medicineList.length });
      }
      
      // 🔥 백그라운드에서 비동기적으로 로드 (UI 블로킹 방지)
      const loadAllMedicineData = async () => {
        try {
          const medicineIds = medicineList.map(m => m.medi_id).filter(Boolean) as string[];
          
          // 🔥 1. 복용 완료 상태 일괄 조회 (1회 API 호출)
          await loadAllDoseCompletionStatus(selectedMember.user_id, medicineIds);
          
          // 🔥 2. 스케줄은 병렬로 조회 (이미 캐싱되어 있으면 즉시 반환)
          await Promise.all(
            medicineList.map(async (medicine: Medicine) => {
              try {
                await loadDailySchedule(medicine.medi_id, selectedMember.user_id);
                if (__DEV__) {
                console.log(`✅ [Effect] ${medicine.name} 스케줄 로드 완료`);
                }
              } catch (error) {
                if (__DEV__) {
                console.error(`❌ [Effect] ${medicine.name} 스케줄 로드 실패:`, error);
                }
              }
            })
          );
          
          if (__DEV__) {
          console.log(`✅ [Effect] 모든 약물 데이터 로드 완료`);
          }
        } catch (error) {
          if (__DEV__) {
          console.error(`❌ [Effect] 전체 약물 데이터 로드 실패:`, error);
          }
        }
      };
      
      loadAllMedicineData();
    }
  }, [medicineList, selectedMember, loadAllDoseCompletionStatus, loadDailySchedule]);

  // 🔥 권한 체크 함수
  // 🔥 getOwnerInfo를 useCallback으로 메모이제이션
  const getOwnerInfo = useCallback((medicine: Medicine) => {
    // 새로운 API에서 직접 가져온 권한 정보 사용
    // 🔥 permission이 없을 때 기본값을 'own'으로 설정하지 않음 (권한 정보가 없으면 undefined 처리)
    const permission = (medicine as any).permission;
    const isOwn = permission === 'own';
    const isManaged = permission === 'manage'; // 보호자가 관리하는 타인 약물
    const ownerInfo = (medicine as any).ownerInfo;
    
    return {
      isOwn,
      isManaged,
      isCommon: ownerInfo?.isCommon || false,
      ownerName: ownerInfo?.ownerName || ''
    };
  }, []);

  // 🔥 복용 완료 상태 조회 함수는 위에서 useCallback으로 정의됨 (중복 제거 완료)


  // 🔥 점진적 로딩: 중요 데이터 먼저 로드, 나머지는 백그라운드
  const loadInitialData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      setUserType(user.role === 'parent' ? 'parent' : 'child');
      
      // 🔥 1단계: 가족 구성원 목록 먼저 로드 (캐시 확인)
      const { CacheManager } = await import('../utils/cache');
      const { CACHE_KEYS, CACHE_DURATION } = await import('../utils/cache');
      
      let cachedMembers = null;
      if (user.group_id) {
        cachedMembers = await CacheManager.get<FamilyMember[]>(CACHE_KEYS.FAMILY_MEMBERS(user.group_id));
      }
      
      if (cachedMembers && cachedMembers.length > 0) {
        // 캐시된 데이터로 즉시 표시
        setFamilyMembers(cachedMembers);
        const savedId = await AsyncStorage.getItem(SELECTED_MEMBER_KEY);
        const savedMember = cachedMembers.find(m => m.user_id === savedId);
        if (savedMember) {
          setSelectedMember(savedMember);
        }
        // 🔥 로딩 상태 업데이트
        setLoadingStates(prev => ({ ...prev, familyMembers: false }));
        setLoading(false); // 🔥 즉시 로딩 완료 표시
      }
      
      // 🔥 2단계: 백그라운드에서 최신 데이터 로드
      const loadLatestData = async () => {
        if (user.role === 'parent') {
          setParentConnect(user.group_id || '');
        } else {
          const parentMember = cachedMembers?.find(m => m.role === 'parent');
          if (parentMember) {
            setParentConnect(parentMember.user_id);
          } else {
            // 부모 정보 조회
            const familyResponse = await getFamilyMembers();
            if (familyResponse.success && familyResponse.data) {
              const parent = familyResponse.data.find(m => m.role === 'parent');
              if (parent) {
                setParentConnect(parent.user_id);
              }
            }
          }
        }
        
        // 최신 가족 구성원 정보 로드
        await loadFamilyMembers();
      };
      
      // 백그라운드에서 실행 (UI 블로킹 없음)
      loadLatestData();
      
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      setError(error instanceof Error ? error.message : '데이터 로드 실패');
      setLoading(false);
    }
  }, []);

  const loadParentConnectID = async () => {
    try {
      logger.log('보호자 계정 정보 로딩 시작');
      const currentUserData = await AsyncStorage.getItem('@user');
      logger.debug('AsyncStorage 사용자 데이터', { hasData: !!currentUserData });
      
      if (!currentUserData) {
        throw new Error('저장된 사용자 정보가 없습니다.');
      }

      const currentUser = JSON.parse(currentUserData);
      logger.debug('파싱된 현재 사용자 정보', {
        user_id: currentUser.user_id,
        name: currentUser.name,
        role: currentUser.role,
        connect: currentUser.connect,
        machine_id: currentUser.machine_id,
        k_uid: currentUser.k_uid
      });

      // 보호자 계정 찾기
      logger.log('가족 구성원 조회 API 호출 시작');
      const parentMemberResponse = await getFamilyMembers();
      logger.debug('보호자 멤버 응답', {
        success: parentMemberResponse?.success,
        hasData: !!parentMemberResponse?.data,
        error: parentMemberResponse?.error
      });

      if (!parentMemberResponse.success || !parentMemberResponse.data) {
        logger.warn('가족 구성원 조회 실패', {
          success: parentMemberResponse?.success,
          data: parentMemberResponse?.data,
          error: parentMemberResponse?.error
        });
        
        // 에러 메시지에 따라 다른 처리
        const errorMessage = parentMemberResponse?.error?.message || '보호자 계정을 찾을 수 없습니다.';
        
        if (errorMessage.includes('연결 정보') || errorMessage.includes('디스펜서')) {
          // 디스펜서 연결이 필요한 경우
          setError(`${errorMessage}\n\n설정 화면에서 디스펜서를 연결해주세요.`);
        } else {
          // 기타 에러
          setError(errorMessage);
        }
        
        return; // 에러 발생 시 더 이상 진행하지 않음
      }

      const familyData = parentMemberResponse.data;
      logger.debug('가족 데이터', {
        type: typeof familyData,
        isArray: Array.isArray(familyData),
        length: Array.isArray(familyData) ? familyData.length : undefined
      });
      
      // 🔥 familyData가 null/undefined인지 확인
      if (!familyData) {
        logger.error('가족 데이터가 null 또는 undefined');
        setError('가족 정보를 불러올 수 없습니다.');
        return;
      }
      
      let parentMember: any = null;
      if (Array.isArray(familyData)) {
        parentMember = familyData.find((member: any) => member && member.role === 'parent');
      } else if (familyData && typeof familyData === 'object' && 'role' in familyData) {
        parentMember = (familyData as any).role === 'parent' ? familyData : null;
      }

      logger.debug('찾은 보호자 멤버', { 
        found: !!parentMember,
        user_id: parentMember?.user_id 
      });
      
      if (!parentMember || !parentMember.user_id) {
        logger.warn('보호자 멤버를 찾을 수 없음', {
          familyDataLength: Array.isArray(familyData) ? familyData.length : 0,
          members: Array.isArray(familyData) ? familyData.map((m: any, i: number) => ({
            index: i,
            user_id: m.user_id,
            name: m.name,
            role: m.role,
            group_id: m.group_id
          })) : []
        });
        throw new Error('보호자 계정을 찾을 수 없습니다.');
      }

      if (parentMember.group_id) {
        setParentConnect(parentMember.group_id);
        setSelectedMember(parentMember);
        
        // 디스펜서 정보 조회하여 maxSlot 설정  
        try {
          logger.log('디스펜서 정보 조회 시작');
          const dispenserResponse = await userApi.getDispenserInfo(parentMember.user_id);
          logger.debug('디스펜서 정보 조회 결과', {
            success: dispenserResponse.success,
            hasData: !!dispenserResponse.data,
            machinesCount: dispenserResponse.data?.machines?.length || 0
          });
          
          if (dispenserResponse.success && dispenserResponse.data) {
            // 서버 응답: { machines: Machine[], group_id: string }
            const { machines } = dispenserResponse.data;
            
            if (machines && machines.length > 0) {
              // 첫 번째 기기의 max_slot 사용
              const maxSlot = machines[0].max_slot || 3;
              const machine_id = machines[0].machine_id;
              
              logger.debug('디스펜서 설정', { maxSlot, machine_id });
              setMaxSlot(maxSlot);
              
              // 🔥 AsyncStorage에 machine_id 저장 (핵심 수정!)
              try {
                const currentUserJson = await AsyncStorage.getItem(USER_KEY);
                if (currentUserJson) {
                  const currentUser = JSON.parse(currentUserJson);
                  // machine_id가 없거나 다르면 업데이트
                  if (!currentUser.machine_id || currentUser.machine_id !== machine_id) {
                    currentUser.machine_id = machine_id;
                    await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
                    logger.log('AsyncStorage 업데이트 완료', { machine_id });
                  } else {
                    logger.debug('machine_id 이미 최신 상태', { machine_id });
                  }
                }
              } catch (storageError) {
                logger.error('AsyncStorage 업데이트 실패', storageError);
              }
            } else {
              logger.warn('등록된 기기가 없음, 기본값 3 사용');
              setMaxSlot(3);
            }
          } else {
            logger.warn('디스펜서 정보 조회 실패, 기본값 3 사용');
            setMaxSlot(3);
          }
        } catch (error) {
          logger.error('디스펜서 정보 조회 중 에러 발생', error);
          setMaxSlot(3); // 에러 시 기본값 3
        }
        
        // 약 목록 조회 추가
        logger.log('약 목록 조회 시작');
        await loadMedicineList();
          
        logger.log('모든 데이터 로딩 완료');
          } else {
        throw new Error('보호자 계정에 그룹 정보가 없습니다.');
          }
        } catch (error) {
      logger.error('보호자 계정 정보 로딩 실패', error);
      setError(error instanceof Error ? error.message : '보호자 계정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const loadFamilyMembers = useCallback(async () => {
    if (!parentConnect) {
      logger.debug('parentConnect가 없습니다.');
      setLoadingStates(prev => ({ ...prev, familyMembers: false }));
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, familyMembers: true }));
      setError(null);
      
      logger.log('가족 구성원 조회 시작', { parentConnect });
      const response = await getFamilyMembers();
      logger.debug('가족 구성원 조회 결과', {
        success: response.success,
        membersCount: response.data?.length || 0,
        error: response.error?.message
      });
      
      if (!response.success || !response.data) {
        logger.warn('가족 구성원 조회 실패', { error: response.error?.message });
        setError(response.error?.message || '가족 구성원 조회 실패');
        setFamilyMembers([]);
        return;
      }

      const members = response.data;
      setFamilyMembers(members);
      
      // 🔥 안전하게 사용자 정보 가져오기
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      logger.debug('현재 사용자', { user_id: user.user_id, name: user.name, role: user.role });
      
      const savedId = await AsyncStorage.getItem(SELECTED_MEMBER_KEY);
      const savedMember = members.find(m => m.user_id === savedId);
      
      if (savedMember) {
        if (user.role === 'child' && savedMember.user_id !== user.user_id) {
          const currentUserMember = members.find(m => m.user_id === user.user_id);
          if (currentUserMember) {
            console.log('자녀 계정 - 저장된 멤버가 본인이 아니므로 본인 계정 선택:', currentUserMember);
            setSelectedMember(currentUserMember);
            await AsyncStorage.setItem(SELECTED_MEMBER_KEY, user.user_id);
          } else {
            console.log('본인 계정을 찾을 수 없음. user_id:', user.user_id);
          }
        } else {
          console.log('저장된 멤버로 설정:', savedMember);
          setSelectedMember(savedMember);
        }
      } else {
        console.log('저장된 멤버가 없음. 기본 선택 진행. user.role:', user.role);
        if (user.role === 'child') {
          // 🔥 자녀 계정일 때는 본인 계정을 찾아서 선택
          const currentUserMember = members.find(m => m.user_id === user.user_id);
          if (currentUserMember) {
            console.log('자녀 계정 - 본인 계정 선택:', currentUserMember);
            setSelectedMember(currentUserMember);
            // 🔥 본인 계정으로 저장
            await AsyncStorage.setItem(SELECTED_MEMBER_KEY, user.user_id);
          } else {
            console.log('본인 계정을 찾을 수 없음. user_id:', user.user_id);
            console.log('가족 구성원 목록:', members.map(m => ({ user_id: m.user_id, name: m.name, role: m.role })));
          }
        } else {
          const parent = members.find(member => member.role === 'parent');
          if (parent) {
            console.log('보호자 계정 - 보호자 멤버 선택:', parent);
            setSelectedMember(parent);
          } else {
            console.log('보호자 멤버를 찾을 수 없음');
          }
        }
      }
    } catch (error) {
      console.error('가족 구성원 로드 실패:', error);
      setError('가족 구성원 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, familyMembers: false }));
    }
  }, [parentConnect]);

  const loadMedicineList = useCallback(async () => {
    try {
      if (!selectedMember?.user_id) {
        console.log('선택된 멤버가 없습니다.');
        return;
      }

      console.log('사용자별 약물 목록 로딩 시작:', selectedMember.user_id);
      
      const { TokenDebugger } = await import('../utils/tokenDebugger');
      await TokenDebugger.monitorTokenRefresh();
      
      // 🔥 캐시 확인 (점진적 로딩)
      const { CacheManager, CACHE_KEYS, CACHE_DURATION } = await import('../utils/cache');
      const cacheKey = CACHE_KEYS.MEDICINE_LIST(selectedMember.user_id);
      const cachedMedicines = await CacheManager.get<Medicine[]>(cacheKey);
      
      if (cachedMedicines && cachedMedicines.length > 0) {
        // 캐시된 데이터로 즉시 표시
        setMedicineList(cachedMedicines);
        setLoadingStates(prev => ({ ...prev, medicines: false, supplements: false }));
        setLoading(false);
        if (__DEV__) {
          console.log(`✅ [Cache] 약물 목록 캐시 히트: ${cachedMedicines.length}개`);
        }
      } else {
        setLoading(true);
      }
      
      const response = await getMedicineList(selectedMember.user_id);
      
      if (response.success && response.data) {
        console.log('=== 사용자별 약물 목록 로드 성공 ===');
        console.log('약물 데이터 (권한 포함):', response.data);
        
        response.data.forEach((medicine, index) => {
          console.log(`약물 ${index + 1}: ${medicine.name}`);
          console.log(`  🆔 medi_id: ${medicine.medi_id}`);
          console.log(`  🎯 medi_id 패턴 분석:`);
          console.log(`    - supplement_ 시작: ${medicine.medi_id?.startsWith('supplement_')}`);
          console.log(`    - medicine_ 시작: ${medicine.medi_id?.startsWith('medicine_')}`);
          console.log(`    - 숫자만: ${/^\d+$/.test(medicine.medi_id || '')}`);
          console.log(`  권한: ${(medicine as any).permission}`);
          console.log(`  슬롯: ${medicine.slot}`);
          console.log(`  총량: ${medicine.totalQuantity}`);
          console.log(`  복용량: ${medicine.doseCount}`);
        });
        
        setMedicineList(response.data);
        setLoadingStates(prev => ({ ...prev, medicines: false }));
        
        // 🔥 캐시 저장
        if (response.data && response.data.length > 0) {
          await CacheManager.set(cacheKey, response.data, CACHE_DURATION.MEDIUM);
          if (__DEV__) {
            console.log(`✅ [Cache] 약물 목록 캐시 저장: ${response.data.length}개`);
          }
        }
        
        console.log('🔍 [DrugInteraction] 현재 선택된 사용자:', selectedMember?.user_id);
        
        const ownMedicines = response.data.filter((medicine: any) => {
          return (medicine as any).permission === 'own';
        });
        
        const managedMedicines = response.data.filter((medicine: any) => {
          return (medicine as any).permission === 'manage';
        });
        
        const otherMedicines = response.data.filter((medicine: any) => {
          return (medicine as any).permission === 'others';
        });
        
        console.log('🔍 [DrugInteraction] 권한 기반 분류:');
        console.log(`  ${selectedMember?.name || '선택된 사용자'}의 약물: ${ownMedicines.length}개`);
        ownMedicines.forEach((med, idx) => {
          console.log(`    ${idx + 1}. ${med.name} (permission: ${(med as any).permission})`);
        });
        console.log(`  관리하는 약물: ${managedMedicines.length}개`);
        managedMedicines.forEach((med, idx) => {
          console.log(`    ${idx + 1}. ${med.name} (permission: ${(med as any).permission})`);
        });
        console.log(`  다른 사용자의 약물: ${otherMedicines.length}개`);
        otherMedicines.forEach((med, idx) => {
          console.log(`    ${idx + 1}. ${med.name} (permission: ${(med as any).permission})`);
        });
        
        // 🔥 개별 사용자 약물 상호작용 검사 (기존 기능 유지)
        console.log('🔍 [DrugInteraction] 개별 사용자 상호작용 검사 시작:', ownMedicines.length, '개 약물');
        const individualInteractionResult = await checkDrugInteractions(ownMedicines);
        
        // 🔥 약물별 warning 상태 업데이트 (개별 검사 결과 기준)
        await updateMedicineWarnings(ownMedicines, individualInteractionResult);
        
        // 🔥 권한 정보가 이미 포함되어 있으므로 별도 스케줄 조회 불필요
        // 기존 스케줄 상태 초기화
        setMedicineSchedules({});
        
        console.log('사용자별 약물 목록 로딩 완료:', response.data.length);
      } else {
        console.error('사용자별 약물 목록 로딩 실패:', response.error);
        setMedicineList([]);
        setLoadingStates(prev => ({ ...prev, medicines: false }));
      }
      
      // 🔥 영양제 목록은 기존 방식 유지 (권한 시스템 미적용)
      try {
        const parentMember = familyMembers.find(member => member.role === 'parent');
        if (parentMember) {
          if (__DEV__) {
          console.log('영양제 목록 조회 시작');
          }
          const supplementResponse = await getSupplementList(parentMember.user_id);
          if (__DEV__) {
          console.log('영양제 목록 조회 결과:', supplementResponse);
          }
          
          if (supplementResponse) {
            if (__DEV__) {
            console.log('🔥 영양제 목록 분석:');
            supplementResponse.forEach((supplement, index) => {
              console.log(`영양제 ${index + 1}: ${supplement.name}`);
              console.log(`  🆔 id: ${supplement.id}`);
              console.log(`  🎯 id 패턴 분석:`);
              console.log(`    - supplement_ 시작: ${supplement.id?.startsWith('supplement_')}`);
              console.log(`    - medicine_ 시작: ${supplement.id?.startsWith('medicine_')}`);
              console.log(`    - 숫자만: ${/^\d+$/.test(supplement.id || '')}`);
              console.log(`  슬롯: ${supplement.dispenserSlot}`);
            });
            }
            setSupplementList(supplementResponse);
            setLoadingStates(prev => ({ ...prev, supplements: false }));
          } else {
            setSupplementList([]);
            setLoadingStates(prev => ({ ...prev, supplements: false }));
          }
        }
      } catch (error) {
        console.error('영양제 목록 조회 중 에러 발생:', error);
        setSupplementList([]);
        setLoadingStates(prev => ({ ...prev, supplements: false }));
      }
    } catch (error) {
      console.error('약물 목록 로딩 중 오류:', error);
      setMedicineList([]);
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, medicines: false, supplements: false }));
    }
  }, [selectedMember?.user_id, familyMembers]);

  useEffect(() => {
    logger.debug('loadParentConnectID 실행');
    // 🔥 에러 처리 추가
    loadParentConnectID().catch((error) => {
      logger.error('보호자 계정 정보 로드 실패', error);
      setError(error instanceof Error ? error.message : '보호자 계정 정보를 불러오는 중 오류가 발생했습니다.');
    });
  }, []);

  useEffect(() => {
    if (parentConnect) {
      if (__DEV__) {
        console.log('[MainHomeScreen] parentConnect 변경:', parentConnect);
      }
      // 🔥 에러 처리 추가
      loadFamilyMembers().catch((error) => {
        logger.error('가족 구성원 로드 실패', error);
        setError(error instanceof Error ? error.message : '가족 구성원을 불러오는 중 오류가 발생했습니다.');
      });
    }
  }, [parentConnect, loadFamilyMembers]); // 🔥 loadFamilyMembers 의존성 추가

  // 🔥 가족 구성원이 로드된 후 가족 전체 약물 상호작용 검사 실행
  useEffect(() => {
    if (familyMembers.length > 0) {
      if (__DEV__) {
        console.log('[FamilyDrugInteraction] 가족 구성원 로드 완료, 상호작용 검사 시작');
      }
      // 약물 목록 로딩 완료 후 즉시 검사 (지연 제거)
      const timer = setTimeout(async () => {
        try {
          await checkFamilyDrugInteractions(true); // 강제 새로고침으로 즉시 검사
        } catch (error) {
          logger.error('가족 약물 상호작용 검사 실패', error);
        }
      }, 300); // 지연 시간 단축 (300ms)
      
      return () => clearTimeout(timer); // 🔥 cleanup 추가
    }
  }, [familyMembers, checkFamilyDrugInteractions]);

  useFocusEffect(
    useCallback(() => {
      if (selectedMember?.user_id) {
        if (__DEV__) {
          console.log('[MainHomeScreen] 화면 포커스 - 약 목록 새로고침:', selectedMember.user_id);
        }
        // 🔥 에러 처리 추가
        loadMedicineList().catch((error) => {
          logger.error('약 목록 로드 실패', error);
        });
      }
    }, [selectedMember?.user_id, loadMedicineList])
  );

  // navigation params를 통한 새로고침 처리
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const unsubscribe = navigation.addListener('focus', () => {
      const state = navigation.getState();
      const route = state.routes[state.index];
      
      // 🔥 타입 안전성 개선: 타입 가드 함수 사용
      const getParams = (): { refresh?: boolean; refreshSchedule?: boolean; medicineId?: string } | undefined => {
        if (!route.params) return undefined;
        const params = route.params as any;
        return {
          refresh: typeof params.refresh === 'boolean' ? params.refresh : undefined,
          refreshSchedule: typeof params.refreshSchedule === 'boolean' ? params.refreshSchedule : undefined,
          medicineId: typeof params.medicineId === 'string' ? params.medicineId : undefined,
        };
      };
      
      const params = getParams();
      
      if (params?.refresh && selectedMember?.user_id) {
        if (__DEV__) {
          console.log('[MainHomeScreen] 새로고침 플래그 감지');
        }
        // 🔥 약물 목록 변경 시 캐시 무효화
        invalidateInteractionCaches();
        // 🔥 에러 처리 추가
        loadMedicineList().catch((error) => {
          logger.error('약 목록 로드 실패', error);
        });
        // 상호작용 검사 재실행 (강제 새로고침)
        // 🔥 cleanup을 위해 timeoutId 저장
        timeoutId = setTimeout(async () => {
          try {
            await checkFamilyDrugInteractions(true);
          } catch (error) {
            logger.error('가족 약물 상호작용 검사 실패', error);
          } finally {
            timeoutId = null;
          }
        }, 500);
        // 새로고침 후 플래그 제거
        navigation.setParams({ refresh: false } as any);
      }
      
      // 🔥 스케줄 수정 후 돌아온 경우 해당 약물의 시간대별 복용량만 새로고침
      // 스케줄 변경은 약물 목록에 영향을 주지 않으므로 상호작용 검사 재실행 불필요
      if (params?.refreshSchedule && params?.medicineId && selectedMember?.user_id) {
        if (__DEV__) {
          console.log('[MainHomeScreen] 스케줄 새로고침 플래그 감지:', params.medicineId);
        }
        loadDailySchedule(params.medicineId, selectedMember.user_id);
        // 플래그 제거
        navigation.setParams({ refreshSchedule: false, medicineId: '' } as any);
      }
    });

    return () => {
      unsubscribe();
      // 🔥 cleanup: 컴포넌트 언마운트 시 timeout 정리
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [navigation, selectedMember?.user_id, loadMedicineList, invalidateInteractionCaches, checkFamilyDrugInteractions]);

  useEffect(() => {
    let isMounted = true;
    
    const loadUserType = async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson && isMounted) {
          const user = JSON.parse(userJson);
          setUserType(user.role);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[MainHomeScreen] 사용자 타입 로드 실패:', error);
        }
      }
    };
    
    loadUserType();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('[MainHomeScreen] selectedMember 변경:', selectedMember?.name);
    }
  }, [selectedMember]);

  // 🔥 handleSelectMember는 위에서 useCallback으로 정의됨 (중복 제거 완료)

  const handlePress = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleRefresh = useCallback(async () => {
    // 🔥 새로고침 시 캐시 무효화
    invalidateInteractionCaches();
    setRefreshing(true);
    try {
      await loadFamilyMembers();
      if (selectedMember?.user_id) {
        await loadMedicineList();
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadFamilyMembers, loadMedicineList, selectedMember?.user_id]);

  // 종료일이 지난 약이 있는지 체크
  const hasExpiredMedicine = useMemo(() => {
    return medicineList.some(med => {
      if (!med.end_date) return false;
      const today = new Date();
      const end = new Date(med.end_date);
      return end < today;
    });
  }, [medicineList]);

  // groupedMedicines와 slotKeys는 MedicineList 컴포넌트로 이동됨

  // AnimatedMedicineCard 컴포넌트 추가
  const AnimatedMedicineCard: React.FC<{ children: React.ReactNode; index: number; onPress: () => void }> = React.memo(({ children, index, onPress }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef<Animated.Value>(new Animated.Value(30)).current;
    
    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          delay: index * 100,
          useNativeDriver: true,
        })
      ]).start();
    }, [fadeAnim, slideAnim, index]);
    
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <TouchableOpacity onPress={onPress} style={styles.medicineBox}>
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // 🔥 약품 리스트가 로드되면 자동으로 스케줄도 로드 (target_users 기반)
  useEffect(() => {
    if (medicineList.length > 0 && selectedMember?.user_id) {
      console.log('🔍 [자동 스케줄 로드] 약품 리스트 변경 감지, 스케줄 로딩 시작');
      
      medicineList.forEach((medicine) => {
        // 🔥 target_users 기반으로 실제 스케줄이 저장된 사용자 결정
        let actualTargetUserId = selectedMember.user_id;
        
        // target_users가 있으면 할당된 사용자의 스케줄 조회
        if (medicine.target_users && medicine.target_users.length > 0) {
          actualTargetUserId = medicine.target_users[0];
          console.log(`🎯 [${medicine.name}] 타인약물 감지 - 실제 스케줄 대상: ${actualTargetUserId}`);
        }
        
        const scheduleKey = `${medicine.medi_id}_${actualTargetUserId}`;
        
        // 이미 로드된 스케줄이 없는 경우에만 로드
        if (!dailySchedules[scheduleKey]) {
          console.log(`🔍 [자동 스케줄 로드] ${medicine.name} 스케줄 로딩 시작 (대상: ${actualTargetUserId})`);
          loadDailySchedule(medicine.medi_id, actualTargetUserId);
        }
      });
    }
  }, [medicineList, selectedMember?.user_id, dailySchedules]);

  // 🔥 영양제 리스트가 로드되면 자동으로 스케줄과 복용 상태도 로드
  useEffect(() => {
    if (supplementList.length > 0 && selectedMember?.user_id) {
      console.log('🔍 [자동 스케줄 로드] 영양제 리스트 변경 감지, 스케줄 로딩 시작');
      
      supplementList.forEach((supplement) => {
        // target_users 기반으로 실제 스케줄이 저장된 사용자 결정
        let actualTargetUserId = selectedMember.user_id;
        
        // target_users가 있으면 할당된 사용자의 스케줄 조회
        if (supplement.target_users && supplement.target_users.length > 0) {
          actualTargetUserId = supplement.target_users[0];
          console.log(`🎯 [영양제 ${supplement.name}] 타인 영양제 감지 - 실제 스케줄 대상: ${actualTargetUserId}`);
        }
        
        const scheduleKey = `${supplement.id}_${actualTargetUserId}`;
        const statusKey = `${supplement.id}_${actualTargetUserId}`;
        
        // 이미 로드된 스케줄이 없는 경우에만 로드
        if (!supplementSchedules[scheduleKey]) {
          console.log(`🔍 [자동 스케줄 로드] ${supplement.name} 스케줄 로딩 시작 (대상: ${actualTargetUserId})`);
          loadSupplementSchedule(supplement.id || '', actualTargetUserId);
        }
        
        // 🔥 복용 완료 상태 조회 (약물과 동일한 방식)
        if (!doseCompletionStatus[statusKey]) {
          setLoadingDoseStatus(prev => new Set(prev).add(statusKey)); // 🔥 로딩 시작
          loadDoseCompletionStatus(supplement.id || '', actualTargetUserId).then(status => {
            setDoseCompletionStatus(prev => {
              const prevStatus = prev[statusKey];
              if (prevStatus && 
                  prevStatus.morning === status.morning &&
                  prevStatus.afternoon === status.afternoon &&
                  prevStatus.evening === status.evening) {
                return prev; // 변경사항 없으면 이전 상태 반환
              }
              return {
                ...prev,
                [statusKey]: status
              };
            });
          }).catch(error => {
            logger.warn('영양제 복용 완료 상태 조회 실패', error);
          }).finally(() => {
            // 🔥 로딩 완료
            setLoadingDoseStatus(prev => {
              const next = new Set(prev);
              next.delete(statusKey);
              return next;
            });
          });
        }
      });
    }
  }, [supplementList, selectedMember?.user_id, supplementSchedules, doseCompletionStatus, loadDoseCompletionStatus]);

  // 통합된 상세정보 함수
  const handleViewItemDetail = async (type: 'medicine' | 'supplement', item: any) => {
    console.log('🔥 handleViewItemDetail 호출됨');
    console.log('🔥 type:', type);
    console.log('🔥 item:', item);
    console.log('🔥 selectedMember:', selectedMember);
    console.log('🔥 selectedMember?.user_id:', selectedMember?.user_id);
    console.log('🔥 userType:', userType);
    
    // 🎯 medi_id 패턴으로 정확한 약/영양제 구분
    // supplement_ 로 시작 → 영양제
    // medicine_ 로 시작 → 의약품
    // 숫자로만 구성 → 외부 API 의약품
    // 기타 → type 파라미터 기준으로 판단
    const isSupplementByMediId = item.medi_id && item.medi_id.startsWith('supplement_');
    const isMedicineByMediId = item.medi_id && (item.medi_id.startsWith('medicine_') || /^\d+$/.test(item.medi_id));
    
    if (__DEV__) {
    console.log('🔍 medi_id 패턴 기반 구분 판단:', {
      medi_id: item.medi_id,
      isSupplementByMediId,
      isMedicineByMediId,
      type: type,
      itemName: item.name,
      finalDecision: type === 'medicine' && !isSupplementByMediId ? 'medicine' : 'supplement'
    });
    }
    
    if (type === 'medicine' && !isSupplementByMediId) {
      const memberIdToUse = selectedMember?.user_id || (familyMembers.length > 0 ? familyMembers[0].user_id : '');
      
      if (__DEV__) {
      console.log('🔥 약 상세정보로 이동 - MedicineDetailScreen');
      console.log('🔥 전달할 파라미터:', {
        medicineId: item.medi_id,
        medicineName: item.name,
        memberId: memberIdToUse,
        isParent: userType === 'parent',
        detail: null
      });
      }
      
      (navigation as any).navigate('MedicineDetail', {
        medicineId: item.medi_id,
        medicineName: item.name,
        memberId: memberIdToUse,
        isParent: userType === 'parent',
        detail: null // 저장된 약이므로 detail은 null
      });
    } else {
      if (__DEV__) {
      console.log('영양제 상세정보로 이동 - SupplementDetailScreen');
      }
      
      // 서버 API에서 저장된 영양제 이름과 매칭되는 제품 찾기
      let matchedSupplement = null;
      try {
        const { findTabletMasterByName } = await import('../api/medicineMaster');
        matchedSupplement = await findTabletMasterByName(item.name);
      } catch (error) {
        if (__DEV__) {
        console.error('영양제 데이터 로드 실패:', error);
        }
      }
      
      // 매칭된 제품 정보가 있으면 실제 정보 사용, 없으면 기본값 사용
      const supplementForDetail = matchedSupplement ? {
        PRDLST_NM: matchedSupplement.name,
        BSSH_NM: matchedSupplement.company_name,
        RAWMTRL_NM: matchedSupplement.raw_materials,
        PRIMARY_FNCLTY: matchedSupplement.primary_function,
        NTK_MTHD: matchedSupplement.intake_method,
        IFTKN_ATNT_MATR_CN: matchedSupplement.precautions,
      } : {
        PRDLST_NM: item.name || '정보 없음',
        BSSH_NM: '제조사 정보 없음',
        RAWMTRL_NM: '성분 정보 없음',
        PRIMARY_FNCLTY: '기능성 정보 없음',
        NTK_MTHD: '제품 설명서에 따라 복용하세요.',
        IFTKN_ATNT_MATR_CN: '복용 전 전문가와 상담하세요.',
      };
      
      if (__DEV__) {
      console.log('매칭된 영양제 정보:', matchedSupplement ? '찾음' : '못찾음');
      }
      
      (navigation as any).navigate('SupplementDetail', {
        supplement: supplementForDetail,
        memberId: selectedMember?.user_id || '',
        isParent: userType === 'parent',
        isStoredSupplement: true,
        storedData: item,
      });
    }
  };

  // 🔥 handleDeleteMedicine과 handleDeleteSupplement는 useMedicineActions 훅에서 제공됨 (중복 제거 완료)

  // 🔥 renderRightActions를 useCallback으로 메모이제이션
  const renderRightActions = useCallback((
    progress: any,
    dragX: any,
    onDelete: () => void
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [-80, -20, 0],
      outputRange: [1, 0.7, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={{ transform: [{ translateX: trans }], opacity }}>
        <TouchableOpacity
          style={{
            backgroundColor: colors.DANGER.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
            width: 80,
            height: '80%',
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            marginTop: 15,
          }}
          onPress={onDelete}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>삭제</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }, []);


  // 🔥 약물명 표시 개선 함수 (useCallback으로 메모이제이션)
  const getMedicineDisplayInfo = useCallback((medicine: Medicine, todaySchedule: any) => {
    const { morning, afternoon, evening, isScheduledDay } = todaySchedule;
    
    let scheduleText = '';
    const timeSlots = [];
    
    if (morning > 0) timeSlots.push(`아침 ${morning}정`);
    if (afternoon > 0) timeSlots.push(`점심 ${afternoon}정`);
    if (evening > 0) timeSlots.push(`저녁 ${evening}정`);
    
    if (timeSlots.length > 0) {
      scheduleText = timeSlots.join(', ');
    } else {
      scheduleText = '오늘은 복용 안함';
    }
    
    return {
      name: medicine.name,
      scheduleText,
      isScheduledDay,
      todayTotal: morning + afternoon + evening
    };
  }, []);

  // renderMedicineItem 함수는 MedicineItem 컴포넌트로 분리됨

  // 🔥 handleMedicineSearch를 useCallback으로 메모이제이션
  const handleMedicineSearch = useCallback(async () => {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;
    
    if (!user) {
      Toast.show({
        type: 'error',
        text1: '사용자 정보를 찾을 수 없습니다.',
        position: 'bottom',
      });
      return;
    }

    if (__DEV__) {
    console.log('약검색 버튼 클릭:', user.role);
    }

    // 보호자 계정인 경우 디스펜서 연동 상태 체크
    if (user.role === 'parent') {
      if (!user.machine_id) {
        // 디스펜서가 등록되지 않은 경우 설정화면으로 이동
        Toast.show({
          type: 'info',
          text1: '디스펜서 등록 필요',
          text2: '약을 등록하기 전에 디스펜서를 먼저 등록해주세요.',
          position: 'bottom',
        });
        (navigation as any).navigate('Settings');
        return;
      }
    }

    // 디스펜서가 등록된 경우 또는 자녀 계정인 경우 검색 화면으로 이동
    try {
      (navigation as any).navigate('MedicineSearch', { searchType: 'medicine' });
    } catch (error) {
      console.error('검색 화면 이동 오류:', error);
      Toast.show({
        type: 'error',
        text1: '화면 이동 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    }
  }, [navigation]);

  const renderMemberItem = ({ item }: { item: FamilyMember }) => (
    <TouchableOpacity
      style={[
        styles.memberItem,
        selectedMember?.user_id === item.user_id && styles.selectedMemberItem
      ]}
      onPress={() => handleSelectMember(item)}
    >
      <Text style={[styles.memberName, { color: themeColors.text }]}>{item.name}</Text>
      <Text style={[styles.memberAge, { color: themeColors.text }]}>나이: {item.age}세</Text>
      <Text style={[styles.memberRole, { color: themeColors.text }]}>
        {item.role === 'parent' ? '보호자 계정' : '자녀 계정'}
      </Text>
    </TouchableOpacity>
  );

  // renderSupplementItem 함수는 SupplementItem 컴포넌트로 분리됨

  const handleNavigateToSchedule = async (medicine: Medicine) => {
    if (selectedMember) {
      console.log('스케줄 편집 화면으로 이동:', {
        medicineId: medicine.medi_id,
        memberId: selectedMember.user_id,
        medicineName: medicine.name
      });
      
      // 🔥 서버 API에서 처방 정보 찾기
      let useMethodQesitm: string | undefined;
      try {
        const { findMedicineMasterByName } = await import('../api/medicineMaster');
        const found = await findMedicineMasterByName(medicine.name);
        if (found) {
          useMethodQesitm = found.intake_method || '';
          console.log('✅ 서버 API에서 처방 정보 찾음:', useMethodQesitm);
        }
      } catch (error) {
        console.log('⚠️ 서버 API에서 처방 정보 조회 실패:', error);
      }
      
      (navigation as any).navigate('MedicineScheduleEdit', {
        medicineId: medicine.medi_id,
        memberId: selectedMember.user_id,
        medicineName: medicine.name,
        useMethodQesitm, // 🔥 처방 정보 전달
      });
    }
  };

  // 🔥 약물 목록이 변경될 때 시간대별 복용량 조회
  useEffect(() => {
    if (!selectedMember?.user_id || medicineList.length === 0) {
      return;
    }

    console.log(`🔍 약물 목록 변경 감지 - 시간대별 복용량 조회 시작`);
    
    // 🔥 자녀 계정을 위한 개선된 권한 필터링
    const accessibleMedicines = medicineList.filter(medicine => {
      // 서버에서 반환된 permission 정보 사용
      const permission = (medicine as any).permission;
      
      console.log(`🔍 [${medicine.name}] 권한 검사:`, {
        permission,
        userType,
        target_users: medicine.target_users,
        selectedUserId: selectedMember.user_id
      });
      
      if (userType === 'parent') {
        // 보호자는 모든 약물에 접근 가능
        return true;
      } else {
        // 자녀는 본인 약물과 공통 약물만 접근 가능
        return permission === 'own' || permission === 'common';
      }
    });

    console.log(`🔍 접근 가능한 약물: ${accessibleMedicines.length}/${medicineList.length}개`);
    accessibleMedicines.forEach(med => {
      console.log(`  - ${med.name} (permission: ${(med as any).permission})`);
    });

    // 각 약물의 시간대별 복용량 조회 (target_users 기반)
    accessibleMedicines.forEach(medicine => {
      // 🔥 target_users 기반으로 실제 스케줄이 저장된 사용자 결정
      let actualTargetUserId = selectedMember.user_id;
      if (medicine.target_users && medicine.target_users.length > 0) {
        actualTargetUserId = medicine.target_users[0];
      }
      
      const scheduleKey = `${medicine.medi_id}_${actualTargetUserId}`;
      
      // 이미 조회된 경우 스킵
      if (!dailySchedules[scheduleKey]) {
        console.log(`🔍 [${medicine.name}] 스케줄 로딩: ${actualTargetUserId}`);
        loadDailySchedule(medicine.medi_id, actualTargetUserId);
        // 🔥 복용 완료 상태 조회 활성화 (target_users 기반, 배치 처리)
        // 🔥 상태 업데이트를 안정적으로 처리하여 깜빡임 방지
        loadDoseCompletionStatus(medicine.medi_id, actualTargetUserId).then(status => {
          const statusKey = `${medicine.medi_id}_${actualTargetUserId}`;
          setDoseCompletionStatus(prev => {
            // 🔥 이전 상태와 비교하여 실제로 변경된 경우만 업데이트
            const prevStatus = prev[statusKey];
            if (prevStatus && 
                prevStatus.morning === status.morning &&
                prevStatus.afternoon === status.afternoon &&
                prevStatus.evening === status.evening) {
              return prev; // 변경사항 없으면 이전 상태 반환 (리렌더링 방지)
            }
            return {
              ...prev,
              [statusKey]: status
            };
          });
        }).catch(error => {
          // 🔥 에러 발생 시 무시 (깜빡임 방지)
          if (__DEV__) {
            logger.warn('복용 완료 상태 조회 실패', error);
          }
        });
      }
    });
  }, [medicineList, selectedMember?.user_id, userType, loadDoseCompletionStatus]);

  // 🔥 대시보드에서 상태 변경 시 메인 화면 업데이트를 위한 함수
  const updateDoseCompletionStatus = useCallback(async (medicineId: string, userId: string, timeOfDay: 'morning' | 'afternoon' | 'evening') => {
    try {
      const statusKey = `${medicineId}_${userId}`;
      // 🔥 해당 약물의 복용 완료 상태를 다시 조회
      const status = await loadDoseCompletionStatus(medicineId, userId);
      
      setDoseCompletionStatus(prev => {
        const prevStatus = prev[statusKey];
        // 🔥 해당 시간대만 업데이트
        const updatedStatus = {
          ...prevStatus,
          ...status,
          [timeOfDay]: status[timeOfDay]
        };
        
        return {
          ...prev,
          [statusKey]: updatedStatus
        };
      });
      
      if (__DEV__) {
        console.log(`✅ [MainHomeScreen] 복용 상태 업데이트: ${medicineId}, ${timeOfDay}, ${status[timeOfDay]}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`❌ [MainHomeScreen] 복용 상태 업데이트 실패:`, error);
      }
    }
  }, [loadDoseCompletionStatus]);

  // 🔥 스케줄 편집 후 돌아왔을 때 새로고침 처리 (debounce 적용)
  const lastRefreshRef = useRef<number>(0);
  const lastRefreshDateRef = useRef<string>('');
  useFocusEffect(
    useCallback(() => {
      // 🔥 24시간 기준 초기화: 날짜가 바뀌었는지 확인
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = lastRefreshDateRef.current !== today;
      
      // 스케줄 편집 후 돌아온 경우 시간대별 복용량 새로고침
      if (selectedMember?.user_id && (medicineList.length > 0 || supplementList.length > 0)) {
        const now = Date.now();
        // 🔥 1초 이내 중복 호출 방지 (깜빡임 방지)
        if (now - lastRefreshRef.current < 1000 && !isNewDay) {
          logger.debug('🔄 [Focus] 중복 호출 방지 (1초 이내)');
          return;
        }
        lastRefreshRef.current = now;
        lastRefreshDateRef.current = today;
        
        logger.debug(`🔄 화면 포커스 - 시간대별 복용량 새로고침 (날짜: ${today}, 새 날짜: ${isNewDay})`);
        
        // 🔥 날짜가 바뀌었으면 복용 완료 상태 초기화 (24시간 기준 초기화)
        if (isNewDay) {
          setDoseCompletionStatus({});
          logger.debug('🔄 날짜 변경 감지 - 복용 완료 상태 초기화');
        }
        
        // 🔥 상태 업데이트를 배치로 처리 (깜빡임 방지)
        const statusUpdates: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> = {};
        
        // 🔥 약물 복용 상태 조회 (오늘 날짜 명시)
        const medicinePromises = medicineList.length > 0 ? (() => {
          // 🔥 권한이 있는 약물들의 시간대별 복용량 및 복용 완료 상태 재조회
          const accessibleMedicines = medicineList.filter(medicine => {
            // 서버에서 반환된 permission 정보 사용
            const permission = (medicine as any).permission;
            
            if (userType === 'parent') {
              // 보호자는 모든 약물에 접근 가능
              return true;
            } else {
              // 자녀는 본인 약물과 공통 약물만 접근 가능
              return permission === 'own' || permission === 'common';
            }
          });

          logger.debug(`🔄 [Focus] 접근 가능한 약물: ${accessibleMedicines.length}/${medicineList.length}개`);

          return accessibleMedicines.map(async (medicine) => {
            // 🔥 target_users 기반으로 실제 스케줄이 저장된 사용자 결정
            let actualTargetUserId = selectedMember.user_id;
            if (medicine.target_users && medicine.target_users.length > 0) {
              actualTargetUserId = medicine.target_users[0];
            }
            
            logger.debug(`🔄 [Focus] ${medicine.name} 스케줄 재로딩: ${actualTargetUserId}`);
            await loadDailySchedule(medicine.medi_id, actualTargetUserId);
            
            // 🔥 복용 완료 상태 조회 (target_users 기반)
            const statusKey = `${medicine.medi_id}_${actualTargetUserId}`;
            setLoadingDoseStatus(prev => new Set(prev).add(statusKey)); // 🔥 로딩 시작
            try {
              const status = await loadDoseCompletionStatus(medicine.medi_id, actualTargetUserId);
              statusUpdates[statusKey] = status;
            } catch (error) {
              logger.warn(`[Focus] ${medicine.name} 복용 상태 조회 실패:`, error);
            } finally {
              // 🔥 로딩 완료
              setLoadingDoseStatus(prev => {
                const next = new Set(prev);
                next.delete(statusKey);
                return next;
              });
            }
          });
        })() : [];

        // 🔥 영양제 복용 상태 조회
        const supplementPromises = supplementList.length > 0 ? supplementList.map(async (supplement) => {
          // 🔥 target_users 기반으로 실제 스케줄이 저장된 사용자 결정
          let actualTargetUserId = selectedMember.user_id;
          if (supplement.target_users && supplement.target_users.length > 0) {
            actualTargetUserId = supplement.target_users[0];
          }
          
          logger.debug(`🔄 [Focus] ${supplement.name} 스케줄 재로딩: ${actualTargetUserId}`);
          await loadSupplementSchedule(supplement.id || '', actualTargetUserId);
          
          // 🔥 복용 완료 상태 조회 (target_users 기반)
          const statusKey = `${supplement.id}_${actualTargetUserId}`;
          setLoadingDoseStatus(prev => new Set(prev).add(statusKey)); // 🔥 로딩 시작
          try {
            const status = await loadDoseCompletionStatus(supplement.id || '', actualTargetUserId);
            statusUpdates[statusKey] = status;
          } catch (error) {
            logger.warn(`[Focus] ${supplement.name} 복용 상태 조회 실패:`, error);
          } finally {
            // 🔥 로딩 완료
            setLoadingDoseStatus(prev => {
              const next = new Set(prev);
              next.delete(statusKey);
              return next;
            });
          }
        }) : [];

        // 🔥 약물과 영양제 모두 병렬 처리
        Promise.all([...medicinePromises, ...supplementPromises]).then(() => {

          setDoseCompletionStatus(prev => {
            // 🔥 날짜가 바뀌었으면 새 상태로 완전히 교체
            if (isNewDay) {
              return statusUpdates;
            }
            
            let hasChanges = false;
            const newStatus: typeof prev = {};
            
            // 기존 상태 복사
            Object.keys(prev).forEach(key => {
              newStatus[key] = prev[key];
            });
            
            // 새 상태와 비교하여 변경된 것만 업데이트
            Object.keys(statusUpdates).forEach(key => {
              const newStatusValue = statusUpdates[key];
              const currentStatusValue = prev[key];
              
              // 상태가 실제로 변경된 경우에만 업데이트
              if (!currentStatusValue || 
                  currentStatusValue.morning !== newStatusValue.morning ||
                  currentStatusValue.afternoon !== newStatusValue.afternoon ||
                  currentStatusValue.evening !== newStatusValue.evening) {
                newStatus[key] = newStatusValue;
                hasChanges = true;
              }
            });
            
            // 변경사항이 없으면 이전 객체 반환 (재렌더링 방지)
            if (!hasChanges) {
              return prev;
            }
            
            return newStatus;
          });
        });
      }
    }, [selectedMember?.user_id, medicineList, supplementList, userType, loadDailySchedule, loadSupplementSchedule, loadDoseCompletionStatus])
  );

  // 🔥 handleCompleteDailySchedule, handleCompleteDoseWithTarget, handleCompleteDose는 useDoseCompletion 훅에서 제공됨 (중복 제거 완료)

  // 🔥 현재 시간 기준으로 시간대 판단 함수 추가
  const getCurrentTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 5 && hour < 11) {
      return 'morning';
    } else if (hour >= 11 && hour < 17) {
      return 'afternoon';
    } else {
      return 'evening';
    }
  };

  // 🔥 시간대별 라벨 변환 함수 추가
  const getTimeOfDayLabel = (timeOfDay: 'morning' | 'afternoon' | 'evening'): string => {
    switch (timeOfDay) {
      case 'morning': return '아침';
      case 'afternoon': return '점심';
      case 'evening': return '저녁';
      default: return '';
    }
  };

  // 🔥 초기 로딩
  useEffect(() => {
    loadParentConnectID();
  }, []);

  // 🔥 약물 목록과 선택된 멤버가 변경될 때 만료 임박 체크
  useEffect(() => {
    if (medicineList.length > 0 && selectedMember) {
      // 500ms 지연 후 체크 (로딩 완료 후)
      const timer = setTimeout(() => {
        checkAndShowExpiringMedicines();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [medicineList, selectedMember]);

  // 🔥 모든 데이터가 로드되었는지 확인 (필수 데이터만 체크)
  const isAllDataLoaded = useMemo(() => {
    // 필수: 가족 구성원, 선택된 멤버
    // 약물 목록은 로드 중이어도 표시 가능 (점진적 로딩)
    // 선택: 영양제, 스케줄, 복용 상태는 로드 중이어도 표시 가능
    const essentialLoaded = !loadingStates.familyMembers && 
                            selectedMember !== null &&
                            !loading;
    
    return essentialLoaded;
  }, [loadingStates, selectedMember, loading]);

  // 🔥 초기 로딩 중이거나 모든 데이터가 로드되지 않았으면 스켈레톤 UI 표시
  if (loading || !isAllDataLoaded) {
    return (
      <SafeAreaView style={[styles.safeAreaView, { backgroundColor: themeColors.background }]} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.text}
              colors={[themeColors.text || (isDark ? colors.WHITE : colors.BLACK)]}
            />
          }
        >
          {/* 헤더 스켈레톤 */}
          <View style={{ padding: 16, marginBottom: 16 }}>
            <SkeletonLoader width={200} height={24} borderRadius={4} />
            <SkeletonLoader width={150} height={16} borderRadius={4} style={{ marginTop: 8 }} />
          </View>

          {/* 약물 목록 스켈레톤 */}
          <View style={styles.medicineContainer}>
            <View style={{ marginBottom: 12 }}>
              <SkeletonLoader width={100} height={20} borderRadius={4} />
            </View>
            {Array.from({ length: 3 }).map((_, idx) => (
              <MedicineCardSkeleton key={idx} isDark={isDark} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !selectedMember) {
    return (
      <SafeAreaView style={[styles.safeAreaView, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>{error || '데이터를 불러올 수 없습니다.'}</Text>
          {error?.includes('로그인') && (
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
              onPress={() => {
                logout();
              }}
            >
              <Text style={[styles.loginButtonText, { color: colors.WHITE }]}>로그인 화면으로 이동</Text>
            </TouchableOpacity>
          )}
          {(error?.includes('연결 정보') || error?.includes('디스펜서')) && (
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.SUCCESS.DEFAULT }]}
              onPress={() => {
                (navigation as any).navigate('Settings');
              }}
            >
              <Text style={[styles.loginButtonText, { color: colors.WHITE }]}>설정 화면으로 이동</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeAreaView, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isDark ? colors.WHITE : colors.BLACK}
            colors={[isDark ? colors.WHITE : colors.BLACK]}
          />
        }
      >
        {/* 복용 기간 만료 배너 */}
        {hasExpiredMedicine && showExpiredBanner && (
          <View style={styles.expiredBanner}>
            <Text style={[styles.expiredBannerText, { color: colors.WHITE }]}>
              복용 기간이 지난 약이 있습니다. 기간을 연장하거나 삭제해 주세요.
            </Text>
            <TouchableOpacity
              onPress={() => setShowExpiredBanner(false)}
              style={styles.expiredBannerCloseButton}
            >
              <Text style={[styles.expiredBannerCloseText, { color: colors.WHITE }]}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🔥 재고 부족 경고 배너 */}
        <StockWarningBanner
          medicines={medicineList}
          familyMembers={familyMembers}
          onRefresh={handleRefresh}
        />

        {/* 🔥 약물 상호작용 경고 */}
        {showInteractionAlert && interactionResult && (
          <DrugInteractionAlert
            validationResult={interactionResult}
            onClose={() => setShowInteractionAlert(false)}
            onConsultPharmacist={() => {
              // 전문가 상담 기능 (추후 구현)
              Alert.alert(
                '전문가 상담',
                '약사 또는 의사와 상담하시기 바랍니다.\n\n• 가까운 약국 방문\n• 병원 예약\n• 온라인 상담 서비스 이용',
                [{ text: '확인' }]
              );
            }}
            onViewDetails={(interaction) => {
              console.log('상호작용 상세 보기:', interaction);
            }}
            isParent={userType === 'parent'}
            onDeleteAllInteractions={async () => {
              try {
                const userJson = await AsyncStorage.getItem('@user');
                if (!userJson) {
                  Toast.show({ type: 'error', text1: '사용자 정보를 찾을 수 없습니다.' });
                  return;
                }
                
                const user = JSON.parse(userJson);
                
                if (!interactionResult) {
                  Toast.show({ type: 'error', text1: '상호작용 정보를 찾을 수 없습니다.' });
                  return;
                }
                
                // 🔥 상호작용이 발생한 모든 약물 추출 (중복 제거)
                const uniqueMedicines = new Map<string, {
                  mediId: string;
                  ownerId: string;
                  name: string;
                }>();
                
                interactionResult.interactions.forEach((interaction: any) => {
                  // drugA 처리 - 모든 mediId와 ownerId 조합 처리
                  const drugAMediIds = interaction.drugAMediIds || (interaction.drugAMediId ? [interaction.drugAMediId] : []);
                  const drugAOwners = interaction.drugAOwners || (interaction.drugAOwner ? [interaction.drugAOwner] : []);
                  
                  drugAMediIds.forEach((mediId: string, idx: number) => {
                    const owner = drugAOwners[idx] || drugAOwners[0];
                    if (mediId && owner?.ownerId) {
                      const key = `${mediId}_${owner.ownerId}`;
                      if (!uniqueMedicines.has(key)) {
                        uniqueMedicines.set(key, {
                          mediId,
                          ownerId: owner.ownerId,
                          name: interaction.drugA
                        });
                      }
                    }
                  });
                  
                  // drugB 처리 - 모든 mediId와 ownerId 조합 처리
                  const drugBMediIds = interaction.drugBMediIds || (interaction.drugBMediId ? [interaction.drugBMediId] : []);
                  const drugBOwners = interaction.drugBOwners || (interaction.drugBOwner ? [interaction.drugBOwner] : []);
                  
                  drugBMediIds.forEach((mediId: string, idx: number) => {
                    const owner = drugBOwners[idx] || drugBOwners[0];
                    if (mediId && owner?.ownerId) {
                      const key = `${mediId}_${owner.ownerId}`;
                      if (!uniqueMedicines.has(key)) {
                        uniqueMedicines.set(key, {
                          mediId,
                          ownerId: owner.ownerId,
                          name: interaction.drugB
                        });
                      }
                    }
                  });
                });
                
                const medicinesToDelete = Array.from(uniqueMedicines.values());
                console.log(`🔥 상호작용 약물 일괄 삭제 시작: ${medicinesToDelete.length}개`);
                
                // 🔥 삭제 전 약물 정보 저장 (캐시 무효화를 위해)
                const medicinesInfoBeforeDelete = medicinesToDelete.map(med => {
                  const fullMedicineInfo = medicineList.find(m => m.medi_id === med.mediId);
                  return {
                    ...med,
                    target_users: fullMedicineInfo?.target_users || []
                  };
                });
                
                // 모든 약물 삭제 실행
                let successCount = 0;
                let failCount = 0;
                
                for (const medicine of medicinesToDelete) {
                  try {
                    const success = await deleteMedicine(medicine.ownerId, medicine.mediId);
                    if (success) {
                      successCount++;
                    } else {
                      failCount++;
                    }
                  } catch (error) {
                    console.error(`약물 삭제 실패: ${medicine.name}`, error);
                    failCount++;
                  }
                }
                
                if (successCount > 0) {
                  Toast.show({
                    type: 'success',
                    text1: '약물 삭제 완료',
                    text2: `${successCount}개 약물이 삭제되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`,
                  });
                  
                  // 🔥 상호작용 캐시 무효화
                  invalidateInteractionCaches();
                  
                  // 🔥 삭제된 모든 약물의 스케줄 캐시 무효화
                  const { CacheManager } = await import('../utils/cache');
                  
                  medicinesInfoBeforeDelete.forEach(medicine => {
                    // 🔥 메모리 상태 캐시 삭제
                    if (medicine.target_users && medicine.target_users.length > 0) {
                      // target_users가 있는 경우 모든 사용자의 스케줄 캐시 무효화
                      medicine.target_users.forEach(userId => {
                        const scheduleKey = `${medicine.mediId}_${userId}`;
                        clearSchedule(scheduleKey);
                        console.log(`[MainHomeScreen] 스케줄 캐시 무효화: ${scheduleKey}`);
                      });
                    } else {
                      // target_users가 없으면 소유자의 스케줄 캐시만 무효화
                      const scheduleKey = `${medicine.mediId}_${medicine.ownerId}`;
                      clearSchedule(scheduleKey);
                      console.log(`[MainHomeScreen] 스케줄 캐시 무효화: ${scheduleKey}`);
                    }
                    
                    // 🔥 안전장치: 모든 가족 구성원의 스케줄 캐시도 무효화
                    familyMembers.forEach(member => {
                      const scheduleKey = `${medicine.mediId}_${member.user_id}`;
                      clearSchedule(scheduleKey);
                    });
                    
                    // 🔥 CacheManager의 AsyncStorage 캐시도 삭제
                    CacheManager.removePattern(medicine.mediId);
                    console.log(`[MainHomeScreen] CacheManager 캐시 삭제: ${medicine.mediId}`);
                  });
                  
                  // 🔥 모든 스케줄 캐시 초기화 (안전장치)
                  clearAllSchedules();
                  
                  // 🔥 CacheManager의 모든 스케줄 관련 캐시 삭제 (안전장치)
                  await CacheManager.removePattern('schedule');
                  await CacheManager.removePattern('medicine');
                  
                  // 약물 목록 새로고침
                  await loadMedicineList();
                  
                  // 상호작용 검사 재실행 (강제 새로고침)
                  setTimeout(async () => {
                    try {
                      await checkFamilyDrugInteractions(true);
                    } catch (error) {
                      logger.error('가족 약물 상호작용 검사 실패', error);
                    }
                  }, 1000);
                } else {
                  Toast.show({
                    type: 'error',
                    text1: '삭제 실패',
                    text2: '모든 약물 삭제에 실패했습니다.',
                  });
                }
              } catch (error) {
                console.error('약물 일괄 삭제 실패:', error);
                Toast.show({
                  type: 'error',
                  text1: '삭제 실패',
                  text2: '약물 삭제 중 오류가 발생했습니다.',
                });
              }
            }}
          />
        )}

        {/* 오늘 날짜 */}
        <DateHeader isDark={isDark} themeColors={themeColors} />

        {/* 사용자 선택 헤더 */}
        <SectionHeader
          icon={userType === 'parent' ? 'users' : 'user'}
          title={userType === 'parent' ? '가족 구성원 선택' : '내 계정'}
          isDark={isDark}
          themeColors={themeColors}
        />

        {/* 가족 구성원 선택 컴포넌트 */}
        <MemberSelector
          userType={userType}
          selectedMember={selectedMember}
          familyMembers={familyMembers}
          isExpanded={isExpanded}
          isDark={isDark}
          themeColors={themeColors}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onSelectMember={handleSelectMember}
        />

        {/* 약 리스트 */}
        <View style={styles.medicineContainer}>
          {/* 약물 목록 헤더 컴포넌트 */}
          <MedicineHeader
            userType={userType}
            isDark={isDark}
            themeColors={themeColors}
            onSearchPress={handleMedicineSearch}
            onSchedulePress={() => setTodayScheduleModalVisible(true)}
          />

          <MedicineList
            medicines={medicineList}
            loading={loading}
            maxSlot={maxSlot}
            selectedMember={selectedMember}
            userType={userType}
            familyMembers={familyMembers}
            dailySchedules={dailySchedules}
            doseCompletionStatus={doseCompletionStatus}
            loadingDoseStatus={loadingDoseStatus}
            themeColors={themeColors}
            isDark={isDark}
            onViewDetail={(med) => handleViewItemDetail('medicine', med)}
            onNavigateToSchedule={handleNavigateToSchedule}
            onDelete={handleDeleteMedicine}
            onCompleteDose={handleCompleteDose}
            renderRightActions={renderRightActions}
            getOwnerInfo={getOwnerInfo}
            getMedicineDisplayInfo={getMedicineDisplayInfo}
          />
        </View>
        {/* 영양제 섹션 - 별도로 표시 */}
        {supplementList.length > 0 && (
          <View style={styles.supplementSection}>
            <Text style={[styles.supplementSectionTitle, { color: colors.SUCCESS.DEFAULT }]}>영양제</Text>
            {supplementList.map((supplement, idx) => {
              // 🔥 로딩 상태 확인 (target_users 기반)
              let actualTargetUserId = selectedMember?.user_id || '';
              if (supplement.target_users && supplement.target_users.length > 0) {
                actualTargetUserId = supplement.target_users[0];
              }
              const statusKey = `${supplement.id}_${actualTargetUserId}`;
              const isLoadingDoseStatus = loadingDoseStatus.has(statusKey);
              
              return (
                <SupplementItem
                  key={`supplement-${supplement.id}-${idx}`}
                  supplement={supplement}
                  selectedMember={selectedMember}
                  userType={userType}
                  supplementSchedules={supplementSchedules}
                  doseCompletionStatus={doseCompletionStatus}
                  isLoadingDoseStatus={isLoadingDoseStatus}
                  isDark={isDark}
                  themeColors={themeColors}
                  onViewDetail={(supp) => handleViewItemDetail('supplement', supp)}
                  onDelete={handleDeleteSupplement}
                  onScheduleEdit={(supplement) => {
                    (navigation as any).navigate('SupplementScheduleEdit', {
                      supplementId: supplement.id || supplement.name,
                      memberId: selectedMember?.user_id || '',
                      supplementName: supplement.name,
                      slot: supplement.dispenserSlot,
                    });
                  }}
                  renderRightActions={renderRightActions}
                  getTodayScheduleForSupplement={getTodayScheduleForSupplement}
                  getMedicineDisplayInfo={getMedicineDisplayInfo}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 🔥 오늘의 스케줄 표시 모달 */}
      <TodayScheduleDisplayModal
        visible={todayScheduleModalVisible}
        onClose={() => setTodayScheduleModalVisible(false)}
        medicineList={medicineList}
        selectedMember={selectedMember}
        dailySchedules={dailySchedules}
        userType={userType}
        familyMembers={familyMembers} supplementList={[]}      />

      {/* 🔥 약물 연장 모달 */}
      <MedicineExtensionModal
        visible={extensionModalVisible}
        onClose={() => {
          setExtensionModalVisible(false);
          setMedicineToExtend(null);
        }}
        medicine={medicineToExtend}
        selectedMember={selectedMember}
        onExtensionComplete={async () => {
          setExtensionModalVisible(false);
          setMedicineToExtend(null);
          // 🔥 에러 처리 추가
          try {
            await loadMedicineList();
          } catch (error) {
            logger.error('약 목록 로드 실패', error);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    textAlign: 'center',
  },
  Text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  accountBox: {
    borderWidth: 2,
    borderColor: colors.PRIMARY.DEFAULT, 
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: 10,
  },
  selectedBox: {
    marginTop: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  userInfoContainer: {
    flex: 1,
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  icon: {
    transform: [{ rotate: '0deg' }],
  },
  iconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  memberBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingLeft: 10,
  },
  memberBox: {
    flex: 1,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    textAlign : 'center',
  },
  memberAge: {
    fontSize: 15,
    textAlign: 'left',
    marginRight: 10,
  },
  headerText: {
    fontSize: 30,
    marginTop: Platform.OS === 'ios' ? 20 : 60,
    marginBottom: 5,
    fontWeight: 'bold',
    textAlign: 'left',
    marginLeft: 10,
  },
  medicineContainer: {
    marginTop: 24,
  },
  medicineBox: {
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 10,
    padding: 10,
    marginTop: 1,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  medicineListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  medicineHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  medicineActionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  medicineHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  medicineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineHeaderText: {
    flex: 1,
  },
  medicineListTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  medicineListSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.8,
  },
  medicineName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  medicineDosage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  medicineDate: {
    fontSize: 15,
    marginTop: 5,
    fontWeight: '600',
  },
  noMedicineText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  noMedicineSubText: {
    fontSize: 12,
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100, // 하단 여백을 늘려서 사용자 선택 리스트가 잘리지 않도록 함
  },
  uuidText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  medicineSchedule: {
    fontSize: 14,
    marginBottom: 5,
  },
  medicineInfo: {
    flex: 1,
    padding: 15,
  },
  medicineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  medicineDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  expiredBanner: {
    backgroundColor: colors.DANGER.DEFAULT,
    padding: 12,
    borderRadius: 8,
    margin: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 24,
  },
  expiredBannerText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  expiredBannerCloseButton: {
    marginLeft: 12,
    padding: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredBannerCloseText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  slotTitle: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 10,
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
  userType: {
    fontSize: 16,
    color: colors.PRIMARY.DEFAULT,
    marginTop: 4,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: colors.WHITE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: Platform.OS === 'ios' ? 10 : 10,
    marginTop: Platform.OS === 'ios' ? 10 : 50,
    borderWidth: 2,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modernAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modernAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.WHITE,
  },
  simpleMedicineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    padding: 16,
    marginVertical: 8,
  },
  simpleMedicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  simpleMedicineInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  simpleSlotText: {
    fontSize: 14,
    color: colors.PRIMARY.DEFAULT,
    marginBottom: 2,
  },
  simpleRemainText: {
    fontSize: 14,
    color: colors.DANGER.DEFAULT,
    marginBottom: 2,
  },
  simplePeriodText: {
    fontSize: 12,
    color: '#888',
  },
  scheduleTable: {
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleHeaderCell: {
    width: 28,
    textAlign: 'center',
  },
  scheduleHeaderCellCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleHeaderText: {
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  scheduleDayCell: {
    width: 28,
    fontSize: 13,
    textAlign: 'center',
    color: colors.PRIMARY.DEFAULT,
    fontWeight: 'bold',
  },
  scheduleCell: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9ecef',
    marginHorizontal: 1,
  },
  scheduleCellChecked: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  memberItem: {
    padding: 10,
  },
  selectedMemberItem: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  memberRole: {
    fontSize: 14,
    color: colors.GRAY.DEFAULT,
  },
  ageText: {
    fontSize: 14,
    color: colors.GRAY.DEFAULT,
  },
  modernAccountBox: {
    borderWidth: 2,
    borderColor: colors.PRIMARY.DEFAULT, 
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: 10,
  },
  modernHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  userInfoSection: {
    flex: 1,
    gap: 8,
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTextContainer: {
    flex: 1,
    gap: 8,
  },
  modernUserName: {
    fontSize: 16,
    fontWeight: '600',
  },
  modernUserAge: {
    fontSize: 15,
    textAlign: 'left',
    marginRight: 10,
  },

  cleanAccountBox: {
    borderWidth: 2,
    borderColor: colors.PRIMARY.DEFAULT, 
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: 10,
  },
  cleanHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  cleanUserSection: {
    flex: 1,
    gap: 8,
  },
  cleanAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cleanAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cleanUserInfo: {
    flex: 1,
    gap: 8,
  },
  cleanUserName: {
    fontSize: 16,
    fontWeight: '600',
  },
  cleanUserSubtitle: {
    fontSize: 15,
    textAlign: 'left',
    marginRight: 10,
  },

  firstMemberItem: {
    borderTopWidth: 0,
  },
  iosStyleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  iosStyleTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  dateMainText: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  dateSubText: {
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.7,
  },
  dateText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    opacity: 0.9,
  },
  iosStyleMembersList: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iosStyleMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    minHeight: 68,
  },
  iosStyleMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  iosStyleMemberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },

  loginButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.WHITE,
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
  warningContainer: {
    display: 'none',
    padding: 10,
    borderWidth: 2,
    borderRadius: 8,
    marginVertical: 10,
    paddingHorizontal: 15,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 5,
  },
  warningItem: {
    fontSize: 14,
    marginBottom: 3,
  },
  statusBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomMessage: {
    padding: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  bottomMessageText: {
    fontSize: 12,
    color: '#fff',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  supplementSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  supplementSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyGuideContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyGuideText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyGuideStep: {
    fontSize: 13,
    marginBottom: 4,
    paddingLeft: 8,
  },
  userSelectionCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.WHITE,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 14,
    color: colors.GRAY.DEFAULT,
    
  },
  expandIndicator: {
    marginLeft: 8,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandIcon: {
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  memberListContainer: {
    marginTop: 10,
    gap: 10,
  },
  memberCard: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  memberCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.WHITE,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberSubtitle: {
    fontSize: 14,
    color: colors.GRAY.DEFAULT,
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.PRIMARY.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 🔥 복용 완료 버튼 관련 스타일들
  doseCompletionSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.PRIMARY.DEFAULT,
  },
  doseButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  doseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.SUCCESS.DEFAULT,  // 🔥 복용 시간 배출 버튼을 녹색으로 강조
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,  // 🔥 적절한 크기로 조정
    justifyContent: 'center',
    gap: 4,
    shadowColor: colors.SUCCESS.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  doseButtonLoading: {
    opacity: 0.6,
  },
  doseButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // 🔥 약물 카드 스타일
  medicineCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // 🔥 스케줄 없음 안내 스타일
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

  // 🔥 복용 완료 메시지 스타일
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
  groupNameText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },


  allButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dispenseButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 6,
    marginTop: 8,
  },
  dispenseButton: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: 70,
    height: 60,
  },
  dispenseButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  todayScheduleButton: {
    backgroundColor: '#007AFF',
  },
  emergencyDispenseButton: {
    backgroundColor: '#DC3545',
  },
  searchButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  searchOnlyButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: 70,
    height: 60,
  },
  searchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  searchButtonSubText: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 1,
  },
});

export default MainHomeScreen;