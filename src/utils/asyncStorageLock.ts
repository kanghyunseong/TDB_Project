/**
 * AsyncStorage 동시 접근 방지를 위한 Lock 메커니즘
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// 진행 중인 작업을 추적하는 Map
const pendingOperations = new Map<string, Promise<any>>();

/**
 * Lock을 사용하여 AsyncStorage 작업을 순차적으로 처리
 */
export const withStorageLock = async <T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> => {
  // 이미 진행 중인 작업이 있으면 대기
  const existingOperation = pendingOperations.get(key);
  if (existingOperation) {
    await existingOperation;
  }
  
  // 새 작업 시작
  const operationPromise = (async () => {
    try {
      return await operation();
    } finally {
      // 작업 완료 후 Map에서 제거
      pendingOperations.delete(key);
    }
  })();
  
  pendingOperations.set(key, operationPromise);
  return operationPromise;
};

/**
 * 안전한 AsyncStorage.getItem (Lock 사용)
 */
export const safeGetItem = async (key: string): Promise<string | null> => {
  return withStorageLock(key, async () => {
    return await AsyncStorage.getItem(key);
  });
};

/**
 * 안전한 AsyncStorage.setItem (Lock 사용)
 */
export const safeSetItem = async (key: string, value: string): Promise<void> => {
  return withStorageLock(key, async () => {
    return await AsyncStorage.setItem(key, value);
  });
};

/**
 * 안전한 AsyncStorage.removeItem (Lock 사용)
 */
export const safeRemoveItem = async (key: string): Promise<void> => {
  return withStorageLock(key, async () => {
    return await AsyncStorage.removeItem(key);
  });
};

/**
 * 안전한 AsyncStorage.multiGet (Lock 사용)
 */
export const safeMultiGet = async (keys: string[]): Promise<readonly [string, string | null][]> => {
  // 모든 키에 대해 Lock 적용
  const lockKey = keys.sort().join(',');
  return withStorageLock(lockKey, async () => {
    return await AsyncStorage.multiGet(keys);
  });
};

/**
 * 안전한 AsyncStorage.multiSet (Lock 사용)
 */
export const safeMultiSet = async (keyValuePairs: [string, string][]): Promise<void> => {
  const keys = keyValuePairs.map(([key]) => key);
  const lockKey = keys.sort().join(',');
  return withStorageLock(lockKey, async () => {
    return await AsyncStorage.multiSet(keyValuePairs);
  });
};

