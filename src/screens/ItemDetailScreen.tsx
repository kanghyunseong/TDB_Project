import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../contexts/ThemeContext';
import { searchMedicineByName, getMedicineDetails } from '../api/medicine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<MainStackParamList, 'ItemDetail'>;

interface ItemDetailData {
  name: string;
  manufacturer?: string;
  ingredients?: string[];
  usage?: string;
  precautions?: string[];
  sideEffects?: string[];
  storage?: string;
  efficacy?: string;
  primaryFunction?: string;
  intakeMethod?: string;
}

const ItemDetailScreen = ({ route, navigation }: Props) => {
  const { colors: themeColors, isDark } = useTheme();
  const { itemType, itemData, itemName } = route.params;
  const [detailData, setDetailData] = useState<ItemDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItemDetail();
  }, []);

  const loadItemDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('=== ItemDetail 로딩 시작 ===');
      console.log('itemType:', itemType);
      console.log('itemName:', itemName);
      console.log('itemData:', itemData);

      if (itemType === 'medicine') {
        await loadMedicineDetail();
      } else if (itemType === 'supplement') {
        await loadSupplementDetail();
      }
    } catch (error) {
      console.error('상세정보 로드 실패:', error);
      setError('상세정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMedicineDetail = async () => {
    console.log('=== 약 상세정보 로딩 시작 ===');
    
    if (itemData) {
      console.log('✅ 이미 약 데이터가 있음 (검색에서 온 경우)');
      console.log('itemData 상세:', itemData);
      
      // 이미 상세정보가 있는 경우 (검색에서 온 경우)
      const medicineDetail = {
        name: itemData["제품명 [ITEMNAME] "] || itemName,
        manufacturer: itemData["업체명 [ENTPNAME] "] || '정보 없음',
        ingredients: [itemData["문항1(효능) [EFCYQESITM] "] || '정보 없음'],
        usage: itemData["문항2(사용법) [USEMETHODQESITM] "] || '정보 없음',
        precautions: [itemData["문항4(주의사항) [ATPNQESITM] "] || '정보 없음'],
        sideEffects: [itemData["문항6(부작용) [SEQESITM] "] || '해당 정보는 현재 제공되지 않습니다'],
        storage: itemData["문항7(보관법) [DEPOSITMETHODQESITM] "] || '해당 정보는 현재 제공되지 않습니다',
        efficacy: itemData["문항1(효능) [EFCYQESITM] "] || '정보 없음',
      };
      
      console.log('✅ 변환된 약 상세정보:', medicineDetail);
      setDetailData(medicineDetail);
      
    } else if (itemName) {
      console.log('📞 로컬 JSON 파일에서 약 정보 검색 시작:', itemName);
      
      // 🔥 로컬 JSON 파일에서 검색
      try {
        const medicineData = require('../assets/medicine.json');
        console.log('📋 로컬 medicine.json 로드 완료');
        
        // 약 이름으로 검색 (부분 매칭)
        const foundMedicine = medicineData.find((item: any) => 
          item["제품명 [ITEMNAME] "]?.toLowerCase().includes(itemName.toLowerCase()) ||
          item["제품명 [ITEMNAME] "]?.includes(itemName)
        );
        
        if (foundMedicine) {
          console.log('✅ 로컬 JSON에서 약물 정보 찾음:', foundMedicine["제품명 [ITEMNAME] "]);
          
          const medicineDetail = {
            name: foundMedicine["제품명 [ITEMNAME] "] || itemName,
            manufacturer: foundMedicine["업체명 [ENTPNAME] "] || '정보 없음',
            ingredients: [foundMedicine["문항1(효능) [EFCYQESITM] "] || '정보 없음'],
            usage: foundMedicine["문항2(사용법) [USEMETHODQESITM] "] || '정보 없음',
            precautions: [foundMedicine["문항4(주의사항) [ATPNQESITM] "] || '정보 없음'],
            sideEffects: [foundMedicine["문항6(부작용) [SEQESITM] "] || '해당 정보는 현재 제공되지 않습니다'],
            storage: foundMedicine["문항7(보관법) [DEPOSITMETHODQESITM] "] || '해당 정보는 현재 제공되지 않습니다',
            efficacy: foundMedicine["문항1(효능) [EFCYQESITM] "] || '정보 없음',
          };
          
          console.log('✅ 로컬 JSON으로 생성된 상세정보:', medicineDetail);
          setDetailData(medicineDetail);
        } else {
          console.log('❌ 로컬 JSON에서 약물 정보를 찾을 수 없음');
          const noResultDetail = {
            name: itemName,
            manufacturer: '정보 없음',
            ingredients: ['정보 없음'],
            usage: '정보 없음',
            precautions: ['정보 없음'],
            sideEffects: ['해당 정보는 현재 제공되지 않습니다'],
            storage: '해당 정보는 현재 제공되지 않습니다',
            efficacy: '정보 없음',
          };
          console.log('✅ 기본 상세정보 생성:', noResultDetail);
          setDetailData(noResultDetail);
        }
      } catch (error) {
        console.error('❌ 로컬 JSON 파일 로드 실패:', error);
        const errorDetail = {
          name: itemName,
          manufacturer: '정보 없음',
          ingredients: ['정보 없음'],
          usage: '정보 없음',
          precautions: ['정보 없음'],
          sideEffects: ['해당 정보는 현재 제공되지 않습니다'],
          storage: '해당 정보는 현재 제공되지 않습니다',
          efficacy: '정보 없음',
        };
        console.log('✅ 오류로 생성된 기본 상세정보:', errorDetail);
        setDetailData(errorDetail);
      }
    } else {
      console.log('❌ 약 이름도 데이터도 없음');
    }
  };

  const loadSupplementDetail = async () => {
    console.log('=== 영양제 상세정보 로딩 시작 ===');
    
    if (itemData) {
      console.log('✅ 영양제 데이터가 있음');
      console.log('itemData 상세:', itemData);
      
      const supplementDetail = {
        name: itemData.PRDLST_NM || itemData.name || itemName,
        manufacturer: itemData.BSSH_NM || itemData.manufacturer || '정보 없음',
        ingredients: [itemData.RAWMTRL_NM || itemData.ingredients || '정보 없음'],
        usage: '제품 라벨의 권장 섭취량을 확인하세요',
        precautions: [itemData.IFTKN_ATNT_MATR_CN || itemData.precautions || '정보 없음'],
        primaryFunction: itemData.PRIMARY_FNCLTY || itemData.primaryFunction || '정보 없음',
        intakeMethod: itemData.NTK_MTHD || itemData.intakeMethod || '정보 없음',
      };
      
      console.log('✅ 변환된 영양제 상세정보:', supplementDetail);
      setDetailData(supplementDetail);
    } else if (itemName) {
      console.log('📞 로컬 JSON 파일에서 영양제 정보 검색 시작:', itemName);
      
      // 🔥 로컬 JSON 파일에서 검색
      try {
        const supplementData = require('../assets/tablet.json');
        console.log('📋 로컬 tablet.json 로드 완료');
        
        // 영양제 이름으로 검색 (부분 매칭)
        const foundSupplement = supplementData.find((item: any) => 
          item.PRDLST_NM?.toLowerCase().includes(itemName.toLowerCase()) ||
          item.PRDLST_NM?.includes(itemName)
        );
        
        if (foundSupplement) {
          console.log('✅ 로컬 JSON에서 영양제 정보 찾음:', foundSupplement.PRDLST_NM);
          
          const supplementDetail = {
            name: foundSupplement.PRDLST_NM || itemName,
            manufacturer: foundSupplement.BSSH_NM || '정보 없음',
            ingredients: [foundSupplement.RAWMTRL_NM || '정보 없음'],
            usage: '제품 라벨의 권장 섭취량을 확인하세요',
            precautions: [foundSupplement.IFTKN_ATNT_MATR_CN || '정보 없음'],
            primaryFunction: foundSupplement.PRIMARY_FNCLTY || '정보 없음',
            intakeMethod: foundSupplement.NTK_MTHD || '정보 없음',
          };
          
          console.log('✅ 로컬 JSON으로 생성된 영양제 상세정보:', supplementDetail);
          setDetailData(supplementDetail);
        } else {
          console.log('❌ 로컬 JSON에서 영양제 정보를 찾을 수 없음');
          const defaultDetail = {
            name: itemName,
            manufacturer: '정보 없음',
            ingredients: ['정보 없음'],
            usage: '제품 라벨의 권장 섭취량을 확인하세요',
            precautions: ['정보 없음'],
            primaryFunction: '정보 없음',
            intakeMethod: '정보 없음',
          };
          
          console.log('✅ 기본 영양제 상세정보 생성:', defaultDetail);
          setDetailData(defaultDetail);
        }
      } catch (error) {
        console.error('❌ 로컬 JSON 파일 로드 실패:', error);
        const errorDetail = {
          name: itemName,
          manufacturer: '정보 없음',
          ingredients: ['정보 없음'],
          usage: '제품 라벨의 권장 섭취량을 확인하세요',
          precautions: ['정보 없음'],
          primaryFunction: '정보 없음',
          intakeMethod: '정보 없음',
        };
        
        console.log('✅ 오류로 생성된 기본 영양제 상세정보:', errorDetail);
        setDetailData(errorDetail);
      }
    } else {
      console.log('⚠️ 영양제 데이터가 없음, 기본값 사용');
      const defaultDetail = {
        name: itemName,
        manufacturer: '정보 없음',
        ingredients: ['정보 없음'],
        usage: '제품 라벨의 권장 섭취량을 확인하세요',
        precautions: ['정보 없음'],
        primaryFunction: '정보 없음',
        intakeMethod: '정보 없음',
      };
      
      console.log('✅ 기본 영양제 상세정보:', defaultDetail);
      setDetailData(defaultDetail);
    }
  };

  const renderInfoSection = (title: string, content: string | string[]) => {
    return (
      <View style={styles.infoSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
        {Array.isArray(content) ? (
          content.map((item, index) => (
            <Text key={index} style={[styles.sectionContent, { color: themeColors.text }]}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={[styles.sectionContent, { color: themeColors.text }]}>{content}</Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세정보</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>상세정보</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
            onPress={loadItemDetail}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
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
          {itemType === 'medicine' ? '의약품' : '영양제'} 상세정보
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={[styles.titleContainer, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.itemName, { color: themeColors.text }]}>
            {detailData?.name || itemName}
          </Text>
          <Text style={[styles.manufacturer, { color: colors.GRAY.DEFAULT }]}>
            제조사: {detailData?.manufacturer || '정보 없음'}
          </Text>
        </View>

        <View style={styles.contentContainer}>
          {itemType === 'medicine' ? (
            <>
              {renderInfoSection('효능・효과', detailData?.efficacy || '정보 없음')}
              {renderInfoSection('사용법', detailData?.usage || '정보 없음')}
              {renderInfoSection('주의사항', detailData?.precautions || ['정보 없음'])}
              {renderInfoSection('부작용', detailData?.sideEffects || ['해당 정보는 현재 제공되지 않습니다'])}
              {renderInfoSection('보관법', detailData?.storage || '해당 정보는 현재 제공되지 않습니다')}
            </>
          ) : (
            <>
              {renderInfoSection('주요 기능', detailData?.primaryFunction || '정보 없음')}
              {renderInfoSection('원재료명', detailData?.ingredients || ['정보 없음'])}
              {renderInfoSection('섭취 방법', detailData?.intakeMethod || '정보 없음')}
              {renderInfoSection('주의사항', detailData?.precautions || ['정보 없음'])}
            </>
          )}
        </View>
        
        {/* 🔥 하단 여백 추가 */}
        <View style={styles.bottomSpacing} />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.GRAY.LIGHT,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.WHITE,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30, // 하단 여백
  },
  titleContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.GRAY.LIGHT,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  manufacturer: {
    fontSize: 16,
  },
  contentContainer: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.PRIMARY.DEFAULT,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  bottomSpacing: {
    height: 100,
    paddingBottom: 10, // 추가 하단 여백
  },
});

export default ItemDetailScreen; 