import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MainStackParamList, BottomTabParamList } from '../types/navigation';
import colors from '../constants/colors';
import { getMedicineSchedule, saveMedicineSchedule, deleteMedicine, getFamilyMembers, getMedicineList, deleteMedicineSchedule } from '../api/family';
import { DrugInteractionValidator } from '../utils/drugInteractionValidator';
import { getCurrentUser } from '../api/userStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { DAYS, TIMES, createEmptySchedule, type Schedule, groupBySlot, TIME_LABELS, DAY_LABELS } from '../constants/schedule';
import { useTheme } from '../contexts/ThemeContext';
import { MedicineSchedule, FamilyMember, Medicine, DayOfWeek, TimeOfDay } from '../types/tdb';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<MainStackParamList, 'MedicineSchedule'>;

function getScheduleSummary(scheduleObj: Record<DayOfWeek, Record<TimeOfDay, boolean>>) {
  const timesMap = { morning: '아침', afternoon: '점심', evening: '저녁' };
  // 전체선택 여부 확인
  const allSelected = DAYS.every(day =>
    TIMES.every(time => scheduleObj[day][time])
  );
  if (allSelected) return '매일';
  // 요일별 줄바꿈 요약
  const lines: string[] = [];
  DAYS.forEach(day => {
    const times = TIMES
      .filter(time => scheduleObj[day][time])
      .map(time => timesMap[time]);
    if (times.length > 0) lines.push(`${DAY_LABELS[day]}: ${times.join(', ')}`);
  });
  return lines.length > 0 ? lines.join('\n') : '스케줄 없음';
}

