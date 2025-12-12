import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';

interface MedicineHeaderProps {
  userType: 'parent' | 'child' | null;
  isDark: boolean;
  themeColors: any;
  onSearchPress: () => void;
  onSchedulePress: () => void;
}

/**
 * 약물 목록 헤더 컴포넌트
 * - 제목 및 부제목
 * - 약 검색 버튼
 * - 스케줄 확인 버튼
 */
const MedicineHeader: React.FC<MedicineHeaderProps> = React.memo(({
  userType,
  isDark,
  themeColors,
  onSearchPress,
  onSchedulePress,
}) => {
  return (
    <>
      {/* 헤더 텍스트 섹션 */}
      <View style={styles.medicineHeaderSection}>
        <View style={styles.medicineHeaderContent}>
          <View style={[styles.medicineIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
            <Feather 
              name="heart" 
              size={20} 
              color={colors.PRIMARY.DEFAULT} 
            />
          </View>
          <View style={styles.medicineHeaderText}>
            <Text style={[styles.medicineListTitle, { color: themeColors.text }]}>
              보유중인 약
            </Text>
            <Text style={[styles.medicineListSubtitle, { color: isDark ? '#888' : '#666' }]}>
              등록된 의약품 목록
            </Text>
          </View>
        </View>
      </View>
      
      {/* 버튼 섹션 */}
      <View style={styles.allButtonsContainer}>
        {/* 약 검색 버튼 */}
        <TouchableOpacity
          style={[styles.dispenseButton, styles.searchButton]}
          onPress={onSearchPress}
        >
          <Feather 
            name={userType === 'parent' ? 'search' : 'info'} 
            size={12} 
            color={colors.PRIMARY.DEFAULT} 
          />
          <Text style={[styles.dispenseButtonText, { color: colors.PRIMARY.DEFAULT }]}>
            {userType === 'parent' ? '약 검색' : '약 정보'}
          </Text>
        </TouchableOpacity>

        {/* 오늘의 스케줄 표시 */}
        <TouchableOpacity
          style={[styles.dispenseButton, styles.todayScheduleButton]}
          onPress={onSchedulePress}
        >
          <Feather name="calendar" size={12} color="#FFF" />
          <Text style={[styles.dispenseButtonText, { color: '#FFF' }]}>
            스케줄 확인
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
});

MedicineHeader.displayName = 'MedicineHeader';

const styles = StyleSheet.create({
  medicineHeaderSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  medicineHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicineHeaderText: {
    flex: 1,
  },
  medicineListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  medicineListSubtitle: {
    fontSize: 13,
  },
  allButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24, // 🔥 디스펜서와의 여백 증가 (16 -> 24)
    gap: 8,
  },
  dispenseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  searchButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  todayScheduleButton: {
    backgroundColor: colors.PRIMARY.DEFAULT,
  },
  dispenseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MedicineHeader;

