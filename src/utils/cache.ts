import AsyncStorage from '@react-native-async-storage/async-storage';


interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // 밀리초
}

export class CacheManager {
  static async set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): Promise<void> {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiresIn,
      };
      
      await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify(cacheItem));
      console.log(`✅ [Cache] 저장 완료: ${key} (${expiresIn}ms)`);
    } catch (error) {
      console.error(`❌ [Cache] 저장 실패: ${key}`, error);
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`@cache_${key}`);
      
      if (!cached) {
        console.log(`⚠️ [Cache] 캐시 없음: ${key}`);
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - cacheItem.timestamp;

      // 캐시 만료 확인
      if (age > cacheItem.expiresIn) {
        console.log(`⏰ [Cache] 캐시 만료: ${key} (age: ${age}ms)`);
        await this.remove(key);
        return null;
      }

      console.log(`✅ [Cache] 캐시 히트: ${key} (age: ${age}ms)`);
      return cacheItem.data;
    } catch (error) {
      console.error(`❌ [Cache] 조회 실패: ${key}`, error);
      return null;
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`@cache_${key}`);
      console.log(`🗑️ [Cache] 삭제 완료: ${key}`);
    } catch (error) {
      console.error(`❌ [Cache] 삭제 실패: ${key}`, error);
    }
  }

  static async removePattern(pattern: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith('@cache_') && key.includes(pattern)
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🗑️ [Cache] 패턴 삭제 완료: ${pattern} (${cacheKeys.length}개)`);
    } catch (error) {
      console.error(`❌ [Cache] 패턴 삭제 실패: ${pattern}`, error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@cache_'));
      
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🗑️ [Cache] 전체 삭제 완료 (${cacheKeys.length}개)`);
    } catch (error) {
      console.error('❌ [Cache] 전체 삭제 실패', error);
    }
  }

  static async getStats(): Promise<{ total: number; expired: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@cache_'));
      
      let expiredCount = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            const age = now - cacheItem.timestamp;
            
            if (age > cacheItem.expiresIn) {
              expiredCount++;
            }
          }
        } catch {
          // 파싱 실패한 캐시는 만료로 간주
          expiredCount++;
        }
      }

      return {
        total: cacheKeys.length,
        expired: expiredCount,
      };
    } catch (error) {
      console.error('❌ [Cache] 통계 조회 실패', error);
      return { total: 0, expired: 0 };
    }
  }
}

export const CACHE_KEYS = {
  FAMILY_MEMBERS: (groupId: string) => `family_members_${groupId}`,
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
  MEDICINE_LIST: (userId: string) => `medicine_list_${userId}`,
  SUPPLEMENT_LIST: (userId: string) => `supplement_list_${userId}`,
  SCHEDULE: (userId: string, medicineId: string) => `schedule_${userId}_${medicineId}`,
  DOSE_HISTORY: (userId: string, date: string) => `dose_history_${userId}_${date}`,
} as const;

export const CACHE_DURATION = {
  SHORT: 1 * 60 * 1000,      // 1분
  MEDIUM: 5 * 60 * 1000,     // 5분
  LONG: 30 * 60 * 1000,      // 30분
  VERY_LONG: 24 * 60 * 60 * 1000, // 24시간
} as const;

export default CacheManager;

