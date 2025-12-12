import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { deleteMedicine, deleteSupplement as deleteSupplementAPI } from '../api/family';
import { Medicine, NutritionalSupplement } from '../types/tdb';
import { logger } from '../utils/logger';

interface UseMedicineActionsProps {
  setMedicineList: React.Dispatch<React.SetStateAction<Medicine[]>>;
  setSupplementList: React.Dispatch<React.SetStateAction<NutritionalSupplement[]>>;
  invalidateInteractionCaches: () => void;
  checkFamilyDrugInteractions: (forceRefresh?: boolean) => Promise<void>;
  clearScheduleCache?: (medicineId: string, userId: string) => void; // 🔥 스케줄 캐시 무효화 함수 추가
}

export const useMedicineActions = ({
  setMedicineList,
  setSupplementList,
  invalidateInteractionCaches,
  checkFamilyDrugInteractions,
  clearScheduleCache,
}: UseMedicineActionsProps) => {
  // 🔥 약물 삭제 처리
  const handleDeleteMedicine = useCallback(async (medicine: Medicine) => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) return;

      const user = JSON.parse(userJson);
      logger.log('약 삭제 시작', { name: medicine.name });

      const success = await deleteMedicine(user.user_id, medicine.medi_id);

      if (success) {
        invalidateInteractionCaches();

        // 🔥 스케줄 캐시 무효화 (약물 삭제 시 관련 스케줄 캐시 제거)
        if (clearScheduleCache) {
          // target_users가 있으면 모든 사용자의 스케줄 캐시 무효화
          if (medicine.target_users && medicine.target_users.length > 0) {
            medicine.target_users.forEach(userId => {
              clearScheduleCache(medicine.medi_id, userId);
              logger.log('스케줄 캐시 무효화', { medicineId: medicine.medi_id, userId });
            });
          } else {
            // target_users가 없으면 현재 사용자의 스케줄 캐시만 무효화
            clearScheduleCache(medicine.medi_id, user.user_id);
            logger.log('스케줄 캐시 무효화', { medicineId: medicine.medi_id, userId: user.user_id });
          }
        }

        // 🔥 CacheManager의 AsyncStorage 캐시도 삭제
        const { CacheManager } = await import('../utils/cache');
        await CacheManager.removePattern(medicine.medi_id);
        logger.log('CacheManager 캐시 삭제', { medicineId: medicine.medi_id });

        setMedicineList(prev => prev.filter(m => m.medi_id !== medicine.medi_id));

        setTimeout(async () => {
          try {
            await checkFamilyDrugInteractions(true);
          } catch (error) {
            logger.error('가족 약물 상호작용 검사 실패', error);
          }
        }, 500);

        Toast.show({
          type: 'success',
          text1: '약이 삭제되었습니다',
          text2: `${medicine.name}이(가) 목록에서 제거되었습니다.`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '삭제 실패',
          text2: '약 삭제 중 오류가 발생했습니다.',
        });
      }
    } catch (error) {
      logger.error('약 삭제 실패', error);
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: '약 삭제 중 오류가 발생했습니다.',
      });
    }
  }, [setMedicineList, invalidateInteractionCaches, checkFamilyDrugInteractions, clearScheduleCache]);

  // 🔥 영양제 삭제 처리
  const handleDeleteSupplement = useCallback(async (supplement: NutritionalSupplement) => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (!userJson) return;

      const user = JSON.parse(userJson);
      logger.log('영양제 삭제 시작', { name: supplement.name });

      const result = await deleteSupplementAPI(user.user_id, supplement.id || '');

      if (result) {
        // 🔥 상호작용 캐시 무효화
        invalidateInteractionCaches();

        // 🔥 스케줄 캐시 무효화 (영양제 삭제 시 관련 스케줄 캐시 제거)
        if (clearScheduleCache) {
          // target_users가 있으면 모든 사용자의 스케줄 캐시 무효화
          if (supplement.target_users && supplement.target_users.length > 0) {
            supplement.target_users.forEach(userId => {
              clearScheduleCache(supplement.id || '', userId);
              logger.log('영양제 스케줄 캐시 무효화', { supplementId: supplement.id, userId });
            });
          } else {
            // target_users가 없으면 현재 사용자의 스케줄 캐시만 무효화
            clearScheduleCache(supplement.id || '', user.user_id);
            logger.log('영양제 스케줄 캐시 무효화', { supplementId: supplement.id, userId: user.user_id });
          }
        }

        // 🔥 CacheManager의 AsyncStorage 캐시도 삭제
        const { CacheManager } = await import('../utils/cache');
        if (supplement.id) {
          await CacheManager.removePattern(supplement.id);
          logger.log('CacheManager 캐시 삭제', { supplementId: supplement.id });
        }

        // 로컬 상태에서 해당 영양제 제거
        setSupplementList(prev => prev.filter(s => s.id !== supplement.id));

        // 🔥 상호작용 재검사 (약물 삭제와 동일하게 처리)
        setTimeout(async () => {
          try {
            await checkFamilyDrugInteractions(true);
          } catch (error) {
            logger.error('가족 약물 상호작용 검사 실패', error);
          }
        }, 500);

        Toast.show({
          type: 'success',
          text1: '영양제가 삭제되었습니다',
          text2: `${supplement.name}이(가) 목록에서 제거되었습니다.`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '삭제 실패',
          text2: '영양제 삭제 중 오류가 발생했습니다.',
        });
      }
    } catch (error) {
      logger.error('영양제 삭제 실패', error);
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: '영양제 삭제 중 오류가 발생했습니다.',
      });
    }
  }, [setSupplementList, invalidateInteractionCaches, checkFamilyDrugInteractions, clearScheduleCache]);

  return {
    handleDeleteMedicine,
    handleDeleteSupplement,
  };
};

