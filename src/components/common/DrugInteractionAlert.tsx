import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { 
  DrugInteraction, 
  InteractionValidationResult, 
  InteractionSeverity 
} from '../../utils/drugInteractionValidator';

// 🔥 색상 상수
const colors = {
  gray500: '#8E8E93',
  gray600: '#636366',
  gray700: '#3C3C43',
  gray800: '#1C1C1E',
  blue500: '#007AFF',
  red500: '#FF3B30',
  amber600: '#FF9500',
  amber700: '#B36800',
  gray200: '#AEAEB2',
};

interface Props {
  validationResult: InteractionValidationResult;
  onClose?: () => void;
  onConsultPharmacist?: () => void;
  onViewDetails?: (interaction: DrugInteraction) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const DrugInteractionAlert: React.FC<Props> = ({ 
  validationResult,
  onClose,
  onConsultPharmacist,
  onViewDetails
}) => {
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDetailModalVisible) {
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
  }, [isDetailModalVisible]);
  const [selectedInteraction, setSelectedInteraction] = useState<DrugInteraction | null>(null);

  // 🔥 위험도별 색상 및 아이콘
  const getSeverityStyle = (severity: InteractionSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          backgroundColor: '#ffebee',
          borderColor: '#f44336',
          iconColor: '#f44336',
          icon: 'alert-circle',
          label: '위험'
        };
      case 'major':
        return {
          backgroundColor: '#fff3e0',
          borderColor: '#ff9800',
          iconColor: '#ff9800',
          icon: 'alert',
          label: '주의'
        };
      case 'moderate':
        return {
          backgroundColor: '#f3e5f5',
          borderColor: '#9c27b0',
          iconColor: '#9c27b0',
          icon: 'information',
          label: '확인'
        };
      default:
        return {
          backgroundColor: '#e8f5e8',
          borderColor: '#4caf50',
          iconColor: '#4caf50',
          icon: 'check-circle',
          label: '안전'
        };
    }
  };

  const overallStyle = getSeverityStyle(validationResult.overallRisk);

  if (!validationResult.hasInteractions) {
    return (
      <View style={[styles.safeContainer, { borderColor: overallStyle.borderColor }]}>
        <Icon name="shield-check" size={24} color={overallStyle.iconColor} />
        <Text style={[styles.safeTitle, { color: overallStyle.iconColor }]}>
          약물 상호작용 검사 완료
        </Text>
        <Text style={styles.safeMessage}>
          현재 복용 중인 약물 간 위험한 상호작용이 발견되지 않았습니다.
        </Text>
      </View>
    );
  }

  const handleInteractionPress = (interaction: DrugInteraction) => {
    setSelectedInteraction(interaction);
    setIsDetailModalVisible(true);
    onViewDetails?.(interaction);
  };

  const handleConsultPress = () => {
    Alert.alert(
      '전문가 상담',
      '약물 상호작용에 대해 약사 또는 의사와 상담하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '상담 예약', 
          onPress: () => onConsultPharmacist?.() 
        }
      ]
    );
  };

  return (
    <>
      {/* 🔥 메인 경고 카드 */}
      <View style={[styles.alertContainer, { borderColor: overallStyle.borderColor }]}>
        <View style={styles.headerRow}>
          <Icon name={overallStyle.icon} size={28} color={overallStyle.iconColor} />
          <View style={styles.headerText}>
            <Text style={[styles.alertTitle, { color: overallStyle.iconColor }]}>
              약물 상호작용 {overallStyle.label}
            </Text>
            <Text style={styles.alertSubtitle}>
              {validationResult.criticalCount > 0 
                ? `위험 ${validationResult.criticalCount}건, 주의 ${validationResult.warningCount - validationResult.criticalCount}건`
                : `주의사항 ${validationResult.warningCount}건`
              }
            </Text>
          </View>
                     {onClose && (
             <TouchableOpacity onPress={onClose} style={styles.closeButton}>
               <Icon name="close" size={20} color={colors.gray500} />
             </TouchableOpacity>
           )}
        </View>

        {/* 🔥 상호작용 목록 (요약) */}
        <ScrollView 
          style={styles.interactionsList} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {validationResult.interactions.slice(0, 3).map((interaction, index) => {
            const itemStyle = getSeverityStyle(interaction.severity);
            const enhancedInteraction = interaction as any; // 타입 단언으로 확장된 속성 접근
            
            return (
              <TouchableOpacity
                key={index}
                style={[styles.interactionItem, { borderLeftColor: itemStyle.borderColor }]}
                onPress={() => handleInteractionPress(interaction)}
              >
                <View style={styles.interactionHeader}>
                  <Icon name={itemStyle.icon} size={16} color={itemStyle.iconColor} />
                  <Text style={styles.drugNames}>
                    {interaction.drugA} + {interaction.drugB}
                  </Text>
                </View>
                
                {/* 🔥 소유자 정보 표시 */}
                {(enhancedInteraction.drugAOwner || enhancedInteraction.drugBOwner) && (
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerInfoText}>
                      {enhancedInteraction.drugAOwner?.name}({enhancedInteraction.drugAOwner?.role === 'parent' ? '메인' : '자식'}) ↔{' '}
                      {enhancedInteraction.drugBOwner?.name}({enhancedInteraction.drugBOwner?.role === 'parent' ? '메인' : '자식'})
                    </Text>
                  </View>
                )}
                
                <Text style={styles.interactionDescription} numberOfLines={2}>
                  {interaction.description}
                </Text>
              </TouchableOpacity>
            );
          })}
          
          {validationResult.interactions.length > 3 && (
            <TouchableOpacity 
              style={styles.moreButton}
              onPress={() => setIsDetailModalVisible(true)}
            >
                             <Text style={styles.moreButtonText}>
                 +{validationResult.interactions.length - 3}개 더 보기
               </Text>
             </TouchableOpacity>
           )}
         </ScrollView>

         {/* 🔥 권장사항 */}
         <View style={styles.recommendationsSection}>
           {validationResult.recommendations.slice(0, 2).map((rec, index) => (
             <Text key={index} style={styles.recommendationText}>
               {rec}
             </Text>
           ))}
         </View>

         {/* 🔥 액션 버튼들 */}
         <View style={styles.actionButtons}>
           <TouchableOpacity 
             style={[styles.actionButton, styles.consultButton]}
             onPress={handleConsultPress}
           >
             <Icon name="doctor" size={16} color="#fff" />
             <Text style={styles.consultButtonText}>전문가 상담</Text>
           </TouchableOpacity>
           
           <TouchableOpacity 
             style={[styles.actionButton, styles.detailButton]}
             onPress={() => setIsDetailModalVisible(true)}
           >
             <Icon name="information" size={16} color={colors.blue500} />
             <Text style={styles.detailButtonText}>자세히 보기</Text>
           </TouchableOpacity>
         </View>
       </View>

       {/* 🔥 상세 정보 모달 */}
       <Modal
         visible={isDetailModalVisible}
         animationType="none"
         presentationStyle="pageSheet"
         onRequestClose={() => setIsDetailModalVisible(false)}
       >
         <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
           <Animated.View style={[styles.modalInnerContainer, { transform: [{ translateY: slideAnim }] }]}>
           <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>약물 상호작용 상세 정보</Text>
             <TouchableOpacity
               onPress={() => setIsDetailModalVisible(false)}
               style={styles.modalCloseButton}
             >
               <Icon name="close" size={24} color={colors.gray700} />
             </TouchableOpacity>
           </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            {/* 전체 위험도 */}
            <View style={[styles.riskOverview, { backgroundColor: overallStyle.backgroundColor }]}>
              <Icon name={overallStyle.icon} size={32} color={overallStyle.iconColor} />
              <View style={styles.riskOverviewText}>  
                <Text style={[styles.riskLevel, { color: overallStyle.  iconColor }]}>
                  전체 위험도: {overallStyle.label}
                </Text>
                <Text style={styles.riskSummary}>
                  총 {validationResult.interactions.length}건의 상호작용이 발견되었습니다.
                </Text>
              </View>
            </View>

            {/* 모든 상호작용 목록 */}
            {validationResult.interactions.map((interaction, index) => {
              const itemStyle = getSeverityStyle(interaction.severity);
              const enhancedInteraction = interaction as any; // 타입 단언으로 확장된 속성 접근
              
              return (
                <View 
                  key={index}
                  style={[styles.detailInteractionCard, { borderLeftColor: itemStyle.borderColor }]}
                >
                  <View style={styles.detailInteractionHeader}>
                    <Icon name={itemStyle.icon} size={20} color={itemStyle.iconColor} />
                    <Text style={[styles.detailSeverityLabel, { color: itemStyle.iconColor }]}>
                      {itemStyle.label}
                    </Text>
                  </View>
                  
                  <Text style={styles.detailDrugNames}>
                    {interaction.drugA} ↔ {interaction.drugB}
                  </Text>
                  
                  {/* 🔥 상세 모달에서도 소유자 정보 표시 */}
                  {(enhancedInteraction.drugAOwner || enhancedInteraction.drugBOwner) && (
                    <View style={styles.ownerInfo}>
                      <Text style={styles.ownerInfoText}>
                        복용자: {enhancedInteraction.drugAOwner?.name}({enhancedInteraction.drugAOwner?.role === 'parent' ? '보호자' : '자식'}) ↔{' '}
                        {enhancedInteraction.drugBOwner?.name}({enhancedInteraction.drugBOwner?.role === 'parent' ? '보호자' : '자식'})
                      </Text>
                    </View>
                  )}
                  
                  <Text style={styles.detailDescription}>
                    {interaction.description}
                  </Text>
                  
                                     <View style={styles.detailRecommendationBox}>
                     <Icon name="lightbulb" size={16} color={colors.amber600} />
                     <Text style={styles.detailRecommendation}>
                       {interaction.recommendation}
                     </Text>
                   </View>
                  
                  <Text style={styles.sourceInfo}>
                    출처: {interaction.sourceField} | 신뢰도: {Math.round(interaction.confidence * 100)}%
                  </Text>
                </View>
              );
            })}

            {/* 종합 권장사항 */}
            <View style={styles.finalRecommendations}>
              <Text style={styles.finalRecommendationsTitle}>💡 종합 권장사항</Text>
              {validationResult.recommendations.map((rec, index) => (
                <Text key={index} style={styles.finalRecommendationItem}>
                  • {rec}
                </Text>
              ))}
            </View>
          </ScrollView>
            </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // 🔥 안전한 경우 스타일
  safeContainer: {
    backgroundColor: '#f8fff8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 12,
    alignItems: 'center',
  },
  safeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  safeMessage: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
  },

  // 🔥 경고 카드 스타일
  alertContainer: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    margin: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  alertSubtitle: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },

  // 🔥 상호작용 목록
  interactionsList: {
    maxHeight: 180,
    marginBottom: 12,
  },
  interactionItem: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  interactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  drugNames: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: colors.gray800,
  },
  ownerInfo: {
    marginTop: 4,
    marginBottom: 4,
  },
  ownerInfoText: {
    fontSize: 11,
    color: colors.gray500,
    fontStyle: 'italic',
  },
  interactionDescription: {
    fontSize: 12,
    color: colors.gray600,
    lineHeight: 16,
  },
  moreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  moreButtonText: {
    fontSize: 14,
    color: colors.blue500,
    fontWeight: '500',
  },

  // 🔥 권장사항
  recommendationsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  recommendationText: {
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 18,
    marginBottom: 4,
  },

  // 🔥 액션 버튼들
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  consultButton: {
    backgroundColor: colors.red500,
  },
  consultButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.blue500,
  },
  detailButtonText: {
    color: colors.blue500,
    fontSize: 14,
    fontWeight: '600',
  },

  // 🔥 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalInnerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingTop: 60,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray800,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 80, // 하단 여백 증가로 종합 권장사항까지 모두 볼 수 있게
  },

  // 🔥 위험도 개요
  riskOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  riskOverviewText: {
    marginLeft: 16,
    flex: 1,
  },
  riskLevel: {
    fontSize: 18,
    fontWeight: '700',
  },
  riskSummary: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 4,
  },

  // 🔥 상세 상호작용 카드
  detailInteractionCard: {
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailInteractionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailSeverityLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  detailDrugNames: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailRecommendationBox: {
    flexDirection: 'row',
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  detailRecommendation: {
    fontSize: 13,
    color: colors.amber700,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  sourceInfo: {
    fontSize: 11,
    color: colors.gray500,
    fontStyle: 'italic',
  },

  // 🔥 최종 권장사항
  finalRecommendations: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  finalRecommendationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: 12,
  },
  finalRecommendationItem: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 8,
  },
});

export default DrugInteractionAlert; 