import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { User } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface AgeValidationResult {
  age: number | null;
  isValid: boolean;
  warnings: string[];
  errors: string[];
  adjustedDose: number;
}

interface AgeWarningModalProps {
  visible: boolean;
  onClose: () => void;
  userInfo: User | null;
  medicineInfo: {
    name: string;
    id: string;
  };
  validationResult: AgeValidationResult;
  mode?: 'detail' | 'warning' | 'schedule';
}

const AgeWarningModal: React.FC<AgeWarningModalProps> = ({
  visible,
  onClose,
  userInfo,
  medicineInfo,
  validationResult,
  mode = 'detail'
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
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

  const getAgeCategory = (age: number | null) => {
    if (age === null) return '알 수 없음';
    if (age < 2) return '영아기 (0-2세)';
    if (age < 7) return '유아기 (2-6세)';
    if (age <= 14) return '아동기 (7-14세)';
    if (age <= 19) return '청소년기 (15-19세)';
    return '성인 (20세 이상)';
  };

  const getAgeGuidance = (age: number | null) => {
    if (age === null) return ['나이 정보가 없어 정확한 안내를 제공할 수 없습니다.'];
    
    if (age < 2) {
      return [
        '영아기에는 대부분의 약물 복용이 제한됩니다.',
        '반드시 소아과 전문의와 상담하세요.',
        '모유수유 중인 경우 더욱 주의가 필요합니다.'
      ];
    }
    
    if (age < 7) {
      return [
        '유아기에는 성인 용량의 25% 정도가 적절합니다.',
        '소아과 전문의와 상담 후 복용하세요.',
        '체중과 연령을 모두 고려한 용량 조절이 필요합니다.'
      ];
    }
    
    if (age <= 14) {
      return [
        '아동기에는 성인 용량의 50% 정도가 적절합니다.',
        '체중 기반 용량 계산이 더 정확할 수 있습니다.',
        '부작용 발생 시 즉시 중단하고 의사와 상담하세요.'
      ];
    }
    
    if (age <= 19) {
      return [
        '청소년기에는 성인 용량에 가깝게 복용할 수 있습니다.',
        '개인차가 클 수 있으므로 주의 깊게 관찰하세요.',
        '학업 스트레스나 성장기 특성을 고려하세요.'
      ];
    }
    
    return [
      '성인 용량으로 복용하실 수 있습니다.',
      '다른 복용 중인 약물과의 상호작용을 확인하세요.',
      '정기적인 건강 검진을 받으세요.'
    ];
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'warning': return '⚠️ 연령 관련 주의사항';
      case 'schedule': return '📅 스케줄 등록 전 확인';
      default: return '👤 연령별 용법 안내';
    }
  };

  const age = validationResult.age || calculateAge(userInfo?.birthDate || null);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View style={[
          styles.modalContent, 
          { 
            backgroundColor: themeColors.background,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          {/* 헤더 */}
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#374151' : '#f0f0f0' }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{getModeTitle()}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: isDark ? '#374151' : '#f8f9fa' }]}>
              <Ionicons name="close" size={24} color={isDark ? '#888' : '#666'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {/* 사용자 정보 */}
            <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>👤 사용자 정보</Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.GRAY.DEFAULT }]}>이름:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{userInfo?.name || '알 수 없음'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.GRAY.DEFAULT }]}>나이:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{age !== null ? `${age}세` : '정보 없음'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.GRAY.DEFAULT }]}>연령대:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{getAgeCategory(age)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.GRAY.DEFAULT }]}>약물:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{medicineInfo.name}</Text>
              </View>
            </View>

            {/* 권장 용량 */}
            <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>💊 권장 용량</Text>
              <View style={[
                styles.dosageCard,
                {
                  backgroundColor: validationResult.errors.length > 0 
                    ? '#ffebee' 
                    : validationResult.warnings.length > 0 
                    ? '#fff8e1' 
                    : '#e8f5e8',
                  borderColor: validationResult.errors.length > 0 
                    ? '#FF3B30' 
                    : validationResult.warnings.length > 0 
                    ? '#FF9500' 
                    : '#34C759',
                }
              ]}>
                <View style={styles.dosageHeader}>
                  <Ionicons 
                    name={validationResult.errors.length > 0 ? "close-circle" : validationResult.warnings.length > 0 ? "warning" : "checkmark-circle"} 
                    size={24} 
                    color={validationResult.errors.length > 0 ? "#FF3B30" : validationResult.warnings.length > 0 ? "#FF9500" : "#34C759"} 
                  />
                  <Text style={[
                    styles.dosageText,
                    {
                      color: validationResult.errors.length > 0 
                        ? '#FF3B30' 
                        : validationResult.warnings.length > 0 
                        ? '#FF9500' 
                        : '#34C759'
                    }
                  ]}>
                    {validationResult.adjustedDose === 0 
                      ? '복용 금지' 
                      : `성인 용량의 ${Math.round(validationResult.adjustedDose * 100)}%`}
                  </Text>
                </View>
                {validationResult.adjustedDose > 0 && validationResult.adjustedDose < 1 && (
                  <Text style={[styles.dosageNote, { color: themeColors.GRAY.DEFAULT }]}>
                    예시: 성인이 1정을 복용한다면, 이 연령대는 약 {validationResult.adjustedDose.toFixed(1)} 정을 복용
                  </Text>
                )}
              </View>
            </View>

            {/* 오류 메시지 */}
            {validationResult.errors.length > 0 && (
              <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
                <Text style={[styles.sectionTitle, styles.errorText]}>🚫 복용 금지 사유</Text>
                {validationResult.errors.map((error, index) => (
                  <View key={index} style={styles.alertItem}>
                    <Ionicons name="warning" size={16} color="#FF3B30" />
                    <Text style={[styles.alertText, styles.errorText]}>
                      {error}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 경고 메시지 */}
            {validationResult.warnings.length > 0 && (
              <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
                <Text style={[styles.sectionTitle, styles.warningText]}>⚠️ 주의사항</Text>
                {validationResult.warnings.map((warning, index) => (
                  <View key={index} style={styles.alertItem}>
                    <Ionicons name="information-circle" size={16} color="#FF9500" />
                    <Text style={[styles.alertText, styles.warningText]}>
                      {warning}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 연령별 안내 */}
            <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>📊 연령별 복용 안내</Text>
              {getAgeGuidance(age).map((guidance, index) => (
                <View key={index} style={styles.guidanceItem}>
                  <Text style={styles.guidanceBullet}>•</Text>
                  <Text style={[styles.guidanceText, { color: themeColors.text }]}>{guidance}</Text>
                </View>
              ))}
            </View>

            {/* 일반 안전 수칙 */}
            <View style={[styles.section, { borderBottomColor: isDark ? '#374151' : '#f8f9fa' }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>🛡️ 안전 수칙</Text>
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.text }]}>복용 전 반드시 전문의와 상담하세요</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.text }]}>정확한 용량과 복용 시간을 지켜주세요</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.text }]}>부작용 발생 시 즉시 복용을 중단하세요</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.text }]}>다른 약물과의 상호작용을 확인하세요</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.text }]}>약물 보관법을 준수하세요</Text>
              </View>
            </View>
          </ScrollView>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
              <Text style={styles.confirmButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    maxHeight: '85%',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 500,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    width: 60,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dosageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  dosageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  dosageText: {
    fontSize: 18,
    fontWeight: '700',
  },
  dosageNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  errorText: {
    color: '#FF3B30',
  },
  warningText: {
    color: '#FF9500',
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  guidanceBullet: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '700',
    marginTop: 2,
  },
  guidanceText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  buttonContainer: {
    padding: 20,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AgeWarningModal; 