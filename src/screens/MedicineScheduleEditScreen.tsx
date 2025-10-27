import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { Medicine, DayOfWeek, TimeOfDay } from '../types/tdb';
import { User } from '../types';
import { DAYS, TIMES, DAY_LABELS, TIME_LABELS } from '../constants/schedule';
import { getMedicineSchedule, saveMedicineScheduleV3, getMedicinesByUser, getMedicineDetails } from '../api/medicine';
import { userApi } from '../api/users';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import AgeWarningModal from '../components/AgeWarningModal';
import { validateMedicineForAge as utilValidateMedicineForAge } from '../utils/ageValidation';
import { ScheduleValidationHelper } from '../utils/scheduleValidationHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'MedicineScheduleEdit'>;

interface MatrixCell {
  enabled: boolean;
  dose: number;
}

type MatrixSchedule = Record<DayOfWeek, Record<TimeOfDay, MatrixCell>>;

// 🔥 **처방 정보 파싱 인터페이스 추가**
interface PrescriptionInfo {
  dailyFrequency: number; // 1일 복용 횟수 (예: 2회)
  singleDose: number; // 1회 복용량 (예: 2정)
  totalDailyDose: number; // 1일 총 복용량 (예: 4정)
  isValid: boolean; // 파싱 성공 여부
  originalText: string; // 원본 텍스트
}

// 🔥 **종합 검증 결과 인터페이스**
interface ValidationResult {
  isValid: boolean;
  canProceed: boolean;
  errors: string[];
  warnings: string[];
  violations: {
    ageViolations: string[];
    prescriptionViolations: string[];
    scheduleViolations: string[];
  };
  recommendations: string[];
}

// 🔥 **종합 유효성 검사 함수**
const comprehensiveValidation = (
  matrixSchedule: MatrixSchedule,
  userAge: number | null,
  medicineName: string,
  prescriptionInfo: PrescriptionInfo | null
): ValidationResult => {
  console.log('🔍 [comprehensiveValidation] 종합 검증 시작:', {
    userAge,
    medicineName,
    prescriptionValid: prescriptionInfo?.isValid,
    prescriptionInfo: prescriptionInfo
  });

  const result: ValidationResult = {
    isValid: true,
    canProceed: true,
    errors: [],
    warnings: [],
    violations: {
      ageViolations: [],
      prescriptionViolations: [],
      scheduleViolations: []
    },
    recommendations: []
  };

  // 🔥 **1. 연령별 검증**
  if (userAge !== null) {
    if (userAge < 2) {
      result.errors.push('2세 미만 영아는 약물 복용이 금지됩니다.');
      result.violations.ageViolations.push('2세 미만 복용 금지');
      result.isValid = false;
      result.canProceed = false;
    } else if (userAge < 7) {
      result.warnings.push('7세 미만은 전문의 상담이 필요합니다.');
      result.violations.ageViolations.push('7세 미만 전문의 상담 필요');
      result.recommendations.push('복용 전 소아과 전문의와 상담하세요.');
    } else if (userAge >= 8 && userAge <= 14) {
      result.warnings.push('소아용 용량으로 조정이 필요합니다 (성인 용량의 50%).');
      result.violations.ageViolations.push('소아용 용량 조정 필요');
      result.recommendations.push('성인 용량의 50%로 조정하여 복용하세요.');
    }
  }

  // 🔥 **2. 처방 정보 기반 검증**
  if (prescriptionInfo && prescriptionInfo.isValid) {
    console.log('🔍 [comprehensiveValidation] 처방 정보 검증 시작');
    
    for (const day of DAYS) {
      const enabledTimes = TIMES.filter(time => matrixSchedule[day][time].enabled);
      const dailyFrequency = enabledTimes.length;
      
      console.log(`🔍 [comprehensiveValidation] ${day} 검증:`, {
        enabledTimes,
        dailyFrequency,
        prescriptionFrequency: prescriptionInfo.dailyFrequency
      });

      if (dailyFrequency > prescriptionInfo.dailyFrequency) {
        const violation = `${day}요일: ${dailyFrequency}회 설정 (처방: ${prescriptionInfo.dailyFrequency}회)`;
        result.violations.prescriptionViolations.push(violation);
        result.warnings.push(`${day}요일에 처방 횟수를 초과했습니다.`);
        console.log(`⚠️ [comprehensiveValidation] 처방 위반:`, violation);
      }

      // 🔥 **3. 복용량 검증**
      enabledTimes.forEach(time => {
        const dose = matrixSchedule[day][time].dose;
        if (prescriptionInfo.singleDose > 0 && dose !== prescriptionInfo.singleDose) {
          const doseViolation = `${day}요일 ${time}: ${dose}정 설정 (처방: ${prescriptionInfo.singleDose}정)`;
          result.violations.prescriptionViolations.push(doseViolation);
          result.recommendations.push(`${day}요일 ${time}의 복용량을 ${prescriptionInfo.singleDose}정으로 조정하세요.`);
        }
      });
    }
  }

  // 🔥 **4. 스케줄 일관성 검증**
  const scheduleDays = DAYS.filter(day => 
    TIMES.some(time => matrixSchedule[day][time].enabled)
  );
  
  if (scheduleDays.length === 0) {
    result.violations.scheduleViolations.push('복용 스케줄이 설정되지 않았습니다.');
    result.warnings.push('최소 하나의 복용 시간을 설정해주세요.');
  }

  // 🔥 **5. 최종 검증 결과**
  const totalViolations = 
    result.violations.ageViolations.length +
    result.violations.prescriptionViolations.length +
    result.violations.scheduleViolations.length;

  if (totalViolations > 0) {
    result.isValid = false;
  }

  if (result.errors.length > 0) {
    result.canProceed = false;
  }

  console.log('✅ [comprehensiveValidation] 종합 검증 완료:', {
    isValid: result.isValid,
    canProceed: result.canProceed,
    errorsCount: result.errors.length,
    warningsCount: result.warnings.length,
    totalViolations
  });

  return result;
};

