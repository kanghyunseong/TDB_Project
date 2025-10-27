import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { searchMedicineByName, getMedicineDetails } from '../api/medicine';
import { Medicine, NutritionalSupplement } from '../types/tdb';
import colors from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../contexts/ThemeContext';
import { useDrugList } from '../contexts/DrugContext';
import { useSupplementList } from '../contexts/SupplementContext';


type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'MedicineSearch'>;
type RouteProp = NativeStackScreenProps<MainStackParamList, 'MedicineSearch'>['route'];

interface SearchMedicine extends Medicine {
  manufacturer: string;
}

const MedicineSearchScreen = () => {
  const { colors: themeColors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState<SearchMedicine[]>([]);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCsvLoading, setIsCsvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'medicine' | 'supplement'>('medicine');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();

  // AsyncStorage에서 사용자 정보 가져오기
  const [user, setUser] = useState<{ role: 'parent' | 'child'; user_id: string; name: string } | null>(null);

  const drugList = useDrugList();
  const supplementList = useSupplementList();

  useEffect(() => {
    // route 파라미터에서 초기 searchType 설정
    if (route.params?.searchType) {
      setSearchType(route.params.searchType);
    }

    const loadUserInfo = async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
        if (userJson) {
          const userData = JSON.parse(userJson);
          setUser(userData);
          
          // 자식 계정도 약 검색은 가능하도록 수정 - 접근 제한 제거
          // if (userData.accountType === 'child') {
          //   Toast.show({
          //     type: 'error',
          //     text1: '접근 권한 없음',
          //     text2: '서브 계정에서는 약/영양제 검색이 불가능합니다.',
          //   });
          //   setTimeout(() => {
          //     navigation.goBack();
          //   }, 1000);
          //   return;
          // }
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
      }
    };
    loadUserInfo();

    if (drugList && drugList.length > 0) {
      console.log('drugList 샘플:', drugList[0]);
        } else {
      console.log('drugList가 비어있음 또는 로딩 중');
      }
  }, [drugList, navigation, route.params?.searchType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('검색어를 입력해주세요.');
      return;
    }
    // 자식 계정도 검색은 가능하도록 수정 - 검색 제한 제거
    // if (user?.accountType === 'child') {
    //   Toast.show({
    //     type: 'error',
    //     text1: '서브 계정에서는 의약품 검색이 불가능합니다.',
    //   });
    //   return;
    // }
    setIsLoading(true);
    setError(null);

    if (searchType === 'medicine') {
      if (!drugList) {
        setError('의약품 데이터가 아직 준비되지 않았습니다.');
        setIsLoading(false);
        return;
      }
      const results = drugList.filter(item => {
        const itemName = item["제품명 [ITEMNAME] "];
        if (!itemName) return false;
        
        // 줄바꿈 문자 제거 후 검색
        const cleanItemName = itemName.replace(/\n/g, ' ').trim();
        const cleanSearchQuery = searchQuery.replace(/\n/g, ' ').trim();
        
        return cleanItemName
          .toLowerCase()
          .includes(cleanSearchQuery.toLowerCase());
      });
      setMedicines(results);
    } else {
      // 영양제 검색 (제품명, 성분, 효능) - 줄바꿈 문자 처리
      const cleanSearchQuery = searchQuery.replace(/\n/g, ' ').trim().toLowerCase();
      const results = supplementList.filter(item => {
        const productName = item["PRDLST_NM"]?.replace(/\n/g, ' ').trim().toLowerCase();
        const rawMaterial = item["RAWMTRL_NM"]?.replace(/\n/g, ' ').trim().toLowerCase();
        const primaryFunction = item["PRIMARY_FNCLTY"]?.replace(/\n/g, ' ').trim().toLowerCase();
        
        return (productName && productName.includes(cleanSearchQuery)) ||
               (rawMaterial && rawMaterial.includes(cleanSearchQuery)) ||
               (primaryFunction && primaryFunction.includes(cleanSearchQuery));
      });
      setSupplements(results);
    }
    setIsLoading(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.medicineItem, { borderBottomColor: themeColors.border }]}
      onPress={() => {
        if (!user) {
          Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
          return;
        }
        navigation.navigate('MedicineDetail', {
          medicineId: item["품목기준코드 [ITEMSEQ] "],
          medicineName: item["제품명 [ITEMNAME] "],
          memberId: user.user_id,
          isParent: user.role === 'parent',
          detail: item
        });
      }}
    >
      <Text style={[styles.medicineName, { color: themeColors.text }]}>{item["제품명 [ITEMNAME] "]}</Text>
    </TouchableOpacity>
  );

  // 타입 가드 함수 추가
  function isMedicine(item: any): item is { [key: string]: any } {
    return !!(item as any)["품목기준코드 [ITEMSEQ] "];
  }

  const handleSupplementPress = (item: any) => {
    if (!user) {
      Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
      return;
    }
    console.log('🔥 [handleSupplementPress] 영양제 상세 이동:', { 
      supplement: item.PRDLST_NM, 
      memberId: user.user_id,
      user: user 
    });
    navigation.navigate('SupplementDetail', {
      supplement: item,
      memberId: user.user_id,
      isParent: user.role === 'parent',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>약/영양제 검색</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, searchType === 'medicine' && styles.activeTab]}
          onPress={() => setSearchType('medicine')}
        >
          <Text style={[styles.tabText, searchType === 'medicine' && styles.activeTabText, { color: themeColors.text }]}>의약품</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, searchType === 'supplement' && styles.activeTab]}
          onPress={() => setSearchType('supplement')}
        >
          <Text style={[styles.tabText, searchType === 'supplement' && styles.activeTabText, { color: themeColors.text }]}>영양제</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[styles.searchInput, { 
              backgroundColor: themeColors.background,
              color: themeColors.text,
              borderColor: themeColors.border
            }]}
            placeholder={`${searchType === 'medicine' ? '약' : '영양제'} 이름을 검색하세요`}
            placeholderTextColor={colors.GRAY.LIGHT}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            editable={!isLoading && !isCsvLoading}
          />
          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: colors.PRIMARY.DEFAULT }]} 
            onPress={handleSearch}
            disabled={isLoading || isCsvLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.WHITE} />
            ) : (
              <Text style={[styles.searchButtonText, { color: colors.WHITE }]}>검색</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}> 
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={{ color: themeColors.text, marginTop: 12 }}>검색 중입니다...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: colors.DANGER.DEFAULT }]}> 
          <Text style={[styles.errorText, { color: colors.WHITE }]}>{error}</Text>
        </View>
      ) : searchType === 'medicine' ? (
        <FlatList
          data={medicines}
          renderItem={renderItem}
          keyExtractor={(item, index) => `medicine_${index}_${(item as any)['품목기준코드 [ITEMSEQ] '] || 'unknown'}`}
          ListEmptyComponent={
            <Text style={{ color: themeColors.text, textAlign: 'center', marginTop: 32 }}>
              검색 결과가 없습니다.
            </Text>
          }
        />
      ) : (
        <FlatList
          data={supplements}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.medicineItem, { borderBottomColor: themeColors.border }]}
              onPress={() => handleSupplementPress(item)}
            >
              <Text style={[styles.medicineName, { color: themeColors.text }]}>{item["PRDLST_NM"]}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => `supplement_${index}_${item["PRDLST_NM"]}_${item["BSSH_NM"] || 'unknown'}`}
          ListEmptyComponent={
            <Text style={{ color: themeColors.text, textAlign: 'center', marginTop: 32 }}>
              검색 결과가 없습니다.
            </Text>
          }
        />
      )}
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
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: Platform.OS === 'ios' ? 16 : 0,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.GRAY.DARK,
  },
  activeTab: {
    borderBottomColor: colors.PRIMARY.DEFAULT,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.PRIMARY.DEFAULT,
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
    minWidth: 60,
  },
  searchButtonText: {
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  medicineItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  manufacturer: {
    fontSize: 14,
    color: colors.GRAY.LIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  ingredients: {
    fontSize: 14,
    color: colors.GRAY.LIGHT,
    marginTop: 4,
  },
  precautions: {
    fontSize: 14,
    color: colors.GRAY.LIGHT,
    marginTop: 4,
  },
});

export default MedicineSearchScreen;
