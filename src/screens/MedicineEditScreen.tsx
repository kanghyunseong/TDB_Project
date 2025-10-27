import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import { getMedicineList } from '../api/family';
import { searchMedicineByName, getMedicineDetails, saveMedicine, type MedicineSearchResult, type Medicine, type MedicineSchedule } from '../api/medicine';
import { getFamilyMembers, type FamilyMember } from '../api/family';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { mainNavigations } from '../constants/navigation';
import medicineData from '../assets/medicine.json';
import ModalSelector from 'react-native-modal-selector';
import Toast from 'react-native-toast-message';
import { DISPENSER_CONFIG } from '../constants/dispenser';

type Props = NativeStackScreenProps<MainStackParamList, 'MedicineEdit'>;

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function MedicineEditScreen({ route, navigation }: Props) {
  const { medicineId, memberId, medicineName, isParent } = route.params;
  const isNewMedicine = medicineId === 'new';

  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [medicine, setMedicine] = useState({
    name: '',
    dosage: '',
    schedule: '',
    startDate: '',
    endDate: '',
    totalQuantity: '',
    doseCount: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MedicineSearchResult[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineSearchResult | null>(null);
  const [userRole, setUserRole] = useState<'parent' | 'child'>('parent');

  useEffect(() => {
    if (!isNewMedicine) {
      loadMedicineDetails();
    }
    loadMemberInfo();
    
    // 자식 계정 권한 체크 - 새 약 추가만 제한, 조회는 허용
    const checkUserPermission = async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson) {
          const userData = JSON.parse(userJson);
          setUserRole(userData.role || 'parent');
          // 자식 계정에서 새 약 추가만 제한 (기존 약 조회/편집은 허용)
          if (userData.role === 'child' && isNewMedicine) {
            Toast.show({
              type: 'info',
              text1: '정보 조회 모드',
              text2: '약 정보는 확인 가능하지만, 등록은 메인 계정에서만 가능합니다.',
            });
            // 바로 돌아가지 않고 조회만 가능하도록 수정
            return;
          }
        }
      } catch (error) {
        console.error('사용자 권한 체크 실패:', error);
      }
    };
    
    checkUserPermission();
  }, [medicineId, isNewMedicine, navigation]);

  const loadMedicineDetails = async () => {
    try {
      setIsLoading(true);
      const response = await getMedicineList(String(memberId ?? ''));
      if (!response.success || !response.data) {
        console.error('약 정보 조회 실패:', response.error?.message);
        return;
      }
      const medicineDetails = response.data.find(m => m.medi_id === String(medicineId ?? ''));
      if (medicineDetails) {
        setMedicine({
          name: medicineDetails.name ?? '',
          dosage: '',
          schedule: '',
          startDate: typeof medicineDetails.start_date === 'string' ? medicineDetails.start_date : '',
          endDate: typeof medicineDetails.end_date === 'string' ? medicineDetails.end_date : '',
          totalQuantity: medicineDetails.totalQuantity ? String(medicineDetails.totalQuantity) : '',
          doseCount: medicineDetails.doseCount ? String(medicineDetails.doseCount) : '',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '약 정보 조회 실패';
      if (
        errorMessage !== '요청한 리소스를 찾을 수 없습니다' &&
        !errorMessage.includes('404')
      ) {
        Alert.alert('오류', '약 정보를 불러오는데 실패했습니다.');
      }
      console.error('약 정보 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberInfo = async () => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) {
        console.error('사용자 정보를 찾을 수 없습니다.');
        return;
      }
      
      const user = JSON.parse(userJson);
      const response = await getFamilyMembers();
      if (!response.success || !response.data) {
        console.error('가족 구성원 조회 실패:', response.error?.message);
        return;
      }
      const member = response.data.find(m => m.user_id === (memberId ?? ''));
      if (member) {
        setSelectedMember(member);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '멤버 정보 로드 실패';
      if (
        errorMessage !== '요청한 리소스를 찾을 수 없습니다' &&
        !errorMessage.includes('404')
      ) {
        console.error('멤버 정보 로드 실패:', error);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('알림', '검색어를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const results = await searchMedicineByName(searchQuery);
      setSearchResults(results);
    } catch (error) {
      Alert.alert('오류', '의약품 검색에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractDosageFromUseMethod = (useMethodQesitm: string | undefined): string => {
    if (!useMethodQesitm) return '1회 1정';
    
    // 1일 1~2회, 1회 1정과 같은 패턴 찾기
    const dosagePattern = /1일\s*(\d+)[~-]?(\d+)?회,?\s*1회\s*(\d+)[정|캡슐|포|미리리터|mL|정제]*/i;
    const match = useMethodQesitm.match(dosagePattern);
    
    if (match) {
      const [_, timesMin, timesMax, amount] = match;
      if (timesMax) {
        return `1일 ${timesMin}~${timesMax}회, 1회 ${amount}정`;
      } else {
        return `1일 ${timesMin}회, 1회 ${amount}정`;
      }
    }
    
    // 1회 1정과 같은 간단한 패턴 찾기
    const simplePattern = /1회\s*(\d+)[정|캡슐|포|미리리터|mL|정제]*/i;
    const simpleMatch = useMethodQesitm.match(simplePattern);
    
    if (simpleMatch) {
      const [_, amount] = simpleMatch;
      return `1회 ${amount}정`;
    }
    
    return '1회 1정';  // 기본값
  };

  const extractScheduleFromUseMethod = (useMethodQesitm: string | undefined): string => {
    if (!useMethodQesitm) return '매일';
    
    // "식후" 또는 "식사 후" 패턴 찾기
    if (useMethodQesitm.includes('식후') || useMethodQesitm.includes('식사 후')) {
      return '식후 30분';
    }
    
    // "식전" 또는 "식사 전" 패턴 찾기
    if (useMethodQesitm.includes('식전') || useMethodQesitm.includes('식사 전')) {
      return '식전 30분';
    }
    
    // "공복" 패턴 찾기
    if (useMethodQesitm.includes('공복')) {
      return '공복 시';
    }
    
    return '매일';  // 기본값
  };

  const extractDoseCountFromUseMethod = (useMethodQesitm: string | undefined): string => {
    if (!useMethodQesitm) return '';
    const match = useMethodQesitm.match(/1회\s*(\d+)/);
    return match ? match[1] : '';
  };

  // 약 이름으로 권장량 찾기
  function getDosageByItemName(itemName: string) {
    if (!Array.isArray(medicineData)) return '';
    const med = medicineData.find((m: any) => m['제품명 [ITEMNAME] '] === itemName);
    return med ? med['문항2(사용법) [USEMETHODQESITM] '] : '';
  }

  const handleSelectMedicine = async (medicine: MedicineSearchResult) => {
    setSelectedMedicine(medicine);
    setMedicine(prev => ({
      ...prev,
      name: medicine.itemName,
    }));

    try {
      setIsLoading(true);
      const details = await getMedicineDetails(medicine.itemSeq);
      
      let doseCount = '1'; // 기본값
      let dosage = '';
      
      // 404 에러가 아닌 경우에만 상세정보 사용
      if (!details?.isNotFound && details?.success && details?.data) {
        doseCount = extractDoseCountFromUseMethod(details.data.useMethodQesitm) || '1';
        dosage = getDosageByItemName(medicine.itemName) || extractDosageFromUseMethod(details.data.useMethodQesitm);
      } else {
        // 404 에러이거나 상세정보가 없는 경우 기본값 사용
        console.log('상세정보 없음 - 기본값 사용:', medicine.itemName);
        doseCount = '1';
        dosage = getDosageByItemName(medicine.itemName) || extractDosageFromUseMethod(medicine.useMethodQesitm);
      }
      
      console.log('추출된 doseCount:', doseCount);
      setMedicine(prev => ({
        ...prev,
        doseCount,
        totalQuantity: '', // 총 투입량은 항상 비워두고 사용자가 직접 입력
        dosage, // 권장량 자동 입력
      }));
    } catch (error) {
      console.error('상세정보 조회 중 오류:', error);
      // 에러 발생 시 기본값 사용
      setMedicine(prev => ({ 
        ...prev, 
        doseCount: '1', 
        totalQuantity: '',
        dosage: getDosageByItemName(medicine.itemName) || extractDosageFromUseMethod(medicine.useMethodQesitm)
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!selectedMedicine) return;

    try {
      setIsLoading(true);
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      const user = JSON.parse(userJson);
      const response = await getFamilyMembers();
      if (!response.success || !response.data) {
        throw new Error('가족 구성원 정보를 찾을 수 없습니다.');
      }
      const member = response.data.find(m => m.user_id === (memberId ?? ''));
      if (!member) {
        throw new Error('가족 구성원 정보를 찾을 수 없습니다.');
      }
      const mainUserId = user.accountType === 'parent' ? user.id : user.parentUuid;
      // 자녀의 약을 등록할 때 총량과 복용량 필수 체크
      if (member.role !== 'parent' && (!medicine.totalQuantity?.trim() || !medicine.doseCount?.trim())) {
        Alert.alert('필수 정보 누락', 
          `자녀(${member.name})의 약을 등록할 때는 다음 정보가 필요합니다:\n\n• 총 투입량 (예: 30정)\n• 1회 복용량 (예: 1정)\n\n위 정보를 입력한 후 다시 시도해주세요.`);
        setIsLoading(false);
        return;
      }
      
      // 부모 자신의 약인 경우에도 기본값 설정
      if (member.role === 'parent' && (!medicine.totalQuantity?.trim() || !medicine.doseCount?.trim())) {
        if (!medicine.totalQuantity?.trim()) {
          setMedicine(prev => ({ ...prev, totalQuantity: '30' })); // 기본값
        }
        if (!medicine.doseCount?.trim()) {
          setMedicine(prev => ({ ...prev, doseCount: '1' })); // 기본값
        }
      }
      
      // 🚨 자식 계정 체크 추가
      if (user.role === 'child') {
        Toast.show({
          type: 'info',
          text1: '등록 권한 없음',
          text2: '약 등록은 메인 계정에서만 가능합니다. 정보 조회는 자유롭게 하세요.',
        });
        setIsLoading(false);
        return;
      }
      const dosage = extractDosageFromUseMethod(selectedMedicine.useMethodQesitm);
      const schedule = extractScheduleFromUseMethod(selectedMedicine.useMethodQesitm);
      console.log('저장 직전:', {
        name: selectedMedicine.itemName,
        dosage,
        schedule,
        startDate: medicine.startDate,
        endDate: medicine.endDate,
        totalQuantity: medicine.totalQuantity,
        doseCount: medicine.doseCount,
        memberName: member.name,
        memberType: member.role === 'parent' ? 'parent' : 'child',
        memberId: member.user_id,
      });
      const medicineData: Omit<Medicine, 'id'> = {
        medi_id: selectedMedicine.itemSeq,
        name: selectedMedicine.itemName,
        warning: 0,
        slot: undefined, // 자동 할당을 위해 undefined로 설정
        totalQuantity: medicine.totalQuantity,
        doseCount: medicine.doseCount,
        start_date: medicine.startDate,
        end_date: medicine.endDate,
        memberName: member.name,
        memberType: member.role === 'parent' ? 'parent' : 'child',
        user_id: mainUserId,
        group_id: user.group_id, // 그룹 기반에서 필요
      };
      const result = await saveMedicine(medicineData);
      
      if (result.success) {
        Alert.alert('성공', `복용 목록에 추가되었습니다. ${result.data?.slot || '자동'}번 슬롯에 할당되었습니다.`, [
          {
            text: '확인',
            onPress: () => {
              navigation.navigate(mainNavigations.MEDICINE_SCHEDULE_EDIT, {
                medicineId: medicineId ?? 'new',
                memberId: memberId ?? '',
                medicineName: selectedMedicine.itemName,
                slot: result.data?.slot || 1,
              });
            },
          },
        ]);
      } else {
        throw new Error(result.error?.message || '약 저장에 실패했습니다.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '약 정보 저장 실패';
      if (
        errorMessage !== '요청한 리소스를 찾을 수 없습니다' &&
        !errorMessage.includes('404')
      ) {
        Alert.alert('오류', '약 정보 저장에 실패했습니다.');
      }
      console.error('약 정보 저장 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      const user = JSON.parse(userJson);

      const updatedMedicine: Omit<Medicine, 'id'> = {
        medi_id: medicineId === 'new' ? '' : String(medicineId),
        group_id: user.group_id || memberId || '',
        name: medicine.name,
        warning: 0,
        start_date: medicine.startDate,
        end_date: medicine.endDate,
        totalQuantity: medicine.totalQuantity,
        doseCount: medicine.doseCount,
        slot: undefined, // 자동 할당을 위해 undefined로 설정
        memberName: selectedMember?.name,
        memberType: selectedMember?.role === 'parent' ? 'parent' : 'child',
        user_id: selectedMember?.user_id,
      };
      const result = await saveMedicine(updatedMedicine);
      
      if (result.success) {
        Alert.alert('성공', `약 정보가 업데이트되었습니다. ${result.data?.slot || '자동'}번 슬롯에 할당되었습니다.`);
        navigation.goBack();
      } else {
        throw new Error(result.error?.message || '약 정보 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('약 정보 업데이트 실패:', error);
      Alert.alert('오류', '약 정보 업데이트에 실패했습니다.');
    }
  };

  const validateForm = () => {
    if (!medicine.name.trim()) {
      Alert.alert('알림', '약 이름을 입력해주세요.');
      return false;
    } 
    if (!medicine.dosage.trim()) {
      Alert.alert('알림', '복용량을 입력해주세요.');
      return false;
    }
    if (!medicine.schedule.trim()) {
      Alert.alert('알림', '복용 시간을 입력해주세요.');
      return false;
    }
    if (!medicine.startDate.trim()) {
      Alert.alert('알림', '시작일을 입력해주세요.');
      return false;
    }
    if (!medicine.endDate.trim()) {
      Alert.alert('알림', '종료일을 입력해주세요.');
      return false;
    }
    if (!medicine.totalQuantity.trim()) {
      Alert.alert('알림', '총 투입량을 입력해주세요.');
      return false;
    }
    if (!medicine.doseCount.trim()) {
      Alert.alert('알림', '1회 복용량을 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      const user = JSON.parse(userJson);
      
      // 🔥 슬롯 제한 체크 (새로운 약물인 경우에만)
      if (medicineId === 'new') {
        try {
          const medicineListResponse = await getMedicineList(user.user_id);
          if (medicineListResponse.success && medicineListResponse.data) {
            const existingMedicines = medicineListResponse.data;
            const usedSlots = new Set(existingMedicines.map(m => m.slot).filter(slot => slot !== null && slot !== undefined));
            
            console.log('🔍 현재 사용 중인 슬롯:', Array.from(usedSlots));
            console.log('🔍 최대 슬롯 수:', DISPENSER_CONFIG.MAX_SLOTS);
            
            if (usedSlots.size >= DISPENSER_CONFIG.MAX_SLOTS) {
              Alert.alert(
                '슬롯 부족', 
                `디스펜서에 빈 슬롯이 없습니다. (최대 ${DISPENSER_CONFIG.MAX_SLOTS}개)\n기존 약물을 삭제한 후 다시 시도해주세요.`,
                [{ text: '확인' }]
              );
              return;
            }
          }
        } catch (error) {
          console.error('슬롯 체크 실패:', error);
          // 슬롯 체크 실패는 저장을 막지 않음 (서버에서도 체크함)
        }
      }
      
      const response = await getFamilyMembers();
      if (!response.success || !response.data) {
        throw new Error('가족 구성원 정보를 찾을 수 없습니다.');
      }
      
      const member = response.data.find(m => m.user_id === (memberId ?? ''));
      if (!member) {
        throw new Error('가족 구성원 정보를 찾을 수 없습니다.');
      }
      
      const mainUserId = user.accountType === 'parent' ? user.id : user.parentUuid;
      
      const medicineData: Omit<Medicine, 'id'> = {
        medi_id: medicineId === 'new' ? '' : String(medicineId),
        group_id: user.group_id || memberId || '',
        name: medicine.name,
        warning: 0,
        start_date: medicine.startDate,
        end_date: medicine.endDate,
        totalQuantity: medicine.totalQuantity,
        doseCount: medicine.doseCount,
        memberName: member.name,
        memberType: member.role === 'parent' ? 'parent' : 'child',
        slot: undefined, // 자동 할당을 위해 undefined로 설정
        user_id: mainUserId,
      };

      const result = await saveMedicine(medicineData);
      
      if (result.success) {
        Alert.alert('성공', `약 정보가 저장되었습니다. ${result.data?.slot || '자동'}번 슬롯에 할당되었습니다.`, [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error(result.error?.message || '약 정보 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('약 정보 저장 실패:', error);
      Alert.alert('오류', '약 정보 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (text: string, field: 'startDate' | 'endDate') => {
    // 숫자만 추출
    const numbers = text.replace(/[^\d]/g, '');
    
    let formatted = numbers;
    
    // YYYY-MM-DD 형식으로 변환
    if (numbers.length > 4) {
      formatted = `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}`;
    }
    if (numbers.length > 6) {
      formatted = `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
    }
    
    // 최대 10자리까지만 허용 (YYYY-MM-DD)
    if (formatted.length > 10) {
      formatted = formatted.slice(0, 10);
    }
    
    setMedicine(prev => ({ ...prev, [field]: formatted }));
  };

  const handleScheduleUpdate = async (updatedSchedules: Record<string, MedicineSchedule>) => {
    try {
      setIsLoading(true);
      const scheduleData = updatedSchedules[medicineId ?? ''];
      if (!scheduleData) {
        throw new Error('스케줄 데이터를 찾을 수 없습니다.');
      }
      await saveMedicineSchedule(memberId ?? '', scheduleData);
      Toast.show({
        type: 'success',
        text1: '스케줄 업데이트 완료',
        text2: '약 복용 스케줄이 저장되었습니다.',
        position: 'bottom',
      });
    } catch (error) {
      console.error('스케줄 업데이트 실패:', error);
      Toast.show({
        type: 'error',
        text1: '스케줄 업데이트 실패',
        text2: '약 복용 스케줄 저장 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSearchForm = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="의약품 이름을 입력하세요"
          placeholderTextColor={colors.GRAY.LIGHT}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isLoading}
        >
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && !selectedMedicine && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>검색 결과</Text>
          {searchResults.map((medicine) => (
            <View key={medicine.itemSeq} style={styles.resultItemRow}>
              <TouchableOpacity
                style={[styles.resultItem]}
                onPress={() => {
                  setSelectedMedicine(medicine);
                  setSearchResults([]);  // 검색 결과 숨기기
                }}
              >
                <Text style={styles.medicineName}>{medicine.itemName}</Text>
                <Text style={styles.companyName}>{medicine.entpName}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMedicineDetails = () => {
    if (!selectedMedicine) return null;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>의약품 정보</Text>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>제품명</Text>
          <Text style={styles.detailText}>{selectedMedicine.itemName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>제조사</Text>
          <Text style={styles.detailText}>{selectedMedicine.entpName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>효능・효과</Text>
          <Text style={styles.detailText}>{selectedMedicine.efcyQesitm || '정보가 없습니다.'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>용법・용량</Text>
          <Text style={styles.detailText}>{selectedMedicine.useMethodQesitm || '정보가 없습니다.'}</Text>
          <Text style={styles.detailSubText}>
            기본 설정값: {extractDosageFromUseMethod(selectedMedicine.useMethodQesitm)}, {extractScheduleFromUseMethod(selectedMedicine.useMethodQesitm)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: '#FF6B6B' }]}>주의사항</Text>
          <Text style={[styles.detailText, styles.warningText]}>{selectedMedicine.atpnWarnQesitm || '정보가 없습니다.'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.disabledButton]}
          onPress={handleAddMedicine}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>복용목록에 추가</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMedicineForm = () => (
    <View style={styles.formContainer}>
      {/* 등록 대상자 표시 */}
      {selectedMember && (
        <View style={styles.targetUserInfo}>
          <Text style={styles.targetUserLabel}>약 등록 대상</Text>
          <Text style={styles.targetUserName}>
            {selectedMember.name} ({selectedMember.role === 'parent' ? '부모' : '자녀'})
          </Text>
          {selectedMember.role !== 'parent' && (
            <Text style={styles.targetUserNote}>
              ⚠️ 자녀의 약은 총량과 복용량을 정확히 입력해주세요
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.autoSlotInfo}>
        <Text style={[styles.autoSlotText, { color: colors.PRIMARY.DEFAULT }]}>
          💡 디스펜서 슬롯은 자동으로 할당됩니다
        </Text>
        <Text style={[styles.autoSlotSubText, { color: '#666' }]}>
          등록 후 사용 가능한 슬롯에 자동 배치됩니다
        </Text>
      </View>
      
      {/* 총량 및 복용량 입력 필드 - 부모 계정에서만 표시 */}
      {userRole === 'parent' && (
        <View style={styles.quantityContainer}>
          <View style={styles.quantityRow}>
            <View style={styles.quantityInputContainer}>
              <Text style={styles.quantityLabel}>총 투입량</Text>
              <TextInput
                placeholder="총 알약 개수 (예: 30)"
                placeholderTextColor={colors.GRAY.LIGHT}
                value={medicine.totalQuantity}
                onChangeText={(text) => setMedicine(prev => ({ ...prev, totalQuantity: text }))}
                style={styles.quantityInput}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.quantityInputContainer}>
              <Text style={styles.quantityLabel}>1회 복용량</Text>
              <TextInput
                placeholder="1회당 알약 개수 (예: 1)"
                placeholderTextColor={colors.GRAY.LIGHT}
                value={medicine.doseCount}
                onChangeText={(text) => setMedicine(prev => ({ ...prev, doseCount: text }))}
                style={styles.quantityInput}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={styles.quantityNote}>
            ℹ️ 자녀의 약을 등록할 때는 총 투입량과 1회 복용량을 반드시 입력해주세요
          </Text>
        </View>
      )}
      
      {/* 자녀 계정용 안내 메시지 */}
      {userRole === 'child' && (
        <View style={styles.childNoticeContainer}>
          <Text style={styles.childNoticeText}>
            ℹ️ 약물 정보 조회 모드
          </Text>
          <Text style={styles.childNoticeSubText}>
            총량과 복용량 설정은 메인 계정(부모)에서만 가능합니다
          </Text>
        </View>
      )}
      
      <TextInput
        placeholder="시작일 (예: 2025-05-06)"
        placeholderTextColor={colors.GRAY.LIGHT}
        value={medicine.startDate}
        onChangeText={(text) => handleDateChange(text, 'startDate')}
        style={styles.input}
      />
      <TextInput
        placeholder="종료일 (예: 2025-05-06)"
        placeholderTextColor={colors.GRAY.LIGHT}
        value={medicine.endDate}
        onChangeText={(text) => handleDateChange(text, 'endDate')}
        style={styles.input}
      />
    </View>
  );

  // 약 스케줄 편집 화면으로 이동
  const handleNavigateToSchedule = (medicineId: string, memberId: string, medicineName: string) => {
    navigation.navigate('MedicineScheduleEdit', {
      medicineId,
      memberId,
      medicineName,
      onScheduleUpdate: handleScheduleUpdate,
      isReadOnly: false,
    });
  };

  const saveMedicineSchedule = async (memberId: string, scheduleData: MedicineSchedule) => {
    try {
      const response = await fetch(`/api/medicine/schedule/${memberId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        throw new Error('스케줄 저장에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('스케줄 저장 실패:', error);
      throw error;
    }
  };

  if (isLoading && !isNewMedicine) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.WHITE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {renderSearchForm()}
        {renderMedicineDetails()}
        {selectedMedicine && renderMedicineForm()}
      </ScrollView>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.WHITE} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BLACK,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  searchContainer: {
    flex: 1,
    padding: 16,
  },
  searchSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 45,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.WHITE,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: colors.PRIMARY.DEFAULT,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchButtonText: {
    color: colors.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    color: colors.WHITE,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
  },
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  resultItem: {
    flex: 1,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.PRIMARY.DEFAULT,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  medicineName: {
    color: colors.WHITE,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  companyName: {
    color: colors.GRAY.LIGHT,
    fontSize: 14,
  },
  detailsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
  },
  detailItem: {
    marginBottom: 20,
  },
  detailLabel: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailText: {
    color: colors.WHITE,
    fontSize: 16,
    lineHeight: 22,
  },
  noDetailsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDetailsText: {
    color: colors.GRAY.LIGHT,
    fontSize: 16,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.PRIMARY.DEFAULT,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButtonText: {
    color: colors.WHITE,
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 24,
    shadowColor: colors.PRIMARY.DEFAULT,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.WHITE,
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  divider: {
    height: 1,
    backgroundColor: colors.GRAY.LIGHT,
    marginVertical: 16,
    opacity: 0.2,
  },
  warningText: {
    color: '#FF6B6B',
    fontSize: 15,
    marginTop: 4,
  },
  infoIcon: {
    marginRight: 8,
    color: colors.PRIMARY.DEFAULT,
  },
  detailSubText: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 14,
    marginTop: 8,
  },
  input: {
    height: 45,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.WHITE,
    fontSize: 16,
  },
  formContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
  },
  hint: {
    color: colors.GRAY.LIGHT,
    fontSize: 14,
    marginTop: 8,
  },
  label: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  autoSlotInfo: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  autoSlotText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  autoSlotSubText: {
    fontSize: 14,
    color: '#666',
  },
  quantityContainer: {
    marginBottom: 20,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityInputContainer: {
    flex: 1,
  },
  quantityLabel: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  quantityInput: {
    height: 45,
    backgroundColor: colors.BLACK,
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.WHITE,
    fontSize: 16,
  },
  quantityNote: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 14,
    marginTop: 8,
  },
  targetUserInfo: {
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.PRIMARY.DEFAULT,
  },
  targetUserLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  targetUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.PRIMARY.DEFAULT,
    marginBottom: 4,
  },
  targetUserNote: {
    fontSize: 13,
    color: '#ff6b35',
    fontWeight: '500',
  },
  childNoticeContainer: {
    backgroundColor: '#fff7f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },
  childNoticeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff8c00',
    marginBottom: 4,
  },
  childNoticeSubText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '400',
  },
});

export default MedicineEditScreen; 