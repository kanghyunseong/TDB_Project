import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { CommonActions } from '@react-navigation/native';
import { saveSupplement, getFamilyMembers, getSupplementList } from '../api/family';
import { NutritionalSupplement } from '../types/tdb';
import { DISPENSER_CONFIG } from '../constants/dispenser';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementEdit'>;

const SupplementEditScreen = ({ route, navigation }: Props) => {
  const { colors: themeColors, isDark } = useTheme();
  const { supplementId, memberId, supplementName, isParent } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [supplementData, setSupplementData] = useState<Partial<NutritionalSupplement>>({
    name: supplementName || '',
    manufacturer: '',
    ingredients: '',
    primaryFunction: '',
    intakeMethod: '',
    precautions: '',
    startDate: '',
    endDate: '',
    totalQuantity: '',
    doseCount: '1',
  });
  
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<string[]>([]);
  const [isAllFamily, setIsAllFamily] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; role: 'parent' | 'child' } | null>(null);

  // 🔥 복용 기간 선택 관련 상태
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1week'); // 기본 1주일
  const [isManualInput, setIsManualInput] = useState(false); // 직접 입력 여부

  useEffect(() => {
    loadUserInfo();
    loadFamilyMembers();
    if (supplementId !== 'new') {
      loadSupplementData();
    }
  }, []);

  const loadUserInfo = async () => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        setUser(JSON.parse(userJson));
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
    }
  };

  const loadFamilyMembers = async () => {
    try {
      const response = await getFamilyMembers();
      if (response.success) {
        setFamilyMembers(response.data || []);
      }
    } catch (error) {
      console.error('가족 구성원 조회 실패:', error);
    }
  };

  const loadSupplementData = async () => {
    try {
      setIsLoading(true);
      // 영양제 데이터 로드 로직 구현 필요시
    } catch (error) {
      console.error('영양제 데이터 로드 실패:', error);
      Toast.show({
        type: 'error',
        text1: '영양제 정보를 불러오지 못했습니다.',
      });
    } finally {
      setIsLoading(false);
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
      
      setSupplementData(prev => ({
        ...prev,
        startDate: startDateString,
        endDate: endDateString,
      }));
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
    if (!isManualInput && selectedPeriod && (!supplementData.startDate || !supplementData.endDate)) {
      updateDatesFromPeriod(selectedPeriod);
    }
  }, [selectedPeriod, isManualInput]);

  const formatDate = (text: string) => {
    const numbers = text.replace(/[^0-9]/g, '');
    const limitedNumbers = numbers.slice(0, 8);
    
    if (limitedNumbers.length <= 4) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 6) {
      return `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4)}`;
    } else {
      return `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4, 6)}-${limitedNumbers.slice(6)}`;
    }
  };

  const handleDateChange = (text: string, field: 'startDate' | 'endDate') => {
    const formattedDate = formatDate(text);
    setSupplementData(prev => ({ ...prev, [field]: formattedDate }));
  };

  const handleSave = async () => {
    if (!supplementData.name?.trim()) {
      Toast.show({ type: 'error', text1: '영양제 이름을 입력해주세요.' });
      return;
    }

    if (!supplementData.startDate || !supplementData.endDate) {
      Toast.show({ type: 'error', text1: '복용 기간을 입력해주세요.' });
      return;
    }

    if (!isValidDate(supplementData.startDate) || !isValidDate(supplementData.endDate)) {
      Toast.show({ type: 'error', text1: '올바른 날짜 형식을 입력해주세요. (YYYY-MM-DD)' });
      return;
    }

    if (new Date(supplementData.startDate) > new Date(supplementData.endDate)) {
      Toast.show({ type: 'error', text1: '시작일이 종료일보다 늦을 수 없습니다.' });
      return;
    }

    if (!supplementData.totalQuantity?.trim()) {
      Toast.show({ type: 'error', text1: '총 개수를 입력해주세요.' });
      return;
    }

    if (!supplementData.doseCount?.trim() || isNaN(Number(supplementData.doseCount)) || Number(supplementData.doseCount) <= 0) {
      Toast.show({ type: 'error', text1: '올바른 1회 복용량을 입력해주세요.' });
      return;
    }

    if (!isAllFamily && selectedTargetUsers.length === 0) {
      Toast.show({ type: 'error', text1: '복용할 가족 구성원을 선택해주세요.' });
      return;
    }

    try {
      setIsLoading(true);

      // 🔥 슬롯 제한 체크 (새로운 영양제인 경우에만)
      if (supplementId === 'new') {
        try {
          const existingSupplements = await getSupplementList(memberId);
          if (existingSupplements) {
            const usedSlots = new Set(existingSupplements.map(s => s.dispenserSlot).filter(slot => slot !== null && slot !== undefined));
            
            console.log('🔍 현재 사용 중인 영양제 슬롯:', Array.from(usedSlots));
            console.log('🔍 최대 슬롯 수:', DISPENSER_CONFIG.MAX_SLOTS);
            
            if (usedSlots.size >= DISPENSER_CONFIG.MAX_SLOTS) {
              Toast.show({
                type: 'error',
                text1: '슬롯 부족',
                text2: `디스펜서에 빈 슬롯이 없습니다. (최대 ${DISPENSER_CONFIG.MAX_SLOTS}개)\n기존 영양제를 삭제한 후 다시 시도해주세요.`,
              });
              return;
            }
          }
        } catch (error) {
          console.error('영양제 슬롯 체크 실패:', error);
          // 슬롯 체크 실패는 저장을 막지 않음 (서버에서도 체크함)
        }
      }

      const payload: Omit<NutritionalSupplement, 'id'> = {
        ...supplementData,
        name: supplementData.name || '',
        manufacturer: supplementData.manufacturer || '',
        ingredients: supplementData.ingredients || '',
        primaryFunction: supplementData.primaryFunction || '',
        intakeMethod: supplementData.intakeMethod || '',
        precautions: supplementData.precautions || '',
        startDate: supplementData.startDate || '',
        endDate: supplementData.endDate || '',
        totalQuantity: supplementData.totalQuantity || '',
        doseCount: supplementData.doseCount || '1',
        memberId,
        memberName: user?.name || '',
        memberType: isParent ? 'parent' : 'child',
        dispenserSlot: undefined,
        target_users: isAllFamily ? null : selectedTargetUsers,
      };

      console.log('영양제 저장:', payload);

      const result = await saveSupplement(memberId, payload, supplementId);

      if (result) {
        Toast.show({
          type: 'success',
          text1: supplementId === 'new' ? '영양제가 추가되었습니다.' : '영양제가 수정되었습니다.',
        });

        if (supplementId === 'new') {
          // 🔥 새로 추가된 경우 상세정보 화면으로 이동
          const supplementForDetail = {
            PRDLST_NM: payload.name,
            BSSH_NM: payload.manufacturer || '제조사 정보 없음',
            RAWMTRL_NM: payload.ingredients || '성분 정보 없음',
            PRIMARY_FNCLTY: payload.primaryFunction || '기능성 정보 없음',
            NTK_MTHD: payload.intakeMethod || '제품 설명서에 따라 복용하세요.',
            IFTKN_ATNT_MATR_CN: payload.precautions || '복용 전 전문가와 상담하세요.',
          };

          navigation.navigate('SupplementDetail', {
            supplement: supplementForDetail,
            memberId: memberId,
            isParent: isParent,
            isStoredSupplement: true,
            storedData: {
              id: result.id || `supplement_${Date.now()}`,
              name: payload.name,
              start_date: payload.startDate,
              end_date: payload.endDate,
              slot: result.dispenserSlot || undefined,
              target_users: payload.target_users,
            },
          });
        } else {
          // 🔥 수정된 경우 홈으로 이동
          navigation.dispatch(
            CommonActions.navigate({
              name: 'MainTabs',
              params: { screen: 'Home' },
            })
          );
        }
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
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>로딩 중...</Text>
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
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          {supplementId === 'new' ? '영양제 추가' : '영양제 수정'}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>기본 정보</Text>
          
          <Text style={[styles.label, { color: themeColors.text }]}>영양제 이름 *</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.name}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, name: text }))}
            placeholder="영양제 이름을 입력하세요"
            placeholderTextColor={themeColors.text + '60'}
          />

          <Text style={[styles.label, { color: themeColors.text }]}>제조사</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.manufacturer}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, manufacturer: text }))}
            placeholder="제조사를 입력하세요"
            placeholderTextColor={themeColors.text + '60'}
          />

          <Text style={[styles.label, { color: themeColors.text }]}>주요 성분</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.ingredients}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, ingredients: text }))}
            placeholder="주요 성분을 입력하세요"
            placeholderTextColor={themeColors.text + '60'}
          />

          <Text style={[styles.label, { color: themeColors.text }]}>기능성</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.primaryFunction}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, primaryFunction: text }))}
            placeholder="기능성을 입력하세요"
            placeholderTextColor={themeColors.text + '60'}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>복용 기간</Text>
          
          {/* 🔥 기간 선택 옵션 */}
          <View style={styles.periodSelection}>
            <Text style={[styles.label, { color: themeColors.text, marginBottom: 8 }]}>
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
          
          <Text style={[styles.label, { color: themeColors.text }]}>시작일 *</Text>
          <TextInput
            style={[styles.input, { 
              color: isManualInput ? themeColors.text : (isDark ? '#888' : '#999'), 
              borderColor: themeColors.border,
              backgroundColor: isManualInput ? themeColors.card : (isDark ? '#333' : '#f5f5f5')
            }]}
            value={supplementData.startDate}
            onChangeText={(text) => handleDateChange(text, 'startDate')}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themeColors.text + '60'}
            keyboardType="numeric"
            editable={isManualInput}
          />

          <Text style={[styles.label, { color: themeColors.text }]}>종료일 *</Text>
          <TextInput
            style={[styles.input, { 
              color: isManualInput ? themeColors.text : (isDark ? '#888' : '#999'), 
              borderColor: themeColors.border,
              backgroundColor: isManualInput ? themeColors.card : (isDark ? '#333' : '#f5f5f5')
            }]}
            value={supplementData.endDate}
            onChangeText={(text) => handleDateChange(text, 'endDate')}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themeColors.text + '60'}
            keyboardType="numeric"
            editable={isManualInput}
          />

          <Text style={[styles.label, { color: themeColors.text }]}>총 개수 *</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.totalQuantity}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, totalQuantity: text }))}
            placeholder="예: 30"
            placeholderTextColor={themeColors.text + '60'}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: themeColors.text }]}>1회 복용량 *</Text>
          <TextInput
            style={[styles.input, { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.card 
            }]}
            value={supplementData.doseCount}
            onChangeText={(text) => setSupplementData(prev => ({ ...prev, doseCount: text }))}
            placeholder="예: 1"
            placeholderTextColor={themeColors.text + '60'}
            keyboardType="numeric"
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

        {familyMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>복용 대상</Text>
            <Text style={[styles.text, { color: themeColors.text, marginBottom: 12 }]}>
              누가 이 영양제를 복용하나요?
            </Text>
            
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
                        setSelectedTargetUsers(prev => prev.filter(id => id !== member.user_id));
                      } else {
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
        )}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={[styles.saveButtonText, { color: colors.WHITE }]}>
            {supplementId === 'new' ? '영양제 추가' : '수정 완료'}
          </Text>
        </TouchableOpacity>
        
        <View style={{ height: 50 }} />
      </ScrollView>
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
  },
  scrollContent: {
    padding: 16,
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
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
  },
  autoSlotInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.PRIMARY.DEFAULT,
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
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.SUCCESS.DEFAULT,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 18,
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
});

export default SupplementEditScreen; 