import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { User } from '../types';
import colors from '../constants/colors';
import { getMedicineDetails, type MedicineDetail } from '../api/medicine';
import { userApi } from '../api/users';
import AgeWarningModal from '../components/AgeWarningModal';
import { validateMedicineForAge } from '../utils/ageValidation';
import { familyMemberToUser } from '../utils/typeAdapters';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { CommonActions } from '@react-navigation/native';
import { saveMedicine, getFamilyMembers, type FamilyMember } from '../api/family';
import { NewMedicine, Medicine } from '../types/tdb';
import { formatDateField } from '../utils/dateUtils';
import { getCurrentUser } from '../api/userStorage';

type Props = NativeStackScreenProps<MainStackParamList, 'MedicineDetail'>;

interface MedicineDetailScreenProps {
  route: {
    params: {
      medicineId: string;
      medicineName: string;
      memberId: string;
      isParent: boolean;
      detail: any;
    };
  };
  navigation: any;
}

const MedicineDetailScreen = ({ route, navigation }: Props) => {
  const { colors: themeColors, isDark } = useTheme();
  const { medicineId, medicineName, memberId, isParent, detail } = route.params;
  const [medicineDetail, setMedicineDetail] = useState<MedicineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [user, setUser] = useState<{ id: string; name: string; accountType: 'main' | 'sub'; uuid: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [doseCount, setDoseCount] = useState('');
  
  // 🔥 새로 추가: 가족 구성원 관련 상태
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<string[]>([]);
  const [isAllFamily, setIsAllFamily] = useState(true); // 가족 전체 복용 여부

  // 🔥 복용 기간 선택 관련 상태
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1week'); // 기본 1주일
  const [isManualInput, setIsManualInput] = useState(false); // 직접 입력 여부
  
  // 🔥 저장된 약물 정보를 위한 상태 추가
  const [storedMedicineInfo, setStoredMedicineInfo] = useState<{
    startDate?: string;
    endDate?: string;
    slot?: number;
    targetUsers?: string[] | null;
    totalQuantity?: string;
  } | null>(null);

  // 🔥 **연령 관련 새로 추가된 상태들**
  const [selectedUserInfo, setSelectedUserInfo] = useState<User | null>(null);
  const [ageValidationResults, setAgeValidationResults] = useState<{
    [userId: string]: {
      age: number | null;
      isValid: boolean;
      warnings: string[];
      errors: string[];
      adjustedDose: number;
    };
  }>({});
  const [showAgeDetailModal, setShowAgeDetailModal] = useState(false);
  const [selectedAgeUserId, setSelectedAgeUserId] = useState<string | null>(null);

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
      warnings.push('소아용 용량으로 조정됩니다.');
      adjustedDose = 0.5;
    }

    // 약물명 기반 추가 검증
    if (medicineName.includes('진통') && age < 6) {
      errors.push('6세 미만에게는 이 진통제가 금지됩니다.');
      adjustedDose = 0;
    }
    if (medicineName.includes('아스피린') && age < 16) {
      errors.push('16세 미만에게는 아스피린 복용이 권장되지 않습니다.');
      adjustedDose = 0;
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      adjustedDose
    };
  };

  // 🔥 **가족 구성원 연령 유효성 검사**
  const validateFamilyMembersAge = async () => {
    const results: { [userId: string]: any } = {};
    
    for (const member of familyMembers) {
      try {
        const response = await userApi.getUser(member.user_id);
        if (response.success && response.data) {
          const age = response.data.age || calculateAge(response.data.birthDate || null);
          if (age !== null) {
            const validation = validateMedicineForAge(age, medicineDetail?.name || '');
            results[member.user_id] = {
              age,
              ...validation
            };
          }
        }
      } catch (error) {
        console.error(`사용자 ${member.user_id} 정보 로드 실패:`, error);
      }
    }
    
    setAgeValidationResults(results);
  };

  useEffect(() => {
    console.log('🚀 [MedicineDetailScreen] useEffect 시작');
    console.log('📋 Route params 전체:', route.params);
    console.log('📋 medicineId:', medicineId, '(타입:', typeof medicineId, ')');
    console.log('📋 medicineName:', medicineName, '(타입:', typeof medicineName, ')');
    console.log('📋 memberId:', memberId, '(타입:', typeof memberId, ')');
    console.log('📋 detail:', detail ? '존재함' : '없음');
    console.log('📋 isParent:', isParent);
    
    // 🔥 의약품/영양제 구분 디버깅
    console.log('🔍 [구분 로직 디버깅]');
    console.log('🔍 medicineId.startsWith("supplement_"):', medicineId && medicineId.startsWith('supplement_'));
    console.log('🔍 medicineId.startsWith("medicine_"):', medicineId && medicineId.startsWith('medicine_'));
    console.log('🔍 medi_id 패턴 분석:', {
      isOnlyNumbers: /^\d+$/.test(medicineId || ''),
      hasKorean: /[가-힣]/.test(medicineId || ''),
      length: medicineId?.length,
      first10chars: medicineId?.substring(0, 10)
    });
    
    const loadUser = async () => {
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        setUser(userData);
        setCurrentUser(userData);
        
        // 🔥 가족 구성원 로드
        await loadFamilyMembers();
      }
    };
    loadUser();

    if (detail) {
      console.log('✅ detail 정보가 있어서 외부 API 상세정보 사용');
      // 외부 API에서 가져온 상세 정보가 있는 경우
      setMedicineDetail({
        id: detail["품목기준코드 [ITEMSEQ] "],
        name: detail["제품명 [ITEMNAME] "],
        manufacturer: detail["업체명 [ENTPNAME] "],
        ingredients: [detail["문항1(효능) [EFCYQESITM] "] || '정보 없음'],
        usage: detail["문항2(사용법) [USEMETHODQESITM] "] || '정보 없음',
        precautions: [detail["문항4(주의사항) [ATPNQESITM] "] || '정보 없음'],
        sideEffects: [detail["문항6(부작용) [SEQESITM] "] || '해당 정보는 현재 제공되지 않습니다'],
        storage: detail["문항7(보관법) [DEPOSITMETHODQESITM] "] || '해당 정보는 현재 제공되지 않습니다',
        efficacy: detail["문항1(효능) [EFCYQESITM] "] || '정보 없음',
      });
      setIsLoading(false);
    } else if (medicineId && medicineName) {
      console.log('✅ 저장된 약물 상세정보 로드:', { medicineId, medicineName });
      // 🔥 저장된 약물 정보를 먼저 로드한 후 상세정보 로드
      loadStoredMedicineInfo().then(() => {
        loadMedicineDetailByName();
      });
    } else {
      console.log('❌ 조건 불일치 - 에러 설정');
      console.log('❌ medicineId 체크:', !!medicineId, medicineId);
      console.log('❌ medicineName 체크:', !!medicineName, medicineName);
      setError('약 정보를 찾을 수 없습니다.');
      setIsLoading(false);
    }
    // 🔥 가족 구성원 로드 추가
    loadFamilyMembers();
  }, []);

  // 🔥 **가족 구성원 로드 후 연령 유효성 검사 실행**
  useEffect(() => {
    if (familyMembers.length > 0 && medicineDetail) {
      validateFamilyMembersAge();
    }
  }, [familyMembers, medicineDetail]);

  const loadMedicineDetailByName = async () => {
    try {
      console.log('🚀 [MedicineDetailScreen] loadMedicineDetailByName 시작');
      console.log('📋 검색할 약물명:', medicineName);
      console.log('📋 medicineId:', medicineId);
      console.log('📋 현재 isLoading 상태:', isLoading);
      
      setIsLoading(true);
      console.log('📞 로컬 JSON 파일에서 약 정보 검색:', medicineName);
      
      // 🔥 로컬 JSON 파일에서 검색
      console.log('📋 medicine.json 파일 로딩 시작...');
      const medicineData = require('../assets/medicine.json');
      console.log('✅ 로컬 medicine.json 로드 완료, 총 약물 수:', medicineData?.length || 0);
      
      if (!medicineData || !Array.isArray(medicineData)) {
        throw new Error('medicine.json 파일 형식이 올바르지 않습니다');
      }
      
      // 약 이름으로 검색 (부분 매칭)
      console.log('🔍 약물 검색 시작...');
      console.log('🔍 검색할 약물명:', medicineName);
      console.log('🔍 medicine.json에서 검색 시작...');
      
      const foundMedicine = medicineData.find((item: any) => {
        const itemName = item["제품명 [ITEMNAME] "];
        if (!itemName) return false;
        
        // 1. 정확히 일치하는 경우
        if (itemName === medicineName) {
          console.log('🎯 정확 매칭:', itemName);
          return true;
        }
        
        // 2. 대소문자 무시하고 정확히 일치하는 경우
        if (itemName.toLowerCase() === medicineName.toLowerCase()) {
          console.log('🎯 대소문자 무시 정확 매칭:', itemName);
          return true;
        }
        
        // 3. 부분 문자열 포함 (양방향) - 더 유연한 검색
        const nameMatch = itemName.toLowerCase().includes(medicineName.toLowerCase()) ||
                         medicineName.toLowerCase().includes(itemName.toLowerCase());
        
        if (nameMatch) {
          console.log('🎯 부분 매칭된 약물:', itemName, '←→', medicineName);
          return true;
        }
        
        // 4. 괄호, 공백, 특수문자 제거 후 매칭
        const cleanItemName = itemName.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '').replace(/[~!@#$%^&*]/g, '');
        const cleanMedicineName = medicineName.replace(/[\(\)\[\]]/g, '').replace(/\s+/g, '').replace(/[~!@#$%^&*]/g, '');
        
        if (cleanItemName.toLowerCase().includes(cleanMedicineName.toLowerCase()) ||
            cleanMedicineName.toLowerCase().includes(cleanItemName.toLowerCase())) {
          console.log('🎯 정제된 이름으로 매칭:', cleanItemName, '←→', cleanMedicineName);
          return true;
        }
        
        // 5. 💊 주성분 기반 매칭 추가 (글루타티온 예시)
        const extractMainIngredient = (name: string) => {
          const match = name.match(/\(([^)]+)\)/); // 괄호 안 내용 추출
          return match ? match[1] : '';
        };
        
        const itemIngredient = extractMainIngredient(itemName);
        const medicineIngredient = extractMainIngredient(medicineName);
        
        if (itemIngredient && medicineIngredient && 
            itemIngredient.toLowerCase().includes(medicineIngredient.toLowerCase())) {
          console.log('🎯 주성분 매칭:', itemIngredient, '←→', medicineIngredient);
          return true;
        }
        
        // 6. 💊 숫자와 단위 제거 후 약물명 부분만 매칭
        const extractDrugName = (name: string) => {
          return name.replace(/\d+(\.\d+)?(mg|g|μg|㎍|밀리그램|그램|마이크로그램)/gi, '')
                    .replace(/[\(\)\[\]]/g, '')
                    .replace(/\s+/g, '')
                    .toLowerCase();
        };
        
        const itemDrugName = extractDrugName(itemName);
        const medicineDrugName = extractDrugName(medicineName);
        
        if (itemDrugName.includes(medicineDrugName) || medicineDrugName.includes(itemDrugName)) {
          console.log('🎯 약물명 기반 매칭:', itemDrugName, '←→', medicineDrugName);
          return true;
        }
        
        return false;
      });
      
      if (foundMedicine) {
        console.log('✅ 로컬 JSON에서 약물 정보 찾음:', foundMedicine["제품명 [ITEMNAME] "]);
        
        const medicineDetail = {
          id: foundMedicine["품목기준코드 [ITEMSEQ] "] || medicineId,
          name: foundMedicine["제품명 [ITEMNAME] "] || medicineName,
          manufacturer: foundMedicine["업체명 [ENTPNAME] "] || '정보 없음',
          ingredients: [foundMedicine["문항1(효능) [EFCYQESITM] "] || '정보 없음'],
          usage: foundMedicine["문항2(사용법) [USEMETHODQESITM] "] || '정보 없음',
          precautions: [foundMedicine["문항4(주의사항) [ATPNQESITM] "] || '정보 없음'],
          sideEffects: [foundMedicine["문항6(부작용) [SEQESITM] "] || '해당 정보는 현재 제공되지 않습니다'],
          storage: foundMedicine["문항7(보관법) [DEPOSITMETHODQESITM] "] || '해당 정보는 현재 제공되지 않습니다',
          efficacy: foundMedicine["문항1(효능) [EFCYQESITM] "] || '정보 없음',
        };
        
        console.log('📋 설정할 약물 상세정보:', medicineDetail);
        setMedicineDetail(medicineDetail);
        console.log('✅ 로컬 JSON으로 약물 상세정보 설정 완료');
      } else {
        console.log('❌ 로컬 JSON에서 약물 정보를 찾을 수 없음');
        console.log('🔄 저장된 약물 정보 로드 시도...');
        
        // 저장된 약물 정보가 있는지 확인
        let storedInfo = null;
        if (storedMedicineInfo) {
          storedInfo = storedMedicineInfo;
          console.log('✅ 저장된 약물 정보 사용:', storedInfo);
        }
        
        // 🎯 저장된 정보를 포함한 의미있는 기본 정보 구성
        const ingredients = ['💊 저장된 의약품입니다'];
        let usage = '복용법: 처방전이나 약물 포장지를 확인해주세요';
        const precautions = ['⚠️ 복용 전 주의사항을 반드시 확인하세요', '⚠️ 전문의와 상담 후 복용하세요'];
        let manufacturer = '제조사 정보 없음';
        
        // 저장된 정보가 있으면 표시에 반영
        if (storedInfo) {
          if (storedInfo.slot) {
            ingredients.unshift(`🏥 디스펜서 슬롯: ${storedInfo.slot}번`);
          }
          if (storedInfo.totalQuantity) {
            manufacturer = `💊 저장된 수량: ${storedInfo.totalQuantity}개`;
          }
          if (storedInfo.startDate) {
            usage += `\n📅 복용 시작일: ${new Date(storedInfo.startDate).toLocaleDateString('ko-KR')}`;
          }
          if (storedInfo.endDate) {
            usage += `\n📅 복용 종료일: ${new Date(storedInfo.endDate).toLocaleDateString('ko-KR')}`;
          }
          if (storedInfo.targetUsers) {
            const targetText = Array.isArray(storedInfo.targetUsers) && storedInfo.targetUsers.length > 0 
              ? `특정 구성원 (${storedInfo.targetUsers.length}명)` 
              : '가족 전체';
            precautions.unshift(`👥 복용 대상: ${targetText}`);
          }
        }
        
        const defaultMedicineDetail = {
          id: medicineId,
          name: medicineName,
          manufacturer,
          ingredients,
          usage,
          precautions,
          sideEffects: ['부작용 발생 시 즉시 복용을 중단하고 전문가와 상담하세요', '📋 자세한 부작용 정보는 약물 포장지를 참고하세요'],
          storage: '서늘하고 건조한 곳에 보관하며, 직사광선을 피해주세요',
          efficacy: `💊 ${medicineName} 의 상세 효능은 처방전 또는 제품 설명서를 확인하세요`,
        };
        
        console.log('📋 기본 약물 상세정보 (저장 정보 포함):', defaultMedicineDetail);
        setMedicineDetail(defaultMedicineDetail);
      }
    } catch (error) {
      console.error('❌ 로컬 JSON 파일 로드 실패:', error);
      console.error('❌ 에러 상세:', error instanceof Error ? error.message : String(error));
      
      const errorMedicineDetail = {
        id: medicineId,
        name: medicineName,
        manufacturer: '정보 없음',
        ingredients: ['정보 없음'],
        usage: '정보 없음',
        precautions: ['정보 없음'],
        sideEffects: ['해당 정보는 현재 제공되지 않습니다'],
        storage: '해당 정보는 현재 제공되지 않습니다',
        efficacy: '정보 없음',
      };
      
      console.log('📋 에러 시 기본 약물 상세정보:', errorMedicineDetail);
      setMedicineDetail(errorMedicineDetail);
    } finally {
      console.log('🏁 loadMedicineDetailByName 완료, 로딩 상태를 false로 변경');
      setIsLoading(false);
    }
  };

  const handleAddMedicine = () => {
    navigation.navigate('MedicineEdit', {
      medicineId: 'new',
      memberId,
      medicineName: medicineDetail?.name || '',
      isParent
    });
  };

  const isValidDate = (date: string) => {
    // YYYY-MM-DD 형식 체크
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(date)) {
      return false;
    }
    // 실제 날짜로 변환해 유효한 날짜인지 확인
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  };

  // 🔥 복용 기간 옵션들 - 1주일로 제한 (연장 시스템으로 대체)
  const periodOptions = [
    { value: '1week', label: '1주일', days: 7 },
  ];

  // 🔥 선택된 기간에 따라 시작일과 종료일 자동 설정
  const updateDatesFromPeriod = (period: string) => {
    const today = new Date();
    const startDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const option = periodOptions.find(opt => opt.value === period);
    if (option) {
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + option.days - 1); // -1 to include start date
      const endDateString = endDate.toISOString().split('T')[0];
      
      setStartDate(startDateString);
      setEndDate(endDateString);
    }
  };

  // 🔥 기간 선택 변경 핸들러
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    if (!isManualInput) {
      updateDatesFromPeriod(period);
    }
  };

  // 🔥 직접 입력 모드 변경 핸들러
  const handleManualInputToggle = () => {
    const newManualInput = !isManualInput;
    setIsManualInput(newManualInput);
    
    if (!newManualInput && selectedPeriod) {
      // 직접 입력에서 자동 선택으로 변경 시 기간 재계산
      updateDatesFromPeriod(selectedPeriod);
    }
  };

  // 🔥 컴포넌트 마운트 시 기본 기간 설정
  useEffect(() => {
    if (!isManualInput && selectedPeriod && (!startDate || !endDate)) {
      updateDatesFromPeriod(selectedPeriod);
    }
  }, [selectedPeriod, isManualInput]);

  const handleAddToMyMedicines = async () => {
    if (!medicineName || !startDate || !endDate) {
      Toast.show({ type: 'error', text1: '필수 정보를 모두 입력해주세요.' });
      return;
    }

    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      const user = JSON.parse(userJson);

      // 🚨 자식 계정 사전 체크 - 클라이언트에서 미리 막기
      if (user.role === 'child') {
        Toast.show({
          type: 'error',
          text1: '약 등록 권한 없음',
          text2: '서브 계정에서는 약을 등록할 수 없습니다. 메인 계정에서 등록해주세요.',
        });
        return;
      }

      // 🔥 기기 연동 재확인
      if (!user.machine_id) {
        Toast.show({
          type: 'error',
          text1: '스마트 디스펜서가 연동되지 않았습니다.',
          text2: '설정에서 RFID 카드를 먼저 스캔해주세요.',
        });
        return;
      }

      // 날짜 형식 검증
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        Toast.show({ type: 'error', text1: '올바른 날짜 형식이 아닙니다.' });
        return;
      }

      // 🔥 target_users 결정
      let targetUsers: string[] | null = null;
      if (isAllFamily) {
        targetUsers = null; // 가족 전체 복용
      } else {
        targetUsers = selectedTargetUsers.length > 0 ? selectedTargetUsers : null;
      }

      console.log('🔥 복용 대상 설정:', {
        isAllFamily,
        selectedTargetUsers,
        finalTargetUsers: targetUsers
      });

      const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
      };

      const payload: Medicine = {
        medi_id: detail ? detail["품목기준코드 [ITEMSEQ]"] || `med_${Date.now()}` : `med_${Date.now()}`,
        group_id: user.group_id || '',
        name: medicineName, // detail["품목명"] 대신 route에서 받은 medicineName 사용
        warning: detail ? Number(detail["복약지도코드 [ADVT_CD]"]) || 0 : 0,
        start_date: formatDate(new Date()),
        end_date: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        slot: undefined,
        target_users: isAllFamily ? null : selectedTargetUsers.length > 0 ? selectedTargetUsers : null,
      };

      console.log('의약품 저장 요청 payload:', payload);
      
      // 🔥 수정: family.ts의 saveMedicine 사용 (user_id, medicineData)
      const userData = await getCurrentUser();
      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      const result = await saveMedicine(userData.user_id, payload);
      
      if (result.success) {
        const targetText = isAllFamily ? '가족 전체' : `${selectedTargetUsers.length}명`;
        Toast.show({ 
          type: 'success', 
          text1: '약 등록 완료',
          text2: `${result.data?.slot || '자동'}번 슬롯에 할당 (${targetText})`,
        });
        
        // 영양제와 동일하게 메인 화면으로 이동
        setTimeout(() => {
          navigation.dispatch(
            CommonActions.navigate({
              name: 'MainTabs',
              params: { screen: 'Home' },
            })
          );
        }, 1500);
      } else {
        throw new Error(result.error?.message || '약 저장에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('약 저장 실패:', error);
      
      // 서버에서 보낸 권한 관련 오류 메시지 처리
      if (error.message?.includes('메인 계정') || error.message?.includes('부모')) {
        Toast.show({
          type: 'error',
          text1: '약 등록 권한 없음',
          text2: '메인 계정(부모)만 약을 등록할 수 있습니다.',
        });
      } else {
      Toast.show({ 
        type: 'error', 
        text1: '약 저장 실패', 
          text2: error.message || '알 수 없는 오류가 발생했습니다.',
      });
      }
    }
  };

  const handleDateChange = (text: string, setDate: (date: string) => void) => {
    // 숫자만 추출
    const numbers = text.replace(/[^0-9]/g, '');
    
    // 8자리로 제한
    const limitedNumbers = numbers.slice(0, 8);
    
    // YYYY-MM-DD 형식으로 포맷팅
    let formatted = '';
    if (limitedNumbers.length <= 4) {
      formatted = limitedNumbers;
    } else if (limitedNumbers.length <= 6) {
      formatted = `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4)}`;
    } else {
      formatted = `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4, 6)}-${limitedNumbers.slice(6)}`;
    }

    setDate(formatted);
  };

  // 🔥 새로 추가: 가족 구성원 로드 함수
  const loadFamilyMembers = async () => {
    try {
      console.log('🔍 가족 구성원 조회 시작');
      const response = await getFamilyMembers();
      
      if (response.success && response.data) {
        setFamilyMembers(response.data);
        console.log('✅ 가족 구성원 조회 완료:', response.data.length, '명');
        
        // 기본값: 가족 전체 복용으로 설정
        setIsAllFamily(true);
        setSelectedTargetUsers([]);
      } else {
        console.error('❌ 가족 구성원 조회 실패:', response.error);
        setFamilyMembers([]);
      }
    } catch (error) {
      console.error('❌ 가족 구성원 조회 중 에러:', error);
      setFamilyMembers([]);
    }
  };

  // 🔥 날짜 포맷팅 헬퍼 함수
  const formatDateField = (dateValue: any): string => {
    if (!dateValue) return '';
    
    try {
      // 이미 문자열인 경우
      if (typeof dateValue === 'string') {
        // YYYY-MM-DD 형식인지 확인
        if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          return dateValue.split('T')[0]; // T가 있으면 시간 부분 제거
        }
        return dateValue;
      }
      
      // Date 객체인 경우
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      
      // 그 외의 경우 빈 문자열 반환
      return '';
    } catch (error) {
      console.error('날짜 포맷팅 실패:', error);
      return '';
    }
  };

  // 🔥 저장된 약물 정보 로드 함수
  const loadStoredMedicineInfo = async () => {
    try {
      console.log('🔥 저장된 약물 정보 로드 시작:', { medicineId, memberId });
      
      // 약물 목록에서 해당 약물 정보 찾기
      const { getMedicineList } = await import('../api/family');
      const medicineListResponse = await getMedicineList(memberId);
      
      if (medicineListResponse.success && medicineListResponse.data) {
        const foundMedicine = medicineListResponse.data.find((med: any) => med.medi_id === medicineId);
        
        if (foundMedicine) {
          console.log('🔥 저장된 약물 정보 찾음:', foundMedicine);
          console.log('🔥 저장된 약물명:', foundMedicine.name);
          setStoredMedicineInfo({
            startDate: formatDateField(foundMedicine.start_date),
            endDate: formatDateField(foundMedicine.end_date),
            slot: foundMedicine.slot,
            targetUsers: foundMedicine.target_users,
            totalQuantity: foundMedicine.totalQuantity,
          });
        } else {
          console.log('❌ 해당 약물을 찾을 수 없음');
          console.log('❌ 검색 대상 목록:', medicineListResponse.data.map((m: any) => ({ medi_id: m.medi_id, name: m.name })));
        }
      } else {
        console.log('❌ 약물 목록 조회 실패:', medicineListResponse);
      }
    } catch (error) {
      console.error('저장된 약물 정보 로드 실패:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세 정보</Text>
        </View>
        <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세 정보</Text>
        </View>
        <View style={[styles.errorContainer, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!medicineDetail) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세 정보</Text>
        </View>
        <View style={[styles.errorContainer, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>약 정보를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세 정보</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 🔥 저장된 약인 경우 영양제와 동일한 위치(맨 위)에 상세 정보 표시 */}
        {!detail && (
          <View style={[styles.section, { backgroundColor: colors.PRIMARY.LIGHT + '20', padding: 16, borderRadius: 12, marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Feather name="check-circle" size={20} color={colors.PRIMARY.DEFAULT} />
              <Text style={[styles.sectionTitle, { color: colors.PRIMARY.DEFAULT, marginLeft: 8, marginBottom: 0 }]}>
                {/* 🎯 medi_id 패턴으로 의약품/영양제 정확히 구분 */}
                {medicineId && medicineId.startsWith('supplement_') ? '등록된 영양제' : '등록된 의약품'}
              </Text>
            </View>
            
            <View style={{ gap: 4 }}>
              <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                📅 복용 기간: {
                  storedMedicineInfo?.startDate && storedMedicineInfo?.endDate
                    ? `${new Date(storedMedicineInfo.startDate).toLocaleDateString('ko-KR')} ~ ${new Date(storedMedicineInfo.endDate).toLocaleDateString('ko-KR')}`
                    : storedMedicineInfo ? '정보 없음' : '아직 복용 일정이 등록되지 않았습니다. '
                }
              </Text>
              
              <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                🏥 디스펜서 슬롯: {
                  storedMedicineInfo?.slot 
                    ? `${storedMedicineInfo.slot}번`
                    : storedMedicineInfo ? '정보 없음' : '등록 후 사용 가능한 슬롯에 자동 배치됩니다.'
                }
              </Text>
              
              <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                👥 복용 대상: {
                  storedMedicineInfo
                    ? (storedMedicineInfo.targetUsers === null || storedMedicineInfo.targetUsers === undefined || (Array.isArray(storedMedicineInfo.targetUsers) && storedMedicineInfo.targetUsers.length === 0)
                        ? '가족 전체'
                        : `특정 구성원 (${Array.isArray(storedMedicineInfo.targetUsers) ? storedMedicineInfo.targetUsers.length : 1}명)`)
                    : '일정 등록 후 자동으로 배정됩니다.'
                }
              </Text>

              {storedMedicineInfo?.totalQuantity && (
                <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                  💊 남은 개수: {storedMedicineInfo.totalQuantity}정
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>기본 정보</Text>
          <Text style={[styles.medicineName, { color: themeColors.text }]}>{medicineDetail.name}</Text>
          <Text style={[styles.manufacturer, { color: themeColors.text }]}>제조사: {medicineDetail.manufacturer}</Text>
        </View>

        {medicineDetail.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>주요 성분</Text>
            {medicineDetail.ingredients.map((ingredient, index) => (
              <Text key={index} style={[styles.listItem, { color: themeColors.text }]}>• {ingredient}</Text>
            ))}
          </View>
        )}

        {medicineDetail.usage && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>용법</Text>
            <Text style={[styles.text, { color: themeColors.text }]}>{medicineDetail.usage}</Text>
            
            {/* 🔥 연령별 조정 용법 표시 */}
            {Object.keys(ageValidationResults).length > 0 && (
                              <View style={[
                  styles.ageBasedDosageSection,
                  {
                    backgroundColor: isDark ? '#1f2937' : '#f8f9fa',
                    borderColor: isDark ? '#374151' : '#e9ecef',
                  }
                ]}>
                <Text style={[styles.ageBasedDosageTitle, { color: themeColors.text }]}>
                  👥 연령별 권장 용량
                </Text>
                {familyMembers.map((member) => {
                  const validation = ageValidationResults[member.user_id];
                  if (!validation) return null;

                  return (
                    <TouchableOpacity
                      key={member.user_id}
                                              style={[
                        styles.ageDosageItem,
                        {
                          backgroundColor: validation.errors.length > 0 
                            ? (isDark ? '#4c1d1d' : '#ffebee')
                            : validation.warnings.length > 0 
                            ? (isDark ? '#4a3319' : '#fff8e1')
                            : (isDark ? '#1e3a1e' : '#e8f5e8'),
                          borderColor: validation.errors.length > 0 
                            ? '#FF3B30' 
                            : validation.warnings.length > 0 
                            ? '#FF9500' 
                            : '#34C759',
                        }
                      ]}
                      onPress={() => {
                        setSelectedAgeUserId(member.user_id);
                        setShowAgeDetailModal(true);
                      }}
                    >
                                             <View style={styles.ageDosageHeader}>
                         <View style={styles.ageUserInfo}>
                           <Text style={[styles.memberName, { color: themeColors.text }]}>
                             {member.name}
                           </Text>
                           <Text style={[styles.memberAge, { color: isDark ? '#888' : '#666' }]}>
                             {validation.age}세
                           </Text>
                         </View>
                        <View style={styles.dosageInfo}>
                          {validation.errors.length > 0 ? (
                            <View style={styles.dosageStatus}>
                              <Ionicons name="close-circle" size={18} color="#FF3B30" />
                              <Text style={[styles.dosageText, { color: '#FF3B30' }]}>
                                복용 금지
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.dosageStatus}>
                              <Ionicons 
                                name={validation.warnings.length > 0 ? "warning" : "checkmark-circle"} 
                                size={18} 
                                color={validation.warnings.length > 0 ? "#FF9500" : "#34C759"} 
                              />
                              <Text style={[
                                styles.dosageText, 
                                { color: validation.warnings.length > 0 ? "#FF9500" : "#34C759" }
                              ]}>
                                {validation.adjustedDose === 1 ? '성인 용량' : `${Math.round(validation.adjustedDose * 100)}%`}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      
                      {/* 간단한 상태 표시 */}
                      <Text style={[styles.statusSummary, { color: isDark ? '#888' : '#666' }]}>
                        {validation.errors.length > 0 
                          ? validation.errors[0]
                          : validation.warnings.length > 0 
                          ? validation.warnings[0]
                          : '안전한 복용 가능'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                
                <View style={[
                  styles.ageBasedNote,
                  { borderTopColor: isDark ? '#374151' : '#e9ecef' }
                ]}>
                  <Ionicons name="information-circle" size={16} color={isDark ? '#888' : '#666'} />
                  <Text style={[styles.noteText, { color: isDark ? '#888' : '#666' }]}>
                    터치하여 상세 안내를 확인하세요
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {medicineDetail.precautions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>주의사항</Text>
            {medicineDetail.precautions.map((precaution, index) => (
              <Text key={index} style={[styles.listItem, { color: themeColors.text }]}>• {precaution}</Text>
            ))}
          </View>
        )}

        {medicineDetail.sideEffects.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>부작용</Text>
            {medicineDetail.sideEffects.map((effect, index) => (
              <Text key={index} style={[styles.listItem, { color: themeColors.text }]}>• {effect}</Text>
            ))}
          </View>
        )}

        {medicineDetail.storage && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>보관법</Text>
            <Text style={[styles.text, { color: themeColors.text }]}>{medicineDetail.storage}</Text>
          </View>
        )}

        {/* 🔥 약 검색에서 온 경우에만 등록 관련 UI 표시 */}
        {detail && (
          <>
            {/* 🔥 자식 계정 체크: 등록 관련 UI는 부모 계정에서만 표시 */}
            {currentUser?.role === 'parent' ? (
              <>
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>복용 기간</Text>
                  
                  {/* 🔥 기간 선택 옵션 */}
                  <View style={styles.periodSelection}>
                    <Text style={[styles.text, { color: themeColors.text, marginBottom: 8 }]}>
                      기간 선택
                    </Text>
                    <View style={styles.periodOptions}>
                      {periodOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.periodOption,
                            {
                              backgroundColor: selectedPeriod === option.value 
                                ? colors.PRIMARY.DEFAULT + '20' 
                                : themeColors.card,
                              borderColor: selectedPeriod === option.value 
                                ? colors.PRIMARY.DEFAULT 
                                : themeColors.border,
                            }
                          ]}
                          onPress={() => handlePeriodChange(option.value)}
                          disabled={isManualInput}
                        >
                          <Text 
                            style={[
                              styles.periodOptionText, 
                              { 
                                color: selectedPeriod === option.value 
                                  ? colors.PRIMARY.DEFAULT 
                                  : themeColors.text,
                                opacity: isManualInput ? 0.5 : 1
                              }
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 🔥 직접 입력 체크박스 */}
                  <TouchableOpacity
                    style={styles.manualInputToggle}
                    onPress={handleManualInputToggle}
                  >
                    <Feather 
                      name={isManualInput ? "check-square" : "square"} 
                      size={20} 
                      color={isManualInput ? colors.PRIMARY.DEFAULT : themeColors.text} 
                    />
                    <Text style={[styles.manualInputText, { color: themeColors.text }]}>
                      직접 입력
                    </Text>
                  </TouchableOpacity>

                  {/* 날짜 입력 필드 */}
                  <Text style={[styles.text, { color: themeColors.text, marginTop: 16 }]}>시작일</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isManualInput ? themeColors.card : (isDark ? '#333' : '#f5f5f5'),
                        color: isManualInput ? themeColors.text : (isDark ? '#888' : '#999'),
                      }
                    ]}
                    value={startDate}
                    onChangeText={(text) => handleDateChange(text, setStartDate)}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numeric"
                    editable={isManualInput}
                  />
                  <Text style={[styles.text, { marginTop: 12, color: themeColors.text }]}>종료일</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isManualInput ? themeColors.card : (isDark ? '#333' : '#f5f5f5'),
                        color: isManualInput ? themeColors.text : (isDark ? '#888' : '#999'),
                      }
                    ]}
                    value={endDate}
                    onChangeText={(text) => handleDateChange(text, setEndDate)}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numeric"
                    editable={isManualInput}
                  />
                  
                  <View style={styles.autoSlotInfo}>
                    <Text style={[styles.autoSlotText, { color: themeColors.text }]}>
                      💡 디스펜서 슬롯은 자동으로 할당됩니다
                    </Text>
                    <Text style={[styles.autoSlotSubText, { color: isDark ? '#888' : '#666' }]}>
                      등록 후 사용 가능한 슬롯에 자동 배치됩니다
                    </Text>
                  </View>
                </View>

                {/* 🔥 새로 추가: 복용 대상 선택 섹션 */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>복용 대상</Text>
                  <Text style={[styles.text, { color: themeColors.text, marginBottom: 12 }]}>
                    누가 이 약을 복용하나요?
                  </Text>
                  
                  {/* 가족 전체 복용 옵션 */}
                  <TouchableOpacity
                    style={[
                      styles.targetOption,
                      {
                        backgroundColor: isAllFamily ? colors.PRIMARY.DEFAULT + '20' : themeColors.card,
                        borderColor: isAllFamily ? colors.PRIMARY.DEFAULT : themeColors.border,
                      }
                    ]}
                    onPress={() => {
                      setIsAllFamily(true);
                      setSelectedTargetUsers([]);
                    }}
                  >
                    <View style={styles.targetOptionContent}>
                      <Feather 
                        name={isAllFamily ? "check-circle" : "circle"} 
                        size={20} 
                        color={isAllFamily ? colors.PRIMARY.DEFAULT : themeColors.text} 
                      />
                      <View style={styles.targetOptionText}>
                        <Text style={[styles.targetOptionTitle, { color: themeColors.text }]}>
                          가족 전체
                        </Text>
                        <Text style={[styles.targetOptionSubtitle, { color: isDark ? '#888' : '#666' }]}>
                          모든 가족 구성원이 복용할 수 있는 약
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* 특정 구성원 선택 옵션 */}
                  <TouchableOpacity
                    style={[
                      styles.targetOption,
                      {
                        backgroundColor: !isAllFamily ? colors.PRIMARY.DEFAULT + '20' : themeColors.card,
                        borderColor: !isAllFamily ? colors.PRIMARY.DEFAULT : themeColors.border,
                      }
                    ]}
                    onPress={() => {
                      setIsAllFamily(false);
                      if (selectedTargetUsers.length === 0 && familyMembers.length > 0) {
                        // 기본적으로 현재 사용자 선택
                        const currentUserId = currentUser?.user_id;
                        if (currentUserId) {
                          setSelectedTargetUsers([currentUserId]);
                        }
                      }
                    }}
                  >
                    <View style={styles.targetOptionContent}>
                      <Feather 
                        name={!isAllFamily ? "check-circle" : "circle"} 
                        size={20} 
                        color={!isAllFamily ? colors.PRIMARY.DEFAULT : themeColors.text} 
                      />
                      <View style={styles.targetOptionText}>
                        <Text style={[styles.targetOptionTitle, { color: themeColors.text }]}>
                          특정 구성원만
                        </Text>
                        <Text style={[styles.targetOptionSubtitle, { color: isDark ? '#888' : '#666' }]}>
                          선택한 가족 구성원만 복용하는 약
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* 특정 구성원 선택 시 구성원 목록 표시 */}
                  {!isAllFamily && familyMembers.length > 0 && (
                    <View style={styles.memberSelectionContainer}>
                      <Text style={[styles.memberSelectionTitle, { color: themeColors.text }]}>
                        복용할 가족 구성원을 선택하세요:
                      </Text>
                      {familyMembers.map((member) => (
                        <TouchableOpacity
                          key={member.user_id}
                          style={[
                            styles.memberOption,
                            {
                              backgroundColor: selectedTargetUsers.includes(member.user_id) 
                                ? colors.SUCCESS.DEFAULT + '20' 
                                : themeColors.card,
                              borderColor: selectedTargetUsers.includes(member.user_id) 
                                ? colors.SUCCESS.DEFAULT 
                                : themeColors.border,
                            }
                          ]}
                          onPress={() => {
                            const isSelected = selectedTargetUsers.includes(member.user_id);
                            if (isSelected) {
                              // 선택 해제
                              setSelectedTargetUsers(prev => prev.filter(id => id !== member.user_id));
                            } else {
                              // 선택 추가
                              setSelectedTargetUsers(prev => [...prev, member.user_id]);
                            }
                          }}
                        >
                          <View style={styles.memberOptionContent}>
                            <Feather 
                              name={selectedTargetUsers.includes(member.user_id) ? "check-square" : "square"} 
                              size={18} 
                              color={selectedTargetUsers.includes(member.user_id) ? colors.SUCCESS.DEFAULT : themeColors.text} 
                            />
                            <View style={styles.memberInfo}>
                              <Text style={[styles.memberName, { color: themeColors.text }]}>
                                {member.name}
                              </Text>
                              <Text style={[styles.memberRole, { color: isDark ? '#888' : '#666' }]}>
                                {member.role === 'parent' ? '메인 계정' : '서브 계정'} • {member.age}세
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                      
                      {/* 선택된 구성원 요약 */}
                      {selectedTargetUsers.length > 0 && (
                        <View style={styles.selectionSummary}>
                          <Text style={[styles.selectionSummaryText, { color: colors.SUCCESS.DEFAULT }]}>
                            ✓ {selectedTargetUsers.length}명의 가족 구성원이 선택됨
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
                  onPress={handleAddToMyMedicines}
                >
                  <Text style={[styles.addButtonText, { color: colors.WHITE }]}>내 약 목록에 추가</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* 자식 계정용 정보 조회 모드 */
              <View style={[styles.childAccountInfo, { 
                backgroundColor: isDark ? '#1a2332' : '#f0f8ff', 
                borderColor: '#4a90e2' 
              }]}>
                <Text style={[styles.childAccountText, { color: '#4a90e2' }]}>
                  📋 정보 조회 모드
                </Text>
                <Text style={[styles.childAccountSubText, { color: isDark ? '#888' : '#666' }]}>
                  약 정보는 자유롭게 확인할 수 있습니다.{'\n'}약 등록은 메인 계정에서만 가능합니다.
                </Text>
              </View>
            )}
          </>
        )}


      </ScrollView>

      {/* 🔥 향상된 연령별 용법 상세 모달 */}
      {selectedAgeUserId && ageValidationResults[selectedAgeUserId] && (
        <AgeWarningModal
          visible={showAgeDetailModal}
          onClose={() => setShowAgeDetailModal(false)}
          userInfo={(() => {
            const member = familyMembers.find(m => m.user_id === selectedAgeUserId);
            return member ? familyMemberToUser(member) : null;
          })()}
          medicineInfo={{
            name: medicineDetail?.name || route.params.medicineName,
            id: route.params.medicineId
          }}
          validationResult={{
            age: ageValidationResults[selectedAgeUserId].age,
            isValid: ageValidationResults[selectedAgeUserId].isValid,
            warnings: ageValidationResults[selectedAgeUserId].warnings,
            errors: ageValidationResults[selectedAgeUserId].errors,
            adjustedDose: ageValidationResults[selectedAgeUserId].adjustedDose
          }}
          mode="detail"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  manufacturer: {
    fontSize: 16,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 16,
    marginBottom: 8,
    paddingLeft: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
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
  },
  errorText: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoSlotInfo: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  autoSlotText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  autoSlotSubText: {
    fontSize: 14,
  },
  childAccountInfo: {
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  childAccountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  childAccountSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  infoMessage: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  targetOption: {
    padding: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
  },
  targetOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetOptionText: {
    marginLeft: 12,
  },
  targetOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  targetOptionSubtitle: {
    fontSize: 14,
  },
  memberSelectionContainer: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  memberSelectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  memberOption: {
    padding: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
  },
  memberOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberRole: {
    fontSize: 14,
  },
  selectionSummary: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectionSummaryText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 🔥 기간 선택 관련 스타일
  periodSelection: {
    marginBottom: 16,
  },
  periodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  periodOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  manualInputToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualInputText: {
    fontSize: 16,
    marginLeft: 8,
  },
  // 🔥 **연령별 용량 관련 스타일**
  ageBasedDosageSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  ageBasedDosageTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  ageDosageItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ageDosageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberAge: {
    fontSize: 12,
    fontWeight: '500',
  },
  ageUserInfo: {
    flex: 1,
  },
  dosageInfo: {
    alignItems: 'flex-end',
  },
  dosageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dosageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusSummary: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  ageBasedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // 🔥 **모달 관련 스타일**
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  dosageDisplay: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dosageDisplayText: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalErrorText: {
    color: '#FF3B30',
  },
  modalWarningText: {
    color: '#FF9500',
  },
  modalButtonContainer: {
    padding: 20,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MedicineDetailScreen; 

function getNutritionalSupplementDetail(medicineId: string): any {
  throw new Error('Function not implemented.');
}
