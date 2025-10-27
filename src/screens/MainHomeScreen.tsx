import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, BottomTabParamList } from '../types/navigation';
import { getFamilyMembers, getMedicineList, getMedicineSchedule, type FamilyMember, deleteMedicine, getSupplementList, deleteSupplement as deleteSupplementAPI } from '../api/family';
import { type Medicine, type MedicineSchedule, type User, NutritionalSupplement } from '../types/tdb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { Swipeable } from 'react-native-gesture-handler';
import { getCurrentUser } from '../api/userStorage';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../api/users';

import { scheduleApi } from '../api/schedule'; 
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api';
import { StockWarningBanner } from '../components/StockWarningBanner';
import { DrugInteractionValidator, type InteractionValidationResult } from '../utils/drugInteractionValidator';
import DrugInteractionAlert from '../components/common/DrugInteractionAlert';
import { formatDateForDisplay } from '../utils/dateUtils';
import { getMedicineRemainByMachine } from '../api/machine';
import { scheduleDispense } from '../api/dispenser';
import TodayScheduleDisplayModal from '../components/TodayScheduleDisplayModal';
import MedicineExtensionModal from '../components/MedicineExtensionModal';

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
  const [dailySchedules, setDailySchedules] = useState<Record<string, { morning: number; afternoon: number; evening: number; total: number; weeklySchedule: Record<string, any> | null }>>({}); // 🔥 시간대별 복용량 state 추가
  const [userType, setUserType] = useState<'parent' | 'child' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpiredBanner, setShowExpiredBanner] = useState(true);
  const [medicineSchedules, setMedicineSchedules] = useState<Record<string, MedicineSchedule | null>>({});
  const [completingDose, setCompletingDose] = useState<Record<string, boolean>>({});
  // 🔥 복용 완료 상태 관리 state 추가
  const [doseCompletionStatus, setDoseCompletionStatus] = useState<Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>>({});
  
  // 🔥 약물 상호작용 검사 결과 state 추가
  const [interactionResult, setInteractionResult] = useState<InteractionValidationResult | null>(null);
  const [showInteractionAlert, setShowInteractionAlert] = useState(false);
  
  // 🔥 배출 모달 상태 관리
  const [todayScheduleModalVisible, setTodayScheduleModalVisible] = useState(false);
  
  // 🔥 연장 시스템 상태 관리
  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [medicineToExtend, setMedicineToExtend] = useState<Medicine | null>(null);

  const { logout } = useAuth();

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

  // 🔥 조회 중인 스케줄을 추적하는 ref 추가
  const loadingSchedules = useRef<Set<string>>(new Set());
  
  // 🔥 가족 전체 약물 상호작용 검사 함수
  const checkFamilyDrugInteractions = async () => {
    try {
      console.log('🔍 [FamilyDrugInteraction] 가족 전체 약물 상호작용 검사 시작');
      
      // 1. 모든 가족 구성원의 약물 수집
      const allFamilyMedicines: Medicine[] = [];
      
      for (const member of familyMembers) {
        try {
          console.log(`🔍 [FamilyDrugInteraction] ${member.name}(${member.role})의 약물 조회 중...`);
          const response = await getMedicineList(member.user_id);
          
          if (response.success && response.data) {
            // 각 약물에 소유자 정보 추가
            const memberMedicines = response.data.map(medicine => ({
              ...medicine,
              ownerName: member.name,
              ownerRole: member.role,
              ownerId: member.user_id
            }));
            
            allFamilyMedicines.push(...memberMedicines);
            console.log(`✅ [FamilyDrugInteraction] ${member.name}: ${memberMedicines.length}개 약물 수집`);
          }
        } catch (error) {
          console.error(`🔥 [FamilyDrugInteraction] ${member.name} 약물 조회 실패:`, error);
        }
      }
      
      console.log(`🔍 [FamilyDrugInteraction] 가족 전체 약물 수: ${allFamilyMedicines.length}개`);
      
      if (allFamilyMedicines.length < 2) {
        console.log('🔍 [FamilyDrugInteraction] 가족 전체 약물이 2개 미만이므로 상호작용 검사 생략');
        setInteractionResult(null);
        setShowInteractionAlert(false);
        return null;
      }
      
      // 2. 상호작용 검사 실행
      const result = await DrugInteractionValidator.validateDrugInteractions(allFamilyMedicines);
      
      // 3. 상호작용이 있는 경우 소유자 정보 포함하여 결과 처리
      if (result.hasInteractions) {
        console.log('⚠️ [FamilyDrugInteraction] 가족 간 약물 상호작용 발견!');
        
        // 상호작용 결과에 소유자 정보 추가
        const enhancedInteractions = result.interactions.map(interaction => {
          const drugAMedicine = allFamilyMedicines.find(med => med.name === interaction.drugA);
          const drugBMedicine = allFamilyMedicines.find(med => med.name === interaction.drugB);
          
          return {
            ...interaction,
            drugAOwner: drugAMedicine ? { name: (drugAMedicine as any).ownerName, role: (drugAMedicine as any).ownerRole } : null,
            drugBOwner: drugBMedicine ? { name: (drugBMedicine as any).ownerName, role: (drugBMedicine as any).ownerRole } : null
          };
        });
        
        const enhancedResult = {
          ...result,
          interactions: enhancedInteractions
        };
        
        setInteractionResult(enhancedResult);
        setShowInteractionAlert(true);
        
        // 심각한 상호작용이 있는 경우 강제 알림
        if (result.criticalCount > 0) {
          Toast.show({
            type: 'error',
            text1: '⚠️ 가족 간 심각한 약물 상호작용 발견',
            text2: '즉시 의사와 상담하세요.',
            position: 'top',
            visibilityTime: 6000,
          });
        } else if (result.warningCount > 0) {
          Toast.show({
            type: 'warning',
            text1: '⚠️ 가족 간 약물 상호작용 주의',
            text2: '복용 전 약사와 상담하세요.',
            position: 'top',
            visibilityTime: 5000,
          });
        }
        
        return enhancedResult;
      } else {
        console.log('✅ [FamilyDrugInteraction] 가족 간 상호작용 없음');
        setInteractionResult(null);
        setShowInteractionAlert(false);
        return null;
      }
      
    } catch (error) {
      console.error('🔥 [FamilyDrugInteraction] 가족 약물 상호작용 검사 중 오류:', error);
      return null;
    }
  };

  // 🔥 개별 사용자 약물 상호작용 검사 함수 (기존 함수 유지)
  const checkDrugInteractions = async (medicines: Medicine[]) => {
    try {
      console.log('🔍 [DrugInteraction] 개별 사용자 상호작용 검사 시작:', medicines.length, '개 약물');
      
      if (medicines.length < 2) {
        console.log('🔍 [DrugInteraction] 약물이 2개 미만이므로 상호작용 검사 생략');
        return null;
      }
      
      const result = await DrugInteractionValidator.validateDrugInteractions(medicines);
      console.log(`🔍 [DrugInteraction] 개별 검사 결과:`, result.hasInteractions ? `${result.interactions.length}건 발견` : '상호작용 없음');
      
      return result;
    } catch (error) {
      console.error('🔥 [DrugInteraction] 개별 상호작용 검사 중 오류:', error);
      return null;
    }
  };

  // 🔥 약물별 warning 상태 업데이트 함수
  const updateMedicineWarnings = async (medicines: Medicine[], interactionResult: any) => {
    if (!interactionResult) {
      console.log('🔍 [Warning] 상호작용 결과가 없어서 warning 업데이트 생략');
      return;
    }

    try {
      console.log('🔍 [Warning] 약물별 warning 상태 업데이트 시작');
      
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
      
      console.log('🔍 [Warning] 상호작용이 있는 약물명들:', Array.from(dangerousMedicineNames));
      
      // 약물명을 medi_id로 매핑
      const dangerousMedicineIds = new Set<string>();
      medicines.forEach(medicine => {
        if (dangerousMedicineNames.has(medicine.name)) {
          dangerousMedicineIds.add(medicine.medi_id);
        }
      });
      
      console.log('🔍 [Warning] 상호작용이 있는 약물 ID들:', Array.from(dangerousMedicineIds));
      
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

  // 🔥 약물 목록이 변경될 때마다 스케줄과 복용 완료 상태 로드
  useEffect(() => {
    if (medicineList.length > 0 && selectedMember) {
      console.log(`🔄 [Effect] 약물 목록 변경 감지 (${medicineList.length}개) - 스케줄 및 복용 상태 로드`);
      
      // 🔥 백그라운드에서 비동기적으로 로드 (UI 블로킹 방지)
      const loadAllMedicineData = async () => {
        try {
          await Promise.all(
            medicineList.map(async (medicine: Medicine) => {
              try {
                // 스케줄과 복용 완료 상태를 병렬로 로드
                await Promise.all([
                  loadDailySchedule(medicine.medi_id, selectedMember.user_id),
                  loadDoseCompletionStatus(medicine.medi_id, selectedMember.user_id)
                ]);
                console.log(`✅ [Effect] ${medicine.name} 데이터 로드 완료`);
              } catch (error) {
                console.error(`❌ [Effect] ${medicine.name} 데이터 로드 실패:`, error);
              }
            })
          );
          console.log(`✅ [Effect] 모든 약물 데이터 로드 완료`);
        } catch (error) {
          console.error(`❌ [Effect] 전체 약물 데이터 로드 실패:`, error);
        }
      };
      
      loadAllMedicineData();
    }
  }, [medicineList, selectedMember]);

  // 🔥 권한 체크 함수
  const getOwnerInfo = (medicine: Medicine) => {
    // 새로운 API에서 직접 가져온 권한 정보 사용
    const permission = (medicine as any).permission || 'own';
    const isOwn = permission === 'own';
    const isManaged = permission === 'manage'; // 부모가 관리하는 타인 약물
    const ownerInfo = (medicine as any).ownerInfo;
    
    return {
      isOwn,
      isManaged,
      isCommon: ownerInfo?.isCommon || false,
      ownerName: ownerInfo?.ownerName || ''
    };
  };

  // 🔥 복용 완료 상태 조회 함수 추가
  const loadDoseCompletionStatus = async (medicineId: string, userId: string) => {
    try {
      console.log(`🔍 [DoseStatus] 복용 완료 상태 조회: ${medicineId}, ${userId}`);
      
      // 오늘 날짜 형식으로 변환
      const today = new Date().toISOString().split('T')[0];
      
      // ⚠️ 임시: 복용 완료 상태 조회 API가 구현되지 않았으므로 기본값 반환
      // 추후 백엔드에서 해당 API가 구현되면 실제 조회로 변경 예정
      
      // 🔥 새로 구현된 today-status API 사용
      const response = await apiClient.get(API_ENDPOINTS.DOSE_HISTORY.TODAY_STATUS, {
        params: {
          user_id: userId,
          medi_id: medicineId,
          date: today
        }
      });
      
      if (response.data.success && response.data.data) {  
        const statusData = response.data.data;
        const statusKey = `${medicineId}_${userId}`;
        
        // API 응답 구조에 따라 처리
        let status = {
          morning: false,
          afternoon: false,
          evening: false
        };
        
        if (statusData.completion_status) {
          // 단일 약물 응답
          status = statusData.completion_status;
        } else if (Array.isArray(statusData)) {
          // 여러 약물 응답에서 해당 약물 찾기
          const medicineStatus = statusData.find((item: any) => item.medi_id === medicineId);
          if (medicineStatus) {
            status = {
              morning: medicineStatus.morning || false,
              afternoon: medicineStatus.afternoon || false,
              evening: medicineStatus.evening || false
            };
          }
        }
        
        console.log(`✅ [DoseStatus] ${medicineId} 복용 완료 상태:`, status);
        
        // 상태 업데이트
        setDoseCompletionStatus(prev => ({
          ...prev,
          [statusKey]: status
        }));
        
        return status;
      } else {
        console.log(`⚠️ [DoseStatus] 복용 기록 없음: ${medicineId}`);
        return { morning: false, afternoon: false, evening: false };
      }
    } catch (error: any) {
      console.error(`🔥 [DoseStatus] 복용 완료 상태 조회 에러:`, error);
      // 🔥 404 에러인 경우 해당 API가 구현되지 않았거나 기록이 없음을 의미
      if (error?.response?.status === 404) {
        console.log(`⚠️ [DoseStatus] 복용 기록이 없거나 API가 구현되지 않음. 기본값 사용.`);
      } else {
        console.log(`⚠️ [DoseStatus] 네트워크 오류 또는 기타 문제. 기본값 사용.`);
      }
      return { morning: false, afternoon: false, evening: false };
    }
  };

  // 🔥 시간대별 복용량 조회 함수 - 개선된 버전
  const loadDailySchedule = async (medicineId: string, userId: string) => {
    const scheduleKey = `${medicineId}_${userId}`;
    
    // 이미 조회 중이거나 완료된 경우 중복 호출 방지
    if (loadingSchedules.current.has(scheduleKey) || dailySchedules[scheduleKey]) {
      return;
    }
    
    // 조회 중임을 표시
    loadingSchedules.current.add(scheduleKey);
    
    try {
      console.log(`🔍 [성능개선] 시간대별 복용량 조회: medicineId=${medicineId}, userId=${userId}`);
      
      // 🔥 현재 선택된 사용자와 조회하려는 사용자가 일치하는지 확인
      if (userId !== selectedMember?.user_id) {
        console.log(`⚠️ 사용자 불일치 감지 - 요청 취소: 요청=${userId}, 선택됨=${selectedMember?.user_id}`);
        loadingSchedules.current.delete(scheduleKey);
          return;
        }

      // 🔥 integrated-server와 호환되는 스케줄 조회 API 사용
      const scheduleResult: any = await getMedicineSchedule(medicineId, userId);
      
      if (scheduleResult && typeof scheduleResult === 'object') {
        console.log(`🔍 [성능개선] 스케줄 조회 성공:`, scheduleResult);
        
        // 🔥 서버에서 반환하는 시간대별 복용량 사용
        let morningDose = 0, afternoonDose = 0, eveningDose = 0;
        let weeklySchedule: Record<string, {
          morning: boolean;
          afternoon: boolean;
          evening: boolean;
          morningDose: number;
          afternoonDose: number;
          eveningDose: number;
        }> | null = null;
        
        // 🔥 1. 서버가 시간대별 복용량을 제공하는 경우 우선 사용
        if (scheduleResult.morningDose !== undefined) {
          morningDose = parseInt(scheduleResult.morningDose.toString()) || 0;
        }
        if (scheduleResult.afternoonDose !== undefined) {
          afternoonDose = parseInt(scheduleResult.afternoonDose.toString()) || 0;
        }
        if (scheduleResult.eveningDose !== undefined) {
          eveningDose = parseInt(scheduleResult.eveningDose.toString()) || 0;
        }
        
        // 🔥 요일별 스케줄 정보 추출
        if (scheduleResult.schedule && typeof scheduleResult.schedule === 'object') {
          weeklySchedule = {};
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          
          dayNames.forEach(day => {
            if (scheduleResult.schedule[day]) {
              const daySchedule = scheduleResult.schedule[day];
              if (weeklySchedule) {
                weeklySchedule[day] = {
                  morning: daySchedule.morning || false,
                  afternoon: daySchedule.afternoon || false,
                  evening: daySchedule.evening || false,
                  morningDose: daySchedule.morningDose || morningDose,
                  afternoonDose: daySchedule.afternoonDose || afternoonDose,
                  eveningDose: daySchedule.eveningDose || eveningDose,
                };
              }
            }
          });
          
          console.log(`📅 [${medicineId}] 요일별 스케줄:`, weeklySchedule);
        }
        
        // 🔥 2. 시간대별 복용량이 없는 경우 기존 방식으로 fallback
        if (morningDose === 0 && afternoonDose === 0 && eveningDose === 0) {
          console.log('🔍 [성능개선] 시간대별 복용량이 없어서 기존 방식 사용');
          
          const doseCount = parseInt((scheduleResult.doseCount || '0').toString()) || 0;
          
          // 📊 스케줄이 설정된 시간대만 복용량 설정 (성능 최적화)
          const hasSchedule = scheduleResult.schedule;
          if (hasSchedule && typeof hasSchedule === 'object') {
            // 간단한 체크: 어느 하나라도 morning이 true면 설정
            const hasAnyMorning = Object.values(hasSchedule).some((day: any) => day?.morning);
            const hasAnyAfternoon = Object.values(hasSchedule).some((day: any) => day?.afternoon);
            const hasAnyEvening = Object.values(hasSchedule).some((day: any) => day?.evening);
            
            if (hasAnyMorning) morningDose = doseCount;
            if (hasAnyAfternoon) afternoonDose = doseCount;
            if (hasAnyEvening) eveningDose = doseCount;
          }
        }
        
        const scheduleData = {
          morning: morningDose,
          afternoon: afternoonDose,
          evening: eveningDose,
          total: morningDose + afternoonDose + eveningDose,
          weeklySchedule: weeklySchedule // 🔥 요일별 스케줄 정보 추가
        };
        
        setDailySchedules(prev => ({
          ...prev,
          [scheduleKey]: scheduleData
        }));
        
        console.log(`✅ [성능개선] 시간대별 복용량 설정 완료:`, {
          medicineId,
          userName: selectedMember?.name,
          ...scheduleData,
        });
            } else {
        console.log(`❌ [성능개선] 시간대별 복용량 조회 실패 - null 응답`);
        // 실패한 경우에도 빈 데이터로 저장하여 재시도 방지
        const emptyScheduleData = {
          morning: 0,
          afternoon: 0,
          evening: 0,
          total: 0,
          weeklySchedule: null
        };
        setDailySchedules(prev => ({
          ...prev,
          [scheduleKey]: emptyScheduleData
        }));
      }
    } catch (error: unknown) {
      // 🔥 에러 발생 시 빈 데이터로 설정
      console.log(`❌ [loadDailySchedule] 에러 발생 - 빈 스케줄로 설정:`, error);
      const emptyScheduleData = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        weeklySchedule: null
      };
      setDailySchedules(prev => ({
        ...prev,
        [scheduleKey]: emptyScheduleData
      }));
    } finally {
      // 조회 완료 표시
      loadingSchedules.current.delete(scheduleKey);
    }
  };

  const loadParentConnectID = async () => {
    try {
      console.log('🔍 [MainHomeScreen] 부모 계정 정보 로딩 시작');
      const currentUserData = await AsyncStorage.getItem('@user');
      console.log('🔍 [MainHomeScreen] AsyncStorage 사용자 데이터:', currentUserData);
      
      if (!currentUserData) {
        throw new Error('저장된 사용자 정보가 없습니다.');
      }

      const currentUser = JSON.parse(currentUserData);
      console.log('🔍 [MainHomeScreen] 파싱된 현재 사용자 정보:', {
        user_id: currentUser.user_id,
        name: currentUser.name,
        role: currentUser.role,
        connect: currentUser.connect,
        machine_id: currentUser.machine_id,
        k_uid: currentUser.k_uid
      });

      // 부모 계정 찾기
      console.log('가족 구성원 조회 API 호출 시작');
      const parentMemberResponse = await getFamilyMembers();
      console.log('부모 멤버 응답:', parentMemberResponse);
      console.log('응답 타입:', typeof parentMemberResponse);
      console.log('응답 success:', parentMemberResponse?.success);
      console.log('응답 data:', parentMemberResponse?.data);
      console.log('응답 error:', parentMemberResponse?.error);

      if (!parentMemberResponse.success || !parentMemberResponse.data) {
        console.log('가족 구성원 조회 실패 - 상세정보:');
        console.log('  success:', parentMemberResponse?.success);
        console.log('  data:', parentMemberResponse?.data);
        console.log('  error:', parentMemberResponse?.error);
        
        // 에러 메시지에 따라 다른 처리
        const errorMessage = parentMemberResponse?.error?.message || '부모 계정을 찾을 수 없습니다.';
        
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
      console.log('가족 데이터:', familyData);
      console.log('가족 데이터 타입:', typeof familyData);
      console.log('가족 데이터가 배열인가:', Array.isArray(familyData));
      
      const parentMember = Array.isArray(familyData) 
        ? familyData.find(member => member.role === 'parent')
        : familyData;

      console.log('찾은 부모 멤버:', parentMember);

      if (!parentMember) {
        console.log('부모 멤버를 찾을 수 없음');
        console.log('가족 데이터 전체:', JSON.stringify(familyData, null, 2));
        if (Array.isArray(familyData)) {
          familyData.forEach((member, index) => {
            console.log(`  멤버 ${index}:`, {
              user_id: member.user_id,
              name: member.name,
              role: member.role,
              group_id: member.group_id
            });
          });
        }
        throw new Error('부모 계정을 찾을 수 없습니다.');
      }

      if (parentMember.group_id) {
        setParentConnect(parentMember.group_id);
        setSelectedMember(parentMember);
        
        // 디스펜서 정보 조회하여 maxSlot 설정  
        try {
          console.log('디스펜서 정보 조회 시작');
          const dispenserResponse = await userApi.getDispenserInfo(parentMember.user_id);
          console.log('디스펜서 정보 조회 결과:', dispenserResponse);
          
          if (dispenserResponse.success && dispenserResponse.data) {
            // 서버 응답: { machines: Machine[], group_id: string }
            const { machines } = dispenserResponse.data;
            
            if (machines && machines.length > 0) {
              // 첫 번째 기기의 max_slot 사용
              const maxSlot = machines[0].max_slot || 3;
              const machine_id = machines[0].machine_id;
              
              console.log('디스펜서 맥스 슬롯 설정:', maxSlot);
              console.log('디스펜서 machine_id:', machine_id);
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
                    console.log('✅ AsyncStorage 업데이트 완료: machine_id =', machine_id);
                  } else {
                    console.log('✅ machine_id 이미 최신 상태:', machine_id);
                  }
                }
              } catch (storageError) {
                console.error('❌ AsyncStorage 업데이트 실패:', storageError);
              }
            } else {
              console.log('등록된 기기가 없음, 기본값 3 사용');
              setMaxSlot(3);
            }
          } else {
            console.log('디스펜서 정보 조회 실패, 기본값 3 사용');
            setMaxSlot(3);
          }
        } catch (error) {
          console.error('디스펜서 정보 조회 중 에러 발생:', error);
          setMaxSlot(3); // 에러 시 기본값 3
        }
        
        // 약 목록 조회 추가
        console.log('약 목록 조회 시작');
        await loadMedicineList();
          
        console.log('모든 데이터 로딩 완료');
          } else {
        throw new Error('부모 계정에 그룹 정보가 없습니다.');
          }
        } catch (error) {
      console.error('부모 계정 정보 로딩 실패:', error);
      setError(error instanceof Error ? error.message : '부모 계정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const loadFamilyMembers = useCallback(async () => {
    if (!parentConnect) {
      console.log('parentConnect가 없습니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('가족 구성원 조회 시작:', parentConnect);
      const response = await getFamilyMembers();
      console.log('가족 구성원 조회 결과:', response);
      
      if (!response.success || !response.data) {
        console.log('가족 구성원 조회 실패:', response.error?.message);
        setError(response.error?.message || '가족 구성원 조회 실패');
        setFamilyMembers([]);
        return;
      }

      const members = response.data;
      setFamilyMembers(members);
      
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      const user = JSON.parse(userJson) as User;
      console.log('현재 사용자:', user);
      
      const savedId = await AsyncStorage.getItem(SELECTED_MEMBER_KEY);
      const savedMember = members.find(m => m.user_id === savedId);
      
      if (savedMember) {
        if (user.role === 'child' && savedMember.role === 'parent') {
          const childMember = members.find(m => m.role === 'child');
          if (childMember) {
            setSelectedMember(childMember);
          }
        } else {
          console.log('저장된 멤버로 설정:', savedMember);
          setSelectedMember(savedMember);
        }
      } else {
        console.log('저장된 멤버가 없음. 기본 선택 진행. user.role:', user.role);
        if (user.role === 'child') {
          const childMember = members.find(m => m.role === 'child');
          if (childMember) {
            console.log('자식 계정 - 자식 멤버 선택:', childMember);
            setSelectedMember(childMember);
          } else {
            console.log('자식 멤버를 찾을 수 없음');
          }
        } else {
          const parent = members.find(member => member.role === 'parent');
          if (parent) {
            console.log('부모 계정 - 부모 멤버 선택:', parent);
            setSelectedMember(parent);
          } else {
            console.log('부모 멤버를 찾을 수 없음');
          }
        }
      }
    } catch (error) {
      console.error('가족 구성원 로드 실패:', error);
      setError('가족 구성원 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [parentConnect]);

  const loadMedicineList = useCallback(async () => {
    try {
      if (!selectedMember?.user_id) {
        console.log('선택된 멤버가 없습니다.');
        return;
      }

      console.log('🔥 사용자별 약물 목록 로딩 시작:', selectedMember.user_id);
      
      // 🔍 토큰 상태 확인
      const { TokenDebugger } = await import('../utils/tokenDebugger');
      await TokenDebugger.monitorTokenRefresh();
      
      setLoading(true);
      
      // 🔥 user_id 기반 약물 조회 (새로운 방식)
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
        
        // 🔥 새로운 권한 시스템에 따른 약물 상호작용 검사 업데이트
        console.log('🔍 [DrugInteraction] 현재 선택된 사용자:', selectedMember?.user_id);
        
        // 🎯 권한 기반 필터링 (permission 필드 사용)
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
      }
      
      // 🔥 영양제 목록은 기존 방식 유지 (권한 시스템 미적용)
      try {
        const parentMember = familyMembers.find(member => member.role === 'parent');
        if (parentMember) {
          console.log('영양제 목록 조회 시작');
          const supplementResponse = await getSupplementList(parentMember.user_id);
          console.log('영양제 목록 조회 결과:', supplementResponse);
          
          if (supplementResponse) {
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
            setSupplementList(supplementResponse);
          } else {
            setSupplementList([]);
          }
        }
      } catch (error) {
        console.error('영양제 목록 조회 중 에러 발생:', error);
        setSupplementList([]);
      }
    } catch (error) {
      console.error('약물 목록 로딩 중 오류:', error);
      setMedicineList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMember?.user_id, familyMembers]);

  useEffect(() => {
    console.log('loadParentConnectID 실행');
    loadParentConnectID();
  }, []);

  useEffect(() => {
    if (parentConnect) {
      console.log('parentConnect 변경됨:', parentConnect);
      loadFamilyMembers();
    }
  }, [parentConnect]);

  // 🔥 가족 구성원이 로드된 후 가족 전체 약물 상호작용 검사 실행
  useEffect(() => {
    if (familyMembers.length > 0) {
      console.log('🔍 [FamilyDrugInteraction] 가족 구성원 로드 완료, 가족 전체 약물 상호작용 검사 시작');
      // 약간의 지연을 두고 실행하여 개별 약물 로딩이 완료된 후 실행
      setTimeout(() => {
        checkFamilyDrugInteractions();
      }, 1000);
    }
  }, [familyMembers]);

  useFocusEffect(
    useCallback(() => {
      if (selectedMember?.user_id) {
        console.log('화면 포커스 - 약 목록 새로고침:', selectedMember.user_id);
        loadMedicineList();
      }
    }, [selectedMember?.user_id, loadMedicineList])
  );

  // navigation params를 통한 새로고침 처리
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const state = navigation.getState();
      const route = state.routes[state.index];
      const params = route.params as any;
      
      if (params?.refresh && selectedMember?.user_id) {
        console.log('새로고침 플래그 감지 - 약 목록 새로고침');
        loadMedicineList();
        // 새로고침 후 플래그 제거
        navigation.setParams({ refresh: undefined } as any);
      }
      
      // 🔥 스케줄 수정 후 돌아온 경우 해당 약물의 시간대별 복용량만 새로고침
      if (params?.refreshSchedule && params?.medicineId && selectedMember?.user_id) {
        console.log('🔍 스케줄 새로고침 플래그 감지:', params.medicineId);
        loadDailySchedule(params.medicineId, selectedMember.user_id);
        // 플래그 제거
        navigation.setParams({ refreshSchedule: undefined, medicineId: undefined } as any);
      }
    });

    return unsubscribe;
  }, [navigation, selectedMember?.user_id, loadMedicineList]);

  useEffect(() => {
    AsyncStorage.getItem('@user').then(userJson => {
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserType(user.role);
      }
    });
  }, []);

  useEffect(() => {
    console.log('👤 selectedMember 변경됨:', selectedMember);
  }, [selectedMember]);

  const handleSelectMember = async (member: FamilyMember) => {
    try {
      console.log('멤버 선택 시도:', member);
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
  };

  const handlePress = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleRefresh = useCallback(async () => {
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

  // 약 리스트 그룹화
  const groupedMedicines = useMemo(() => {
    const slotMap: Record<number, Medicine[]> = {};
    for (let i = 1; i <= 6; i++) {
      slotMap[i] = [];
    }
    
    console.log('=== groupedMedicines 처리 시작 ===');
    console.log('medicineList:', medicineList);
    
    medicineList.forEach((med) => {
      // 🔥 새로운 API에서 슬롯 정보 직접 사용
      const slot = med.slot || 1;
      
      console.log(`=== ${med.name} 그룹화 처리 ===`);
      console.log('med.slot:', med.slot, typeof med.slot);
      console.log('🎯 최종 결정된 slot:', slot);
      
      slotMap[slot].push(med);
    });
    
    console.log('=== 최종 slotMap ===');
    Object.keys(slotMap).forEach(slotNum => {
      if (slotMap[parseInt(slotNum)].length > 0) {
        console.log(`슬롯 ${slotNum}:`, slotMap[parseInt(slotNum)].map(m => m.name));
      }
    });
    
    return slotMap;
  }, [medicineList]);

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
        
        // 이미 로드된 스케줄이 없고, 로딩 중이 아닌 경우에만 로드
        if (!dailySchedules[scheduleKey] && !loadingSchedules.current.has(scheduleKey)) {
          console.log(`🔍 [자동 스케줄 로드] ${medicine.name} 스케줄 로딩 시작 (대상: ${actualTargetUserId})`);
          loadDailySchedule(medicine.medi_id, actualTargetUserId);
        }
      });
    }
  }, [medicineList, selectedMember?.user_id, dailySchedules]);

  // 통합된 상세정보 함수
  const handleViewItemDetail = (type: 'medicine' | 'supplement', item: any) => {
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
    
    console.log('🔍 medi_id 패턴 기반 구분 판단:', {
      medi_id: item.medi_id,
      isSupplementByMediId,
      isMedicineByMediId,
      type: type,
      itemName: item.name,
      finalDecision: type === 'medicine' && !isSupplementByMediId ? 'medicine' : 'supplement'
    });
    
    if (type === 'medicine' && !isSupplementByMediId) {
      const memberIdToUse = selectedMember?.user_id || (familyMembers.length > 0 ? familyMembers[0].user_id : '');
      
      console.log('🔥 약 상세정보로 이동 - MedicineDetailScreen');
      console.log('🔥 전달할 파라미터:', {
        medicineId: item.medi_id,
        medicineName: item.name,
        memberId: memberIdToUse,
        isParent: userType === 'parent',
        detail: null
      });
      
      (navigation as any).navigate('MedicineDetail', {
        medicineId: item.medi_id,
        medicineName: item.name,
        memberId: memberIdToUse,
        isParent: userType === 'parent',
        detail: null // 저장된 약이므로 detail은 null
      });
    } else {
      console.log('영양제 상세정보로 이동 - SupplementDetailScreen');
      
      // tablet.json에서 저장된 영양제 이름과 매칭되는 제품 찾기
      let matchedSupplement = null;
      try {
        const supplementData = require('../assets/tablet.json');
        // 정확히 일치하는 제품명 찾기
        matchedSupplement = supplementData.find((sup: any) => 
          sup.PRDLST_NM === item.name
        );
        
        // 정확히 일치하지 않으면 부분 일치로 찾기
        if (!matchedSupplement) {
          matchedSupplement = supplementData.find((sup: any) => 
            sup.PRDLST_NM.includes(item.name) || item.name.includes(sup.PRDLST_NM)
          );
        }
      } catch (error) {
        console.error('영양제 데이터 로드 실패:', error);
      }
      
      // 매칭된 제품 정보가 있으면 실제 정보 사용, 없으면 기본값 사용
      const supplementForDetail = matchedSupplement ? {
        PRDLST_NM: matchedSupplement.PRDLST_NM,
        BSSH_NM: matchedSupplement.BSSH_NM,
        RAWMTRL_NM: matchedSupplement.RAWMTRL_NM,
        PRIMARY_FNCLTY: matchedSupplement.PRIMARY_FNCLTY,
        NTK_MTHD: matchedSupplement.NTK_MTHD,
        IFTKN_ATNT_MATR_CN: matchedSupplement.IFTKN_ATNT_MATR_CN,
      } : {
        PRDLST_NM: item.name || '정보 없음',
        BSSH_NM: '제조사 정보 없음',
        RAWMTRL_NM: '성분 정보 없음',
        PRIMARY_FNCLTY: '기능성 정보 없음',
        NTK_MTHD: '제품 설명서에 따라 복용하세요.',
        IFTKN_ATNT_MATR_CN: '복용 전 전문가와 상담하세요.',
      };
      
      console.log('매칭된 영양제 정보:', matchedSupplement ? '찾음' : '못찾음');
      
      (navigation as any).navigate('SupplementDetail', {
        supplement: supplementForDetail,
        memberId: selectedMember?.user_id || '',
        isParent: userType === 'parent',
        isStoredSupplement: true,
        storedData: item,
      });
    }
  };

  const handleDeleteMedicine = async (medicine: Medicine) => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) return;
      
      const user = JSON.parse(userJson);
      console.log('약 삭제 시작:', medicine.name);
      
      // 기존 deleteMedicine 대신 family.ts의 deleteMedicine 사용
      const success = await deleteMedicine(user.user_id, medicine.medi_id);
      
      if (success) {
        // 로컬 상태에서 해당 약 제거
        setMedicineList(prev => prev.filter(m => m.medi_id !== medicine.medi_id));
        
        Toast.show({
          type: 'success',
          text1: '약이 삭제되었습니다',
          text2: `${medicine.name}이(가) 목록에서 제거되었습니다.`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '삭제 실패',
          text2: '약 삭제 중 오류가 발생했습니다.',
        });
      }
    } catch (error) {
      console.error('약 삭제 실패:', error);
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: '약 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const handleDeleteSupplement = async (supplement: NutritionalSupplement) => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) return;
      
      const user = JSON.parse(userJson);
      console.log('영양제 삭제 시작:', supplement.name);
      
      const result = await deleteSupplementAPI(user.user_id, supplement.id || '');
      
      if (result) {
        // 로컬 상태에서 해당 영양제 제거
        setSupplementList(prev => prev.filter(s => s.id !== supplement.id));
        
        Toast.show({
          type: 'success',
          text1: '영양제가 삭제되었습니다',
          text2: `${supplement.name}이(가) 목록에서 제거되었습니다.`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '삭제 실패',
          text2: '영양제 삭제 중 오류가 발생했습니다.',
        });
      }
    } catch (error) {
      console.error('영양제 삭제 실패:', error);
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: '영양제 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const renderRightActions = (
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
  };

  // 🔥 요일별 스케줄 확인 함수 추가 - 약물 상태 검증 포함
  const getTodayScheduleForMedicine = (medicine: Medicine, dailySchedule: any) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    
    // 🔥 스케줄 저장 시 사용하는 요일 형식과 일치시키기
    const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // 0=일요일부터 시작
    const todayShortName = shortDayNames[dayOfWeek];
    
    // 전체 요일명도 함께 계산 (서버에서 다른 형식으로 올 수 있음)
    const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayFullName = fullDayNames[dayOfWeek];
    
    console.log(`🗓️ [${medicine.name}] 오늘 요일 체크: ${todayShortName} (${dayOfWeek}) / 전체명: ${todayFullName}`);
    console.log(`🗓️ [${medicine.name}] 전체 dailySchedule 데이터:`, dailySchedule);
    
    // 🔥 약물 상태 검증 - 재고와 복용 기간 확인
    const totalQuantity = parseInt(medicine.totalQuantity || '0');
    const endDate = medicine.end_date ? new Date(medicine.end_date) : null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정
    
    // 재고가 0이거나 복용 기간이 끝난 경우 스케줄 표시 안함
    if (totalQuantity <= 0) {
      console.log(`❌ [${medicine.name}] 재고 부족으로 스케줄 표시 안함: ${totalQuantity}정`);
      return {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        dayOfWeek: todayShortName,
        isScheduledDay: false,
        reason: 'no_stock'
      };
    }
    
    if (endDate && endDate < todayDate) {
      console.log(`❌ [${medicine.name}] 복용 기간 만료로 스케줄 표시 안함: ${medicine.end_date}`);
      return {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
        dayOfWeek: todayShortName,
        isScheduledDay: false,
        reason: 'expired'
      };
    }
    
    console.log(`✅ [${medicine.name}] 약물 상태 정상 - 재고: ${totalQuantity}정, 종료일: ${medicine.end_date}`);
    
    
    // 🔥 우선 기본 복용량부터 확인 (매일 복용하는 경우)
    const morningDose = dailySchedule?.morning || 0;
    const afternoonDose = dailySchedule?.afternoon || 0;
    const eveningDose = dailySchedule?.evening || 0;
    
    console.log(`📋 [${medicine.name}] 기본 복용량:`, { morningDose, afternoonDose, eveningDose });
    
    // 🔥 기본 복용량이 있으면 우선 사용 (매일 복용)
    if (morningDose > 0 || afternoonDose > 0 || eveningDose > 0) {
      const result = {
        morning: morningDose,
        afternoon: afternoonDose,
        evening: eveningDose,
        total: morningDose + afternoonDose + eveningDose,
        dayOfWeek: todayShortName,
        isScheduledDay: true,
        reason: 'daily_schedule'
      };
      
      console.log(`✅ [${medicine.name}] 매일 복용 스케줄 적용:`, result);
      return result;
    }
    
    // 🔥 요일별 스케줄이 있는 경우에만 처리
    if (dailySchedule?.weeklySchedule) {
      console.log(`📋 [${medicine.name}] 요일별 스케줄 존재:`, dailySchedule.weeklySchedule);
      
      // 🔥 짧은 형식(mon, tue)과 전체 형식(monday, tuesday) 모두 시도
      let todaySchedule = dailySchedule.weeklySchedule[todayShortName]; // 먼저 짧은 형식으로 시도
      
      // 짧은 형식이 없으면 전체 형식으로 시도
      if (!todaySchedule) {
        todaySchedule = dailySchedule.weeklySchedule[todayFullName];
        console.log(`📋 [${medicine.name}] 전체 요일명으로 재시도: ${todayFullName}`, todaySchedule);
      } else {
        console.log(`📋 [${medicine.name}] 짧은 요일명으로 발견: ${todayShortName}`, todaySchedule);
      }
      
      if (todaySchedule) {
        console.log(`📋 [${medicine.name}] 오늘 스케줄 (요일별):`, todaySchedule);
        
        // 요일별 스케줄에서 직접 복용량 가져오기
        const weeklyMorningDose = todaySchedule.morning ? (parseInt(todaySchedule.morningDose?.toString()) || 1) : 0;
        const weeklyAfternoonDose = todaySchedule.afternoon ? (parseInt(todaySchedule.afternoonDose?.toString()) || 1) : 0;
        const weeklyEveningDose = todaySchedule.evening ? (parseInt(todaySchedule.eveningDose?.toString()) || 1) : 0;
        
        const result = {
          morning: weeklyMorningDose,
          afternoon: weeklyAfternoonDose,
          evening: weeklyEveningDose,
          total: weeklyMorningDose + weeklyAfternoonDose + weeklyEveningDose,
          dayOfWeek: todayShortName,
          isScheduledDay: weeklyMorningDose > 0 || weeklyAfternoonDose > 0 || weeklyEveningDose > 0,
          reason: 'weekly_schedule'
        };
        
        console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (요일별):`, result);
        return result;
      } else {
        // 오늘 요일에 스케줄이 없는 경우 - 복용하지 않는 날
        console.log(`❌ [${medicine.name}] 요일별 스케줄에서 오늘은 복용하지 않는 날: ${todayShortName} / ${todayFullName}`);
        
        const result = {
          morning: 0,
          afternoon: 0,
          evening: 0,
          total: 0,
          dayOfWeek: todayShortName,
          isScheduledDay: false,
          reason: 'no_schedule_today'
        };
        
        console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (스케줄 없음):`, result);
        return result;
      }
    }
    
    // 🔥 어떤 스케줄도 없는 경우 - 기본 스케줄 적용 (매일 아침 1정)
    console.log(`❌ [${medicine.name}] 스케줄 정보가 전혀 없음 - 기본 스케줄 적용`);
    
    const result = {
      morning: 1, // 🔥 기본값: 매일 아침 1정
      afternoon: 0,
      evening: 0,
      total: 1,
      dayOfWeek: todayShortName,
      isScheduledDay: true, // 🔥 기본적으로 복용 가능하도록 변경
      reason: 'default_schedule'
    };
    
    console.log(`✅ [${medicine.name}] 오늘의 복용 스케줄 (기본 매일 아침 1정):`, result);
    return result;
  };

  // 🔥 약물명 표시 개선 함수
  const getMedicineDisplayInfo = (medicine: Medicine, todaySchedule: any) => {
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
  };

  // 기존 renderMedicineItem 함수에서 복용 완료 버튼 부분 수정
  const renderMedicineItem = (medicine: Medicine, index: number) => {
    const handleViewMedicineDetail = () => {
      console.log('🔥 [renderMedicineItem] 의약품 상세보기:', medicine.name, medicine.medi_id);
      handleViewItemDetail('medicine', medicine);
    };

    const handleSchedulePress = () => {
      handleNavigateToSchedule(medicine);
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
      
      // 🔥 자식 계정의 경우 항상 본인이 대상인지만 확인
      if (userType === 'child') {
        if (!medicine.target_users || medicine.target_users.length === 0) {
          return true; // 가족 공통 약물
        }
        return medicine.target_users.includes(selectedMember.user_id);
      }
      
      // 🔥 부모 계정의 경우 기존 로직 유지
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

      // 🔥 자식 계정의 경우 색깔 표시 로직 개선
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
    let actualTargetUserId = selectedMember?.user_id || '';
    if (medicine.target_users && medicine.target_users.length > 0) {
      actualTargetUserId = medicine.target_users[0];
    }
    
    const scheduleKey = `${medicine.medi_id}_${actualTargetUserId}`;
    const dailySchedule = dailySchedules[scheduleKey];

    // 🔥 오늘의 스케줄 계산
    const todaySchedule = getTodayScheduleForMedicine(medicine, dailySchedule);
    const displayInfo = getMedicineDisplayInfo(medicine, todaySchedule);

    return (
      <Swipeable
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, () => handleDeleteMedicine(medicine))
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

            {/* 🔥 시간대별 복용량 표시 - Hook 제거하고 단순 조회 */}
              <View style={styles.medicineDetails}>
                <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
                시작일: {formatDateForDisplay(medicine.start_date)}
                </Text>
                <Text style={[styles.medicineDetail, { color: themeColors.text }]}>
                종료일: {formatDateForDisplay(medicine.end_date)}
                </Text>
            </View>
            
                        {/* 🔥 복용 완료 상태 확인 및 조건부 렌더링 */}
            {(ownerInfo.isOwn || ownerInfo.isManaged) && todaySchedule.isScheduledDay && (() => {
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
              
              // 🔥 실제 복용 완료 상태를 API에서 조회 (target_users 기반)
              const statusKey = `${medicine.medi_id}_${actualTargetUserId}`;
              const completionStatus = doseCompletionStatus[statusKey] || {
                morning: false,
                afternoon: false,
                evening: false
              };
              
              const morningCompleted = completionStatus.morning;
              const afternoonCompleted = completionStatus.afternoon;  
              const eveningCompleted = completionStatus.evening;
              
              const allCompleted = (todaySchedule.morning === 0 || morningCompleted) &&
                                 (todaySchedule.afternoon === 0 || afternoonCompleted) &&
                                 (todaySchedule.evening === 0 || eveningCompleted);
              
              if (allCompleted) {
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
                // 🔥 아직 복용하지 않은 시간대가 있는 경우 스케줄 정보만 표시
                return (
                  <View style={[
                    styles.doseCompletionSection,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
                  ]}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 8, textAlign: 'center' }]}>
                      📋 오늘의 복용 스케줄: {displayInfo.scheduleText}
                    </Text>
                    <Text style={[styles.medicineDetail, { color: isDark ? '#888' : '#666', textAlign: 'center', fontSize: 12 }]}>
                      🔥 RFID 태그를 디스펜서에 인식하면 자동으로 배출됩니다
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
              
                            
                              {/* 🔥 수정: 권한에 따른 스케줄 버튼 제어 - 부모는 모든 약품 편집 가능 */}
                                {/* 스케줄 버튼 - 부모는 모든 약물 관리 가능 */}
                {(() => {
                  // 🎯 부모는 모든 약물 관리 가능, 자녀는 타인 약물 접근 불가
                  const isOthersOnly = !isTargetUser && medicineType !== 'family_common';
                  const hasSchedulePermission = userType === 'parent' || !isOthersOnly;
                  
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
            
            {/* 🔥 타인 약물 정보 표시 - 부모는 관리 가능한 정보로 표시 */}
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
                  {userType === 'parent' 
                    ? (medicineType === 'others_only' 
                        ? '자녀의 개인 약물 (부모 관리 가능)' 
                        : '가족 공통 약물')
                    : (medicineType === 'others_only' 
                    ? '다른 가족 구성원의 개인 전용 약물' 
                        : '가족 공통 약물 (참고용)')
                  }
                </Text>
              </View>
            )}
          </View>
        </View>
      </Swipeable>
    );
  };

  const handleMedicineSearch = async () => {
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

    console.log('약검색 버튼 클릭:', user.role);

    // 부모 계정인 경우 디스펜서 연동 상태 체크
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

    // 디스펜서가 등록된 경우 또는 자식 계정인 경우 검색 화면으로 이동
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
  };

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
        {item.role === 'parent' ? '부모 계정' : '자식 계정'}
      </Text>
    </TouchableOpacity>
  );

  const renderSupplementItem = (supplement: NutritionalSupplement, index: number) => {
    const handleViewSupplementDetail = () => {
      console.log('🔥 [renderSupplementItem] 영양제 상세보기:', supplement.name, supplement.id || supplement.name);
      handleViewItemDetail('supplement', supplement);
    };

    const handleSupplementScheduleEdit = () => {
      (navigation as any).navigate('SupplementScheduleEdit', {
        supplementId: supplement.id || supplement.name, // 영양제 ID 또는 이름 사용
        memberId: selectedMember?.user_id || '',
        supplementName: supplement.name,
        slot: supplement.dispenserSlot,
      });
    };

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
        canSchedule = userType === 'parent'; // 부모는 모든 영양제 관리 가능
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

    return (
      <Swipeable
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, () => handleDeleteSupplement(supplement))
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
    );
  };

  const handleNavigateToSchedule = async (medicine: Medicine) => {
    if (selectedMember) {
      console.log('스케줄 편집 화면으로 이동:', {
        medicineId: medicine.medi_id,
        memberId: selectedMember.user_id,
        medicineName: medicine.name
      });
      
      // 🔥 로컬 JSON에서 처방 정보 찾기
      let useMethodQesitm: string | undefined;
      try {
        const medicineData = require('../assets/medicine.json');
        if (Array.isArray(medicineData)) {
          const found = medicineData.find((item: any) => 
            item['품목일련번호 [ITEMSEQ] '] === medicine.medi_id ||
            item['제품명 [ITEMNAME] '] === medicine.name
          );
          if (found) {
            useMethodQesitm = found['문항2(사용법) [USEMETHODQESITM] '];
            console.log('✅ 로컬 JSON에서 처방 정보 찾음:', useMethodQesitm);
          }
        }
      } catch (error) {
        console.log('⚠️ 로컬 JSON에서 처방 정보 조회 실패:', error);
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
    
    // 🔥 자식 계정을 위한 개선된 권한 필터링
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
        // 부모는 모든 약물에 접근 가능
        return true;
      } else {
        // 자식은 본인 약물과 공통 약물만 접근 가능
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
        // 🔥 복용 완료 상태 조회 활성화 (target_users 기반)
        loadDoseCompletionStatus(medicine.medi_id, actualTargetUserId);
      }
    });
  }, [medicineList, selectedMember?.user_id, userType]);

  // 🔥 스케줄 편집 후 돌아왔을 때 새로고침 처리
  useFocusEffect(
    useCallback(() => {
      // 스케줄 편집 후 돌아온 경우 시간대별 복용량 새로고침
      if (selectedMember?.user_id && medicineList.length > 0) {
        console.log('🔄 화면 포커스 - 시간대별 복용량 새로고침');
        
        // 기존 스케줄 및 복용 완료 상태 데이터 초기화
        setDailySchedules({});
        setDoseCompletionStatus({});
        
        // 🔥 권한이 있는 약물들의 시간대별 복용량 및 복용 완료 상태 재조회
        const accessibleMedicines = medicineList.filter(medicine => {
          // 서버에서 반환된 permission 정보 사용
          const permission = (medicine as any).permission;
          
          if (userType === 'parent') {
            // 부모는 모든 약물에 접근 가능
            return true;
          } else {
            // 자식은 본인 약물과 공통 약물만 접근 가능
            return permission === 'own' || permission === 'common';
          }
        });

        console.log(`🔄 [Focus] 접근 가능한 약물: ${accessibleMedicines.length}/${medicineList.length}개`);

        accessibleMedicines.forEach(medicine => {
          // 🔥 target_users 기반으로 실제 스케줄이 저장된 사용자 결정
          let actualTargetUserId = selectedMember.user_id;
          if (medicine.target_users && medicine.target_users.length > 0) {
            actualTargetUserId = medicine.target_users[0];
          }
          
          console.log(`🔄 [Focus] ${medicine.name} 스케줄 재로딩: ${actualTargetUserId}`);
          loadDailySchedule(medicine.medi_id, actualTargetUserId);
          // 🔥 복용 완료 상태 조회 활성화 (target_users 기반)
          loadDoseCompletionStatus(medicine.medi_id, actualTargetUserId);
        });
      }
    }, [selectedMember?.user_id, medicineList, userType])
  );

  // 🔥 하루 전체 스케줄 배출 처리 함수 - 데일리키트용
  const handleCompleteDailySchedule = async (
    medicine: Medicine,
    targetUserId: string
  ) => {
    const completingKey = `${medicine.medi_id}_${targetUserId}_daily`;
    
    try {
      setCompletingDose(prev => ({ ...prev, [completingKey]: true }));
      
      console.log('📦 [DailySchedule] 하루 전체 스케줄 배출 시작:', {
        medicine: medicine.name,
        targetUserId,
        schedule: dailySchedules[medicine.medi_id]
      });
      
      const dailySchedule = dailySchedules[medicine.medi_id];
      if (!dailySchedule) {
        throw new Error('스케줄 정보를 찾을 수 없습니다.');
      }
      
             const totalDose = dailySchedule.total;
       
       // 슬롯 정보 확인
       if (!medicine.slot) {
         throw new Error('약물 슬롯 정보가 없습니다.');
       }
       
       // 1. 실제 약물 배출 (하루치 전체)
       let machine_id: string;
       
       try {
         const machineIdResponse = await userApi.getUserMachineId(targetUserId);
         if (!machineIdResponse.success || !machineIdResponse.data?.machine_id) {
           throw new Error('기기 정보를 찾을 수 없습니다.');
         }
         machine_id = machineIdResponse.data.machine_id;
         
        console.log('📦 [DailySchedule] 하루치 배출 요청:', {
          machine_id,
          medi_id: medicine.medi_id,
          slot: medicine.slot,
          count: totalDose
        });
        
        const dispenseResult = await scheduleDispense(
          machine_id,
          targetUserId,
          medicine.medi_id,
          medicine.slot,
          totalDose,
          '하루치 일괄 배출'
        );
        
        if (!dispenseResult.success) {
          throw new Error(dispenseResult.error?.message || '배출에 실패했습니다.');
        }
        
        console.log('✅ [DailySchedule] 하루치 배출 성공');
        
      } catch (dispenseError) {
        console.error('🔥 [DailySchedule] 배출 실패:', dispenseError);
        throw new Error(`배출 실패: ${dispenseError instanceof Error ? dispenseError.message : '알 수 없는 오류'}`);
      }
      
             // 2. 모든 시간대 복용 기록 저장
       const timeSlots = ['morning', 'afternoon', 'evening'] as const;
       
       for (const timeOfDay of timeSlots) {
         const dosage = dailySchedule[timeOfDay];
         if (dosage > 0) {
           try {
             const response = await scheduleApi.completeDose(medicine.medi_id, targetUserId, timeOfDay, dosage);
             if (!response.success) {
               console.error(`🔥 [DailySchedule] ${timeOfDay} 복용 기록 실패:`, response.error);
             } else {
               console.log(`✅ [DailySchedule] ${timeOfDay} 복용 기록 성공`);
             }
           } catch (recordError) {
             console.error(`🔥 [DailySchedule] ${timeOfDay} 복용 기록 오류:`, recordError);
           }
         }
       }
      
      Toast.show({
        type: 'success',
        text1: '📦 하루치 배출 완료',
        text2: `${medicine.name} 총 ${totalDose}정이 배출되었습니다. 데일리키트에 나눠서 보관하세요.`,
        position: 'top',
        visibilityTime: 4000,
      });
      
      // 3. 복용 완료 상태 즉시 업데이트
      setDoseCompletionStatus(prev => ({
        ...prev,
        [medicine.medi_id]: {
          morning: true,
          afternoon: true,
          evening: true
        }
      }));
      
      // 4. 약물 목록 새로고침
      if (selectedMember) {
        await handleSelectMember(selectedMember);
      }
      
    } catch (error) {
      console.error('📦 [DailySchedule] 하루치 배출/복용 완료 처리 에러:', error);
      Toast.show({
        type: 'error',
        text1: '배출 실패',
        text2: error instanceof Error ? error.message : '하루치 배출 처리에 실패했습니다.',
        position: 'top',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completingKey]: false }));
    }
  };

  // 🔥 복용 완료 처리 함수 (target_users 기반) - 실제 약물 배출 포함
  const handleCompleteDoseWithTarget = async (
    medicine: Medicine, 
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    targetUserId: string
  ) => {
    if (!selectedMember) {
      Toast.show({
        type: 'error',
        text1: '가족 구성원을 선택해주세요.',
        position: 'bottom',
      });
      return;
    }

    const completionKey = `${medicine.medi_id}_${targetUserId}_${timeOfDay}`;
    
    // 이미 처리 중인 경우 중복 호출 방지
    if (completingDose[completionKey]) {
      return;
    }

    try {
      setCompletingDose(prev => ({ ...prev, [completionKey]: true }));

      // 스케줄에서 복용량 가져오기 (target_users 기반)
      const scheduleKey = `${medicine.medi_id}_${targetUserId}`;
      const dailySchedule = dailySchedules[scheduleKey];
      
      let actualDose = 1; // 기본값
      if (dailySchedule) {
        actualDose = timeOfDay === 'morning' ? dailySchedule.morning :
                     timeOfDay === 'afternoon' ? dailySchedule.afternoon :
                     dailySchedule.evening;
      }

      if (actualDose === 0) {
        Toast.show({
          type: 'warning',
          text1: '해당 시간대에 복용 스케줄이 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // 🔥 1단계: 오늘 스케줄에 따른 약물 배출 실행
      console.log('🔥 스케줄 기반 배출 시작:', { 
        medicine: medicine.name, 
        dose: actualDose, 
        timeOfDay,
        targetUser: targetUserId,
        today: new Date().toISOString().split('T')[0]
      });
      
      // 사용자의 machine_id 조회
      const machineIdResponse = await userApi.getUserMachineId(targetUserId);
      if (!machineIdResponse.success || !machineIdResponse.data?.machine_id) {
        throw new Error('디스펜서 기기 정보를 찾을 수 없습니다.');
      }
      
      const machine_id = machineIdResponse.data.machine_id;
      console.log('🔍 사용자 machine_id 확인:', machine_id);

      // 약물 배출 API 호출 (스케줄 기반 자동배출)
      const dispenseResult = await scheduleDispense(
        machine_id,
        targetUserId,
        medicine.medi_id,
        medicine.slot || 1,
        actualDose,
        '개별 시간대 배출'
      );

      if (!dispenseResult.success) {
        throw new Error(dispenseResult.error?.message || '약물 배출에 실패했습니다.');
      }

      console.log('✅ 약물 배출 성공, 복용 기록 저장 시작');

      // 🔥 2단계: 배출 성공 후 복용 기록 저장
      const response = await scheduleApi.completeDose(
        medicine.medi_id,
        targetUserId,
        timeOfDay,
        actualDose
      );

      if (response.success) {
        const timeLabel = timeOfDay === 'morning' ? '아침' : 
                         timeOfDay === 'afternoon' ? '점심' : '저녁';
        Toast.show({
          type: 'success',
          text1: `${timeLabel} 복용 완료`,
          text2: `${medicine.name} ${actualDose}정이 스케줄에 따라 배출되었습니다.`,
          position: 'bottom',
        });

        // 🔥 복용 완료 상태 즉시 업데이트 (target_users 기반)
        const statusKey = `${medicine.medi_id}_${targetUserId}`;
        setDoseCompletionStatus(prev => ({
          ...prev,
          [statusKey]: {
            morning: prev[statusKey]?.morning || false,
            afternoon: prev[statusKey]?.afternoon || false,
            evening: prev[statusKey]?.evening || false,
            [timeOfDay]: true
          }
        }));

        // 🔥 즉시 데이터 새로고침 (target_users 기반)
        await Promise.all([
          loadDailySchedule(medicine.medi_id, targetUserId),
          loadDoseCompletionStatus(medicine.medi_id, targetUserId)
        ]);
        
        console.log(`✅ [handleCompleteDoseWithTarget] 배출 + 기록 완료: ${statusKey}`);
      } else {
        throw new Error(response.error?.message || '복용 기록 저장에 실패했습니다.');
      }

    } catch (error) {
      console.error('약물 배출/복용 완료 처리 에러:', error);
      Toast.show({
        type: 'error',
        text1: '복용 실패',
        text2: error instanceof Error ? error.message : '복용 처리에 실패했습니다.',
        position: 'bottom',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completionKey]: false }));
    }
  };

  // 🔥 기존 복용 완료 처리 함수 (호환성 유지)
  const handleCompleteDose = async (
    medicine: Medicine, 
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ) => {
    if (!selectedMember) {
      Toast.show({
        type: 'error',
        text1: '가족 구성원을 선택해주세요.',
        position: 'bottom',
      });
      return;
    }

    const completionKey = `${medicine.medi_id}_${selectedMember.user_id}_${timeOfDay}`;
    
    // 이미 처리 중인 경우 중복 호출 방지
    if (completingDose[completionKey]) {
      return;
    }

    try {
      setCompletingDose(prev => ({ ...prev, [completionKey]: true }));

      // 스케줄에서 복용량 가져오기
      const scheduleKey = `${medicine.medi_id}_${selectedMember.user_id}`;
      const dailySchedule = dailySchedules[scheduleKey];
      
      let actualDose = 1; // 기본값
      if (dailySchedule) {
        actualDose = timeOfDay === 'morning' ? dailySchedule.morning :
                     timeOfDay === 'afternoon' ? dailySchedule.afternoon :
                     dailySchedule.evening;
      }

      if (actualDose === 0) {
        Toast.show({
          type: 'warning',
          text1: '해당 시간대에 복용 스케줄이 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // API 호출
      const response = await scheduleApi.completeDose(
        medicine.medi_id,
        selectedMember.user_id,
        timeOfDay,
        actualDose
      );

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: '복용 완료',
          text2: `${actualDose}정 복용이 기록되었습니다.`,
          position: 'bottom',
        });

        // 🔥 복용 완료 상태 즉시 업데이트
        const statusKey = `${medicine.medi_id}_${selectedMember.user_id}`;
        setDoseCompletionStatus(prev => ({
          ...prev,
          [statusKey]: {
            morning: prev[statusKey]?.morning || false,
            afternoon: prev[statusKey]?.afternoon || false,
            evening: prev[statusKey]?.evening || false,
            [timeOfDay]: true
          }
        }));

        // 🔥 즉시 데이터 새로고침
        if (selectedMember) {
          await Promise.all([
            loadDailySchedule(medicine.medi_id, selectedMember.user_id),
            loadDoseCompletionStatus(medicine.medi_id, selectedMember.user_id)
          ]);
          
          console.log(`✅ [handleCompleteDose] 상태 업데이트 완료: ${statusKey}`);
        }
      } else {
        throw new Error(response.error?.message || '복용 기록 저장에 실패했습니다.');
      }

    } catch (error) {
      console.error('복용 완료 처리 에러:', error);
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: error instanceof Error ? error.message : '복용 완료 처리에 실패했습니다.',
        position: 'bottom',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completionKey]: false }));
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeAreaView}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.WHITE} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !selectedMember) {
    return (
      <SafeAreaView style={[styles.safeAreaView, { backgroundColor: themeColors.background }]}>
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
    <SafeAreaView style={[styles.safeAreaView, { backgroundColor: themeColors.background }]}>
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
          />
        )}

        {/* 오늘 날짜 */}
        <View style={styles.dateHeader}>
          <View style={styles.dateContainer}>
            <Text style={[styles.dateMainText, { color: themeColors.text }]}>
            {new Date().toLocaleDateString('ko-KR', {
              month: 'long', 
                day: 'numeric'
              })}
            </Text>
            <Text style={[styles.dateSubText, { color: isDark ? '#888' : '#666' }]}>
              {new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
              weekday: 'long'
            })}
          </Text>
          </View>
        </View>

        {/* 사용자 선택 헤더 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderContent}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
              <Feather 
                name={userType === 'parent' ? 'users' : 'user'} 
                size={18} 
                color={colors.PRIMARY.DEFAULT} 
              />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            {userType === 'parent' ? '사용자 선택' : '내 계정'}
          </Text>
          </View>
        </View>

        {/* 사용자 계정 선택 박스 - 부모 계정만 표시 */}
        {userType === 'parent' && (
          <>
            <TouchableOpacity 
              style={[
                styles.userSelectionCard, 
                { 
                  backgroundColor: isDark ? themeColors.card : 'white',
                  borderColor: colors.PRIMARY.DEFAULT,
                }
              ]}
              onPress={() => setIsExpanded(!isExpanded)}
            >
              <View style={styles.userCardContent}>
                <View style={styles.userMainInfo}>
                  <View style={[styles.userAvatar, { backgroundColor: selectedMember.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT }]}>
                    <Text style={styles.userAvatarText}>
                      {selectedMember.role === 'parent' ? 'M' : 'S'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: themeColors.text }]}>
                      {selectedMember.name}
                    </Text>
                    <Text style={[styles.userSubtitle, { color: isDark ? '#888' : '#666' }]}>
                      {selectedMember.age}세 • {selectedMember.role === 'parent' ? '부모 계정' : '자식 계정'}
                    </Text>
                  </View>
                </View>
                <View style={styles.expandIndicator}>
                  <View style={[styles.expandButton, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
                  <Feather 
                    name="chevron-down" 
                    size={18} 
                    color={isDark ? '#ccc' : '#666'} 
                      style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}
                  />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* 가족 구성원 목록 - 부모 계정만 */}
            {isExpanded && (
              <View style={[
                styles.memberListContainer,
                { 
                  backgroundColor: isDark ? themeColors.card : 'white',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#e0e0e0',
                shadowColor: isDark ? '#000' : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                  paddingVertical: 8,
                }
              ]}>
                {familyMembers.map((member, index) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.memberCard,
                      { 
                        backgroundColor: 'transparent',
                        borderColor: selectedMember.user_id === member.user_id ? 
                          colors.PRIMARY.DEFAULT : 'transparent',
                        borderWidth: selectedMember.user_id === member.user_id ? 2 : 0,
                        borderRadius: selectedMember.user_id === member.user_id ? 8 : 0,
                        marginHorizontal: 8,
                        marginVertical: 4,
                      }
                    ]}
                    onPress={() => handleSelectMember(member)}
                  >
                    <View style={styles.memberCardContent}>
                      <View style={styles.memberMainInfo}>
                        <View style={[styles.memberAvatar, { 
                      backgroundColor: member.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT
                    }]}>
                          <Text style={styles.memberAvatarText}>
                        {member.role === 'parent' ? 'M' : 'S'}
                      </Text>
                    </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: themeColors.text }]}>
                        {member.name}
                      </Text>
                          <Text style={[styles.memberSubtitle, { 
                        color: isDark ? '#888' : '#666'
                      }]}>
                        {member.age}세 • {member.role === 'parent' ? '부모 계정' : '자식 계정'}
                      </Text>
                        </View>
                    </View>
                    {selectedMember.user_id === member.user_id && (
                        <View style={styles.selectedIndicator}>
                          <View style={[styles.checkmark, { backgroundColor: colors.PRIMARY.DEFAULT }]}>
                        <Feather name="check" size={16} color={colors.WHITE} />
                          </View>
                      </View>
                    )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* 자식 계정일 때는 고정된 헤더만 표시 */}
        {userType === 'child' && (
          <View style={[
            styles.userSelectionCard, 
            { 
              backgroundColor: isDark ? themeColors.card : 'white',
              borderColor: colors.SUCCESS.DEFAULT,
            }
          ]}>
            <View style={styles.userCardContent}>
              <View style={styles.userMainInfo}>
                <View style={[styles.userAvatar, { backgroundColor: colors.SUCCESS.DEFAULT }]}>
                  <Text style={styles.userAvatarText}>
                    S
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: themeColors.text }]}>
                    {selectedMember?.name || '내 약 목록'}
                  </Text>
                  <Text style={[styles.userSubtitle, { color: isDark ? '#888' : '#666' }]}>
                    자식 계정 • 스케줄 편집만 가능
                  </Text>
                  {/* 🔥 자식 계정에서도 그룹명 표시 */}
                  {selectedMember?.group_name && (
                    <Text style={[styles.groupNameText, { color: colors.SUCCESS.DEFAULT }]}>
                      🏠 {selectedMember.group_name}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 약 리스트 */}
        <View style={styles.medicineContainer}>
          {/* 헤더 텍스트 섹션 */}
          <View style={styles.medicineHeaderSection}>
            <View style={styles.medicineHeaderContent}>
              <View style={[styles.medicineIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
                <Feather 
                  name="heart" 
                  size={20} 
                  color={colors.PRIMARY.DEFAULT} 
                />
              </View>
              <View style={styles.medicineHeaderText}>
                <Text style={[styles.medicineListTitle, { color: themeColors.text }]}>
                  보유중인 약
                </Text>
                <Text style={[styles.medicineListSubtitle, { color: isDark ? '#888' : '#666' }]}>
                  등록된 의약품 목록
                </Text>
              </View>
            </View>
          </View>
          
          {/* 버튼 섹션 */}
          <View style={styles.allButtonsContainer}>
            {/* 약 검색 버튼 */}
            <TouchableOpacity
              style={[styles.dispenseButton, styles.searchButton]}
              onPress={handleMedicineSearch}
            >
              <Feather 
                name={userType === 'parent' ? 'search' : 'info'} 
                size={12} 
                color={colors.PRIMARY.DEFAULT} 
              />
              <Text style={[styles.dispenseButtonText, { color: colors.PRIMARY.DEFAULT }]}>
                {userType === 'parent' ? '약 검색' : '약 정보'}
              </Text>
            </TouchableOpacity>

            {/* 오늘의 스케줄 표시 */}
            <TouchableOpacity
              style={[styles.dispenseButton, styles.todayScheduleButton]}
              onPress={() => setTodayScheduleModalVisible(true)}
            >
              <Feather name="calendar" size={12} color="#FFF" />
              <Text style={[styles.dispenseButtonText, { color: '#FFF' }]}>
                스케줄 확인
              </Text>
            </TouchableOpacity>

          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.text} />
          ) : medicineList.length > 0 ? (
            (() => {
              // 맥스 슬롯 설정에 따라 동적으로 슬롯 배열 생성
              const slotKeys = Array.from({ length: maxSlot }, (_, i) => i + 1);
              
              const renderedSlots = slotKeys.map((slot) => {
                const medicines = groupedMedicines[slot];
                
                if (medicines.length === 0) return null;
                
                return (
                  <View key={slot} style={{ marginBottom: 20 }}>
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
                    {medicines.map((medicine, idx) =>
                      <React.Fragment key={`${medicine.medi_id}-${medicine.slot}-${idx}`}>
                        {renderMedicineItem(medicine, idx)}
                      </React.Fragment>
                    )}
                  </View>
                );
              }).filter(Boolean);
              
              return renderedSlots.length > 0 ? renderedSlots : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.noMedicineText, { color: themeColors.text }]}>등록된 약이 없습니다.</Text>
                  <Text style={[styles.noMedicineSubText, { color: themeColors.text }]}>상단의 "약 검색" 버튼을 눌러 약을 등록해주세요.</Text>
                  </View>
                );
            })()
          ) : (
            <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
              <Text style={[styles.noMedicineText, { color: themeColors.text }]}>✨ 어서오세요! 복용중인 약이 없습니다.</Text>
              <Text style={[styles.noMedicineSubText, { color: themeColors.text }]}>상단의 "약 검색" 버튼을 눌러 약을 등록해주세요.</Text>
              <View style={[styles.emptyGuideContainer, { backgroundColor: themeColors.background }]}>
                <Text style={[styles.emptyGuideText, { color: colors.PRIMARY.DEFAULT }]}>💊 약 등록 방법:</Text>
                <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>1. 상단의 "약 검색" 버튼 클릭</Text>
                <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>2. 약 이름이나 성분으로 검색</Text>
                <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>3. 복용 스케줄 설정</Text>
                <Text style={[styles.emptyGuideStep, { color: themeColors.text }]}>4. 디스펜서 슬롯 할당</Text>
              </View>
            </View>
          )}
        </View>
        {/* 영양제 섹션 - 별도로 표시 */}
        {supplementList.length > 0 && (
          <View style={styles.supplementSection}>
            <Text style={[styles.supplementSectionTitle, { color: colors.SUCCESS.DEFAULT }]}>영양제</Text>
            {supplementList.map((supplement, idx) =>
              <React.Fragment key={`supplement-${supplement.id}-${idx}`}>
                {renderSupplementItem(supplement, idx)}
              </React.Fragment>
            )}
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
        familyMembers={familyMembers}
      />

      {/* 🔥 약물 연장 모달 */}
      <MedicineExtensionModal
        visible={extensionModalVisible}
        onClose={() => {
          setExtensionModalVisible(false);
          setMedicineToExtend(null);
        }}
        medicine={medicineToExtend}
        selectedMember={selectedMember}
        onExtensionComplete={() => {
          setExtensionModalVisible(false);
          setMedicineToExtend(null);
          loadMedicineList();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
    paddingHorizontal: 10,
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
    marginTop: Platform.OS === 'ios' ? 1 : -10,
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