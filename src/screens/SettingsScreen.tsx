import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../constants/colors';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, AuthStackParamList } from '../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/tdb';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import QRCodeModal from '../components/QRCodeModal';
import QRScanner from '../components/QRScanner';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Feather from 'react-native-vector-icons/Feather';
import { API_URL, API_ENDPOINTS } from '../constants/api';
import { getCurrentUser, syncUserWithServer } from '../api/userStorage';
import { verifyAuth } from '../api/auth';

type MainBottomTabParamList = {
  Home: undefined;
  Member: undefined;
  Settings: {
    scannedData?: string;
    scanType?: 'dispenser' | 'dailyKit';
  };
};

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainBottomTabParamList, 'Settings'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [user, setUser] = React.useState<User | null>(null);
  const { logout, setIsLogin } = useAuth();
  const { isDark, toggleTheme, colors: themeColors } = useTheme();
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<'dispenser' | 'dailyKit'>('dispenser');
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // 사용자 정보 로드
  React.useEffect(() => {
    loadUserInfo();
  }, []);

  // 🔥 화면 포커스 시 사용자 정보 확인 및 동기화
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [SettingsScreen] 화면 포커스 - 사용자 정보 확인');
      loadUserInfo();
    }, [])
  );

  const loadUserInfo = async () => {
    setIsLoading(true);
    try {
      // 🔥 로컬 스토리지에서 먼저 사용자 정보 가져오기
      const currentUser = await getCurrentUser();
      console.log('현재 사용자 정보 (로컬):', currentUser);
      
      if (!currentUser) {
        setDebugInfo('사용자 정보 없음');
        setUser(null);
        return;
      }
      
      setUser(currentUser as any);
      setDebugInfo(`연결됨: ${currentUser.user_id || '알 수 없음'}`);
      
      // 🔥 먼저 인증 상태 확인
      try {
        const authResult = await verifyAuth();
        if (!authResult.success) {
          console.warn('⚠️ 인증 상태 확인 실패:', authResult.error?.message);
          // 인증 실패 시에도 로컬 데이터는 유지
        } else {
          console.log('✅ 인증 상태 확인 성공');
        }
      } catch (authError) {
        console.error('❌ 인증 확인 중 에러:', authError);
      }

      // 🔥 서버에서 최신 사용자 정보 가져와서 동기화
      try {
        const syncedUser = await syncUserWithServer(currentUser.user_id);
        if (syncedUser && syncedUser.name) {
          setUser(syncedUser as any);
          console.log('✅ 사용자 정보 동기화 완료:', syncedUser.name);
        } else {
          // 동기화 실패 시 로컬 데이터 사용
          console.log('⚠️ 서버 동기화 실패 (로컬 데이터 사용)');
        }
      } catch (syncError) {
        console.log('⚠️ 서버 동기화 실패 (로컬 데이터 사용):', syncError);
        // 동기화 실패해도 로컬 데이터는 계속 사용
      }
      
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      setDebugInfo('사용자 정보 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // 새로고침 함수
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserInfo();
    setRefreshing(false);
    Toast.show({
      type: 'success',
      text1: '새로고침 완료',
      text2: '설정 정보가 업데이트되었습니다.',
    });
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          onPress: logout,
          style: 'destructive',
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <View style={[styles.titleIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
              <Feather 
                name="settings" 
                size={24} 
                color={colors.PRIMARY.DEFAULT} 
              />
            </View>
            <Text style={[styles.modernTitle, { color: themeColors.text }]}>설정</Text>
            </View>
            <TouchableOpacity
              style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <Feather 
                name="refresh-cw" 
                size={20} 
                color={refreshing ? (isDark ? '#666' : '#999') : colors.PRIMARY.DEFAULT}
              />
            </TouchableOpacity>
          </View>
          
          {user ? (
            <View style={[styles.modernUserCard, { 
              backgroundColor: themeColors.card,
              borderColor: themeColors.border 
            }]}>
              <View style={styles.userCardHeader}>
                <View style={[styles.userAvatar, { 
                  backgroundColor: user.role === 'parent' ? colors.PRIMARY.DEFAULT : colors.SUCCESS.DEFAULT 
                }]}>
                  <Feather 
                    name={user.role === 'parent' ? 'user' : 'users'} 
                    size={20} 
                    color={colors.WHITE} 
                  />
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.modernUserName, { color: themeColors.text }]}>
                    {user.name}님 ({user.role === 'parent' ? '보호자' : '자녀'})
                  </Text>
                  <Text style={[styles.modernUserType, { color: isDark ? '#888' : '#666' }]}>
                    {user.role === 'parent' ? '보호자' : '자녀'} 계정
                  </Text>
                  {/* 🔥 그룹명 표시 */}
                  {user.group_name && (
                    <Text style={[styles.groupName, { color: colors.SUCCESS.DEFAULT }]}>
                      🏠 {user.group_name}
                    </Text>
                  )}
                  {user?.role === 'parent' && user.group_id && (
                    <Text style={[styles.connectId, { color: colors.PRIMARY.DEFAULT }]}>
                      ID: {maskConnectID(user.group_id)}
                    </Text>
                  )}
                </View>
              </View>
              {user?.role === 'parent' && user.user_id && (
                <TouchableOpacity
                  style={[styles.modernQrButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
                  onPress={() => setShowQRModal(true)}
                >
                  <FontAwesome name="qrcode" size={18} color={colors.WHITE} />
                  <Text style={[styles.modernQrButtonText, { color: colors.WHITE }]}>QR 코드 생성</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.userInfo, { 
              backgroundColor: themeColors.card,
              borderColor: themeColors.border 
            }]}>
              <Text style={[styles.userName, { color: themeColors.text }]}>{debugInfo}</Text>
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.PRIMARY.DEFAULT }]}
                onPress={() => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'AuthStack' as any }],
                  });
                }}
              >
                <Text style={[styles.loginButtonText, { color: colors.WHITE }]}>로그인 화면으로 이동</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.modernSectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.SUCCESS.DEFAULT + '20' }]}>
              <Feather 
                name="smartphone" 
                size={18} 
                color={colors.SUCCESS.DEFAULT} 
              />
            </View>
            <Text style={[styles.modernSectionTitle, { color: themeColors.text }]}>기기 등록</Text>
          </View>
          
          {/* 디스펜서 QR 스캔 (보호자 계정만) */}
          {user?.role === 'parent' && (
            <View style={[styles.modernDeviceCard, { 
              backgroundColor: themeColors.card,
              borderColor: themeColors.border 
            }]}>
              <TouchableOpacity
                style={styles.modernDeviceButton}
                onPress={() => {
                  navigation.navigate('QRScanner', { scanType: 'dispenser' });
                }}
              >
                <View style={styles.deviceCardContent}>
                  <View style={styles.deviceInfo}>
                    <View style={[styles.deviceIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
                      <Feather 
                        name="package" 
                        size={20} 
                        color={colors.PRIMARY.DEFAULT} 
                      />
                    </View>
                    <View style={styles.deviceDetails}>
                      <Text style={[styles.modernDeviceTitle, { color: themeColors.text }]}>
                        디스펜서 QR 스캔
                      </Text>
                      <Text style={[styles.deviceDescription, { color: isDark ? '#888' : '#666' }]}>
                        디스펜서를 연결하여 약을 관리하세요
                      </Text>
                      {user.machine_id && (
                        <Text style={[styles.registeredIndicator, { color: colors.SUCCESS.DEFAULT }]}>
                          ✅ 등록완료: {maskConnectID(user.machine_id)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.scanIcon, { backgroundColor: colors.PRIMARY.DEFAULT }]}>
                    <Feather 
                      name="camera" 
                      size={16} 
                      color={colors.WHITE} 
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* 🔥 디스펜서 등록 상태 표시 (보호자 계정만) - TODO: 기기 등록 API 추가 필요 */}
          {user?.role === 'parent' && false && (
            <View style={[styles.modernStatusCard, { 
              backgroundColor: themeColors.card,
              borderColor: colors.SUCCESS.DEFAULT + '30',
              borderWidth: 1
            }]}>
              <View style={styles.statusCardContent}>
                <View style={styles.statusInfo}>
                  <View style={[styles.statusIcon, { backgroundColor: colors.SUCCESS.DEFAULT + '20' }]}>
                    <Feather 
                      name="check-circle" 
                      size={20} 
                      color={colors.SUCCESS.DEFAULT} 
                    />
                  </View>
                  <View style={styles.statusDetails}>
                    <Text style={[styles.modernStatusTitle, { color: themeColors.text }]}>
                      디스펜서 연결됨
                    </Text>
                    <Text style={[styles.statusDescription, { color: isDark ? '#888' : '#666' }]}>
                      슬롯 3개 사용 가능
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.SUCCESS.DEFAULT + '10' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.SUCCESS.DEFAULT }]}>활성</Text>
                </View>
              </View>
            </View>
          )}

          {/* 데일리 키트 QR 스캔 (모든 계정) */}
          {user && (
            <View style={[styles.modernDeviceCard, { 
              backgroundColor: themeColors.card,
              borderColor: themeColors.border 
            }]}>
              <TouchableOpacity
                style={styles.modernDeviceButton}
                onPress={() => {
                  navigation.navigate('QRScanner', { scanType: 'dailyKit' });
                }}
              >
                <View style={styles.deviceCardContent}>
                  <View style={styles.deviceInfo}>
                    <View style={[styles.deviceIcon, { backgroundColor: colors.WARNING.DEFAULT + '20' }]}>
                      <Feather 
                        name="briefcase" 
                        size={20} 
                        color={colors.WARNING.DEFAULT} 
                      />
                    </View>
                    <View style={styles.deviceDetails}>
                      <Text style={[styles.modernDeviceTitle, { color: themeColors.text }]}>
                        데일리 키트 QR 스캔
                      </Text>
                      <Text style={[styles.deviceDescription, { color: isDark ? '#888' : '#666' }]}>
                        휴대용 약통을 연결하여 외출 시 관리하세요
                      </Text>
                      {user?.k_uid && (
                        <Text style={[styles.registeredIndicator, { color: colors.SUCCESS.DEFAULT }]}>
                          ✅ 등록완료: {maskConnectID(user.k_uid)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.scanIcon, { backgroundColor: colors.WARNING.DEFAULT }]}>
                    <Feather 
                      name="camera" 
                      size={16} 
                      color={colors.WHITE} 
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.modernSectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.GRAY.DEFAULT + '20' }]}>
              <Feather 
                name="sliders" 
                size={18} 
                color={colors.GRAY.DEFAULT} 
              />
            </View>
            <Text style={[styles.modernSectionTitle, { color: themeColors.text }]}>앱 설정</Text>
          </View>
          <View style={[styles.modernSettingCard, { 
            backgroundColor: themeColors.card,
            borderColor: themeColors.border 
          }]}>
            <View style={styles.settingCardContent}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: isDark ? colors.WARNING.DEFAULT + '20' : colors.GRAY.DEFAULT + '20' }]}>
                  <Feather 
                    name={isDark ? 'moon' : 'sun'} 
                    size={16} 
                    color={isDark ? colors.WARNING.DEFAULT : colors.GRAY.DEFAULT} 
                  />
                </View>
                <View style={styles.settingDetails}>
                  <Text style={[styles.modernSettingLabel, { color: themeColors.text }]}>다크 모드</Text>
                  <Text style={[styles.settingDescription, { color: isDark ? '#888' : '#666' }]}>
                    {isDark ? '어두운 테마 사용 중' : '밝은 테마 사용 중'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.GRAY.DEFAULT, true: colors.PRIMARY.DEFAULT }}
                thumbColor={colors.WHITE}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.modernLogoutCard, { 
            backgroundColor: themeColors.card,
            borderColor: themeColors.border 
          }]}
          onPress={handleLogout}
        >
          <View style={styles.logoutCardContent}>
            <View style={styles.logoutInfo}>
              <View style={[styles.logoutIcon, { backgroundColor: colors.DANGER.DEFAULT + '20' }]}>
                <Feather 
                  name="log-out" 
                  size={16} 
                  color={colors.DANGER.DEFAULT} 
                />
              </View>
              <View style={styles.logoutDetails}>
                <Text style={[styles.modernLogoutLabel, { color: colors.DANGER.DEFAULT }]}>로그아웃</Text>
                <Text style={[styles.logoutDescription, { color: isDark ? '#888' : '#666' }]}>
                  계정에서 로그아웃합니다
                </Text>
              </View>
            </View>
            <Feather 
              name="chevron-right" 
              size={16} 
              color={colors.DANGER.DEFAULT} 
            />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {user?.role === 'parent' && user.user_id && (
        <QRCodeModal
          visible={showQRModal}
          onClose={() => setShowQRModal(false)}
          connectId={user.user_id}
        />
      )}
    </SafeAreaView>
  );
};

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
  header: {
    padding: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.PRIMARY.DEFAULT + '10',
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 60 : 50,
  },
  userInfo: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 5,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userType: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  uuid: {
    fontSize: 14,
    marginTop: 8,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  settingLabel: {
    fontSize: 16,
  },
  qrButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  qrButtonText: {
    color: colors.WHITE,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    flex: 1,
  },
  deviceButtonText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
    flexWrap: 'wrap',
  },
  registeredText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 16,
    marginRight: 16,
    color: colors.GRAY.DEFAULT,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  qrDescription: {
    fontSize: 14,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  loginButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 새로운 현대적 스타일들
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: Platform.OS === 'ios' ? 80 : 10,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  modernUserCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  modernUserName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modernUserType: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  connectId: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modernQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modernQrButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  modernSettingCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  settingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingDetails: {
    flex: 1,
  },
  modernSettingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    fontWeight: '400',
  },
  modernLogoutCard: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutDetails: {
    flex: 1,
  },
  modernLogoutLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  logoutDescription: {
    fontSize: 12,
    fontWeight: '400',
  },
  modernDeviceCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modernDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceDetails: {
    flex: 1,
  },
  modernDeviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modernDeviceSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  deviceDescription: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  registeredIndicator: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  scanIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernStatusCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDetails: {
    flex: 1,
  },
  modernStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 13,
    fontWeight: '400',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

function maskConnectID(connectId: string) {
  if (!connectId || connectId.length < 3) return connectId;
  // 뒤 2자리만 노출, 나머지는 *
  return '*'.repeat(connectId.length - 2) + connectId.slice(-2);
}

export default SettingsScreen; 
