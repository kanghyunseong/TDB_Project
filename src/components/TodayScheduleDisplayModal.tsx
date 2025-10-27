import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../constants/colors';
import { Medicine, FamilyMember } from '../types/tdb';

interface TodayScheduleDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  medicineList: Medicine[];
  selectedMember: FamilyMember | null;
  dailySchedules: Record<string, any>;
  userType: 'parent' | 'child' | null;
  familyMembers: FamilyMember[];
}

const TodayScheduleDisplayModal: React.FC<TodayScheduleDisplayModalProps> = ({
  visible,
  onClose,
  medicineList,
  selectedMember,
  dailySchedules,
  userType,
  familyMembers,
}) => {
  // 오늘 요일 계산
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const todayName = dayNames[dayOfWeek];
  const todayDate = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 🔥 공통 약물인지 확인하는 함수
  const isCommonMedicine = (medicine: Medicine) => {
    return !medicine.target_users || medicine.target_users.length === 0 || medicine.target_users.length > 1;
  };

  const getTodayMedicines = () => {
    const todayMedicines: Array<{
      medicine: Medicine;
      userName: string;
      userId: string;
      schedule: {
        morning: number;
        afternoon: number;
        evening: number;
        total: number;
      };
    }> = [];

    console.log(`🔍 [TodayScheduleDisplayModal] 약물 필터링 시작: ${medicineList.length}개 약물`);

    // 🔥 자식 계정을 위한 권한 필터링
    const accessibleMedicines = medicineList.filter(medicine => {
      const permission = (medicine as any).permission;
      
      console.log(`🔍 [TodayScheduleDisplayModal] ${medicine.name} 권한 검사:`, {
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

    console.log(`🔍 [TodayScheduleDisplayModal] 접근 가능한 약물: ${accessibleMedicines.length}개`);

    accessibleMedicines.forEach((medicine) => {
      // 🔥 공통 약물인 경우
      if (isCommonMedicine(medicine)) {
        console.log(`🔍 [TodayScheduleDisplayModal] ${medicine.name}은 공통 약물입니다`);
        
        // 부모 계정: 모든 가족 구성원의 스케줄 확인
        // 자식 계정: 자기 자신의 스케줄만 확인
        const membersToCheck = userType === 'parent' 
          ? familyMembers 
          : familyMembers.filter(member => member.user_id === selectedMember?.user_id);

        console.log(`🔍 [TodayScheduleDisplayModal] 확인할 멤버: ${membersToCheck.map(m => m.name).join(', ')}`);

        membersToCheck.forEach(member => {
          const scheduleKey = `${medicine.medi_id}_${member.user_id}`;
          const dailySchedule = dailySchedules[scheduleKey];

          console.log(`🔍 [TodayScheduleDisplayModal] ${medicine.name} - ${member.name} 스케줄 확인:`, {
            scheduleKey,
            hasSchedule: !!dailySchedule
          });

          if (dailySchedule) {
            const dayScheduleKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];
            
            let todayDoses = {
              morning: dailySchedule.morning || 0,
              afternoon: dailySchedule.afternoon || 0,
              evening: dailySchedule.evening || 0,
              total: 0,
            };

            // 요일별 스케줄이 있는 경우
            if (dailySchedule.weeklySchedule && dailySchedule.weeklySchedule[dayScheduleKey]) {
              const weeklySchedule = dailySchedule.weeklySchedule[dayScheduleKey];
              todayDoses = {
                morning: weeklySchedule.morning ? (parseInt(weeklySchedule.morningDose?.toString()) || 1) : 0,
                afternoon: weeklySchedule.afternoon ? (parseInt(weeklySchedule.afternoonDose?.toString()) || 1) : 0,
                evening: weeklySchedule.evening ? (parseInt(weeklySchedule.eveningDose?.toString()) || 1) : 0,
                total: 0,
              };
            }

            todayDoses.total = todayDoses.morning + todayDoses.afternoon + todayDoses.evening;

            if (todayDoses.total > 0) {
              todayMedicines.push({
                medicine,
                userName: member.name,
                userId: member.user_id,
                schedule: todayDoses,
              });
            }
          }
        });
      } 
      // 🔥 개인 약물인 경우
      else {
        const targetUserId = medicine.target_users![0];
        const targetMember = familyMembers.find(m => m.user_id === targetUserId);

        // 자식 계정인데 자기 약물이 아니면 스킵
        if (userType === 'child' && targetUserId !== selectedMember?.user_id) {
          return;
        }

        const scheduleKey = `${medicine.medi_id}_${targetUserId}`;
        const dailySchedule = dailySchedules[scheduleKey];

        console.log(`🔍 [TodayScheduleDisplayModal] ${medicine.name} - ${targetMember?.name} (개인약물) 스케줄 확인:`, {
          scheduleKey,
          hasSchedule: !!dailySchedule
        });

        if (dailySchedule) {
          const dayScheduleKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];
          
          let todayDoses = {
            morning: dailySchedule.morning || 0,
            afternoon: dailySchedule.afternoon || 0,
            evening: dailySchedule.evening || 0,
            total: 0,
          };

          // 요일별 스케줄이 있는 경우
          if (dailySchedule.weeklySchedule && dailySchedule.weeklySchedule[dayScheduleKey]) {
            const weeklySchedule = dailySchedule.weeklySchedule[dayScheduleKey];
            todayDoses = {
              morning: weeklySchedule.morning ? (parseInt(weeklySchedule.morningDose?.toString()) || 1) : 0,
              afternoon: weeklySchedule.afternoon ? (parseInt(weeklySchedule.afternoonDose?.toString()) || 1) : 0,
              evening: weeklySchedule.evening ? (parseInt(weeklySchedule.eveningDose?.toString()) || 1) : 0,
              total: 0,
            };
          }

          todayDoses.total = todayDoses.morning + todayDoses.afternoon + todayDoses.evening;

          if (todayDoses.total > 0) {
            todayMedicines.push({
              medicine,
              userName: targetMember?.name || '알 수 없음',
              userId: targetUserId,
              schedule: todayDoses,
            });
          }
        }
      }
    });

    console.log(`🔍 [TodayScheduleDisplayModal] 최종 오늘 복용 약물: ${todayMedicines.length}개`);
    return todayMedicines;
  };

  const todayMedicines = getTodayMedicines();

  const getTimeLabel = (time: 'morning' | 'afternoon' | 'evening') => {
    switch (time) {
      case 'morning': return '아침';
      case 'afternoon': return '점심';  
      case 'evening': return '저녁';
      default: return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>오늘의 복용 스케줄</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 날짜 정보 */}
        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>{todayDate}</Text>
          <Text style={styles.dayText}>{todayName}</Text>
        </View>

        {/* 스케줄 목록 */}
        <ScrollView style={styles.content}>
          {todayMedicines.length > 0 ? (
            todayMedicines.map((item, index) => (
              <View key={`${item.medicine.medi_id}_${item.userId}_${index}`} style={styles.medicineCard}>
                <View style={styles.medicineHeader}>
                  <View style={styles.medicineNameContainer}>
                    <Text style={styles.medicineName}>{item.medicine.name}</Text>
                    {/* 🔥 사용자 이름 표시 */}
                    <Text style={styles.medicineOwner}>
                      {isCommonMedicine(item.medicine) ? `👥 ${item.userName}` : `👤 ${item.userName}`}
                    </Text>
                  </View>
                  <Text style={styles.medicineSlot}>슬롯 {item.medicine.slot}번</Text>
                </View>
                
                <View style={styles.scheduleDetails}>
                  {(['morning', 'afternoon', 'evening'] as const).map((timeOfDay) => {
                    const dose = item.schedule[timeOfDay];
                    if (dose > 0) {
                      return (
                        <View key={timeOfDay} style={styles.timeSlot}>
                          <Text style={styles.timeLabel}>{getTimeLabel(timeOfDay)}</Text>
                          <Text style={styles.doseText}>{dose}정</Text>
                        </View>
                      );
                    }
                    return null;
                  })}
                </View>

                <View style={styles.totalDose}>
                  <Text style={styles.totalDoseText}>
                    총 {item.schedule.total}정
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>오늘 복용할 약물이 없습니다</Text>
              <Text style={styles.emptySubtitle}>
                {todayName}에는 스케줄이 등록된 약물이 없습니다.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* 안내 메시지 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🔥 실제 배출은 RFID 태그를 디스펜서에 인식하세요
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  dateInfo: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
  dayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.PRIMARY.DEFAULT,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  medicineCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medicineNameContainer: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  medicineOwner: {
    fontSize: 12,
    color: colors.PRIMARY.DEFAULT,
    fontWeight: '500',
  },
  medicineSlot: {
    fontSize: 14,
    color: colors.PRIMARY.DEFAULT,
    fontWeight: '500',
  },
  scheduleDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeSlot: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  doseText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.PRIMARY.DEFAULT,
  },
  totalDose: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalDoseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
});

export default TodayScheduleDisplayModal; 