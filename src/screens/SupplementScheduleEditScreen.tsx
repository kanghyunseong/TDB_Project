import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  TextInput,
  Platform,
  KeyboardAvoidingView,
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import { getSupplementSchedule, getFamilyMembers, deleteSupplementSchedule, deleteSupplement, getSupplementList, saveSupplementSchedule } from '../api/family';
import { saveMedicineSchedule } from '../api/family';
import { createEmptySchedule, DAYS, DAY_LABELS } from '../constants/schedule';
import { useTheme } from '../contexts/ThemeContext';
import { SupplementSchedule, DayOfWeek } from '../types/tdb';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';

// 🔥 영양제 전용 시간대 타입 (SupplementSchedule과 일치)
type SupplementTimeOfDay = 'morning' | 'lunch' | 'dinner';

// 🔥 영양제 전용 상수
const SUPPLEMENT_TIMES: SupplementTimeOfDay[] = ['morning', 'lunch', 'dinner'];
const SUPPLEMENT_TIME_LABELS: Record<SupplementTimeOfDay, string> = {
  morning: '아침',
  lunch: '점심', 
  dinner: '저녁'
};

// 🔥 영양제 전용 빈 스케줄 생성
const createEmptySupplementSchedule = (): SupplementSchedule['schedule'] => ({
  mon: { morning: false, lunch: false, dinner: false },
  tue: { morning: false, lunch: false, dinner: false },
  wed: { morning: false, lunch: false, dinner: false },
  thu: { morning: false, lunch: false, dinner: false },
  fri: { morning: false, lunch: false, dinner: false },
  sat: { morning: false, lunch: false, dinner: false },
  sun: { morning: false, lunch: false, dinner: false }
});

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementScheduleEdit'>;

function SupplementScheduleEditScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();
  const { supplementId, memberId, supplementName, isReadOnly } = route.params as {
    supplementId: string;
    memberId: string;
    supplementName: string;
    isReadOnly?: boolean;
  };
  
  useEffect(() => {
    if (!supplementId || !memberId) {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: '영양제 정보를 찾을 수 없습니다.',
      });
      navigation.goBack();
      return;
    }
  }, [supplementId, memberId, navigation]);

  // 🔥 영양제 전용 상태
  const [weeklyDoses, setWeeklyDoses] = useState<{
    morning: string;
    lunch: string;
    dinner: string;
  }>({
    morning: '',
    lunch: '',
    dinner: ''
  });
  
  const [schedule, setSchedule] = useState<SupplementSchedule['schedule']>(createEmptySupplementSchedule());
  const [isLoading, setIsLoading] = useState(true);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [slot, setSlot] = useState<number>(1);
  const [userAccountType, setUserAccountType] = useState<'parent' | 'child' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isManagingOthersSchedule, setIsManagingOthersSchedule] = useState(false);
  const [supplement, setSupplement] = useState<any>(null);
  const [hasSchedulePermission, setHasSchedulePermission] = useState(true);

  // 🔥 영양제 전용 복용량 업데이트
  const updateDose = (time: SupplementTimeOfDay, value: string) => {
    setWeeklyDoses(prev => ({
      ...prev,
      [time]: value
    }));
  };

  useEffect(() => {
    loadUserAndSchedule();
  }, []);

  const loadUserAndSchedule = async () => {
    try {
      setIsLoading(true);
      
      // 사용자 정보 로드
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserAccountType(user.role);
        setCurrentUserId(user.user_id);
        
        // 보호자가 자녀의 스케줄을 관리하는지 확인
        if (user.role === 'parent' && memberId !== user.user_id) {
          setIsManagingOthersSchedule(true);
        }
        
        // 🔥 영양제 권한 체크를 위해 영양제 목록 조회
        try {
          const supplementList = await getSupplementList(memberId);
          if (supplementList) {
            const foundSupplement = supplementList.find(s => s.id === supplementId);
            if (foundSupplement) {
              setSupplement(foundSupplement);
              
              // 권한 체크 로직
              const checkPermission = () => {
                if (user.role === 'parent') {
                  // 보호자는 모든 영양제 스케줄 편집 가능
                  return true;
                }
                
                // 자녀인 경우 본인 영양제만 편집 가능
                if (user.role === 'child') {
                  const targetUsers = foundSupplement.target_users;
                  
                  // target_users가 null이면 가족 공통 영양제
                  if (!targetUsers || targetUsers.length === 0) {
                    return true;
                  }
                  
                  // target_users에 현재 사용자가 포함되어 있는지 확인
                  return targetUsers.includes(user.user_id);
                }
                
                return false;
              };
              
              const permission = checkPermission();
              setHasSchedulePermission(permission);
              
              console.log('🔥 영양제 스케줄 편집 권한 체크:', {
                supplementName: foundSupplement.name,
                userRole: user.role,
                currentUserId: user.user_id,
                targetUsers: foundSupplement.target_users,
                hasPermission: permission
              });
            }
          }
        } catch (error) {
          console.error('영양제 목록 조회 실패:', error);
        }
      }

      // 영양제 스케줄 로드
      await fetchSchedule();
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      Toast.show({
        type: 'error',
        text1: '데이터를 불러오는데 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      console.log('영양제 스케줄 조회:', { supplementId, memberId });
      
      const data = await getSupplementSchedule(supplementId, memberId);
      console.log('영양제 스케줄 조회 결과:', data);
      
      if (data && data.schedule) {
        setSchedule({ ...createEmptySupplementSchedule(), ...data.schedule });
        setTotalQuantity(data.totalQuantity ?? '');
        setSlot(data.dispenserSlot ?? slot);
        
        // 🔥 의약품과 동일한 시간대별 복용량 처리
        if ((data as any).morningDose !== undefined) setWeeklyDoses({
          morning: (data as any).morningDose.toString(),
          lunch: (data as any).lunchDose?.toString() || '',
          dinner: (data as any).dinnerDose?.toString() || ''
        });
        
        // 기존 doseCount를 시간대별로 분할 (호환성)
        if (data.doseCount && !(data as any).morningDose && !(data as any).lunchDose && !(data as any).dinnerDose) {
          setWeeklyDoses({
            morning: data.doseCount.toString(),
            lunch: data.doseCount.toString(),
            dinner: data.doseCount.toString()
          });
          console.log('🔄 기존 doseCount를 시간대별로 분할:', data.doseCount);
        }
      } else {
        // 🔥 자녀 계정이고 스케줄이 없는 경우 보호자 설정값 조회
        if (userAccountType === 'child') {
          await loadParentTotalQuantity();
        }
      }
    } catch (error) {
      console.error('영양제 스케줄 로드 실패:', error);
      // 404 에러는 정상적인 상황 (스케줄이 없음)
      if ((error as any)?.response?.status !== 404) {
        Toast.show({
          type: 'error',
          text1: '스케줄을 불러오는데 실패했습니다.',
        });
      } else if (userAccountType === 'child') {
        // 🔥 자녀 계정이고 404 에러인 경우 보호자 설정값 조회
        await loadParentTotalQuantity();
      }
    }
  };

  const loadParentTotalQuantity = async () => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) return;
      
      const user = JSON.parse(userJson);
      const parentUserId = user.parentUuid || user.id;
      
      // 보호자의 영양제 목록에서 같은 supplementId의 총 복용량 조회
      const parentSupplementsResponse = await getSupplementList(parentUserId);
      if (parentSupplementsResponse && Array.isArray(parentSupplementsResponse)) {
        const parentSupplement = parentSupplementsResponse.find(
          (sup: any) => sup.medi_id === supplementId || sup.id === supplementId
        );
        
        if (parentSupplement?.totalQuantity) {
          setTotalQuantity(parentSupplement.totalQuantity);
          console.log('🔥 보호자 설정 총 복용량 로드:', parentSupplement.totalQuantity);
        }
      }
    } catch (error) {
      console.error('🔥 보호자 총 복용량 로드 실패:', error);
    }
  };

  const toggleCell = (day: DayOfWeek, time: SupplementTimeOfDay) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: !prev[day][time]
      }
    }));
  };

  const handleSave = async () => {
    // 🔥 권한 체크
    if (!hasSchedulePermission) {
      Toast.show({
        type: 'error',
        text1: '권한 없음',
        text2: '이 영양제의 스케줄을 편집할 권한이 없습니다.',
      });
      return;
    }
    
    if (!totalQuantity.trim()) {
      Toast.show({
        type: 'error',
        text1: '총 복용량을 입력해주세요.',
      });
      return;
    }

    // 🔥 의약품과 동일한 시간대별 복용량 유효성 검사
    const hasValidDose = weeklyDoses.morning.trim() || weeklyDoses.lunch.trim() || weeklyDoses.dinner.trim();
    if (!hasValidDose) {
      Toast.show({
        type: 'error',
        text1: '최소 한 시간대의 복용량을 입력해주세요.',
      });
      return;
    }

    try {
      setIsLoading(true);

      const scheduleData = await saveSupplementSchedule(
        supplementId,
        memberId,
        schedule as any,
        totalQuantity,
        weeklyDoses.morning || weeklyDoses.lunch || weeklyDoses.dinner ? 
          (weeklyDoses.morning || weeklyDoses.lunch || weeklyDoses.dinner) : ''
      );

      if (scheduleData) {
        Toast.show({
          type: 'success',
          text1: '영양제 스케줄이 저장되었습니다.',
        });
        
        // 🔥 메인 화면으로 이동하면서 새로고침 플래그 전달
        navigation.navigate('MainTabs', { 
          screen: 'Home',
          params: { 
            refresh: true,
            refreshSchedule: true,
            supplementId: supplementId 
          }
        });
      } else {
        throw new Error('스케줄 저장 실패');
      }
    } catch (error) {
      console.error('영양제 스케줄 저장 실패:', error);
      Toast.show({
        type: 'error',
        text1: '스케줄 저장에 실패했습니다.',
        text2: '다시 시도해주세요.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      '영양제 삭제',
      `"${supplementName}" 영양제를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // 스케줄 삭제
              try {
                await deleteSupplementSchedule(supplementId, memberId);
              } catch (error) {
                console.log('스케줄 삭제 시도 (없을 수도 있음):', error);
              }

              // 영양제 삭제
              const deleteSuccess = await deleteSupplement(memberId, supplementId);
              
              if (deleteSuccess) {
                Toast.show({
                  type: 'success',
                  text1: '영양제가 삭제되었습니다.',
                });
                navigation.navigate('MainTabs', { screen: 'Home' });
              } else {
                throw new Error('영양제 삭제 실패');
              }
            } catch (error) {
              console.error('영양제 삭제 실패:', error);
              Toast.show({
                type: 'error',
                text1: '삭제에 실패했습니다.',
                text2: '다시 시도해주세요.',
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.card }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.card} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.card }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.card} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* 🔥 의약품과 동일한 헤더 */}
        <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: themeColors.card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>영양제 스케줄 편집</Text>
            <Text style={styles.headerSubtitle}>{supplementName}</Text>
            <Text style={styles.headerSlot}>💊 슬롯: {slot}번</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
        
          {/* 🔥 빠른 설정 패턴 */}
          <View style={styles.quickPatternSection}>
            <Text style={styles.sectionTitle}>⚡ 빠른 설정</Text>
            <View style={styles.quickPatternButtons}>
              <TouchableOpacity 
                style={[styles.quickButton, styles.morningButton]} 
                onPress={() => {
                  const newSchedule = { ...schedule };
                  // 🔥 토글 방식: 현재 상태의 반대로 변경 (모든 요일)
                  const isCurrentlyEnabled = newSchedule['mon']['morning'];
                  DAYS.forEach(day => {
                    newSchedule[day]['morning'] = !isCurrentlyEnabled;
                  });
                  setSchedule(newSchedule);
                }}
              >
                <Text style={styles.quickButtonText}>🌅 아침</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.afternoonButton]} 
                onPress={() => {
                  const newSchedule = { ...schedule };
                  // 🔥 토글 방식: 현재 상태의 반대로 변경 (모든 요일)
                  const isCurrentlyEnabled = newSchedule['mon']['lunch'];
                  DAYS.forEach(day => {
                    newSchedule[day]['lunch'] = !isCurrentlyEnabled;
                  });
                  setSchedule(newSchedule);
                }}
              >
                <Text style={styles.quickButtonText}>☀️ 점심</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.eveningButton]} 
                onPress={() => {
                  const newSchedule = { ...schedule };
                  // 🔥 토글 방식: 현재 상태의 반대로 변경 (모든 요일)
                  const isCurrentlyEnabled = newSchedule['mon']['dinner'];
                  DAYS.forEach(day => {
                    newSchedule[day]['dinner'] = !isCurrentlyEnabled;
                  });
                  setSchedule(newSchedule);
                }}
              >
                <Text style={styles.quickButtonText}>🌙 저녁</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickButton, styles.clearButton]} 
                onPress={() => setSchedule(createEmptySupplementSchedule())}
              >
                <Text style={styles.quickButtonText}>초기화</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 총 복용량 설정 */}
          {/* 🔥 자녀 계정에서는 총 복용량 섹션 전체 숨김 */}
          {userAccountType === 'parent' && (
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>💊 총 복용량</Text>
            <TextInput
              style={[
                styles.quantityInput,
                  isManagingOthersSchedule && styles.quantityInputDisabled
              ]}
              value={totalQuantity}
                onChangeText={isManagingOthersSchedule ? undefined : setTotalQuantity}
                placeholder={isManagingOthersSchedule ? "보호자 계정에서만 수정 가능" : "총 복용량을 입력하세요"}
              keyboardType="numeric"
                editable={!isManagingOthersSchedule}
            />
              {isManagingOthersSchedule && (
              <Text style={styles.quantityNote}>
                ℹ️ 총 복용량은 보호자 계정에서만 수정할 수 있습니다
              </Text>
            )}
          </View>
          )}
        
        {/* 🔥 의약품과 동일한 시간대별 복용량 섹션 */}
        <View style={styles.timeDoseSection}>
          <Text style={[styles.sectionTitle, { color: colors.PRIMARY.DEFAULT }]}>시간대별 복용량</Text>
          
          {/* 🔥 도움말 추가 */}
          <View style={styles.timeDoseNote}>
            <Text style={[styles.noteText, { color: colors.PRIMARY.DEFAULT }]}>
              💡 각 시간대별로 복용할 정제의 개수를 입력하세요
            </Text>
            <Text style={[styles.noteSubText, { color: '#666' }]}>
              빈 칸으로 두면 해당 시간대에는 복용하지 않습니다
            </Text>
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>🌅 아침</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  color: isDark ? colors.WHITE : colors.BLACK,
                  backgroundColor: userAccountType === 'child' ? '#f0f0f0' : 'transparent',
                }
              ]}
              value={weeklyDoses.morning}
              onChangeText={value => updateDose('morning', value)}
              placeholder="예: 1"
              placeholderTextColor={(isDark ? colors.WHITE : colors.BLACK) + '55'}
              keyboardType="numeric"
              editable={userAccountType !== 'child'}
            />
            <Text style={styles.unitText}>정</Text>
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>🌞 점심</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  color: isDark ? colors.WHITE : colors.BLACK,
                  backgroundColor: userAccountType === 'child' ? '#f0f0f0' : 'transparent',
                }
              ]}
              value={weeklyDoses.lunch}
              onChangeText={value => updateDose('lunch', value)}
              placeholder="예: 2"
              placeholderTextColor={(isDark ? colors.WHITE : colors.BLACK) + '55'}
              keyboardType="numeric"
              editable={userAccountType !== 'child'}
            />
            <Text style={styles.unitText}>정</Text>
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>🌙 저녁</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  color: isDark ? colors.WHITE : colors.BLACK,
                  backgroundColor: userAccountType === 'child' ? '#f0f0f0' : 'transparent',
                }
              ]}
              value={weeklyDoses.dinner}
              onChangeText={value => updateDose('dinner', value)}
              placeholder="예: 1"
              placeholderTextColor={(isDark ? colors.WHITE : colors.BLACK) + '55'}
              keyboardType="numeric"
              editable={userAccountType !== 'child'}
            />
            <Text style={styles.unitText}>정</Text>
          </View>
        </View>

        {/* 스케줄 표 */}
        <View style={[styles.scheduleTable, { 
          backgroundColor: isDark ? themeColors.card : '#f8f9fa', 
          borderColor: isDark ? '#444' : '#e0e0e0' 
        }]}>
          {/* 🔥 도움말 텍스트 추가 */}
          <View style={styles.scheduleHelpContainer}>
            <Text style={[styles.scheduleHelpText, { color: colors.PRIMARY.DEFAULT }]}>
              📅 요일별 복용 일정을 선택하세요
            </Text>
            <Text style={[styles.scheduleHelpSubText, { color: isDark ? '#888' : '#666' }]}>
              터치하여 복용 일정을 설정/해제할 수 있습니다
            </Text>
          </View>
          
          <View style={[
            styles.scheduleHeaderRow,
            { borderBottomColor: isDark ? '#374151' : '#e2e8f0' }
          ]}>
            <Text style={styles.scheduleHeaderCell}></Text>
            {SUPPLEMENT_TIMES.map(time => (
              <View key={time} style={styles.scheduleHeaderCellCenter}>
                <Text style={[styles.scheduleHeaderText, { color: colors.PRIMARY.DEFAULT }]}>{SUPPLEMENT_TIME_LABELS[time]}</Text>
              </View>
            ))}
          </View>
          {DAYS.map(day => (
            <View key={day} style={styles.scheduleRow}>
              <Text style={[styles.scheduleDayCell, { 
                color: colors.PRIMARY.DEFAULT 
              }]}>
                {DAY_LABELS[day]}
              </Text>
              {SUPPLEMENT_TIMES.map(time => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.scheduleCell,
                    {
                      backgroundColor: isDark ? '#222' : '#e9ecef',
                      borderColor: isDark ? '#444' : '#d1d1d1',
                    },
                    schedule[day][time] && styles.scheduleCellChecked
                  ]}
                  onPress={() => toggleCell(day, time)}
                  activeOpacity={0.7}
                >
                  {schedule[day][time] && (
                    <Text style={{ color: colors.WHITE, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
        
        </ScrollView>
        
        {/* 저장 버튼 */}
        <View style={[styles.saveButtonContainer, { backgroundColor: themeColors.card, borderTopColor: isDark ? '#374151' : '#f1f5f9', paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>저장</Text>
            </TouchableOpacity>
            {/* 삭제 버튼 - 보호자 계정만 */}
            {userAccountType === 'parent' && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: { 
    flex: 1 
  },
  scrollContainer: { 
    flex: 1 
  },
  scrollContentContainer: { 
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    flexGrow: 1
  },
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
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSlot: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  scrollViewContent: {
    paddingBottom: 20, // 저장 버튼과 겹치지 않도록 하단 패딩 추가
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8, 
    textAlign: 'center',
    color: '#1a1a1a'
  },
  scheduleTable: {
    backgroundColor: '#ffffff',
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
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  scheduleHeaderCell: {
    width: 40,
    textAlign: 'center',
  },
  scheduleHeaderCellCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleHeaderText: {
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleDayCell: {
    width: 40,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  scheduleCell: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  scheduleCellChecked: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButton: { 
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  saveButtonText: { 
    color: '#ffffff', 
    fontWeight: '600',
    fontSize: 15,
  },
  loading: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  inputLabel: {
    width: 100,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
    fontWeight: '500',
    color: '#1e293b',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    borderColor: '#e2e8f0',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 80,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  slotInfo: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  slotLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  // 🔥 현대적인 빠른 설정 관련 스타일
  quickPatternSection: {
    backgroundColor: '#ffffff',
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
  morningButton: {
    backgroundColor: '#FF9500', // 주황색 - 아침
  },
  afternoonButton: {
    backgroundColor: '#FFD700', // 금색 - 점심
  },
  eveningButton: {
    backgroundColor: '#5856D6', // 보라색 - 저녁
  },
  clearButton: {
    backgroundColor: '#FF3B30', // 빨간색 - 초기화
  },
  quickButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // 🔥 현대적인 섹션 제목 스타일
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  // 🔥 현대적인 총 복용량 관련 스타일
  quantitySection: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
    padding: 24,
    borderRadius: 28,
    shadowColor: '#4285f4',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  quantityInput: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    backgroundColor: '#f8f9fa',
    fontWeight: '600',
    color: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quantityInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
    borderColor: '#ddd',
  },
  quantityNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  timeDoseSection: {
    marginBottom: 28,
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 28,
    shadowColor: '#4285f4',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  timeDoseNote: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#f7f9ff',
    borderWidth: 0,
    borderRadius: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#667eea',
  },
  noteText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  noteSubText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scheduleHelpContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  scheduleHelpText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#16a34a',
  },
  scheduleHelpSubText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#15803d',
  },
  permissionNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SupplementScheduleEditScreen; 