import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';

import { MainStackParamList } from '../types/navigation';
import { MemberWithProgress } from '../types/member';
import colors from '../constants/colors';

// 커스텀 훅
import { useMemberData } from '../hooks/useMemberData';

// 컴포넌트
import FamilyDashboard from '../components/FamilyDashboard';

type MainBottomTabParamList = {
  홈: undefined;
  멤버: undefined;
  약: undefined;
  설정: undefined;
};

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainBottomTabParamList, '멤버'>,
  NativeStackNavigationProp<MainStackParamList>
>;

function MainMemberScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors: themeColors, isDark } = useTheme();
  
  // 커스텀 훅 사용
  const {
    familyMembers,
    isLoading,
    error,
    refreshing,
    refresh,
    markDoseComplete,
    loadData
  } = useMemberData();
  
  // group_id 값 가져오기 (첫 번째 가족 구성원의 group_id 사용)
  const group_id = familyMembers.length > 0 ? familyMembers[0].group_id : '';

  // 🔥 화면 포커스 시 데이터 새로고침 (스케줄 변경 반영)
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [MainMemberScreen] 화면 포커스 - 데이터 새로고침');
      refresh(); // 매번 refresh하여 스케줄 변경사항 반영
    }, [refresh])
  );

  // 구성원 상세 화면으로 이동
  const handleMemberDetail = useCallback((member: MemberWithProgress) => {
    navigation.navigate('MemberDetail', {
      memberId: member.user_id
    });
  }, [navigation]);

  // 복용 완료 처리
  const handleDoseComplete = useCallback(async (
    userId: string,
    timeSlot: 'morning' | 'afternoon' | 'evening'
  ) => {
    await markDoseComplete(userId, timeSlot);
    // 복용 완료 후 전체 데이터 새로고침
    setTimeout(() => {
      refresh();
    }, 1000);
  }, [markDoseComplete, refresh]);

  // 대시보드 새로고침 핸들러 (약물 ID와 시간대 정보 전달)
  const handleDashboardRefresh = useCallback((medicineId?: string, userId?: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') => {
    refresh();
    // 🔥 약물 ID와 시간대 정보가 있으면 메인 홈 화면에도 알림 (이벤트 전달)
    if (medicineId && userId && timeOfDay) {
      // 메인 홈 화면에서 상태를 업데이트할 수 있도록 이벤트 발생
      // 실제로는 navigation이나 전역 상태를 통해 전달해야 하지만,
      // 현재 구조에서는 refresh만 호출하여 간접적으로 업데이트
      console.log(`[MainMemberScreen] 복용 상태 업데이트: ${medicineId}, ${userId}, ${timeOfDay}`);
    }
  }, [refresh]);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.PRIMARY.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>
            가족 정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.DANGER.DEFAULT} />
          <Text style={[styles.errorTitle, { color: themeColors.text }]}>
            데이터 로딩 실패
          </Text>
          <Text style={[styles.errorText, { color: isDark ? '#888' : '#666' }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
            onPress={refresh}
          >
            <Icon name="refresh-cw" size={16} color={colors.WHITE} />
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={refresh}
            colors={[colors.PRIMARY.DEFAULT]}
            tintColor={colors.PRIMARY.DEFAULT}
          />
        }
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={[styles.headerIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
              <Icon name="users" size={24} color={colors.PRIMARY.DEFAULT} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>
                가족 건강 대시보드
              </Text>
              <Text style={[styles.headerSubtitle, { color: isDark ? '#888' : '#666' }]}>
                오늘의 복용 현황을 확인하세요
              </Text>
              {/* 🔥 그룹명 표시 */}
              {familyMembers.length > 0 && familyMembers[0].group_name && (
                <Text style={[styles.groupNameSubtitle, { color: colors.PRIMARY.DEFAULT }]}>
                  🏠 {familyMembers[0].group_name}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 🔥 새로운 실시간 가족 복용 현황 대시보드 */}
        {group_id && (
          <FamilyDashboard 
            connect={group_id}
            onRefresh={handleDashboardRefresh}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.WHITE,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  groupNameSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  addMemberButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  todayDate: {
    fontSize: 14,
  },
  memberProgressContainer: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default MainMemberScreen;