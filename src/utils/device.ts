import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const DEVICE_ID_KEY = '@device_id';

export const getDeviceId = async (): Promise<string> => {
  try {
    // 저장된 디바이스 ID가 있는지 확인
    const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (storedDeviceId) {
      return storedDeviceId;
    }
    
    // 디바이스 ID가 없으면 새로 생성
    const newDeviceId = await DeviceInfo.getUniqueId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.error('디바이스 ID 가져오기 실패:', error);
    // 에러 발생 시 플랫폼별 기본값 반환
    return Platform.OS === 'ios' ? 'ios-device' : 'android-device';
  }
}; 