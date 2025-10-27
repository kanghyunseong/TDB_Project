import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
// 간단한 색상 정의
const colors = {
  white: '#FFFFFF',
  black: '#000000',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  darkGray: '#374151',
  primary: '#007AFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  lightSuccess: '#D1FAE5',
  lightError: '#FEE2E2',
  transparent: 'rgba(0,0,0,0.5)'
};
import { DosageFrequency, ScheduleValidationResult } from '../utils/dosageFrequencyValidator';

interface ScheduleValidationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  dosageInfo: DosageFrequency | null;
  validationResult: ScheduleValidationResult;
  medicineName: string;
}

export const ScheduleValidationModal: React.FC<ScheduleValidationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  dosageInfo,
  validationResult,
  medicineName
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
  
  const handleForceConfirm = () => {
    Alert.alert(
      '⚠️ 확인',
      '권장 복용 횟수를 초과하여 스케줄을 저장하시겠습니까?\n의사나 약사와 상담하는 것을 권장합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '저장', style: 'destructive', onPress: onConfirm }
      ]
    );
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: themeColors.background,
      borderRadius: 20,
      maxHeight: '80%',
      width: '100%',
      maxWidth: 400,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : colors.lightGray,
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.text,
      marginBottom: 5,
    },
    medicineName: {
      fontSize: 14,
      color: themeColors.GRAY.DEFAULT,
    },
    content: {
      maxHeight: 400,
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : colors.lightGray,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: themeColors.text,
      marginBottom: 12,
    },
    infoCard: {
      backgroundColor: isDark ? '#374151' : colors.lightGray,
      borderRadius: 10,
      padding: 15,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    infoLabel: {
      fontSize: 14,
      color: themeColors.GRAY.DEFAULT,
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.text,
      flex: 1,
      textAlign: 'right',
    },
    statusCard: {
      borderRadius: 10,
      padding: 15,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: isDark ? '#E5E7EB' : '#374151',
      fontWeight: '500',
    },
    statusValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    violationSection: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    },
    violationTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: isDark ? '#F87171' : colors.error,
      marginBottom: 5,
    },
    violationText: {
      fontSize: 14,
      color: isDark ? '#F87171' : colors.error,
    },
    warningCard: {
      backgroundColor: isDark ? '#7F1D1D' : colors.lightError,
      borderRadius: 10,
      padding: 15,
      marginTop: 10,
    },
    warningText: {
      fontSize: 14,
      color: isDark ? '#FECACA' : colors.error,
      textAlign: 'center',
    },
    recommendationItem: {
      marginBottom: 8,
    },
    recommendationText: {
      fontSize: 14,
      color: themeColors.GRAY.DEFAULT,
      lineHeight: 20,
    },
    debugCard: {
      backgroundColor: isDark ? '#374151' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
    },
    debugText: {
      fontSize: 12,
      color: themeColors.GRAY.DEFAULT,
      fontFamily: 'monospace',
    },
    buttonContainer: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? '#374151' : colors.lightGray,
    },
    cancelButtonText: {
      color: isDark ? '#E5E7EB' : '#374151',
      fontSize: 16,
      fontWeight: '600',
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    confirmButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    forceButton: {
      backgroundColor: colors.warning,
    },
    forceButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[
          styles.modalContainer, 
          { 
            backgroundColor: themeColors.background,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>🩺 복용 스케줄 검증</Text>
            <Text style={styles.medicineName}>{medicineName}</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 복용 정보 요약 */}
            {dosageInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 복용 정보</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>권장 복용 횟수:</Text>
                    <Text style={styles.infoValue}>1일 {dosageInfo.dailyCount}회</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>1회 복용량:</Text>
                    <Text style={styles.infoValue}>최대 {dosageInfo.maxPerDose}정</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>정보 출처:</Text>
                    <Text style={styles.infoValue}>
                      {dosageInfo.source === 'medicine' ? '의약품 정보' : '건강기능식품 정보'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>신뢰도:</Text>
                    <Text style={[
                      styles.infoValue,
                      { color: dosageInfo.confidence === 'high' ? colors.success : 
                              dosageInfo.confidence === 'medium' ? colors.warning : colors.error }
                    ]}>
                      {dosageInfo.confidence === 'high' ? '높음' : 
                       dosageInfo.confidence === 'medium' ? '보통' : '낮음'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 검증 결과 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {validationResult.isValid ? '✅ 검증 통과' : '⚠️ 검증 실패'}
              </Text>
              
              <View style={[
                styles.statusCard,
                { backgroundColor: validationResult.isValid ? 
                    (isDark ? '#064E3B' : colors.lightSuccess) : 
                    (isDark ? '#7F1D1D' : colors.lightError) }
              ]}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>현재 선택:</Text>
                  <Text style={styles.statusValue}>
                    {validationResult.currentSelections}개 시간대
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>최대 허용:</Text>
                  <Text style={styles.statusValue}>
                    {validationResult.maxAllowedSelections}개 시간대/일
                  </Text>
                </View>
                
                {validationResult.violatedDays.length > 0 && (
                  <View style={styles.violationSection}>
                    <Text style={styles.violationTitle}>⚠️ 초과된 요일:</Text>
                    <Text style={styles.violationText}>
                      {validationResult.violatedDays.join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* 경고 메시지 */}
              {validationResult.warningMessage && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    {validationResult.warningMessage}
                  </Text>
                </View>
              )}
            </View>

            {/* 권장사항 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 권장사항</Text>
              {validationResult.recommendations.map((recommendation, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Text style={styles.recommendationText}>
                    • {recommendation}
                  </Text>
                </View>
              ))}
            </View>

            {/* 원본 텍스트 (디버깅용) */}
            {dosageInfo && __DEV__ && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔍 원본 정보 (개발용)</Text>
                <View style={styles.debugCard}>
                  <Text style={styles.debugText}>
                    {dosageInfo.originalText.substring(0, 200)}
                    {dosageInfo.originalText.length > 200 ? '...' : ''}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* 버튼 영역 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>수정하기</Text>
            </TouchableOpacity>
            
            {validationResult.isValid ? (
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={onConfirm}
              >
                <Text style={styles.confirmButtonText}>저장</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.forceButton]}
                onPress={handleForceConfirm}
              >
                <Text style={styles.forceButtonText}>강제 저장</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}; 