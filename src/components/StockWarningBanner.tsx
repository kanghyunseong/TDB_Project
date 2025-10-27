import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
// @ts-ignore
import Icon from 'react-native-vector-icons/Ionicons';
import { MedicineStockValidator, MedicineStockInfo, StockValidationResult } from '../utils/medicineStockValidator';
import { Medicine, FamilyMember } from '../types/tdb';

interface StockWarningBannerProps {
  medicines: Medicine[];
  familyMembers: FamilyMember[];
  onRefresh?: () => void;
}

export const StockWarningBanner: React.FC<StockWarningBannerProps> = ({
  medicines,
  familyMembers,
  onRefresh,
}) => {
  const [warningMedicines, setWarningMedicines] = useState<MedicineStockInfo[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 재고 상태 체크
  useEffect(() => {
    checkStockStatus();
  }, [medicines, familyMembers]);

  const checkStockStatus = async () => {
    if (medicines.length === 0 || familyMembers.length === 0) return;

    setIsLoading(true);
    try {
      const warningList = await MedicineStockValidator.getInsufficientMedicines(
        medicines,
        familyMembers
      );
      setWarningMedicines(warningList);
    } catch (error) {
      console.error('재고 상태 체크 에러:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 경고 레벨별 스타일
  const getWarningStyle = (daysRemaining: number) => {
    if (daysRemaining <= 0) return styles.criticalBanner;
    if (daysRemaining <= 3) return styles.urgentBanner;
    return styles.warningBanner;
  };

  const getWarningIcon = (daysRemaining: number) => {
    if (daysRemaining <= 0) return 'alert-circle';
    if (daysRemaining <= 3) return 'warning';
    return 'notifications';
  };

  // 🔥 경고 배너 렌더링
  if (warningMedicines.length === 0) {
    return null; // 경고할 약물이 없으면 숨김
  }

  const criticalCount = warningMedicines.filter(m => m.daysRemaining <= 0).length;
  const urgentCount = warningMedicines.filter(m => m.daysRemaining > 0 && m.daysRemaining <= 3).length;
  const warningCount = warningMedicines.filter(m => m.daysRemaining > 3).length;

  const primaryWarning = warningMedicines[0];

  return (
    <>
      <TouchableOpacity
        style={[styles.banner, getWarningStyle(primaryWarning.daysRemaining)]}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.bannerContent}>
          <Icon
            name={getWarningIcon(primaryWarning.daysRemaining)}
            size={24}
            color="white"
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>
              약물 재고 {criticalCount > 0 ? '부족' : urgentCount > 0 ? '위험' : '경고'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {criticalCount > 0 && `${criticalCount}개 약물 즉시 부족`}
              {urgentCount > 0 && `${urgentCount}개 약물 3일 이내 부족`}
              {warningCount > 0 && !criticalCount && !urgentCount && `${warningCount}개 약물 재고 확인 필요`}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color="white" />
        </View>
      </TouchableOpacity>

      {/* 🔥 재고 상세 모달 */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>약물 재고 현황</Text>
            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>재고 정보를 불러오는 중...</Text>
              </View>
            ) : warningMedicines.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="checkmark-circle" size={64} color="#34C759" />
                <Text style={styles.emptyTitle}>재고 상태 양호</Text>
                <Text style={styles.emptyMessage}>
                  현재 모든 약물의 재고가 충분합니다.
                </Text>
              </View>
            ) : (
              warningMedicines.map((stockInfo) => (
                <StockInfoCard
                  key={stockInfo.medicine.medi_id}
                  stockInfo={stockInfo}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

// 🔥 재고 정보 카드 컴포넌트
interface StockInfoCardProps {
  stockInfo: MedicineStockInfo;
  onRefresh?: () => void;
}

const StockInfoCard: React.FC<StockInfoCardProps> = ({ stockInfo, onRefresh }) => {
  const { medicine, currentStock, dailyConsumption, daysRemaining, userConsumptions } = stockInfo;

  const getCardStyle = () => {
    if (daysRemaining <= 0) return styles.criticalCard;
    if (daysRemaining <= 3) return styles.urgentCard;
    return styles.warningCard;
  };

  const getStatusText = () => {
    if (daysRemaining <= 0) return `🚨 즉시 부족`;
    if (daysRemaining <= 3) return `⚠️ ${daysRemaining}일 남음`;
    return `📢 ${daysRemaining}일 남음`;
  };

  const handleRecommendationPress = () => {
    Alert.alert(
      '권장 조치',
      daysRemaining <= 0
        ? '• 즉시 약물을 보충하거나 복용 스케줄을 조정하세요.\n• 가족 구성원들의 복용량을 재검토하세요.'
        : daysRemaining <= 3
        ? '• 긴급히 약물을 보충하세요.\n• 약국에 주문하거나 처방을 받으세요.'
        : '• 곧 약물을 보충할 계획을 세우세요.\n• 약국에 미리 연락해보세요.',
      [
        { text: '확인', style: 'default' },
        { text: '재고 새로고침', onPress: onRefresh },
      ]
    );
  };

  return (
    <View style={[styles.card, getCardStyle()]}>
      <View style={styles.cardHeader}>
        <Text style={styles.medicineName}>{medicine.name}</Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      <View style={styles.stockInfo}>
        <Text style={styles.stockText}>현재 재고: {currentStock}정</Text>
        <Text style={styles.consumptionText}>일일 소비: {dailyConsumption}정</Text>
      </View>

      {userConsumptions.length > 0 && (
        <View style={styles.userConsumptions}>
          <Text style={styles.sectionTitle}>가족별 복용량:</Text>
          {userConsumptions.map((user, index) => (
            <Text key={index} style={styles.userConsumptionText}>
              • {user.userName}: {user.dailyDose}정/일
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleRecommendationPress}
      >
        <Text style={styles.actionButtonText}>권장 조치 보기</Text>
        <Icon name="information-circle-outline" size={16} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // 배너 스타일
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  warningBanner: {
    backgroundColor: '#FF9500',
  },
  urgentBanner: {
    backgroundColor: '#FF3B30',
  },
  criticalBanner: {
    backgroundColor: '#DC143C',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },

  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalContentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // 카드 스타일
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  warningCard: {
    borderLeftColor: '#FF9500',
  },
  urgentCard: {
    borderLeftColor: '#FF3B30',
  },
  criticalCard: {
    borderLeftColor: '#DC143C',
  },
  cardHeader: {
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
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stockText: {
    fontSize: 14,
    color: '#666',
  },
  consumptionText: {
    fontSize: 14,
    color: '#666',
  },
  userConsumptions: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  userConsumptionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
}); 