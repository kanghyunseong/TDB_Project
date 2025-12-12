import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { CommonActions } from '@react-navigation/native';
import { saveSupplement, getFamilyMembers, type FamilyMember, getMedicineList, getSupplementList } from '../api/family';
import { NutritionalSupplement } from '../types/tdb';
import AgeWarningModal from '../components/AgeWarningModal';
import { validateSupplementForAge, getSupplementAgeSpecificGuidelines } from '../utils/supplementAgeValidation';
import { familyMemberToUser } from '../utils/typeAdapters';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementDetail'>;

const SupplementDetailScreen = ({ route, navigation }: Props) => {
  const { colors: themeColors, isDark } = useTheme();
  const { supplement, memberId, isParent, isStoredSupplement, storedData } = route.params;
  
  console.log('🔥 [SupplementDetailScreen] 파라미터 수신:', { 
    supplement: supplement?.PRDLST_NM, 
    memberId, 
    isParent, 
    isStoredSupplement,
    storedData: storedData?.name 
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [user, setUser] = useState<{ id: string; name: string; role: 'parent' | 'child' } | null>(null);
  
  // 🔥 의약품과 동일한 가족 구성원 관련 상태 추가
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<string[]>([]);
  const [isAllFamily, setIsAllFamily] = useState(true); // 가족 전체 복용 여부

  // 🔥 복용 기간 선택 관련 상태
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1week'); // 기본 1주일
  const [isManualInput, setIsManualInput] = useState(false); // 직접 입력 여부

  // 🔥 연령 유효성 검사 관련 상태
  const [ageValidationResults, setAgeValidationResults] = useState<Record<string, any>>({});
  const [showAgeDetailModal, setShowAgeDetailModal] = useState(false);
  const [selectedAgeUserId, setSelectedAgeUserId] = useState<string | null>(null);
  
  // 🔥 상호작용 검사 관련 상태 추가
  const [interactionResults, setInteractionResults] = useState<any>(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  
  // 🔥 알레르기 검사 관련 상태 추가  
  const [allergyResults, setAllergyResults] = useState<Record<string, any>>({});
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  
  // 🔥 복용 횟수별 유효성 검사 관련 상태 추가
  const [dosageResults, setDosageResults] = useState<Record<string, any>>({});
  const [showDosageModal, setShowDosageModal] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        setUser(userData);
        
        // 🔥 가족 구성원 로드 추가
        await loadFamilyMembers();
      }
    };
    loadUser();
  }, []);

  const loadFamilyMembers = async () => {
    try {
      const response = await getFamilyMembers();
      if (response.success) {
        setFamilyMembers(response.data || []);
        // 가족 구성원 로드 후 연령 유효성 검사 수행
        await validateFamilyMembersAge(response.data || []);
        // 🔥 알레르기 검사도 함께 수행
        await checkSupplementAllergies(response.data || []);
      }
    } catch (error) {
      console.error('가족 구성원 조회 실패:', error);
    }
  };

  // 🔥 연령 계산 함수
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

  // 🔥 가족 구성원들의 연령 유효성 검사
  const validateFamilyMembersAge = async (members: FamilyMember[]) => {
    const results: Record<string, any> = {};
    
    for (const member of members) {
      const age = member.age || calculateAge(member.birthDate || null);
      if (age !== null) {
        const validation = validateSupplementForAge(age, {
          name: supplement.PRDLST_NM,
          category: supplement.PRIMARY_FNCLTY // 주기능을 카테고리로 사용
        }, {
          strictMode: true,
          includeDetailedWarnings: true,
          checkInteractions: true
        });
        
        results[member.user_id] = {
          ...validation,
          memberName: member.name
        };
      }
    }
    
    setAgeValidationResults(results);
  };

  // 🔥 영양제 알레르기 검사 함수 추가 (간단한 버전)
  const checkSupplementAllergies = async (members: FamilyMember[]) => {
    try {
      console.log('🔍 [SupplementAllergy] 영양제 알레르기 검사 시작');
      
      const results: Record<string, any> = {};
      
      for (const member of members) {
        // 영양제 성분 추출
        const ingredients = supplement.RAWMTRL_NM || '';
        const ingredientList = ingredients.split(',').map((ing: string) => ing.trim());
        
        // 간단한 알레르기 검사 (실제로는 사용자의 알레르기 정보와 비교해야 함)
        const commonAllergens = ['대두', '우유', '견과류', '생선', '조개류', '달걀', '밀'];
        const potentialAllergens = ingredientList.filter((ing: string) => 
          commonAllergens.some(allergen => ing.includes(allergen))
        );
        
        results[member.user_id] = {
          memberName: member.name,
          potentialAllergens,
          hasRisk: potentialAllergens.length > 0,
          ingredients: ingredientList
        };
      }
      
      setAllergyResults(results);
      
      // 알레르기 위험이 있는 경우 경고 표시
      const hasAnyRisk = Object.values(results).some((result: any) => result.hasRisk);
      if (hasAnyRisk) {
        console.log('⚠️ [SupplementAllergy] 알레르기 위험 발견');
      } else {
        console.log('✅ [SupplementAllergy] 알레르기 위험 없음');
      }
      
    } catch (error) {
      console.error('🔥 [SupplementAllergy] 알레르기 검사 중 오류:', error);
    }
  };

  // 🔥 영양제 복용 횟수별 유효성 검사 함수 추가
  const checkSupplementDosage = async (members: FamilyMember[]) => {
    try {
      console.log('🔍 [SupplementDosage] 영양제 복용 횟수별 유효성 검사 시작');
      
      const results: Record<string, any> = {};
      
      for (const member of members) {
        const age = member.age || calculateAge(member.birthDate || null);
        if (age === null) continue;
        
        // 복용법 파싱 (예: "1일 1-2회, 1회 1정")
        const intakeMethod = supplement.NTK_MTHD || '';
        
        // 연령별 권장 복용량 계산
        let recommendedDailyDose = 1;
        let maxDailyDose = 2;
        let warningMessages: string[] = [];
        
        // 연령별 기본 가이드라인
        if (age < 3) {
          recommendedDailyDose = 0;
          maxDailyDose = 0;
          warningMessages.push('3세 미만은 복용을 권장하지 않습니다.');
        } else if (age < 12) {
          recommendedDailyDose = 1;
          maxDailyDose = 1;
          warningMessages.push('12세 미만은 성인 복용량의 1/2을 권장합니다.');
        } else if (age < 18) {
          recommendedDailyDose = 1;
          maxDailyDose = 2;
          warningMessages.push('18세 미만은 성인 복용량의 2/3를 권장합니다.');
        } else if (age >= 65) {
          recommendedDailyDose = 1;
          maxDailyDose = 1;
          warningMessages.push('65세 이상은 복용량 조절이 필요할 수 있습니다.');
        }
        
        // 영양제 종류별 특별 고려사항
        const primaryFunction = supplement.PRIMARY_FNCLTY || '';
        if (primaryFunction.includes('철분')) {
          if (age < 12) {
            warningMessages.push('철분 영양제는 어린이에게 과량 복용 시 위험할 수 있습니다.');
          }
        } else if (primaryFunction.includes('비타민A')) {
          if (age < 18) {
            warningMessages.push('비타민A는 성장기에 과량 복용을 주의해야 합니다.');
          }
        } else if (primaryFunction.includes('칼슘')) {
          if (age >= 50) {
            recommendedDailyDose = 2;
            warningMessages.push('50세 이상은 칼슘 흡수율이 낮아 복용량 증가 고려 가능합니다.');
          }
        }
        
        results[member.user_id] = {
          memberName: member.name,
          age,
          recommendedDailyDose,
          maxDailyDose,
          warningMessages,
          intakeMethod,
          hasWarning: warningMessages.length > 0,
          isSafe: maxDailyDose > 0
        };
      }
      
      setDosageResults(results);
      
      // 경고가 있는 경우 로그
      const hasAnyWarning = Object.values(results).some((result: any) => result.hasWarning);
      if (hasAnyWarning) {
        console.log('⚠️ [SupplementDosage] 복용량 관련 경고 발견');
      } else {
        console.log('✅ [SupplementDosage] 복용량 관련 문제 없음');
      }
      
    } catch (error) {
      console.error('🔥 [SupplementDosage] 복용량 검사 중 오류:', error);
    }
  };

  const isValidDate = (date: string) => {
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(date)) {
      return false;
    }
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

  const handleDateChange = (text: string, setDate: (date: string) => void) => {
    const numbers = text.replace(/[^0-9]/g, '');
    const limitedNumbers = numbers.slice(0, 8);
    
    if (limitedNumbers.length <= 4) {
      setDate(limitedNumbers);
    } else if (limitedNumbers.length <= 6) {
      setDate(`${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4)}`);
    } else {
      setDate(`${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4, 6)}-${limitedNumbers.slice(6)}`);
    }
  };

  const handleAddToMySupplements = async () => {
    console.log('🔥 [handleAddToMySupplements] 영양제 저장 시작:', { 
      memberId, 
      supplement: supplement?.PRDLST_NM,
      user: user?.name,
      startDate,
      endDate 
    });
    
    if (!memberId || memberId === 'undefined') {
      console.error('❌ [handleAddToMySupplements] memberId 오류:', { memberId, type: typeof memberId });
      Toast.show({ type: 'error', text1: 'memberId가 유효하지 않습니다.' });
      return;
    }
    
    if (!startDate || !endDate) {
      Toast.show({
        type: 'error',
        text1: '복용 기간을 입력해주세요.',
      });
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Toast.show({
        type: 'error',
        text1: '올바른 날짜 형식을 입력해주세요. (YYYY-MM-DD)',
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      Toast.show({
        type: 'error',
        text1: '시작일이 종료일보다 늦을 수 없습니다.',
      });
      return;
    }

    // 🔥 의약품과 동일한 복용 대상 유효성 검사
    if (!isAllFamily && selectedTargetUsers.length === 0) {
      Toast.show({
        type: 'error',
        text1: '복용할 가족 구성원을 선택해주세요.',
      });
      return;
    }

    try {
      setIsLoading(true);

      // 🔥 영양제 유효성 검사들 실행
      if (familyMembers && familyMembers.length > 0) {
        await validateFamilyMembersAge(familyMembers);
        await checkSupplementAllergies(familyMembers);
        await checkSupplementDosage(familyMembers);
      }

      const supplementData: Omit<NutritionalSupplement, 'id'> = {
        name: supplement.PRDLST_NM,
        manufacturer: supplement.BSSH_NM || '',
        ingredients: supplement.RAWMTRL_NM || '',
        primaryFunction: supplement.PRIMARY_FNCLTY || '',
        intakeMethod: supplement.NTK_MTHD || '',
        precautions: supplement.IFTKN_ATNT_MATR_CN || '',
        startDate,
        endDate,
        memberId,
        memberName: user?.name || '',
        memberType: user?.role || 'child',
        // 🔥 의약품과 동일한 복용 대상 설정
        target_users: isAllFamily ? null : selectedTargetUsers,
        dispenserSlot: undefined, // 추가 필요한 필드
      };

      console.log('영양제 저장:', supplementData);

      const result = await saveSupplement(memberId, supplementData, 'new');

      if (result) {
        Toast.show({
          type: 'success',
          text1: '영양제가 추가되었습니다.',
          text2: '메인 화면에서 확인하세요.',
        });

        // 🔥 영양제 추가 후 메인 화면으로 이동
        navigation.dispatch(
          CommonActions.navigate({
            name: 'MainTabs',
            params: { screen: 'Home' },
          })
        );
      }
    } catch (error: any) {
      console.error('영양제 저장 실패:', error);
      Toast.show({
        type: 'error',
        text1: '저장에 실패했습니다.',
        text2: error.message || '다시 시도해주세요.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세 정보</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* 저장된 영양제인 경우 추가 정보 표시 */}
        {isStoredSupplement && storedData && (
          <View style={[styles.section, { backgroundColor: colors.PRIMARY.LIGHT + '20', padding: 16, borderRadius: 12, marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Feather name="check-circle" size={20} color={colors.PRIMARY.DEFAULT} />
              <Text style={[styles.sectionTitle, { color: colors.PRIMARY.DEFAULT, marginLeft: 8, marginBottom: 0 }]}>
                등록된 영양제
              </Text>
            </View>
            
            <View style={{ gap: 4 }}>
              <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                📅 복용 기간: {storedData.start_date ? new Date(storedData.start_date).toLocaleDateString('ko-KR') : '정보 없음'} ~ {storedData.end_date ? new Date(storedData.end_date).toLocaleDateString('ko-KR') : '정보 없음'}
              </Text>
              
              {storedData.slot && (
                <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                  🏥 디스펜서 슬롯: {storedData.slot}번
                </Text>
              )}
              
              <Text style={[styles.text, { color: themeColors.text, fontSize: 14 }]}>
                👥 복용 대상: {
                  storedData.target_users === null || storedData.target_users === undefined || (Array.isArray(storedData.target_users) && storedData.target_users.length === 0)
                    ? '가족 전체'
                    : `특정 구성원 (${Array.isArray(storedData.target_users) ? storedData.target_users.length : 1}명)`
                }
              </Text>
            </View>
          </View>
        )}

        {/* 🔥 의약품과 동일한 기본 정보 섹션 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>기본 정보</Text>
          <Text style={[styles.medicineName, { color: themeColors.text }]}>{supplement.PRDLST_NM}</Text>
          <Text style={[styles.manufacturer, { color: themeColors.text }]}>제조사: {supplement.BSSH_NM}</Text>
        </View>

        {/* 주요 성분 섹션 */}
        {supplement.RAWMTRL_NM && supplement.RAWMTRL_NM !== '성분 정보 없음' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>주요 성분</Text>
            <Text style={[styles.listItem, { color: themeColors.text }]}>• {supplement.RAWMTRL_NM}</Text>
          </View>
        )}

        {/* 용법 섹션 */}
        {supplement.NTK_MTHD && supplement.NTK_MTHD !== '제품 설명서에 따라 복용하세요.' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>용법</Text>
            <Text style={[styles.text, { color: themeColors.text }]}>{supplement.NTK_MTHD}</Text>
          </View>
        )}

        {/* 기능성 섹션 */}
        {supplement.PRIMARY_FNCLTY && supplement.PRIMARY_FNCLTY !== '기능성 정보 없음' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>기능성</Text>
            <Text style={[styles.text, { color: themeColors.text }]}>{supplement.PRIMARY_FNCLTY}</Text>
          </View>
        )}

        {/* 주의사항 섹션 */}
        {supplement.IFTKN_ATNT_MATR_CN && supplement.IFTKN_ATNT_MATR_CN !== '복용 전 전문가와 상담하세요.' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>주의사항</Text>
            <Text style={[styles.listItem, { color: themeColors.text }]}>• {supplement.IFTKN_ATNT_MATR_CN}</Text>
          </View>
        )}

        {/* 정보 없음 안내 */}
        {(!supplement.RAWMTRL_NM || supplement.RAWMTRL_NM === '성분 정보 없음') && 
         (!supplement.NTK_MTHD || supplement.NTK_MTHD === '제품 설명서에 따라 복용하세요.') && 
         (!supplement.PRIMARY_FNCLTY || supplement.PRIMARY_FNCLTY === '기능성 정보 없음') && 
         (!supplement.IFTKN_ATNT_MATR_CN || supplement.IFTKN_ATNT_MATR_CN === '복용 전 전문가와 상담하세요.') && (
          <View style={styles.section}>
            <View style={[styles.noInfoContainer, { borderColor: themeColors.border }]}>
              <Feather name="info" size={24} color={isDark ? '#888' : '#999'} />
              <Text style={[styles.noInfoText, { color: isDark ? '#888' : '#999' }]}>
                이 제품에 대한 상세 정보가 없습니다.
              </Text>
              <Text style={[styles.noInfoSubText, { color: isDark ? '#888' : '#999' }]}>
                제품 포장지나 설명서를 참고해주세요.
              </Text>
            </View>
          </View>
        )}

        {/* 🔥 저장된 영양제가 아닌 경우에만 등록 관련 UI 표시 */}
        {!isStoredSupplement && (
          <>
            {/* 🔥 자식 계정 체크: 등록 관련 UI는 부모 계정에서만 표시 */}
            {user?.role === 'parent' ? (
              <>
                {/* 🔥 의약품과 동일한 복용 기간 섹션 */}
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

                {/* 🔥 연령별 안전성 정보 섹션 */}
                {familyMembers.length > 0 && Object.keys(ageValidationResults).length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>🔍 연령별 안전성 정보</Text>
                    <Text style={[styles.text, { color: themeColors.text, marginBottom: 12 }]}>
                      가족 구성원별 영양제 복용 적합성을 확인하세요
                    </Text>
                    
                    <View style={styles.ageValidationContainer}>
                      {familyMembers.map((member) => {
                        const validation = ageValidationResults[member.user_id];
                        if (!validation) return null;
                        
                        const age = member.age || calculateAge(member.birthDate || null);
                        const statusColor = validation.errors.length > 0 
                          ? '#FF3B30' 
                          : validation.warnings.length > 0 
                          ? '#FF9500' 
                          : '#34C759';
                        const statusIcon = validation.errors.length > 0 
                          ? 'close-circle' 
                          : validation.warnings.length > 0 
                          ? 'warning' 
                          : 'checkmark-circle';
                        
                        return (
                          <TouchableOpacity
                            key={member.user_id}
                            style={[
                              styles.ageValidationCard,
                              {
                                backgroundColor: themeColors.card,
                                borderColor: statusColor,
                                borderWidth: 2,
                              }
                            ]}
                            onPress={() => {
                              setSelectedAgeUserId(member.user_id);
                              setShowAgeDetailModal(true);
                            }}
                          >
                            <View style={styles.ageValidationHeader}>
                              <View style={styles.memberInfo}>
                                <Text style={[styles.memberName, { color: themeColors.text }]}>
                                  {member.name}
                                </Text>
                                <Text style={[styles.memberAge, { color: isDark ? '#888' : '#666' }]}>
                                  {age !== null ? `${age}세` : '나이 미상'}
                                </Text>
                              </View>
                              <View style={styles.statusIndicator}>
                                <Ionicons name={statusIcon} size={24} color={statusColor} />
                              </View>
                            </View>
                            
                            <View style={styles.ageValidationContent}>
                              <Text style={[styles.dosageInfo, { color: statusColor }]}>
                                {validation.adjustedDose === 0 
                                  ? '복용 금지' 
                                  : `권장 용량: 성인의 ${Math.round(validation.adjustedDose * 100)}%`}
                              </Text>
                              
                              {validation.errors.length > 0 && (
                                <Text style={[styles.warningText, { color: '#FF3B30' }]} numberOfLines={2}>
                                  ⚠️ {validation.errors[0]}
                                </Text>
                              )}
                              
                              {validation.warnings.length > 0 && validation.errors.length === 0 && (
                                <Text style={[styles.warningText, { color: '#FF9500' }]} numberOfLines={2}>
                                  💡 {validation.warnings[0]}
                                </Text>
                              )}
                              
                              <Text style={[styles.detailPrompt, { color: colors.PRIMARY.DEFAULT }]}>
                                자세히 보기 →
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 🔥 의약품과 동일한 복용 대상 선택 섹션 */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>복용 대상</Text>
                  <Text style={[styles.text, { color: themeColors.text, marginBottom: 12 }]}>
                    누가 이 영양제를 복용하나요?
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
                          모든 가족 구성원이 복용할 수 있는 영양제
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
                        const currentUserId = user?.id;
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
                          선택한 가족 구성원만 복용하는 영양제
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* 특정 구성원 선택 시 구성원 목록 표시 */}
                  {!isAllFamily && familyMembers.length > 0 && (
                    <View style={[
                      styles.memberSelectionContainer,
                      {
                        backgroundColor: isDark ? '#1f2937' : '#f8f9fa',
                        borderColor: isDark ? '#374151' : '#e9ecef',
                        borderWidth: 1,
                      }
                    ]}>
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
                        <View style={[
                          styles.selectionSummary,
                          {
                            backgroundColor: isDark ? '#1e3a1e' : '#f8f9fa',
                          }
                        ]}>
                          <Text style={[styles.selectionSummaryText, { color: colors.SUCCESS.DEFAULT }]}>
                            ✓ {selectedTargetUsers.length}명의 가족 구성원이 선택됨
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 🔥 의약품과 동일한 등록 버튼 */}
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
                  onPress={handleAddToMySupplements}
                  disabled={isLoading}
                >
                  <Text style={[styles.addButtonText, { color: colors.WHITE }]}>
                    내 영양제에 추가
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* 🔥 자식 계정일 때 안내 메시지 */
              <View style={styles.section}>
                <View style={[
                  styles.childAccountNotice,
                  {
                    backgroundColor: isDark ? '#1a2332' : '#f0f8ff',
                  }
                ]}>
                  <Feather name="info" size={24} color={colors.PRIMARY.DEFAULT} />
                  <Text style={[styles.childAccountText, { color: themeColors.text }]}>
                    영양제 등록은 보호자 계정에서만 가능합니다.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 🔥 영양제 연령별 안전성 상세 모달 */}
      {selectedAgeUserId && ageValidationResults[selectedAgeUserId] && (
        <AgeWarningModal
          visible={showAgeDetailModal}
          onClose={() => setShowAgeDetailModal(false)}
          userInfo={(() => {
            const member = familyMembers.find(m => m.user_id === selectedAgeUserId);
            return member ? familyMemberToUser(member) : null;
          })()}
          medicineInfo={{
            name: supplement.PRDLST_NM,
            id: supplement.PRDLST_NM // 영양제는 ID 대신 이름 사용
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

// 🔥 의약품과 동일한 스타일 적용
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  autoSlotInfo: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  autoSlotText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  autoSlotSubText: {
    fontSize: 12,
  },
  targetOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  targetOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  targetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  targetOptionSubtitle: {
    fontSize: 14,
  },
  memberSelectionContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
  },
  memberSelectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  memberOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  memberOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 14,
  },
  selectionSummary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.SUCCESS.DEFAULT,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  childAccountNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  childAccountText: {
    marginLeft: 12,
    fontSize: 16,
    flex: 1,
  },
  noInfoContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  noInfoText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noInfoSubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
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
  // 🔥 MedicineDetailScreen과 동일한 안내 메시지 스타일 추가
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
  // 🔥 연령 유효성 검사 관련 스타일
  ageValidationContainer: {
    gap: 12,
  },
  ageValidationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  ageValidationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAge: {
    fontSize: 12,
    color: '#666',
  },
  statusIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageValidationContent: {
    gap: 8,
  },
  dosageInfo: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
  },
  detailPrompt: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 4,
  },
});

export default SupplementDetailScreen; 