function MedicineScheduleScreen({ route, navigation }: Props) {
  const { colors: themeColors, isDark } = useTheme();
  const params = 'params' in route ? route.params : undefined;
  const medi_id = params?.medicineId;
  const user_id = params?.memberId;
  const medicineName = params?.medicineName;
  const isParent = params?.isParent;
  const isReadOnly = true;

  const [schedule, setSchedule] = useState<MedicineSchedule | null>({
    medi_id: medi_id ?? '',
    user_id: user_id ?? '',
    schedule: createEmptySchedule(),
    slot: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const STORAGE_KEY = `@medicine_schedule_${medi_id}_${user_id}`;
  const [userAccountType, setUserAccountType] = useState<'parent' | 'child' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noScheduleMessage, setNoScheduleMessage] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [allSchedules, setAllSchedules] = useState<Record<string, MedicineSchedule | null>>({});

  useEffect(() => {
    if (medi_id && user_id) {
      loadSchedule();
      (async () => {
        try {
          const response = await getMedicineList(user_id);
          if (!response.success || !response.data) {
            console.error('약 목록 조회 실패:', response.error?.message);
            setMedicines([]);
            return;
          }
          setMedicines(response.data);
          const parentMedicine = response.data.find(m => m.medi_id === medi_id && m.user_id !== user_id);
          if (parentMedicine) {
            setTotalQuantity(parentMedicine.totalQuantity || '');
            setDoseCount(parentMedicine.doseCount || '');
          }
        } catch (error) {
          console.error('약 목록 조회 실패:', error);
        }
      })();
    }
  }, [medi_id, user_id]);

  useEffect(() => {
    const fetchAllMedicines = async () => {
      if (!user_id) return;
      const response = await getMedicineList(user_id);
      if (!response.success || !response.data) {
        console.error('약 목록 조회 실패:', response.error?.message);
        setMedicines([]);
        return;
      }
      setMedicines(response.data);
    };
    fetchAllMedicines();
  }, [user_id]);

  // 슬롯별 그룹핑
  const groupedMedicines = useMemo(() => groupBySlot(medicines as (Medicine & { dispenserSlot: string | number })[]), [medicines]);

  // 각 약의 스케줄도 미리 불러오기 (병렬 처리로 최적화)
  useEffect(() => {
    const fetchSchedules = async () => {
      const schedulePromises = medicines
        .filter(med => med.medi_id && med.user_id)
        .map(async (med) => {
          try {
            const schedule = await getMedicineSchedule(med.medi_id!, med.user_id!);
            return { medi_id: med.medi_id!, schedule };
          } catch (error) {
            console.warn(`[MedicineScheduleScreen] ${med.name} 스케줄 조회 실패:`, error);
            return { medi_id: med.medi_id!, schedule: null };
          }
        });
      
      const scheduleResults = await Promise.all(schedulePromises);
      const schedules: Record<string, MedicineSchedule | null> = {};
      scheduleResults.forEach(({ medi_id, schedule }) => {
        schedules[medi_id] = schedule;
      });
      setAllSchedules(schedules);
    };
    if (medicines.length > 0) fetchSchedules();
  }, [medicines]);

  const loadSchedule = async () => {
    if (!medi_id || !user_id) {
      console.error('약 ID 또는 사용자 ID가 없습니다:', { medi_id, user_id });
      return;
    }
    try {
      setIsLoading(true);
      const scheduleData = await getMedicineSchedule(medi_id, user_id);
      if (scheduleData && scheduleData.schedule) {
        const mergedSchedule = {
          medi_id: medi_id,
          user_id: user_id,
          schedule: {
            ...createEmptySchedule(),
            ...scheduleData.schedule
          },
          slot: scheduleData.slot ?? 1
        };
        setSchedule(mergedSchedule);
        setNoScheduleMessage(null);
      } else {
        setSchedule({
          medi_id: medi_id,
          user_id: user_id,
          schedule: createEmptySchedule(),
          slot: 1
        });
        setNoScheduleMessage('아직 스케줄이 없습니다. 약 스케줄을 지정해주세요.');
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        setSchedule(null);
        setNoScheduleMessage('아직 스케줄이 없습니다. 약 스케줄을 지정해주세요.');
      } else {
        console.error('스케줄 조회 실패:', error);
        Alert.alert('오류', '스케줄을 불러오는데 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCell = (day: string, time: string) => {
    return; // 클릭해도 아무 동작 없음
  };

  const handleSave = async () => {
    if (isReadOnly || !medi_id || !user_id || !schedule) return;

    let finalTotalQuantity = totalQuantity;
    let finalDoseCount = doseCount;

    if (isParent) {
      try {
        const response = await getMedicineList(user_id);
        if (!response.success || !response.data) {
          console.error('약 목록 조회 실패:', response.error?.message);
          setMedicines([]);
          return;
        }
        setMedicines(response.data);
        const parentMedicine = response.data.find(m => m.medi_id === medi_id && m.user_id !== user_id);
        if (parentMedicine) {
          if (!finalTotalQuantity) finalTotalQuantity = parentMedicine.totalQuantity || '';
          if (!finalDoseCount) finalDoseCount = parentMedicine.doseCount || '';
        }
      } catch (error) {
        console.error('약 목록 조회 실패:', error);
      }
    }

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      const familyResponse = await getFamilyMembers();
      if (!familyResponse.success || !familyResponse.data) {
        throw new Error('가족 구성원 정보를 가져올 수 없습니다.');
      }
      
      // 가족 전체 약물 목록 수집 (병렬 처리)
      const medicinePromises = familyResponse.data.map(async (member) => {
        try {
          const medicineResponse = await getMedicineList(member.user_id);
          if (medicineResponse.success && medicineResponse.data) {
            return medicineResponse.data.map(medicine => ({
              ...medicine,
              ownerName: member.name,
              ownerRole: member.role,
              ownerId: member.user_id
            }));
          }
          return [];
        } catch (error) {
          console.error(`약물 목록 조회 실패 (${member.name}):`, error);
          return [];
        }
      });
      
      const medicineArrays = await Promise.all(medicinePromises);
      const allFamilyMedicines = medicineArrays.reduce((acc, arr) => [...acc, ...arr], []);
      
      // 현재 약물 찾기
      const currentMedicine = allFamilyMedicines.find(m => m.medi_id === medi_id);
      if (!currentMedicine) {
        throw new Error('약물 정보를 찾을 수 없습니다.');
      }
      
      // 상호작용 검사 실행
      if (allFamilyMedicines.length >= 2) {
        const interactionResult = await DrugInteractionValidator.validateDrugInteractions(allFamilyMedicines);
        
        if (interactionResult.hasInteractions) {
          const criticalCount = interactionResult.interactions.filter(i => i.severity === 'critical').length;
          const majorCount = interactionResult.interactions.filter(i => i.severity === 'major').length;
          
          // 현재 약물과 관련된 상호작용만 필터링
          const relevantInteractions = interactionResult.interactions.filter(
            interaction => interaction.drugA === currentMedicine.name || interaction.drugB === currentMedicine.name
          );
          
          if (relevantInteractions.length > 0) {
            const severity = criticalCount > 0 ? 'critical' : majorCount > 0 ? 'major' : 'moderate';
            const severityText = severity === 'critical' ? '심각한' : severity === 'major' ? '주요' : '중간';
            
            Alert.alert(
              `⚠️ 약물 상호작용 발견`,
              `${currentMedicine.name}과(와) 다른 약물 간 ${severityText} 상호작용이 발견되었습니다.\n\n스케줄 저장을 중단합니다.\n\n상호작용 약물:\n${relevantInteractions.map(i => `• ${i.drugA === currentMedicine.name ? i.drugB : i.drugA}`).join('\n')}`,
              [{ text: '확인', style: 'default' }]
            );
            return; // 스케줄 저장 차단
          }
        }
      }
      
      const userJson = await AsyncStorage.getItem('@user');
      const user = userJson ? JSON.parse(userJson) : null;
      const mainUserId = user?.accountType === 'parent' ? user.id : user.parentUuid;
      await saveMedicineSchedule(medi_id, mainUserId, schedule.schedule, finalTotalQuantity, finalDoseCount);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ totalQuantity: finalTotalQuantity, doseCount: finalDoseCount }));
      Toast.show({
        type: 'success',
        text1: '저장 완료',
        text2: '약 스케줄이 저장되었습니다.'
      });
      
      // 🔥 대시보드 새로고침을 위해 MainTabs로 이동하면서 refresh 플래그 전달
      navigation.navigate('MainTabs', {
        screen: 'Member',
        params: { refresh: true }
      });
    } catch (error) {
      console.error('스케줄 저장 실패:', error);
      Alert.alert('오류', '스케줄 저장에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!medi_id || !user_id) {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: '약 정보를 찾을 수 없습니다.'
      });
      return;
    }

    Alert.alert(
      '삭제 확인',
      '이 약 스케줄을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteMedicineSchedule(medi_id, user_id);
              Toast.show({
                type: 'success',
                text1: '삭제 완료',
                text2: '약 스케줄이 삭제되었습니다.'
              });
              navigation.goBack();
            } catch (error) {
              console.error('스케줄 삭제 실패:', error);
              Alert.alert('오류', '스케줄 삭제에 실패했습니다.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    if (!medi_id || !user_id) {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: '약 정보를 찾을 수 없습니다.'
      });
      return;
    }

    navigation.navigate('MedicineScheduleEdit', {
      medicineId: medi_id,
      memberId: user_id,
      medicineName: medicineName || '',
      isReadOnly: false
    });
  };

  const handleTimeSlotPress = (day: DayOfWeek, time: TimeOfDay) => {
    if (!schedule) return;
    const newSchedule = {
      ...schedule,
      schedule: {
        ...schedule.schedule,
        [day]: {
          ...schedule.schedule[day],
          [time]: !schedule.schedule[day][time]
        }
      }
    };
    setSchedule(newSchedule);
  };

  const renderTimeSlot = (day: DayOfWeek, time: TimeOfDay) => {
    const isChecked = schedule?.schedule[day][time] || false;
    return (
      <TouchableOpacity
        key={`${day}-${time}`}
        style={[
          styles.timeSlot,
          isChecked && { backgroundColor: themeColors.PRIMARY.DEFAULT }
        ]}
        onPress={() => handleTimeSlotPress(day, time)}
      >
        <Text style={[
          styles.timeSlotText,
          isChecked && { color: themeColors.WHITE }
        ]}>
          {TIME_LABELS[time]}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDaySchedule = (day: DayOfWeek) => {
    return (
      <View key={day} style={styles.dayContainer}>
        <Text style={[styles.dayText, { color: themeColors.text }]}>
          {DAY_LABELS[day]}
        </Text>
        <View style={styles.timeSlotsContainer}>
          {TIMES.map(time => renderTimeSlot(day, time))}
        </View>
      </View>
    );
  };

  const renderSchedule = () => {
    if (!schedule) return null;
    return (
      <View style={styles.scheduleContainer}>
        {DAYS.map(day => renderDaySchedule(day))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.text} />
      </View>
    );
  }

  if (schedule === null) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>{noScheduleMessage || '스케줄이 없습니다.'}</Text>
      </View>
    );
  }

  // 탭 네비게이션에서 접근한 경우 기본 화면 표시
  if (!medi_id || !user_id) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>복용 일정</Text>
        <Text style={[styles.subtitle, { color: themeColors.text }]}>약을 선택하여 복용 일정을 확인하세요</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>{medicineName}</Text>
          {!isReadOnly && (
            <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
              <Feather name="edit-2" size={24} color={themeColors.text} />
            </TouchableOpacity>
          )}
        </View>
        {!isReadOnly && userAccountType === 'parent' && (
          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.inputLabel, { color: themeColors.text }]}>총 투입량</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: themeColors.card,
                  color: themeColors.text,
                  borderColor: themeColors.border 
                }]}
                value={totalQuantity}
                onChangeText={setTotalQuantity}
                placeholder="총 투입량을 입력하세요"
                placeholderTextColor={themeColors.text}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: themeColors.text }]}>1회 복용량</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: themeColors.card,
                  color: themeColors.text,
                  borderColor: themeColors.border 
                }]}
                value={doseCount}
                onChangeText={setDoseCount}
                placeholder="1회 복용량을 입력하세요"
                placeholderTextColor={themeColors.text}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}
        {Object.keys(groupedMedicines).map(slot => (
          <View key={slot} style={styles.slotCard}>
            <Text style={styles.slotTitle}>{slot === '기타' ? '디스펜서 정보 없음' : `${slot}번 디스펜서`}</Text>
            {groupedMedicines[slot].map(med => {
              const medicine = med as Medicine;
              return (
                <View key={medicine.medi_id} style={styles.medicineCard}>
                  <Text style={styles.medicineName}>{medicine.name}</Text>
                  <View style={styles.scheduleTable}>
                    <View style={styles.scheduleHeaderRow}>
                      <Text style={styles.scheduleHeaderCell}></Text>
                      {TIMES.map(time => (
                        <Text key={time} style={styles.scheduleHeaderCell}>{TIME_LABELS[time]}</Text>
                      ))}
                    </View>
                    {DAYS.map(day => (
                      <View key={day} style={styles.scheduleRow}>
                        <Text style={styles.scheduleDayCell}>{DAY_LABELS[day]}</Text>
                        {TIMES.map(time => {
                          const checked = allSchedules[medicine.medi_id]?.schedule?.[day]?.[time];
                          return (
                            <View
                              key={time}
                              style={[
                                styles.scheduleCell,
                                checked && styles.scheduleCellChecked
                              ]}
                            >
                              {checked && <Feather name="check" size={16} color="#fff" />}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 60 : 40,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  scheduleContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timeCell: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  dayCell: {
    flex: 1,
    padding: 8,
  },
  selectedCell: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  timeText: {
    fontWeight: 'bold',
  },
  dayText: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  deleteButton: {
    backgroundColor: colors.DANGER.DEFAULT,
  },
  buttonText: {
    color: colors.WHITE,
    fontWeight: 'bold',
    fontSize: 16,
  },
  slotCard: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  slotTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.PRIMARY.DEFAULT,
  },
  medicineCard: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  medicineName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scheduleTable: {
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
    padding: 8,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  scheduleHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    color: colors.PRIMARY.DEFAULT,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  scheduleDayCell: {
    width: 32,
    textAlign: 'center',
    fontWeight: 'bold',
    color: colors.PRIMARY.DEFAULT,
  },
  scheduleCell: {
    flex: 1,
    height: 28,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCellChecked: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  editButton: {
    padding: 8,
  },
  timeSlot: {
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    marginVertical: 2,
    minWidth: 60,
    alignItems: 'center'
  },
  timeSlotText: {
    fontSize: 14
  },
  dayContainer: {
    marginBottom: 20,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
  },
});

export default MedicineScheduleScreen; 