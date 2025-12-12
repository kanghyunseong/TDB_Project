import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
 StatusBar} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { searchMedicineByName, getMedicineDetails } from '../api/medicine';
import { Medicine, NutritionalSupplement } from '../types/tdb';
import colors from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../contexts/ThemeContext';
// 🔥 컨텍스트 사용 제거 (서버 API 직접 사용)
// import { useDrugList } from '../contexts/DrugContext';
// import { useSupplementList } from '../contexts/SupplementContext';
import { searchMedicineMaster, searchTabletMaster } from '../api/medicineMaster';
import AntDesign from 'react-native-vector-icons/AntDesign';
type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'MedicineSearch'>;
type RouteProp = NativeStackScreenProps<MainStackParamList, 'MedicineSearch'>['route'];

interface SearchMedicine extends Medicine {
  manufacturer: string;
}

const MedicineSearchScreen = () => {
  const insets = useSafeAreaInsets();
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

  // 🔥 컨텍스트 제거 (서버 API 직접 사용)
  // const drugList = useDrugList();
  // const supplementList = useSupplementList();

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

    // 🔥 컨텍스트 제거로 인한 useEffect 수정
  }, [navigation, route.params?.searchType]);

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
      // 🔥 의약품 검색 시 영양제 결과 초기화
      setSupplements([]);
      
      // 🔥 서버 API를 통한 의약품 검색
      try {
        const response = await searchMedicineMaster(searchQuery, 100);
        if (response.success && response.data) {
          const results: SearchMedicine[] = response.data.map((item: any) => ({
            // Medicine 인터페이스 필수 필드
            medi_id: item.report_no || '',
            group_id: '', // 검색 결과에는 group_id가 없음
            name: item.name || '',
            warning: 0,
            // SearchMedicine 추가 필드
            manufacturer: item.company_name || '',
            // 추가 정보 (옵셔널)
            start_date: undefined,
            end_date: undefined,
            target_users: null,
            listed_only: 1,
            // 검색 결과에 포함된 추가 정보 (MedicineSearchResult 형식 호환성)
            itemSeq: item.report_no || '',
            itemName: item.name || '',
            entpName: item.company_name || '',
            efcyQesitm: item.primary_function || '',
            useMethodQesitm: item.intake_method || '',
            atpnWarnQesitm: item.precautions || '',
            atpnQesitm: item.precautions || '',
            intrcQesitm: '',
            seQesitm: '',
            depositMethodQesitm: item.storage_method || '',
            packUnit: '',
          }));
          setMedicines(results);
        } else {
          setError(response.error?.message || '의약품 검색에 실패했습니다.');
          setMedicines([]);
        }
      } catch (error: any) {
        console.error('의약품 검색 실패:', error);
        setError('의약품 검색 중 오류가 발생했습니다.');
        setMedicines([]);
      }
    } else {
      // 🔥 영양제 검색 시 의약품 결과 초기화
      setMedicines([]);
      
      // 🔥 서버 API를 통한 건강기능식품 검색
      try {
        const response = await searchTabletMaster(searchQuery, 100);
        if (response.success && response.data) {
          const results = response.data.map((item: any) => ({
            PRDLST_NM: item.name || '',
            BSSH_NM: item.company_name || '',
            RAWMTRL_NM: item.raw_materials || '',
            PRIMARY_FNCLTY: item.primary_function || '',
            NTK_MTHD: item.intake_method || '',
            IFTKN_ATNT_MATR_CN: item.precautions || '',
            report_no: item.report_no || ''
          }));
          setSupplements(results);
        } else {
          setError(response.error?.message || '건강기능식품 검색에 실패했습니다.');
          setSupplements([]);
        }
      } catch (error: any) {
        console.error('건강기능식품 검색 실패:', error);
        setError('건강기능식품 검색 중 오류가 발생했습니다.');
        setSupplements([]);
      }
    }
    setIsLoading(false);
  };

  const renderItem = ({ item }: { item: SearchMedicine }) => (
    <TouchableOpacity
      style={[styles.medicineItem, { 
        backgroundColor: themeColors.card,
        borderColor: themeColors.border
      }]}
      onPress={() => {
        if (!user) {
          Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
          return;
        }
        navigation.navigate('MedicineDetail', {
          medicineId: item.medi_id || (item as any).itemSeq || '',
          medicineName: item.name || (item as any).itemName || '',
          memberId: user.user_id,
          isParent: user.role === 'parent',
          detail: item
        });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.medicineItemContent}>
        <View style={[styles.medicineIconContainer, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
          <AntDesign name="medicinebox" size={20} color={colors.PRIMARY.DEFAULT} />
        </View>
        <View style={styles.medicineTextContainer}>
          <Text style={[styles.medicineName, { color: themeColors.text }]} numberOfLines={2}>
            {item.name || (item as any).itemName || ''}
          </Text>
          {(item.manufacturer || (item as any).entpName) && (
            <Text style={[styles.manufacturer, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
              {item.manufacturer || (item as any).entpName || ''}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={20} color={isDark ? '#555' : '#ccc'} />
      </View>
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
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background} />
      
      {/* 헤더 */}
      <View style={[styles.header, { 
        paddingTop: insets.top + 12, 
        backgroundColor: themeColors.card,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border
      }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>약/영양제 검색</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#888' : '#666' }]}>
            검색하여 약물 정보를 확인하세요
          </Text>
        </View>
      </View>

      {/* 탭 컨테이너 */}
      <View style={[styles.tabContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
        <TouchableOpacity
          style={[
            styles.tab, 
            searchType === 'medicine' && [styles.activeTab, { backgroundColor: colors.PRIMARY.DEFAULT }]
          ]}
          onPress={() => {
            // 🔥 탭 변경 시 이전 검색 결과 초기화
            setSearchType('medicine');
            setMedicines([]);
            setSupplements([]);
            setError(null);
            setSearchQuery('');
          }}
        >
          <AntDesign
            name="medicinebox" 
            size={18} 
            color={searchType === 'medicine' ? colors.WHITE : (isDark ? '#888' : '#666')} 
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabText, 
            searchType === 'medicine' && styles.activeTabText,
            { color: searchType === 'medicine' ? colors.WHITE : themeColors.text }
          ]}>
            의약품
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab, 
            searchType === 'supplement' && [styles.activeTab, { backgroundColor: colors.PRIMARY.DEFAULT }]
          ]}
          onPress={() => {
            // 🔥 탭 변경 시 이전 검색 결과 초기화
            setSearchType('supplement');
            setMedicines([]);
            setSupplements([]);
            setError(null);
            setSearchQuery('');
          }}
        >
          <Feather 
            name="package" 
            size={18} 
            color={searchType === 'supplement' ? colors.WHITE : (isDark ? '#888' : '#666')} 
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabText, 
            searchType === 'supplement' && styles.activeTabText,
            { color: searchType === 'supplement' ? colors.WHITE : themeColors.text }
          ]}>
            영양제
          </Text>
        </TouchableOpacity>
      </View>

      {/* 검색 컨테이너 */}
      <View style={[styles.searchContainer, { backgroundColor: themeColors.background }]}>
        <View style={[styles.searchInputContainer, { 
          backgroundColor: themeColors.card,
          borderColor: themeColors.border
        }]}>
          <Feather 
            name="search" 
            size={20} 
            color={isDark ? '#888' : '#666'} 
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { 
              color: themeColors.text,
            }]}
            placeholder={`${searchType === 'medicine' ? '약' : '영양제'} 이름을 검색하세요`}
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            editable={!isLoading && !isCsvLoading}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Feather name="x-circle" size={18} color={isDark ? '#888' : '#666'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.searchButton, { 
              backgroundColor: colors.PRIMARY.DEFAULT,
              opacity: (isLoading || isCsvLoading) ? 0.6 : 1
            }]} 
            onPress={handleSearch}
            disabled={isLoading || isCsvLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.WHITE} size="small" />
            ) : (
              <Feather name="arrow-right" size={18} color={colors.WHITE} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}> 
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>검색 중입니다...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: themeColors.card }]}> 
          <Feather name="alert-circle" size={24} color={colors.DANGER.DEFAULT} />
          <Text style={[styles.errorText, { color: colors.DANGER.DEFAULT }]}>{error}</Text>
        </View>
      ) : searchType === 'medicine' ? (
        <FlatList
          data={medicines}
          renderItem={renderItem}
          keyExtractor={(item, index) => `medicine_${index}_${item.medi_id || (item as any).itemSeq || 'unknown'}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="search" size={48} color={isDark ? '#444' : '#ccc'} />
              <Text style={[styles.emptyText, { color: isDark ? '#888' : '#666' }]}>
                검색 결과가 없습니다
              </Text>
              <Text style={[styles.emptySubtext, { color: isDark ? '#666' : '#999' }]}>
                다른 검색어로 시도해보세요
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={supplements}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.medicineItem, { 
                backgroundColor: themeColors.card,
                borderColor: themeColors.border
              }]}
              onPress={() => handleSupplementPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.medicineItemContent}>
                <View style={[styles.medicineIconContainer, { backgroundColor: '#10b98120' }]}>
                  <Feather name="package" size={20} color="#10b981" />
                </View>
                <View style={styles.medicineTextContainer}>
                  <Text style={[styles.medicineName, { color: themeColors.text }]} numberOfLines={2}>
                    {item["PRDLST_NM"]}
                  </Text>
                  {item["BSSH_NM"] && (
                    <Text style={[styles.manufacturer, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
                      {item["BSSH_NM"]}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color={isDark ? '#555' : '#ccc'} />
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => `supplement_${index}_${item["PRDLST_NM"]}_${item["BSSH_NM"] || 'unknown'}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="search" size={48} color={isDark ? '#444' : '#ccc'} />
              <Text style={[styles.emptyText, { color: isDark ? '#888' : '#666' }]}>
                검색 결과가 없습니다
              </Text>
              <Text style={[styles.emptySubtext, { color: isDark ? '#666' : '#999' }]}>
                다른 검색어로 시도해보세요
              </Text>
            </View>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginRight: 4,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  medicineItem: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  medicineItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  medicineIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicineTextContainer: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  manufacturer: {
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 8,
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
