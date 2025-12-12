import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import Toast from 'react-native-toast-message';
import type { Medicine } from '../types/tdb';
import { scheduleApi } from '../api/schedule';
import { userApi } from '../api/users';
import AntDesign from 'react-native-vector-icons/AntDesign';

interface ScheduleBasedDispenseModalProps {
  visible: boolean;
  onClose: () => void;
  medicines: Medicine[];
  selectedUserId: string;
  dailySchedules: Record<string, { morning: number; afternoon: number; evening: number; total: number; weeklySchedule: Record<string, any> | null }>;
  onDispenseComplete: () => void;
  userType: 'parent' | 'child' | null;
}

interface MedicineWithSchedule extends Medicine {
  todayTotal: number;
  scheduleText: string;
  isScheduledToday: boolean;
  morning: number;
  afternoon: number;
  evening: number;
}

export const ScheduleBasedDispenseModal: React.FC<ScheduleBasedDispenseModalProps> = ({
  visible,
  onClose,
  medicines,
  selectedUserId,
  dailySchedules,
  onDispenseComplete,
  userType,
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [dispensingMedicines, setDispensingMedicines] = useState<Set<string>>(new Set());
  const [medicinesWithSchedule, setMedicinesWithSchedule] = useState<MedicineWithSchedule[]>([]);

  // 오늘의 스케줄 계산 함수
  const getTodayScheduleForMedicine = (medicine: Medicine, dailySchedule: any) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[dayOfWeek];
    
    // 기본 복용량 확인
    const morningDose = dailySchedule?.morning || 0;
    const afternoonDose = dailySchedule?.afternoon || 0;
    const eveningDose = dailySchedule?.evening || 0;
    
    if (morningDose > 0 || afternoonDose > 0 || eveningDose > 0) {
      return {
        morning: morningDose,
        afternoon: afternoonDose,
        evening: eveningDose,
        total: morningDose + afternoonDose + eveningDose,
        isScheduledDay: true
      };
    }
    
    // 요일별 스케줄 확인
    if (dailySchedule?.weeklySchedule) {
      const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayShortName = shortDayNames[dayOfWeek];
      
      let todaySchedule = dailySchedule.weeklySchedule[todayName] || dailySchedule.weeklySchedule[todayShortName];
      
      if (todaySchedule) {
        const weeklyMorningDose = todaySchedule.morning ? (parseInt(todaySchedule.morningDose?.toString()) || 1) : 0;
        const weeklyAfternoonDose = todaySchedule.afternoon ? (parseInt(todaySchedule.afternoonDose?.toString()) || 1) : 0;
        const weeklyEveningDose = todaySchedule.evening ? (parseInt(todaySchedule.eveningDose?.toString()) || 1) : 0;
        
        return {
          morning: weeklyMorningDose,
          afternoon: weeklyAfternoonDose,
          evening: weeklyEveningDose,
          total: weeklyMorningDose + weeklyAfternoonDose + weeklyEveningDose,
          isScheduledDay: weeklyMorningDose > 0 || weeklyAfternoonDose > 0 || weeklyEveningDose > 0
        };
      }
    }
    
    return {
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0,
      isScheduledDay: false
    };
  };

  // medicines와 dailySchedules가 변경될 때마다 스케줄 정보 계산
  useEffect(() => {
    if (!visible || !medicines.length) {
      setMedicinesWithSchedule([]);
      return;
    }

    console.log(`🔍 [ScheduleBasedDispenseModal] 약물 필터링 시작: ${medicines.length}개 약물`);

    // 🔥 자식 계정을 위한 권한 필터링
    const accessibleMedicines = medicines.filter(medicine => {
      const permission = (medicine as any).permission;
      
      console.log(`🔍 [ScheduleBasedDispenseModal] ${medicine.name} 권한 검사:`, {
        permission,
        userType,
        target_users: medicine.target_users
      });
      
      if (userType === 'parent') {
        return true; // 부모는 모든 약물 접근 가능
      } else {
        return permission === 'own' || permission === 'common'; // 자식은 본인 약물과 공통 약물만
      }
    });

    console.log(`🔍 [ScheduleBasedDispenseModal] 접근 가능한 약물: ${accessibleMedicines.length}개`);

    const medicinesWithScheduleData: MedicineWithSchedule[] = accessibleMedicines
      .map(medicine => {
        // target_users 기반으로 올바른 스케줄 키 생성
        let actualTargetUserId = selectedUserId;
        if (medicine.target_users && medicine.target_users.length > 0) {
          actualTargetUserId = medicine.target_users[0];
        }
        
        const scheduleKey = `${medicine.medi_id}_${actualTargetUserId}`;
        const dailySchedule = dailySchedules[scheduleKey];
        const todaySchedule = getTodayScheduleForMedicine(medicine, dailySchedule);
        
        const timeSlots = [];
        if (todaySchedule.morning > 0) timeSlots.push(`아침 ${todaySchedule.morning}정`);
        if (todaySchedule.afternoon > 0) timeSlots.push(`점심 ${todaySchedule.afternoon}정`);
        if (todaySchedule.evening > 0) timeSlots.push(`저녁 ${todaySchedule.evening}정`);
        
        const scheduleText = timeSlots.length > 0 ? timeSlots.join(', ') : '오늘은 복용 안함';
        
        console.log(`🔍 [ScheduleBasedDispenseModal] ${medicine.name} 스케줄:`, {
          actualTargetUserId,
          scheduleKey,
          todayTotal: todaySchedule.total,
          isScheduledToday: todaySchedule.isScheduledDay
        });
        
        return {
          ...medicine,
          todayTotal: todaySchedule.total,
          scheduleText,
          isScheduledToday: todaySchedule.isScheduledDay,
          morning: todaySchedule.morning,
          afternoon: todaySchedule.afternoon,
          evening: todaySchedule.evening,
        };
      })
      .filter(medicine => medicine.isScheduledToday && medicine.todayTotal > 0); // 오늘 스케줄이 있는 약물만

    console.log(`🔍 [ScheduleBasedDispenseModal] 최종 스케줄 약물: ${medicinesWithScheduleData.length}개`);
    setMedicinesWithSchedule(medicinesWithScheduleData);
  }, [medicines, dailySchedules, selectedUserId, visible, userType]);

  // 개별 약물 배출 함수
  const handleDispenseMedicine = async (medicine: MedicineWithSchedule) => {
    if (dispensingMedicines.has(medicine.medi_id)) return;
    
    try {
      setDispensingMedicines(prev => new Set(prev).add(medicine.medi_id));
      
      console.log('🔥 [스케줄 기반 배출] 시작:', {
        medicine: medicine.name,
        todayTotal: medicine.todayTotal,
        schedule: `${medicine.morning}+${medicine.afternoon}+${medicine.evening}`
      });
      
      // 1. 사용자의 machine_id 조회
      let actualTargetUserId = selectedUserId;
      if (medicine.target_users && medicine.target_users.length > 0) {
        actualTargetUserId = medicine.target_users[0];
      }
      
      const machineIdResponse = await userApi.getUserMachineId(actualTargetUserId);
      if (!machineIdResponse.success || !machineIdResponse.data?.machine_id) {
        throw new Error('디스펜서 기기 정보를 찾을 수 없습니다.');
      }
      
      const machine_id = machineIdResponse.data.machine_id;
      
      // 2. 약물 배출 API 호출 (스케줄 기반 자동배출)
      const { scheduleDispense } = await import('../api/dispenser');
      const dispenseResult = await scheduleDispense(
        machine_id,
        actualTargetUserId,
        medicine.medi_id,
        medicine.slot || 1,
        medicine.todayTotal,
        '스케줄 기반 자동배출'
      );

      if (!dispenseResult.success) {
        throw new Error(dispenseResult.error?.message || '약물 배출에 실패했습니다.');
      }

      // 🔥 배출 API에서 이미 복용 기록을 생성하므로 추가 호출 불필요
      console.log('✅ [스케줄 배출] 배출 완료 (복용 기록은 배출 API에서 자동 생성됨)');
      
      Toast.show({
        type: 'success',
        text1: '📦 스케줄 배출 완료',
        text2: `${medicine.name} 총 ${medicine.todayTotal}정 배출 완료`,
        position: 'bottom',
      });
      
    } catch (error) {
      console.error('🔥 [스케줄 배출] 실패:', error);
      Toast.show({
        type: 'error',
        text1: '배출 실패',
        text2: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        position: 'bottom',
      });
    } finally {
      setDispensingMedicines(prev => {
        const newSet = new Set(prev);
        newSet.delete(medicine.medi_id);
        return newSet;
      });
    }
  };

  // 전체 약물 일괄 배출 함수
  const handleDispenseAll = async () => {
    if (medicinesWithSchedule.length === 0) return;
    
    Alert.alert(
      '전체 배출 확인',
      `오늘 스케줄이 있는 모든 약물(${medicinesWithSchedule.length}개)을 한 번에 배출하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '배출',
          style: 'default',
          onPress: async () => {
            try {
              for (const medicine of medicinesWithSchedule) {
                if (!dispensingMedicines.has(medicine.medi_id)) {
                  await handleDispenseMedicine(medicine);
                  // 각 배출 사이에 잠깐 대기
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              // 전체 배출 완료 후 모달 닫기
              setTimeout(() => {
                onDispenseComplete();
                onClose();
              }, 2000);
              
            } catch (error) {
              console.error('🔥 [전체 배출] 실패:', error);
            }
          }
        }
      ]
    );
  };

  const handleClose = () => {
    if (dispensingMedicines.size > 0) {
      Alert.alert(
        '배출 진행 중',
        '현재 약물 배출이 진행 중입니다. 잠시 후 다시 시도해주세요.',
        [{ text: '확인' }]
      );
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
          {/* 헤더 */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              📦 스케줄 기반 일반 배출
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* 설명 */}
          <View style={styles.modalDescription}>
            <Text style={[styles.descriptionText, { color: isDark ? '#888' : '#666' }]}>
              오늘 복용 스케줄이 있는 약물들을 하루치씩 배출합니다
            </Text>
          </View>

          {/* 약물 목록 */}
          <ScrollView style={styles.medicineList} showsVerticalScrollIndicator={false}>
            {medicinesWithSchedule.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="calendar-x" size={48} color={isDark ? '#666' : '#ccc'} />
                <Text style={[styles.emptyText, { color: isDark ? '#888' : '#666' }]}>
                  오늘 복용 스케줄이 있는 약물이 없습니다
                </Text>
              </View>
            ) : (
              <>
                {medicinesWithSchedule.map((medicine) => {
                  const isDispensing = dispensingMedicines.has(medicine.medi_id);
                  
                  return (
                    <View key={medicine.medi_id} style={[styles.medicineCard, { backgroundColor: isDark ? themeColors.card : 'white' }]}>
                      <View style={styles.medicineInfo}>
                        <View style={styles.medicineHeader}>
                          <Text style={[styles.medicineName, { color: themeColors.text }]}>
                            {medicine.name}
                          </Text>
                          <View style={[styles.slotBadge, { backgroundColor: colors.PRIMARY.DEFAULT }]}>
                            <Text style={styles.slotText}>{medicine.slot}번</Text>
                          </View>
                        </View>
                        
                        <Text style={[styles.scheduleText, { color: colors.SUCCESS.DEFAULT }]}>
                          📋 {medicine.scheduleText}
                        </Text>
                        
                        <Text style={[styles.totalText, { color: isDark ? '#888' : '#666' }]}>
                          총 {medicine.todayTotal}정 배출 예정
                        </Text>
                      </View>
                      
                      <TouchableOpacity
                        style={[
                          styles.dispenseButton,
                          { backgroundColor: colors.SUCCESS.DEFAULT },
                          isDispensing && styles.dispenseButtonDisabled
                        ]}
                        onPress={() => handleDispenseMedicine(medicine)}
                        disabled={isDispensing}
                      >
                        {isDispensing ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Feather name="carry-out" size={16} color="white" />
                        )}
                        <Text style={styles.dispenseButtonText}>
                          {isDispensing ? '배출 중...' : '배출'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* 하단 버튼들 */}
          <View style={styles.modalFooter}>
            {medicinesWithSchedule.length > 0 && (
              <TouchableOpacity
                style={[styles.allDispenseButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
                onPress={handleDispenseAll}
                disabled={dispensingMedicines.size > 0}
              >
                <AntDesign name="packages" size={16} color="white" />
                <Text style={styles.allDispenseButtonText}>
                  전체 배출 ({medicinesWithSchedule.length}개)
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: themeColors.text }]}
              onPress={handleClose}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>
                닫기
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  modalDescription: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  medicineList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  medicineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  medicineInfo: {
    flex: 1,
    marginRight: 15,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  slotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  slotText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scheduleText: {
    fontSize: 14,
    marginBottom: 5,
  },
  totalText: {
    fontSize: 12,
  },
  dispenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  dispenseButtonDisabled: {
    opacity: 0.6,
  },
  dispenseButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  modalFooter: {
    gap: 10,
  },
  allDispenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  allDispenseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    borderWidth: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 