// 🔥 **처방 정보 파싱 함수**
const parsePrescriptionInfo = (useMethodText: string): PrescriptionInfo => {
  console.log('🔍 [parsePrescriptionInfo] 처방 정보 파싱 시작:', { useMethodText });
  
  const defaultResult: PrescriptionInfo = {
    dailyFrequency: 0,
    singleDose: 0,
    totalDailyDose: 0,
    isValid: false,
    originalText: useMethodText || ''
  };

  if (!useMethodText) {
    console.log('❌ [parsePrescriptionInfo] 처방 텍스트가 없음');
    return defaultResult;
  }

  // "1일 2회 2정씩" 또는 "하루 3번 1정씩" 패턴 매칭 (더 강화된 패턴)
  const patterns = [
    // 🔥 가장 흔한 패턴: "1회 2정, 1일 3회" (순서 주의!)
    /1회\s*(\d+)(?:~\d+)?정[^,]*,\s*1일\s*(\d+)(?:~\d+)?회/,
    // 기본 패턴들
    /(\d+)일\s*(\d+)회\s*(\d+)정/,
    /하루\s*(\d+)번\s*(\d+)정/,
    /1일\s*(\d+)번\s*(\d+)정/,
    /매일\s*(\d+)회\s*(\d+)정/,
    // 추가 패턴들
    /일\s*(\d+)회\s*(\d+)정/,
    /(\d+)회\s*(\d+)정/,
    /(\d+)번\s*(\d+)정/,
    // 테스트용 강제 패턴 (개발 중)
    /테스트\s*(\d+)회\s*(\d+)정/,
  ];

  console.log('🔍 [parsePrescriptionInfo] 패턴 매칭 시도:', patterns.length, '개 패턴');

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = useMethodText.match(pattern);
    console.log(`🔍 [parsePrescriptionInfo] 패턴 ${i + 1} 시도:`, pattern.source, '결과:', match);
    
    if (match) {
      console.log('✅ [parsePrescriptionInfo] 매칭 성공:', { match: match, groups: match.slice(1) });
      
      let frequency, dose;
      
      // 패턴에 따른 그룹 추출 로직
      if (i === 0) {
        // 🔥 첫 번째 패턴: "1회 2정, 1일 3회" → [dose, frequency] 순서
        dose = parseInt(match[1]);
        frequency = parseInt(match[2]);
      } else if (match.length >= 4) { // 3개 그룹인 경우 (예: "1일 2회 2정")
        frequency = parseInt(match[2]);
        dose = parseInt(match[3]);
      } else if (match.length >= 3) { // 2개 그룹인 경우 (예: "2회 2정")
        frequency = parseInt(match[1]);
        dose = parseInt(match[2]);
      } else {
        console.log('❌ [parsePrescriptionInfo] 매칭 그룹 부족:', match.length);
        continue;
      }
      
      console.log('🔍 [parsePrescriptionInfo] 추출된 값:', { frequency, dose });
      
      if (frequency > 0 && dose > 0 && frequency <= 3) { // 최대 3회 제한
        const result = {
          dailyFrequency: frequency,
          singleDose: dose,
          totalDailyDose: frequency * dose,
          isValid: true,
          originalText: useMethodText
        };
        console.log('✅ [parsePrescriptionInfo] 파싱 성공:', result);
        return result;
      } else {
        console.log('❌ [parsePrescriptionInfo] 값 유효성 검사 실패:', { frequency, dose });
      }
    }
  }

  console.log('❌ [parsePrescriptionInfo] 모든 패턴 매칭 실패');
  
  // 🔥 테스트용: 강제로 처방 정보 생성 (개발 중에만 사용)
  if (useMethodText.includes('테스트') || useMethodText.includes('test')) {
    console.log('🧪 [parsePrescriptionInfo] 테스트 모드 활성화');
    return {
      dailyFrequency: 2,
      singleDose: 2,
      totalDailyDose: 4,
      isValid: true,
      originalText: '테스트: 1일 2회 2정씩'
    };
  }

  return defaultResult;
};

const MedicineScheduleEditScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // 🔥 다크모드 적용된 동적 스타일
  const dynamicStyles = {
    container: {
      backgroundColor: themeColors.background,
    },
    header: {
      backgroundColor: themeColors.card,
    },
    section: {
      backgroundColor: themeColors.card,
    },
    text: {
      color: themeColors.text,
    },
    subText: {
      color: themeColors.GRAY.DEFAULT,
    },
    cardBackground: {
      backgroundColor: isDark ? '#374151' : '#f8fafc',
    },
    saveButtonContainer: {
      backgroundColor: themeColors.card,
      borderTopColor: isDark ? '#374151' : '#f1f5f9',
    },
    modalContent: {
      backgroundColor: themeColors.card,
    },
    modalTitle: {
      color: themeColors.text,
    },
    modalSectionTitle: {
      color: themeColors.text,
    },
    modalText: {
      color: themeColors.GRAY.DEFAULT,
    },
    modalHeader: {
      borderBottomColor: isDark ? '#374151' : '#f1f5f9',
    },
    modalSection: {
      borderBottomColor: isDark ? '#374151' : '#f1f5f9',
    },
  };
  
  // route.params 구조 맞추기
  const medicineId = route.params.medicineId;
  const memberId = route.params.memberId;
  const medicineName = route.params.medicineName;
  
  // 🔥 **처방 정보 상태 추가**
  const [prescriptionInfo, setPrescriptionInfo] = useState<PrescriptionInfo | null>(null);
  const [useMethodText, setUseMethodText] = useState<string>('');
  
  // 약물 정보 상태
  const [medicine, setMedicine] = useState<{ medi_id: string; itemName: string; target_users?: string[] }>({
    medi_id: medicineId, 
    itemName: medicineName, 
    target_users: []
  });
  const [member, setMember] = useState<{ user_id: string; name: string }>({ 
    user_id: memberId, 
    name: '사용자' 
  });

  // 🔥 **추가된 상태들**
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // 현재 로그인된 사용자
  const [ageValidation, setAgeValidation] = useState<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
    adjustedDoses: Record<string, number>;
  } | null>(null);
  const [showAgeWarningModal, setShowAgeWarningModal] = useState(false);

  // 🔥 **매트릭스 상태 관리**
  const [matrixDoses, setMatrixDoses] = useState<MatrixSchedule>(() => {
    const initial: MatrixSchedule = {} as MatrixSchedule;
    for (const day of DAYS) {
      initial[day] = {} as Record<TimeOfDay, MatrixCell>;
      for (const time of TIMES) {
        initial[day][time] = { enabled: false, dose: 1 };
      }
    }
    return initial;
  });

  const [totalQuantity, setTotalQuantity] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'parent' | 'child'>('parent');

  // 🔥 **부모 총 복용량 로드 함수**
  const loadParentTotalQuantity = async (parentId?: string) => {
    try {
      console.log('🔍 [loadParentTotalQuantity] 부모 설정값 조회 시작:', { medicineId, providedParentId: parentId });
      
      // parentId가 전달되면 사용, 아니면 현재 사용자 정보에서 부모 찾기
      let parentUserId = parentId;
      
      if (!parentUserId) {
        const userJson = await AsyncStorage.getItem('@user');
        if (!userJson) {
          console.log('🔥 [loadParentTotalQuantity] 사용자 정보 없음');
          return;
        }
        
        const currentUser = JSON.parse(userJson);
        console.log('🔍 [loadParentTotalQuantity] 현재 로그인 사용자:', { 
          role: currentUser.role, 
          user_id: currentUser.user_id,
          group_id: currentUser.group_id,
          connect: currentUser.connect 
        });
        
        // 🔥 자식 계정인 경우 가족 구성원 목록에서 부모 user_id 찾기
        if (currentUser.role === 'child') {
          console.log('🔍 [loadParentTotalQuantity] 자식 계정 - 가족 구성원에서 부모 찾기 시작');
          
          try {
            // 가족 구성원 API 호출
            const { getFamilyMembers } = require('../api/family');
            const familyResponse = await getFamilyMembers();
            
            console.log('🔍 [loadParentTotalQuantity] 가족 구성원 응답:', {
              success: familyResponse.success,
              members: familyResponse.data?.map((m: any) => ({ 
                user_id: m.user_id, 
                name: m.name, 
                role: m.role 
              }))
            });
            
            if (familyResponse.success && familyResponse.data) {
              // 부모 찾기
              const parentMember = familyResponse.data.find((m: any) => m.role === 'parent');
              if (parentMember) {
                parentUserId = parentMember.user_id;
                console.log('✅ [loadParentTotalQuantity] 부모 찾음:', {
                  parent_user_id: parentUserId,
                  parent_name: parentMember.name
                });
              } else {
                console.log('❌ [loadParentTotalQuantity] 부모를 찾을 수 없음');
                parentUserId = currentUser.group_id || currentUser.connect;
              }
            } else {
              console.log('❌ [loadParentTotalQuantity] 가족 구성원 조회 실패, fallback');
              parentUserId = currentUser.group_id || currentUser.connect;
            }
          } catch (error) {
            console.error('❌ [loadParentTotalQuantity] 가족 구성원 조회 오류:', error);
            parentUserId = currentUser.group_id || currentUser.connect;
          }
        } else if (currentUser.role === 'parent') {
          // 부모 계정이지만 다른 자식의 스케줄을 관리하는 경우
          if (userInfo && userInfo.role === 'child') {
            parentUserId = currentUser.user_id; // 현재 로그인된 부모의 ID
            console.log('🔍 [loadParentTotalQuantity] 부모가 자식 관리 - 부모 ID:', parentUserId);
          } else {
            parentUserId = currentUser.user_id;
            console.log('🔍 [loadParentTotalQuantity] 부모 본인 - 부모 ID:', parentUserId);
          }
        }
      }
      
      if (!parentUserId) {
        console.log('🔥 [loadParentTotalQuantity] 부모 ID를 찾을 수 없음');
        return;
      }
      
      console.log('🔍 [loadParentTotalQuantity] 부모 ID:', { parentUserId });
      
      if (!parentUserId) {
        console.log('🔥 [loadParentTotalQuantity] 부모 ID를 찾을 수 없음');
        return;
      }
      
      // 부모의 약물 목록에서 같은 medicineId의 총 복용량 조회
      const parentMedicinesResponse = await getMedicinesByUser(parentUserId);
      console.log('🔍 [loadParentTotalQuantity] 부모 약물 목록 응답:', { 
        success: parentMedicinesResponse.success, 
        dataLength: parentMedicinesResponse.data?.length 
      });
      
      if (parentMedicinesResponse.success && parentMedicinesResponse.data) {
        console.log('🔍 [loadParentTotalQuantity] 부모 약물 목록:', 
          parentMedicinesResponse.data.map((med: any) => ({
            medi_id: med.medi_id,
            name: med.name,
            totalQuantity: med.totalQuantity
          }))
        );
        
        const parentMedicine = parentMedicinesResponse.data.find(
          (med: any) => med.medi_id === medicineId
        );
        
        console.log('🔍 [loadParentTotalQuantity] 일치하는 부모 약물:', { 
          found: !!parentMedicine,
          parentMedicine: parentMedicine ? {
            medi_id: parentMedicine.medi_id,
            name: parentMedicine.name,
            totalQuantity: parentMedicine.totalQuantity
          } : null
        });
        
        // 🔥 수정: !== '1' 조건 제거! 부모가 1로 설정해도 로드해야 함
        if (parentMedicine?.totalQuantity) {
          console.log('✅ [loadParentTotalQuantity] 부모 설정 총 복용량 로드 성공:', parentMedicine.totalQuantity);
          setTotalQuantity(parentMedicine.totalQuantity);
        } else if (parentMedicine) {
          console.log('⚠️ [loadParentTotalQuantity] 부모 약물은 있지만 totalQuantity가 없음:', parentMedicine);
          // 부모 약물은 있지만 totalQuantity가 없으면 기본값 설정
          setTotalQuantity('1');
        } else {
          console.log('❌ [loadParentTotalQuantity] 부모 약물 목록에서 medicineId를 찾을 수 없음:', medicineId);
          // 약물을 못 찾았으면 기본값 설정
          setTotalQuantity('1');
        }
      } else {
        console.log('❌ [loadParentTotalQuantity] 부모 약물 목록 조회 실패:', parentMedicinesResponse);
      }
    } catch (error) {
      console.error('🔥 [loadParentTotalQuantity] 부모 총 복용량 로드 실패:', error);
    }
  };

  // 🔥 **사용자 정보 로드 및 부모 설정값 조회**
  useEffect(() => {
    
    const loadCurrentUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          console.log('✅ 현재 로그인된 사용자 정보 로드:', user);
        }
      } catch (error) {
        console.error('🔥 현재 사용자 정보 로드 실패:', error);
      }
    };

    const loadUserInfo = async () => {
      try {
        const response = await userApi.getUser(memberId);
        if (response.success && response.data) {
          setUserInfo(response.data);
          setUserRole(response.data.role || 'parent');
          setMember(prev => ({ ...prev, name: response.data?.name || '사용자' }));
          console.log('✅ 선택된 사용자 정보 로드:', response.data);
          
          // 🔥 자녀 계정인 경우 또는 부모가 자식을 관리하는 경우 부모 설정값 조회
          if (response.data.role === 'child') {
            console.log('🔥 자식 계정 감지 - 부모 설정값 조회 시작');
            await loadParentTotalQuantity();
          }
        }
      } catch (error) {
        console.error('🔥 사용자 정보 로드 실패:', error);
      }
    };

    const loadMedicineTargetUsers = async () => {
      try {
        // 현재 사용자의 약물 목록에서 target_users 정보 조회
        const medicinesResponse = await getMedicinesByUser(memberId);
        if (medicinesResponse.success && medicinesResponse.data) {
          const targetMedicine = medicinesResponse.data.find((med: any) => med.medi_id === medicineId);
          if (targetMedicine && targetMedicine.target_users) {
                         setMedicine(prev => ({
               ...prev,
               target_users: targetMedicine.target_users || []
             }));
            console.log('🎯 약물 target_users 로드:', targetMedicine.target_users);
          }
        }
      } catch (error) {
        console.error('🔥 약물 target_users 로드 실패:', error);
      }
    };

    loadCurrentUser();
    loadUserInfo();
    loadMedicineTargetUsers();

  }, [memberId, medicineId]);

  // 🔥 **화면 진입 시 자식 계정이면 즉시 부모 설정값 조회**
  useEffect(() => {
    const initializeChildSettings = async () => {
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        const currentUser = JSON.parse(userJson);
        if (currentUser.role === 'child') {
          console.log('🔥 자식 계정 감지 - 즉시 부모 설정값 조회');
          await loadParentTotalQuantity();
        }
      }
    };

    initializeChildSettings();
  }, [medicineId]); // medicineId가 변경될 때마다 실행

  // 🔥 **부모가 자식을 관리하는 경우 부모 설정값 조회**
  useEffect(() => {
    const checkParentManaging = async () => {
      if (currentUser && userInfo && isParentManagingChild()) {
        console.log('🔥 부모가 자식 관리 - 부모 설정값 조회 시작');
        await loadParentTotalQuantity(currentUser.user_id); // 현재 로그인된 사용자(부모) ID 전달
      }
    };

    checkParentManaging();
  }, [currentUser, userInfo]);

  // 🔥 **부모가 자식을 관리하는지 판단하는 함수**
  const isParentManagingChild = (): boolean => {
    if (!currentUser || !userInfo) return false;
    
    // 현재 로그인된 사용자와 선택된 사용자가 다르고
    // 현재 로그인된 사용자가 부모인 경우
    const isDifferentUser = currentUser.user_id !== userInfo.user_id;
    const isCurrentUserParent = currentUser.role === 'parent';
    
    console.log('🔍 [isParentManagingChild] 체크:', {
      currentUserId: currentUser.user_id,
      selectedUserId: userInfo.user_id,
      isDifferentUser,
      currentUserRole: currentUser.role,
      isCurrentUserParent,
      result: isDifferentUser && isCurrentUserParent
    });
    
    return isDifferentUser && isCurrentUserParent;
  };

  // 🔥 **연령 계산 함수**
  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 🔥 **약물 연령 유효성 검사 함수**
  const validateMedicineForAge = (age: number, medicineName: string) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    let adjustedDose = 1;

    // 기본 연령 제한
    if (age < 2) {
      errors.push('2세 미만 영아는 약물 복용이 금지됩니다.');
      adjustedDose = 0;
    } else if (age < 7) {
      warnings.push('7세 미만은 전문의 상담이 필요합니다.');
      adjustedDose = 0.25;
    } else if (age >= 8 && age <= 14) {
      warnings.push('소아용 용량으로 조정됩니다 (성인 용량의 50%).');
      adjustedDose = 0.5;
    }

    // 약물명 기반 추가 검증 (기본적인 패턴)
    if (medicineName.includes('진통') && age < 6) {
      errors.push('6세 미만에게는 이 진통제가 금지됩니다.');
      adjustedDose = 0;
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      adjustedDose
    };
  };

  // 🔥 **연령 유효성 검사 실행**
  useEffect(() => {
    if (userInfo && userInfo.age !== null) {
                const age = userInfo.age || calculateAge(userInfo.birthDate || null);
      if (age !== null) {
        const validation = validateMedicineForAge(age, medicineName);
        setAgeValidation({
          ...validation,
          adjustedDoses: { default: validation.adjustedDose }
        });

        // 오류가 있으면 모달 표시
        if (validation.errors.length > 0 || validation.warnings.length > 0) {
          setShowAgeWarningModal(true);
        }
      }
    }
  }, [userInfo, medicineName]);

  // 🔥 **의약품 상세 정보 및 처방 정보 로드**
  useEffect(() => {
    const loadMedicineDetails = async () => {
      try {
        console.log('🔍 의약품 상세 정보 로드 시작:', medicine.medi_id);
        
        // 🔥 1순위: route.params에서 전달받은 처방 정보 사용
        const { useMethodQesitm: passedUseMethod } = route.params;
        if (passedUseMethod) {
          console.log('✅ 전달받은 처방 정보 사용:', passedUseMethod);
          setUseMethodText(passedUseMethod);
          
          const parsed = parsePrescriptionInfo(passedUseMethod);
          setPrescriptionInfo(parsed);
          
          if (parsed.isValid) {
            console.log('✅ 전달받은 처방 정보 파싱 성공:', {
              원본: parsed.originalText,
              일일복용횟수: parsed.dailyFrequency,
              회복용량: parsed.singleDose,
              일일총량: parsed.totalDailyDose
            });
          } else {
            console.log('⚠️ 전달받은 처방 정보 파싱 실패, API 조회 시도');
          }
          
          // 파싱 성공 시 API 호출 스킵
          if (parsed.isValid) {
            return;
          }
        }
        
        // 🔥 2순위: 테스트 모드 (개발 중에만 사용)
        if (medicine.medi_id.includes('test') || medicine.itemName.includes('테스트')) {
          console.log('🧪 테스트 모드: 강제 처방 정보 설정');
          const testPrescription = {
            dailyFrequency: 2,
            singleDose: 2,
            totalDailyDose: 4,
            isValid: true,
            originalText: '테스트: 1일 2회 2정씩'
          };
          setPrescriptionInfo(testPrescription);
          setUseMethodText(testPrescription.originalText);
          console.log('✅ 테스트 처방 정보 설정 완료:', testPrescription);
          return;
        }
        
        // 🔥 3순위: 서버 API 조회
        const detailResponse = await getMedicineDetails(medicine.medi_id);
        console.log('🔍 의약품 상세 정보 응답:', { 
          success: detailResponse.success, 
          hasData: !!detailResponse.data,
          useMethodQesitm: detailResponse.data?.useMethodQesitm 
        });
        
        if (detailResponse.success && detailResponse.data) {
          const useMethod = detailResponse.data.useMethodQesitm || '';
          console.log('🔍 원본 용법용량 텍스트:', useMethod);
          setUseMethodText(useMethod);
          
          const parsed = parsePrescriptionInfo(useMethod);
          setPrescriptionInfo(parsed);
          
          if (parsed.isValid) {
            console.log('✅ 처방 정보 파싱 성공:', {
              원본: parsed.originalText,
              일일복용횟수: parsed.dailyFrequency,
              회복용량: parsed.singleDose,
              일일총량: parsed.totalDailyDose
            });
          } else {
            console.log('⚠️ 처방 정보 파싱 실패 또는 없음:', useMethod);
            // 🔥 파싱 실패 시 테스트용 처방 정보 설정 (개발 중)
            console.log('🧪 파싱 실패로 테스트 처방 정보 적용');
            const fallbackPrescription = {
              dailyFrequency: 2,
              singleDose: 1,
              totalDailyDose: 2,
              isValid: true,
              originalText: '기본 설정: 1일 2회 1정씩'
            };
            setPrescriptionInfo(fallbackPrescription);
          }
        } else {
          console.log('❌ 의약품 상세 정보 로드 실패');
          // 🔥 API 실패 시에도 테스트용 처방 정보 설정
          console.log('🧪 API 실패로 테스트 처방 정보 적용');
          const fallbackPrescription = {
            dailyFrequency: 2,
            singleDose: 1,
            totalDailyDose: 2,
            isValid: true,
            originalText: '기본 설정: 1일 2회 1정씩'
          };
          setPrescriptionInfo(fallbackPrescription);
        }
      } catch (error) {
        console.error('🔥 의약품 상세 정보 로드 실패:', error);
        // 🔥 오류 시에도 테스트용 처방 정보 설정
        console.log('🧪 오류 발생으로 테스트 처방 정보 적용');
        const fallbackPrescription = {
          dailyFrequency: 2,
          singleDose: 1,
          totalDailyDose: 2,
          isValid: true,
          originalText: '기본 설정: 1일 2회 1정씩'
        };
        setPrescriptionInfo(fallbackPrescription);
      }
    };

    loadMedicineDetails();
  }, [medicine.medi_id]);

  // 🔥 **기존 스케줄 로드 및 부모 설정값 조회**
  useEffect(() => {
    const loadExistingSchedule = async () => {
      try {
        const response = await getMedicineSchedule(medicine.medi_id, member.user_id);
        console.log('🔍 API 응답 전체:', response);
        
        if (response.success && response.data) {
          const newMatrix = { ...matrixDoses };
          
          // 🔥 API 응답 구조 확인: schedules 배열이 있는지 체크
          const schedules = (response.data as any).schedules || response.data;
          console.log('🔍 스케줄 배열:', schedules);
          
          if (Array.isArray(schedules)) {
            // DB 스케줄을 매트릭스에 반영
            schedules.forEach((schedule: any) => {
              const day = schedule.day_of_week as DayOfWeek;
              const time = schedule.time_of_day as TimeOfDay;
              console.log(`🔍 로드 중인 스케줄: ${day} ${time}, dose=${schedule.dose}`);
              if (newMatrix[day] && newMatrix[day][time]) {
                newMatrix[day][time] = {
                  enabled: true,
                  dose: schedule.dose || 1  // 🔥 dose_count → dose로 수정
                };
              }
            });

            setMatrixDoses(newMatrix);
            console.log('✅ 기존 스케줄을 매트릭스에 로드했습니다:', newMatrix);
          }
          
          // 🔥 기존 스케줄에서 totalQuantity 로드
          const apiTotalQuantity = (response.data as any).totalQuantity;
          if (apiTotalQuantity && apiTotalQuantity !== '1' && apiTotalQuantity !== '') {
            console.log('✅ 기존 스케줄에서 totalQuantity 로드:', apiTotalQuantity);
            setTotalQuantity(apiTotalQuantity);
          } else {
            console.log('🔍 기존 스케줄에 totalQuantity 없음, 부모 설정값 조회 시도');
            // 기존 스케줄에 totalQuantity가 없거나 기본값이면 부모 설정값 조회
            if (userRole === 'child' || isParentManagingChild() || (userInfo && userInfo.role === 'child')) {
              await loadParentTotalQuantity();
            }
          }
        }
      } catch (error) {
        console.error('🔥 기존 스케줄 로드 실패:', error);
      }
    };

    loadExistingSchedule();
  }, [medicine.medi_id, member.user_id]);

  // 🔥 **빠른 설정 패턴 - 유효성 검사 포함**
  const applyQuickPattern = (pattern: 'all' | 'weekdays' | 'weekends' | 'clear') => {
    const newMatrix = { ...matrixDoses };
    let hasViolation = false;
    let violationMessages: string[] = [];

    // clear 패턴은 유효성 검사 없이 바로 적용
    if (pattern === 'clear') {
      for (const day of DAYS) {
        for (const time of TIMES) {
          newMatrix[day][time].enabled = false;
          newMatrix[day][time].dose = 0;
        }
      }
      setMatrixDoses(newMatrix);
      return;
    }

    // 처방 정보 기반 유효성 검사
    if (prescriptionInfo && prescriptionInfo.isValid) {
      console.log('🔍 [applyQuickPattern] 처방 정보 기반 유효성 검사 시작:', prescriptionInfo);
      
      for (const day of DAYS) {
        let shouldApplyToDay = false;
        
        switch (pattern) {
          case 'all':
            shouldApplyToDay = true;
            break;
          case 'weekdays':
            shouldApplyToDay = !['sat', 'sun'].includes(day);
            break;
          case 'weekends':
            shouldApplyToDay = ['sat', 'sun'].includes(day);
            break;
        }

        if (shouldApplyToDay) {
          // 해당 요일에 활성화될 시간대 수 계산
          const timesToEnable = TIMES.length; // 아침, 점심, 저녁 모두 활성화
          
          if (timesToEnable > prescriptionInfo.dailyFrequency) {
            hasViolation = true;
            const dayLabel = {
              'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 
              'fri': '금', 'sat': '토', 'sun': '일'
            }[day];
            violationMessages.push(`${dayLabel}요일: ${timesToEnable}회 → ${prescriptionInfo.dailyFrequency}회로 제한`);
          }
        }
      }

      // 유효성 검사 위반 시 경고 및 안전한 패턴 적용
      if (hasViolation) {
        Alert.alert(
          '💊 처방 정보 위반 감지',
          `${prescriptionInfo.originalText}\n\n요청하신 패턴이 일일 복용 횟수를 초과합니다:\n${violationMessages.join('\n')}\n\n처방 정보에 맞게 안전한 패턴으로 적용됩니다.`,
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '안전한 패턴 적용', 
              onPress: () => applySafeQuickPattern(pattern, newMatrix)
            }
          ]
        );
        return;
      }
    }

    // 유효성 검사 통과 시 일반 패턴 적용
    for (const day of DAYS) {
      for (const time of TIMES) {
        let shouldEnable = false;
        
        switch (pattern) {
          case 'all':
            shouldEnable = true;
            break;
          case 'weekdays':
            shouldEnable = !['sat', 'sun'].includes(day);
            break;
          case 'weekends':
            shouldEnable = ['sat', 'sun'].includes(day);
            break;
        }

        newMatrix[day][time].enabled = shouldEnable;
        if (shouldEnable && newMatrix[day][time].dose === 0) {
          newMatrix[day][time].dose = getSmartDose();
        }
      }
    }

    setMatrixDoses(newMatrix);
  };

  // 🔥 **안전한 빠른 패턴 적용 (처방 정보 준수)**
  const applySafeQuickPattern = (pattern: 'all' | 'weekdays' | 'weekends', matrix: typeof matrixDoses) => {
    if (!prescriptionInfo || !prescriptionInfo.isValid) {
      return;
    }

    for (const day of DAYS) {
      let shouldApplyToDay = false;
      
      switch (pattern) {
        case 'all':
          shouldApplyToDay = true;
          break;
        case 'weekdays':
          shouldApplyToDay = !['sat', 'sun'].includes(day);
          break;
        case 'weekends':
          shouldApplyToDay = ['sat', 'sun'].includes(day);
          break;
      }

      if (shouldApplyToDay) {
        // 허용된 횟수만큼만 활성화 (우선순위: 아침 → 점심 → 저녁)
        const allowedCount = prescriptionInfo.dailyFrequency;
        let enabledCount = 0;

        for (const time of TIMES) {
          if (enabledCount < allowedCount) {
            matrix[day][time].enabled = true;
            matrix[day][time].dose = prescriptionInfo.singleDose;
            enabledCount++;
          } else {
            matrix[day][time].enabled = false;
            matrix[day][time].dose = 0;
          }
        }
      } else {
        // 해당 요일은 모두 비활성화
        for (const time of TIMES) {
          matrix[day][time].enabled = false;
          matrix[day][time].dose = 0;
        }
      }
    }

    setMatrixDoses(matrix);
    
    Toast.show({
      type: 'info',
      text1: '처방 정보 준수',
      text2: `일일 최대 ${prescriptionInfo.dailyFrequency}회로 제한하여 적용되었습니다.`,
    });
  };

  // 🔥 **종합 검증 기반 셀 선택 제한**
  const validateCellSelection = (day: DayOfWeek, time: TimeOfDay): { canSelect: boolean; message?: string } => {
    console.log('🔍 [validateCellSelection] 셀 선택 검증 시작:', { day, time });

    if (!prescriptionInfo || !prescriptionInfo.isValid) {
      console.log('❌ [validateCellSelection] 처방 정보 없음 - 제한 없이 허용');
      return { canSelect: true }; // 처방 정보가 없으면 제한 없음
    }

    // 해당 날짜의 현재 활성화된 셀 개수 계산
    const enabledTimesForDay = TIMES.filter(t => matrixDoses[day][t].enabled);
    const currentDailyCount = enabledTimesForDay.length;

    console.log('🔍 [validateCellSelection] 현재 상태:', {
      day,
      enabledTimesForDay,
      currentDailyCount,
      prescriptionDailyFrequency: prescriptionInfo.dailyFrequency,
      shouldBlock: currentDailyCount >= prescriptionInfo.dailyFrequency
    });

    // 이미 일일 복용 횟수에 도달했는지 확인
    if (currentDailyCount >= prescriptionInfo.dailyFrequency) {
      console.log('🚫 [validateCellSelection] 일일 복용 횟수 제한 적용');
      return { 
        canSelect: false, 
        message: `${prescriptionInfo.originalText}\n\n이미 ${prescriptionInfo.dailyFrequency}회 복용 설정이 완료되었습니다.\n다른 시간대를 선택하려면 기존 설정을 해제해주세요.` 
      };
    }

    console.log('✅ [validateCellSelection] 복용 허용');
    return { canSelect: true };
  };

  // 🔥 **스마트 복용량 자동 설정**
  const getSmartDose = (): number => {
    if (prescriptionInfo && prescriptionInfo.isValid) {
      return prescriptionInfo.singleDose;
    }
    return 1; // 기본값
  };

  // 🔥 **매트릭스 셀 토글 (처방 정보 기반 스마트 제한 포함)**
  const toggleMatrixCell = (day: DayOfWeek, time: TimeOfDay) => {
    console.log('🔥 [toggleMatrixCell] 함수 시작:', { 
      day, 
      time, 
      medicineId: medicine.medi_id,
      medicineName: medicine.itemName,
      currentEnabled: matrixDoses[day][time].enabled,
      prescriptionInfo: prescriptionInfo 
    });

    // 선택하려는 셀이 이미 활성화되어 있으면 토글 허용 (해제)
    if (matrixDoses[day][time].enabled) {
      console.log('🔥 [toggleMatrixCell] 셀 비활성화 (해제)');
      setMatrixDoses(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [time]: {
            ...prev[day][time],
            enabled: false
          }
        }
      }));
      return;
    }

    // 🔥 **처방 정보 기반 제한 검증**
    const prescriptionValidation = validateCellSelection(day, time);
    if (!prescriptionValidation.canSelect && prescriptionValidation.message) {
      Alert.alert(
        '💊 복용 횟수 제한',
        prescriptionValidation.message,
        [{ text: '확인', style: 'default' }]
      );
      return;
    }

    // 🔥 **새로운 처방 정보 기반 제한만 사용**
    console.log('🔥 [toggleMatrixCell] 새로운 처방 정보 기반 제한 시스템 사용');
    const smartDose = getSmartDose();
    
    setMatrixDoses(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: {
          ...prev[day][time],
          enabled: true,
          dose: smartDose // 🔥 처방 정보 기반 스마트 복용량 적용
        }
      }
    }));
    
    // 🔥 처방 정보가 있으면 사용자에게 알림
    if (prescriptionInfo && prescriptionInfo.isValid) {
      console.log(`✅ 스마트 복용량 적용: ${smartDose}정 (처방: ${prescriptionInfo.originalText})`);
    }
  };

  // 🔥 **복용량 변경**
  const updateDose = (day: DayOfWeek, time: TimeOfDay, dose: number) => {
    if (dose < 0 || dose > 99) return;
    
    setMatrixDoses(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: {
          ...prev[day][time],
          dose: dose,
          enabled: dose > 0 ? true : prev[day][time].enabled
        }
      }
    }));
  };

  // 🔥 **통계 계산**
  const getStats = () => {
    let totalWeeklyDose = 0;
    let activeSchedules = 0;

    for (const day of DAYS) {
      for (const time of TIMES) {
        if (matrixDoses[day][time].enabled) {
          totalWeeklyDose += matrixDoses[day][time].dose;
          activeSchedules++;
        }
      }
    }

    return { totalWeeklyDose, activeSchedules };
  };

  // 🔥 **저장 함수**
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 🔥 처방 정보 기반 최종 검증
      if (prescriptionInfo && prescriptionInfo.isValid) {
        let hasViolation = false;
        for (const day of DAYS) {
          const enabledTimesForDay = TIMES.filter(t => matrixDoses[day][t].enabled);
          if (enabledTimesForDay.length > prescriptionInfo.dailyFrequency) {
            Alert.alert(
              '💊 처방 정보 위반',
              `${prescriptionInfo.originalText}\n\n${day}요일에 ${enabledTimesForDay.length}회 설정되어 있습니다.\n최대 ${prescriptionInfo.dailyFrequency}회까지만 가능합니다.`,
              [{ text: '확인', style: 'default' }]
            );
            hasViolation = true;
            break;
          }
        }
        
        if (hasViolation) {
          setIsLoading(false);
          return;
        }
      }

      // 🔥 연령 유효성 검사
      if (ageValidation && ageValidation.errors.length > 0) {
        Alert.alert(
          '복용 금지',
          '이 연령대에는 복용이 금지된 약물입니다. 전문의와 상담하세요.',
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '강제 저장', 
              style: 'destructive',
              onPress: () => saveSchedule()
            }
          ]
        );
        setIsLoading(false);
        return;
      }

      // 🔥 경고가 있는 경우 확인
      if (ageValidation && ageValidation.warnings.length > 0) {
        Alert.alert(
          '연령 관련 주의사항',
          `${ageValidation.warnings[0]}\n\n계속 진행하시겠습니까?`,
          [
            { text: '취소', style: 'cancel', onPress: () => setIsLoading(false) },
            { text: '확인', onPress: () => saveSchedule() }
          ]
        );
        return;
      }

      // 일반 저장
      await saveSchedule();
    } catch (error) {
      console.error('스케줄 저장 오류:', error);
      Toast.show({
        type: 'error',
        text1: '저장 오류',
        text2: '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 **실제 저장 함수**
  const saveSchedule = async () => {
    try {
      let finalTotalQuantity = totalQuantity;
      
      // 🔥 가족 공통 약물 판단 (target_users가 null이거나 비어있음)
      const isCommonMedicine = !medicine.target_users || medicine.target_users.length === 0;
      
      // 부모는 직접 입력한 값 사용, 자식은 부모 설정값 조회
      if (currentUser?.role === 'parent') {
        // 부모 계정: 입력한 값 그대로 사용 (자녀 약물 포함)
        if (!finalTotalQuantity || finalTotalQuantity === '') {
          finalTotalQuantity = '1'; // 기본값
        }
        console.log('✅ 부모 계정 - 직접 입력 값 사용:', finalTotalQuantity);
      } else if (currentUser?.role === 'child') {
        // 자식 계정: 항상 부모 설정값 사용 (가족 공통 약물)
        console.log('🔥 자식 계정 스케줄 저장 - 부모 설정값 최종 확인');
        console.log('🔍 약물 타입:', isCommonMedicine ? '가족 공통 약물' : '개인 약물');
        console.log('🔍 currentUser 정보:', {
          user_id: currentUser.user_id,
          group_id: currentUser.group_id,
          role: currentUser.role
        });
        
        // 🔥 부모 ID 찾기: 가족 구성원에서 부모의 실제 user_id 찾기
        let parentUserId = null;
        
        console.log('🔍 [saveSchedule] 가족 구성원에서 부모 찾기 시작');
        try {
          const { getFamilyMembers } = require('../api/family');
          const familyResponse = await getFamilyMembers();
          
          console.log('🔍 [saveSchedule] 가족 구성원 응답:', {
            success: familyResponse.success,
            members: familyResponse.data?.map((m: any) => ({ 
              user_id: m.user_id, 
              name: m.name, 
              role: m.role 
            }))
          });
          
          if (familyResponse.success && familyResponse.data) {
            const parentMember = familyResponse.data.find((m: any) => m.role === 'parent');
            if (parentMember) {
              parentUserId = parentMember.user_id;
              console.log('✅ [saveSchedule] 부모 찾음:', {
                parent_user_id: parentUserId,
                parent_name: parentMember.name
              });
            } else {
              console.log('❌ [saveSchedule] 부모를 찾을 수 없음');
            }
          }
        } catch (error) {
          console.error('❌ [saveSchedule] 가족 구성원 조회 오류:', error);
        }
        
        if (parentUserId) {
          console.log('🔍 부모 약물 목록 조회 중... (parentUserId:', parentUserId, ')');
          const parentMedicinesResponse = await getMedicinesByUser(parentUserId);
          
          console.log('🔍 부모 약물 목록 응답:', {
            success: parentMedicinesResponse.success,
            dataLength: parentMedicinesResponse.data?.length,
            mediIds: parentMedicinesResponse.data?.map((m: any) => m.medi_id)
          });
          
          if (parentMedicinesResponse.success && parentMedicinesResponse.data) {
            const parentMedicine = parentMedicinesResponse.data.find(
              (med: any) => med.medi_id === medicine.medi_id
            );
            
            console.log('🔍 부모 약물 찾기 결과:', {
              found: !!parentMedicine,
              totalQuantity: parentMedicine?.totalQuantity,
              medicineName: parentMedicine?.name,
              medi_id: parentMedicine?.medi_id
            });
            
            // 🔥 수정: !== '1' 조건 제거! 부모가 1로 설정해도 사용해야 함
            if (parentMedicine?.totalQuantity) {
              finalTotalQuantity = parentMedicine.totalQuantity;
              console.log('✅ 스케줄 저장 시 부모 설정값 사용:', finalTotalQuantity);
            } else {
              // 부모 약물이 있지만 totalQuantity가 없는 경우
              console.log('⚠️ 부모 약물은 있지만 totalQuantity 없음');
              if (!finalTotalQuantity || finalTotalQuantity === '') {
                finalTotalQuantity = '1';
              }
              console.log('⚠️ 기본값 사용:', finalTotalQuantity);
            }
          } else {
            console.log('❌ 부모 약물 목록 조회 실패 또는 데이터 없음');
            // 조회 실패 시 현재 표시된 값 유지
            if (!finalTotalQuantity || finalTotalQuantity === '') {
              finalTotalQuantity = '1';
            }
          }
        } else {
          console.log('❌ 부모 ID(group_id)를 찾을 수 없음');
          if (!finalTotalQuantity || finalTotalQuantity === '') {
            finalTotalQuantity = '1';
          }
        }
      }
      
      // totalQuantity가 여전히 비어있으면 기본값 설정
      if (!finalTotalQuantity) {
        finalTotalQuantity = '1';
      }
      
      console.log('🔥 최종 사용할 totalQuantity:', finalTotalQuantity);
      console.log('🔥 약물 타입:', isCommonMedicine ? '가족 공통 약물' : '개인 약물');
      
      const response = await saveMedicineScheduleV3(
        medicine.medi_id,
        member.user_id,
        matrixDoses,
        finalTotalQuantity,
        userInfo?.user_id  // 🔥 현재 로그인한 사용자 ID 전달
      );

      if (response.success) {
        // 🔥 타겟 정보에 따른 메시지 표시
        const isTargetedMedicine = medicine.target_users && medicine.target_users.length > 0;
        const actualTarget = response.data?.actualTargetUserId;
        const isManagingOthers = response.data?.isManagingOthersSchedule;
        
        let successMessage = '약 복용 스케줄이 성공적으로 저장되었습니다.';
        if (isManagingOthers && actualTarget) {
          successMessage = `${member.name}의 약 복용 스케줄이 성공적으로 저장되었습니다.`;
        }
        
        Toast.show({
          type: 'success',
          text1: '스케줄 저장 완료',
          text2: successMessage,
        });
        
        // 🔥 메인 화면으로 이동하면서 새로고침 플래그 전달
        navigation.navigate('MainTabs', { 
          screen: 'Home',
          params: { 
            refresh: true,
            refreshSchedule: true,
            medicineId: medicine.medi_id 
          }
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '저장 실패',
          text2: response.error?.message || '스케줄 저장에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error('실제 저장 오류:', error);
      Toast.show({
        type: 'error',
        text1: '저장 오류',
        text2: '저장 중 오류가 발생했습니다.',
      });
    }
  };



  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, dynamicStyles.container]}
      >
        {/* 헤더 */}
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, dynamicStyles.text]}>{medicine.itemName}</Text>
            <Text style={styles.headerSubtitle}>{medicineName}</Text>
            <Text style={[styles.headerMember, dynamicStyles.subText]}>👤 {userInfo?.name || member.name}</Text>
            {userInfo && (
              <Text style={styles.headerAge}>
                🎂 {userInfo.age !== null ? `${userInfo.age}세` : '나이 정보 없음'}
              </Text>
            )}
            
            {/* 🔥 관리자 정보 표시 */}
            {isParentManagingChild() && currentUser && (
              <Text style={[styles.managerInfo, { 
                color: themeColors.PRIMARY?.DEFAULT || '#007AFF',
                backgroundColor: isDark ? '#1e3a8a20' : '#f0f9ff'
              }]}>
                👨‍👩‍👧‍👦 관리자: {currentUser.name} (부모)
              </Text>
            )}
            
            {/* 🔥 약물 타입 표시 (가족 공통 vs 개인) */}
            {(() => {
              const isCommonMedicine = !medicine.target_users || medicine.target_users.length === 0;
              if (isCommonMedicine) {
                return (
                  <Text style={[styles.medicineTypeInfo, {
                    color: '#10B981',
                    backgroundColor: isDark ? '#06402920' : '#ECFDF5',
                    borderColor: isDark ? '#06402950' : '#A7F3D0'
                  }]}>
                    👨‍👩‍👧‍👦 가족 공통 약물 - 스케줄은 개별 설정, 총량은 부모가 관리
                  </Text>
                );
              } else {
                return (
                  <Text style={[styles.medicineTypeInfo, {
                    color: '#3B82F6',
                    backgroundColor: isDark ? '#1e3a8a20' : '#EFF6FF',
                    borderColor: isDark ? '#1e3a8a50' : '#BFDBFE'
                  }]}>
                    👤 개인 약물 - 부모가 스케줄과 총량 모두 관리
                  </Text>
                );
              }
            })()}
            
            {/* 🔥 타인약물 경고 표시 */}
            {medicine.target_users && medicine.target_users.length > 0 && isParentManagingChild() && (
              <Text style={[styles.targetUserWarning, {
                color: isDark ? '#fbbf24' : '#FF9500',
                backgroundColor: isDark ? '#451a0320' : '#FFF3CD',
                borderColor: isDark ? '#92400e50' : '#FFE4B5'
              }]}>
                🎯 이 약물은 {member.name}에게 할당된 전용 약물입니다
              </Text>
            )}
            
            {/* 🔥 처방 정보 기반 복용 안내 */}
            {prescriptionInfo && prescriptionInfo.isValid && (
              <Text style={styles.dosageInfo}>
                💊 {prescriptionInfo.originalText}
              </Text>
            )}
          </View>
        </View>

        {/* 🔥 연령 유효성 검사 경고 */}
        {ageValidation && (ageValidation.warnings.length > 0 || ageValidation.errors.length > 0) && (
          <View style={[
            styles.ageWarningBanner,
            ageValidation.errors.length > 0 ? styles.ageErrorBanner : styles.ageWarningOnlyBanner
          ]}>
            <Ionicons 
              name={ageValidation.errors.length > 0 ? "warning" : "information-circle"} 
              size={20} 
              color={ageValidation.errors.length > 0 ? "#FF3B30" : "#FF9500"} 
            />
            <View style={styles.ageWarningContent}>
              <Text style={[
                styles.ageWarningTitle,
                ageValidation.errors.length > 0 ? styles.ageErrorTitle : styles.ageWarningOnlyTitle
              ]}>
                {ageValidation.errors.length > 0 ? '⚠️ 복용 금지' : '⚠️ 주의 필요'}
              </Text>
              <Text style={styles.ageWarningText}>
                {ageValidation.errors.length > 0 ? ageValidation.errors[0] : ageValidation.warnings[0]}
              </Text>
              {ageValidation.adjustedDoses.default !== 1 && ageValidation.adjustedDoses.default > 0 && (
                <Text style={styles.adjustedDoseText}>
                  권장 용량: 성인 용량의 {Math.round(ageValidation.adjustedDoses.default * 100)}%
                </Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={() => setShowAgeWarningModal(true)}
              style={styles.detailButton}
            >
              <Text style={styles.detailButtonText}>자세히</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 🔥 처방 정보 표시 */}
          {prescriptionInfo && prescriptionInfo.isValid && (
            <View style={[styles.prescriptionInfoSection, dynamicStyles.section]}>
              <Text style={[styles.sectionTitle, dynamicStyles.text]}>💊 처방 정보</Text>
              <View style={[styles.prescriptionCard, dynamicStyles.cardBackground]}>
                <Text style={[styles.prescriptionOriginal, dynamicStyles.text]}>📋 {prescriptionInfo.originalText}</Text>
                <View style={styles.prescriptionDetails}>
                  <View style={styles.prescriptionDetailItem}>
                    <Text style={[styles.prescriptionDetailLabel, dynamicStyles.subText]}>일일 복용 횟수</Text>
                    <Text style={[styles.prescriptionDetailValue, dynamicStyles.text]}>{prescriptionInfo.dailyFrequency}회</Text>
                  </View>
                  <View style={styles.prescriptionDetailItem}>
                    <Text style={[styles.prescriptionDetailLabel, dynamicStyles.subText]}>1회 복용량</Text>
                    <Text style={[styles.prescriptionDetailValue, dynamicStyles.text]}>{prescriptionInfo.singleDose}정</Text>
                  </View>
                  <View style={styles.prescriptionDetailItem}>
                    <Text style={[styles.prescriptionDetailLabel, dynamicStyles.subText]}>일일 총량</Text>
                    <Text style={[styles.prescriptionDetailValue, dynamicStyles.text]}>{prescriptionInfo.totalDailyDose}정</Text>
                  </View>
                </View>
                <Text style={[styles.prescriptionNote, dynamicStyles.subText]}>
                  ℹ️ 스케줄 선택 시 이 정보에 따라 자동으로 제한됩니다
                </Text>
              </View>
            </View>
          )}

          {/* 빠른 패턴 선택 */}
          <View style={[styles.quickPatternSection, dynamicStyles.section]}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>⚡ 빠른 패턴 선택</Text>
            <View style={styles.quickPatternButtons}>
              <TouchableOpacity 
                style={[styles.quickButton, styles.allButton]} 
                onPress={() => applyQuickPattern('all')}
              >
                <Text style={styles.quickButtonText}>전체 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.weekdaysButton]} 
                onPress={() => applyQuickPattern('weekdays')}
              >
                <Text style={styles.quickButtonText}>평일만</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.weekendsButton]} 
                onPress={() => applyQuickPattern('weekends')}
              >
                <Text style={styles.quickButtonText}>주말만</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.clearButton]} 
                onPress={() => applyQuickPattern('clear')}
              >
                <Text style={styles.quickButtonText}>초기화</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 매트릭스 테이블 */}
          <View style={[styles.matrixSection, dynamicStyles.section]}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>📋 요일별 복용 스케줄</Text>
            
            {/* 🔥 도움말 텍스트 추가 */}
            <View style={[styles.helpTextContainer, dynamicStyles.cardBackground]}>
              <Text style={[styles.helpText, dynamicStyles.text]}>● 활성화됨 | ○ 비활성화됨</Text>
            </View>
            
            {/* 테이블 헤더 */}
            <View style={styles.matrixTable}>
              <View style={styles.matrixRow}>
                <View style={[styles.matrixCell, styles.headerCell, styles.dayCell]}>
                  <Text style={styles.headerCellText}>요일</Text>
                </View>
                {TIMES.map(time => (
                  <View key={time} style={[styles.matrixCell, styles.headerCell]}>
                    <Text style={styles.headerCellText}>
                      {time === 'morning' ? '🌅' : time === 'afternoon' ? '☀️' : '🌙'}
                    </Text>
                    <Text style={styles.headerCellSubtext}>
                      {TIME_LABELS[time]}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 요일별 행 */}
              {DAYS.map(day => (
                <View key={day} style={styles.matrixRow}>
                  <View style={[styles.matrixCell, styles.dayCell]}>
                    <Text style={styles.dayCellText}>
                      {DAY_LABELS[day]}
                    </Text>
                  </View>
                  {TIMES.map(time => {
                    const cell = matrixDoses[day][time];
                    return (
                      <TouchableOpacity
                        key={`${day}-${time}`}
                        style={[
                          styles.matrixCell,
                          styles.doseCell,
                          cell.enabled && styles.doseCellActive
                        ]}
                        onPress={() => toggleMatrixCell(day, time)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.doseCellContent}>
                          <Text style={[
                            styles.doseCellIcon,
                            cell.enabled && styles.doseCellIconActive
                          ]}>
                            {cell.enabled ? '●' : '○'}
                          </Text>
                          {cell.enabled && (
                            <TextInput
                              style={styles.doseInput}
                              value={cell.dose.toString()}
                              onChangeText={(text) => {
                                const dose = parseInt(text) || 0;
                                updateDose(day, time, dose);
                              }}
                              keyboardType="numeric"
                              maxLength={2}
                              placeholder="1"
                              placeholderTextColor="#999"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* 🔥 통계 섹션 */}
          <View style={[styles.statsSection, dynamicStyles.section]}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>📊 복용 통계</Text>
            <View style={[styles.statsContainer, dynamicStyles.cardBackground]}>
              <View style={styles.statsRow}>
                <View style={[styles.statItem, dynamicStyles.cardBackground]}>
                  <Text style={[styles.statLabel, dynamicStyles.subText]}>주간 총량</Text>
                  <Text style={[styles.statValue, dynamicStyles.text]}>{getStats().totalWeeklyDose}정</Text>
                </View>
                <View style={[styles.statItem, dynamicStyles.cardBackground]}>
                  <Text style={[styles.statLabel, dynamicStyles.subText]}>설정된 시간</Text>
                  <Text style={[styles.statValue, dynamicStyles.text]}>{getStats().activeSchedules}개</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 🔥 자식 계정에서는 총 복용량 섹션 전체 숨김 */}
          {currentUser?.role === 'parent' && (
            <View style={[styles.quantitySection, dynamicStyles.section]}>
              <Text style={[styles.sectionTitle, dynamicStyles.text]}>💊 총 복용량</Text>
              <TextInput
                style={[styles.quantityInput, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: isDark ? '#374151' : '#e2e8f0' }]}
                value={totalQuantity}
                onChangeText={setTotalQuantity}
                placeholder="총 복용량을 입력하세요"
                placeholderTextColor={themeColors.GRAY.DEFAULT}
                keyboardType="numeric"
                editable={true}
              />
              {isParentManagingChild() && (
                <Text style={[styles.parentManagingNote, { 
                  color: isDark ? '#94a3b8' : '#64748b',
                  backgroundColor: isDark ? '#1e3a8a10' : '#f8fafc'
                }]}>
                  👨‍👩‍👧‍👦 부모로서 자녀의 약물을 관리하고 있습니다
                </Text>
              )}
            </View>
          )}
          
          {/* 🔥 자녀 계정에서는 총 복용량 관련 UI 완전 숨김 */}
          {currentUser?.role === 'child' && (
            <View style={[styles.quantitySection, dynamicStyles.section]}>
              <Text style={[styles.sectionTitle, dynamicStyles.text]}>💊 총 복용량</Text>
              <View style={[styles.parentManagingInfo, dynamicStyles.cardBackground]}>
                <Text style={styles.parentManagingText}>
                  현재 설정: {totalQuantity || '부모 설정값 로딩 중...'}정
                </Text>
                <Text style={[styles.parentManagingNote, dynamicStyles.subText]}>
                  ℹ️ 총 복용량은 부모 계정에서만 수정할 수 있습니다
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 저장 버튼 */}
        <View style={[styles.saveButtonContainer, dynamicStyles.saveButtonContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity 
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? '저장 중...' : '스케줄 저장'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 🔥 향상된 연령 유효성 검사 모달 */}
      {ageValidation && (
        <AgeWarningModal
          visible={showAgeWarningModal}
          onClose={() => setShowAgeWarningModal(false)}
          userInfo={userInfo}
          medicineInfo={{
            name: medicineName,
            id: medicineId
          }}
          validationResult={{
            age: userInfo?.age || calculateAge(userInfo?.birthDate || null),
            isValid: ageValidation.isValid,
            warnings: ageValidation.warnings,
            errors: ageValidation.errors,
            adjustedDose: ageValidation.adjustedDoses.default
          }}
                     mode="schedule"
         />
       )}
     </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  headerMember: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  dosageInfo: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20, // 저장 버튼과 겹치지 않도록 하단 패딩 추가
  },
  prescriptionInfoSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  prescriptionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  prescriptionOriginal: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 12,
    fontWeight: '500',
  },
  prescriptionDetails: {
    gap: 8,
  },
  prescriptionDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prescriptionDetailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },  
  prescriptionDetailValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  prescriptionNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    fontStyle: 'italic',
  },
  quickPatternSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    gap: 10,  
  },
  quickPatternButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  allButton: {
    backgroundColor: '#007AFF',
  },
  weekdaysButton: {
    backgroundColor: '#34C759',
  },
  weekendsButton: {
    backgroundColor: '#FF9500',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  quickButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  matrixTable: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: '#f8fafc',
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixCell: {
    flex: 1,
    minHeight: 70,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  headerCell: {
    backgroundColor: '#007AFF',
    minHeight: 70,
  },
  headerCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerCellSubtext: {
    fontSize: 11,
    color: '#ffffff',
    marginTop: 2,
    opacity: 0.9,
    fontWeight: '500',
  },
  dayCell: {
    backgroundColor: '#007AFF',
    minWidth: 30,
    minHeight: 70,
    borderRightWidth: 2,
    borderRightColor: '#ffffff',
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  doseCell: {
    backgroundColor: '#ffffff',
  },
  doseCellActive: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  doseCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  doseCellIcon: {
    fontSize: 16,
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  doseCellIconActive: {
    color: '#007AFF',
  },
  doseInput: {
    width: 48,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 4,
  },
  statsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statItem: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  quantitySection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  quantityInputContainer: {
    gap: 12,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    fontWeight: '500',
    color: '#1e293b',
  },
  quantityInputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    borderColor: '#e2e8f0',
  },
  quantityNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  parentManagingInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
  },
  parentManagingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  parentManagingNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    // paddingBottom은 동적으로 insets를 사용하여 적용
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.1,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpTextContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  helpText: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  errorDescription: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d97706',
    marginBottom: 4,
  },
  warningDescription: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 4,
  },
  errorText: {
    color: '#dc2626',
  },
  warningText: {
    color: '#d97706',
  },
  modalButtonContainer: {
    padding: 20,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ageWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  ageErrorBanner: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  ageWarningOnlyBanner: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  ageWarningContent: {
    flex: 1,
    marginLeft: 12,
  },
  ageWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  ageErrorTitle: {
    color: '#FF3B30',
  },
  ageWarningOnlyTitle: {
    color: '#FF9500',
  },
  ageWarningText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  adjustedDoseText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  detailButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  detailButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  managerInfo: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  medicineTypeInfo: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerAge: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  targetUserWarning: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
});

export default MedicineScheduleEditScreen; 