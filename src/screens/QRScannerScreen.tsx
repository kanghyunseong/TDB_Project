import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, StatusBar, TextInput, Modal } from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import colors from '../constants/colors';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types/navigation';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../api/userStorage';
import { userApi } from '../api/users';

type QRScannerScreenParams = {
  scanType: 'dispenser' | 'dailyKit';
};

interface QRData {
  type: 'uuid_link' | 'uid_link' | 'link';
  uid: string;
  createdAt: string;
}

const QRScannerScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<{ params: QRScannerScreenParams }, 'params'>>();
  const [scanned, setScanned] = useState(false);
  const scanType = route.params?.scanType || 'dispenser';
  const [isProcessing, setIsProcessing] = useState(false);

  const validateQRData = (data: QRData): boolean => {
    try {
      // 필수 필드 확인
      if (!data.type || !data.uid || !data.createdAt) {
        console.log('필수 필드 누락:', { type: data.type, uid: data.uid, createdAt: data.createdAt });
        return false;
      }

      // type 값 검증
      if (!['uuid_link', 'uid_link', 'link'].includes(data.type)) {
        console.log('잘못된 type 값:', data.type);
        return false;
      }

      // uid 형식 검증 (8자리 알파벳+숫자)
      const uidRegex = /^[A-Z0-9]{8}$/;
      if (!uidRegex.test(data.uid)) {
        console.log('잘못된 uid 형식:', data.uid);
        return false;
      }

      // createdAt 형식 검증 (ISO 8601 형식)
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
      if (!dateRegex.test(data.createdAt)) {
        console.log('잘못된 createdAt 형식:', data.createdAt);
        return false;
      }

      return true;
    } catch (error) {
      console.error('QR 데이터 검증 중 에러:', error);
      return false;
    }
  };

  const handleScan = async (event: { data: string }) => {
    if (scanned || isProcessing) return;
    
    setIsProcessing(true);
    setScanned(true);
    
    try {
      let uid: string;
      
      console.log('🔍 스캔된 원본 데이터:', event.data);
      
      // 🔥 machine_id 값 추출 로직 개선 (띄어쓰기 처리 포함)
      try {
        // 1. 정규식으로 machine_id 값 추출 시도 (Python dict 형태나 불완전한 JSON 처리)
        const machineIdMatch = event.data.match(/['"]?machine_id['"]?\s*:\s*['"]([A-Z0-9\s]{1,20})['"]?/i);
        if (machineIdMatch) {
          uid = machineIdMatch[1].replace(/\s+/g, ''); // 띄어쓰기 제거
          console.log('✅ 정규식으로 machine_id 추출 성공 (띄어쓰기 제거):', uid);
        } else {
          // 2. JSON 파싱 시도
          const qrData = JSON.parse(event.data);
          console.log('✅ JSON 파싱 성공:', qrData);
          let rawUid = qrData.uid || qrData.machine_id;
          uid = typeof rawUid === 'string' ? rawUid.replace(/\s+/g, '') : rawUid;
          console.log('✅ JSON에서 UID 추출 (띄어쓰기 제거):', uid);
        }
      } catch {
        // 3. 띄어쓰기가 포함된 문자열 처리 (예: "F7 F8 F9" → "F7F8F9")
        const cleanedData = event.data.replace(/\s+/g, '');
        console.log('🔧 띄어쓰기 제거된 데이터:', cleanedData);
        
        // 4. 단순 문자열로 처리 (8자리 영숫자 패턴 찾기)
        const uidMatch = cleanedData.match(/[A-Z0-9]{8}/);
        if (uidMatch) {
          uid = uidMatch[0];
          console.log('✅ 패턴 매칭으로 UID 추출:', uid);
        } else {
          // 5. 전체를 UID로 시도 (띄어쓰기 제거)
          uid = cleanedData;
          console.log('✅ 전체 문자열을 UID로 처리 (띄어쓰기 제거):', uid);
        }
      }
      
      // UID 유효성 검증
      if (!uid) {
        throw new Error('QR 코드에서 UID를 찾을 수 없습니다.');
      }
      
      // UID 형식 검증 (8자리 영숫자)
      const uidRegex = /^[A-Z0-9]{8}$/i;
      if (!uidRegex.test(uid)) {
        throw new Error(`올바르지 않은 UID 형식입니다: ${uid}`);
      }
      
      console.log('🎯 최종 추출된 UID:', uid);

      // 🔥 바로 기기 등록 처리
      await registerDevice(uid);

    } catch (error) {
      console.error('QR 스캔 처리 에러:', error);
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: error instanceof Error ? error.message : 'QR 코드 처리에 실패했습니다.',
      });
      
      // 에러 시 다시 스캔 가능하도록
      setTimeout(() => {
        setScanned(false);
        setIsProcessing(false);
      }, 2000);
    }
  };

  // 🔥 기기 등록 함수 (userApi 사용)
  const registerDevice = async (uid: string) => {
    try {
      // 현재 사용자 정보 가져오기
      const user = await getCurrentUser();
      if (!user?.user_id) {
        throw new Error('사용자 정보가 없습니다. 다시 로그인해주세요.');
      }

      console.log(`[QRScanner] 기기 등록 시도: userId=${user.user_id}, uid=${uid}, scanType=${scanType}`);

      // userApi를 사용하여 기기 등록
      const result = scanType === 'dispenser' 
        ? await userApi.registerDispenser(user.user_id, uid)
        : await userApi.registerDailyKit(user.user_id, uid);

      console.log('[QRScanner] API 응답:', result);

      // 🔥 "이미 등록된 디스펜서" 에러 처리
      if (!result.success) {
        const errorMessage = result.error?.message || '기기 등록에 실패했습니다.';
        
        // "이미 등록된 디스펜서"인 경우 AsyncStorage는 업데이트하고 안내 메시지만 표시
        if (errorMessage.includes('이미 등록된')) {
          console.log('[QRScanner] 이미 등록된 기기입니다. AsyncStorage 업데이트 시도...');
          
          // AsyncStorage 업데이트
          const updatedUser = {
            ...user,
            [scanType === 'dispenser' ? 'machine_id' : 'k_uid']: uid
          };
          await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
          console.log('[QRScanner] ✅ AsyncStorage 업데이트 완료');

          Toast.show({
            type: 'info',
            text1: '알림',
            text2: scanType === 'dispenser'
              ? '이미 등록된 디스펜서입니다. 앱 정보가 동기화되었습니다.'
              : '이미 등록된 데일리 키트입니다. 앱 정보가 동기화되었습니다.',
          });

          // 홈 화면으로 이동
          setTimeout(() => {
            navigation.navigate('MainTabs', {
              screen: 'Home'
            });
          }, 1500);
          
          return; // 여기서 종료
        }
        
        // 다른 에러인 경우
        throw new Error(errorMessage);
      }

      // 🔥 등록 성공 시 AsyncStorage 업데이트
      const updatedUser = {
        ...user,
        [scanType === 'dispenser' ? 'machine_id' : 'k_uid']: uid
      };
      await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
      console.log('[QRScanner] ✅ 새 기기 등록 완료 및 AsyncStorage 업데이트');

      Toast.show({
        type: 'success',
        text1: '성공',
        text2: scanType === 'dispenser' 
          ? '디스펜서가 등록되었습니다 (슬롯 3개 사용 가능)'
          : '데일리 키트가 성공적으로 등록되었습니다.',
      });

      // 홈 화면으로 이동
      navigation.navigate('MainTabs', {
        screen: 'Home'
      });

    } catch (error) {
      console.error('[QRScanner] ❌ 기기 등록 에러:', error);
      
      // 에러 타입에 따라 다른 메시지 표시
      let errorText = '기기 등록에 실패했습니다.';
      if (error instanceof Error) {
        errorText = error.message;
        
        // 네트워크 에러인 경우
        if (errorText.includes('Network') || errorText.includes('connect')) {
          errorText = '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.';
        }
      }
      
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: errorText,
      });
      
      // 에러 시 다시 스캔 가능하도록
      setTimeout(() => {
        setScanned(false);
        setIsProcessing(false);
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <QRCodeScanner
        onRead={handleScan}
        flashMode={RNCamera.Constants.FlashMode.auto}
        vibrate={false}
        reactivate={true}
        reactivateTimeout={2000}
        topContent={
          <View style={styles.header}>
            <Text style={styles.title}>
              {scanType === 'dispenser' ? '디스펜서' : '데일리 키트'} QR 코드를 스캔해주세요
            </Text>
          </View>
        }
        bottomContent={
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                setScanned(false);
                setIsProcessing(false);
              }}
            >
              <Text style={styles.buttonText}>다시 스캔</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => navigation.goBack()}
      >
        <FontAwesome name="times" size={24} color={colors.WHITE} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BLACK,
  },
  header: {
    padding: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
  },
  title: {
    fontSize: 18,
    color: colors.WHITE,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
  },
  button: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: colors.WHITE,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default QRScannerScreen; 