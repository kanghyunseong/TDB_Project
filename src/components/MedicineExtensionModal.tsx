import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../constants/colors';
import { Medicine, FamilyMember } from '../types/tdb';

interface MedicineExtensionModalProps {
  visible: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  selectedMember: FamilyMember | null;
  onExtensionComplete: () => void;
}

const MedicineExtensionModal: React.FC<MedicineExtensionModalProps> = ({
  visible,
  onClose,
  medicine,
  selectedMember,
  onExtensionComplete,
}) => {
  const [isExtending, setIsExtending] = useState(false);

  if (!medicine || !selectedMember) return null;

  // 남은 일수 계산
  const getRemainingDays = () => {
    if (!medicine.end_date) return 0;
    const endDate = new Date(medicine.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const remainingDays = getRemainingDays();

  // 1주일 연장 처리
  const handleExtension = async () => {
    try {
      setIsExtending(true);

      if (!medicine.end_date) {
        throw new Error('종료일 정보가 없습니다.');
      }

      // 현재 종료일에서 7일 추가
      const currentEndDate = new Date(medicine.end_date);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(currentEndDate.getDate() + 7);
      const newEndDateString = newEndDate.toISOString().split('T')[0];

      // 약물 업데이트 API 호출
      const { saveMedicine } = await import('../api/family');
      
      const updateData: Medicine = {
        ...medicine,
        end_date: newEndDateString,
      };

      console.log('🔥 약물 연장 요청:', updateData);

      const result = await saveMedicine(
        selectedMember.user_id,
        updateData,
        medicine.medi_id
      );

      Toast.show({
        type: 'success',
        text1: '복용 기간 연장 완료',
        text2: `${medicine.name}의 복용 기간이 1주일 연장되었습니다.`,
        position: 'bottom',
      });

      onExtensionComplete();
      onClose();

    } catch (error) {
      console.error('연장 처리 실패:', error);
      Toast.show({
        type: 'error',
        text1: '연장 실패',
        text2: error instanceof Error ? error.message : '연장 처리 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    } finally {
      setIsExtending(false);
    }
  };

  // 연장 거부 처리 (약물 비활성화 또는 종료 표시)
  const handleSkipExtension = () => {
    Alert.alert(
      '복용 기간 만료',
      `${medicine.name}의 복용 기간이 만료됩니다. 복용을 중단하시겠습니까?`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '복용 중단',
          style: 'destructive',
          onPress: () => {
            Toast.show({
              type: 'info',
              text1: '복용 중단',
              text2: `${medicine.name}의 복용이 중단되었습니다.`,
              position: 'bottom',
            });
            onClose();
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>복용 기간 연장</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 내용 */}
        <View style={styles.content}>
          {/* 약물 정보 */}
          <View style={styles.medicineInfo}>
            <View style={styles.medicineHeader}>
              <Text style={styles.medicineName}>{medicine.name}</Text>
              <View style={styles.slotBadge}>
                <Text style={styles.slotText}>슬롯 {medicine.slot}번</Text>
              </View>
            </View>
            
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>현재 복용 기간</Text>
              <Text style={styles.dateText}>
                {medicine.start_date ? new Date(medicine.start_date).toLocaleDateString('ko-KR') : '시작일 없음'} ~ {' '}
                {medicine.end_date ? new Date(medicine.end_date).toLocaleDateString('ko-KR') : '종료일 없음'}
              </Text>
            </View>
          </View>

          {/* 경고 메시지 */}
          <View style={[
            styles.warningBox,
            { backgroundColor: remainingDays <= 1 ? '#FFE5E5' : '#FFF8E1' }
          ]}>
            <Feather 
              name={remainingDays <= 1 ? "alert-circle" : "clock"} 
              size={24} 
              color={remainingDays <= 1 ? '#FF6B6B' : '#FFA500'} 
            />
            <View style={styles.warningContent}>
              <Text style={[
                styles.warningTitle,
                { color: remainingDays <= 1 ? '#D63384' : '#F57C00' }
              ]}>
                {remainingDays <= 1 ? '복용 기간 만료' : '복용 기간 만료 임박'}
              </Text>
              <Text style={styles.warningText}>
                {remainingDays <= 0 
                  ? '복용 기간이 만료되었습니다.'
                  : `복용 기간이 ${remainingDays}일 남았습니다.`
                }
              </Text>
              <Text style={styles.warningSubText}>
                복용 기간을 1주일 연장하시겠습니까?
              </Text>
            </View>
          </View>

          {/* 연장 후 정보 */}
          <View style={styles.extensionInfo}>
            <Text style={styles.extensionTitle}>연장 시 복용 기간</Text>
            <Text style={styles.extensionText}>
              {medicine.start_date ? new Date(medicine.start_date).toLocaleDateString('ko-KR') : '시작일 없음'} ~ {' '}
              {medicine.end_date ? (() => {
                const currentEndDate = new Date(medicine.end_date);
                const newEndDate = new Date(currentEndDate);
                newEndDate.setDate(currentEndDate.getDate() + 7);
                return newEndDate.toLocaleDateString('ko-KR');
              })() : '종료일 없음'}
            </Text>
          </View>
        </View>

        {/* 버튼 영역 */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkipExtension}
            disabled={isExtending}
          >
            <Text style={styles.skipButtonText}>복용 중단</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.extendButton, isExtending && styles.disabledButton]}
            onPress={handleExtension}
            disabled={isExtending}
          >
            {isExtending ? (
              <Text style={styles.extendButtonText}>연장 중...</Text>
            ) : (
              <>
                <Feather name="calendar-plus" size={16} color="white" />
                <Text style={styles.extendButtonText}>1주일 연장</Text>
              </>
            )}
          </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: 20,
  },
  medicineInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  medicineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  slotBadge: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slotText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  dateInfo: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  warningSubText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  extensionInfo: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.PRIMARY.DEFAULT,
  },
  extensionTitle: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
    marginBottom: 4,
  },
  extensionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  skipButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  extendButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  extendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default MedicineExtensionModal; 