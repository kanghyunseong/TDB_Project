import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DoseTimeSettings {
  morning: string;   // "08:00" 형식
  afternoon: string; // "13:00" 형식
  evening: string;   // "19:00" 형식
}

const DOSE_TIME_SETTINGS_KEY = '@dose_time_settings';

// 기본 설정값
const DEFAULT_SETTINGS: DoseTimeSettings = {
  morning: '08:00',
  afternoon: '12:00',
  evening: '19:00'
};

/**
 * 복용 시간 설정 불러오기
 */
export const getDoseTimeSettings = async (): Promise<DoseTimeSettings> => {
  try {
    const settings = await AsyncStorage.getItem(DOSE_TIME_SETTINGS_KEY);
    if (settings) {
      const parsed = JSON.parse(settings);
      console.log('✅ 복용 시간 설정 로드:', parsed);
      return parsed;
    }
    console.log('ℹ️ 저장된 설정 없음, 기본값 사용:', DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('❌ 복용 시간 설정 로드 실패:', error);
    return DEFAULT_SETTINGS;
  }
};

/**
 * 시간 문자열을 시(hour)로 변환
 * @param timeString "08:00" 형식
 * @returns 8
 */
export const getHourFromTimeString = (timeString: string): number => {
  try {
    const [hours] = timeString.split(':').map(Number);
    return hours;
  } catch (error) {
    console.error('시간 파싱 오류:', timeString, error);
    return 8; // 기본값
  }
};

/**
 * 복용 시간 설정값을 동기적으로 가져오기 (캐시)
 * 비동기 로딩 전에 임시로 기본값 반환
 */
export const getCachedDoseTimeSettings = (): DoseTimeSettings => {
  return DEFAULT_SETTINGS;
};

