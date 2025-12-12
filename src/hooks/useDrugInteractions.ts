import { useState, useCallback, useRef } from 'react';
import { DrugInteractionValidator, type InteractionValidationResult } from '../utils/drugInteractionValidator';
import { type Medicine, type FamilyMember } from '../types/tdb';
import { getMedicineList } from '../api/family';
import Toast from 'react-native-toast-message';

interface UseDrugInteractionsReturn {
  interactionResult: InteractionValidationResult | null;
  showInteractionAlert: boolean;
  setShowInteractionAlert: (show: boolean) => void;
  checkFamilyDrugInteractions: (forceRefresh?: boolean) => Promise<InteractionValidationResult | null>;
  invalidateCaches: () => void;
}

/**
 * 약물 상호작용 검사 훅
 * - 가족 전체 약물 상호작용 검사
 * - 약물 목록 캐싱
 * - 상호작용 검사 결과 캐싱
 */
export const useDrugInteractions = (
  familyMembers: FamilyMember[]
): UseDrugInteractionsReturn => {
  const [interactionResult, setInteractionResult] = useState<InteractionValidationResult | null>(null);
  const [showInteractionAlert, setShowInteractionAlert] = useState(false);
  
  // 🔥 약물 목록 캐시 (가족 전체 약물)
  const familyMedicinesCache = useRef<{
    medicines: Medicine[];
    lastUpdated: number;
    hash: string;
  } | null>(null);
  
  // 🔥 상호작용 검사 결과 캐시
  const interactionResultCache = useRef<{
    medicinesHash: string;
    result: InteractionValidationResult | null;
    lastChecked: number;
  } | null>(null);
  
  // 🔥 약물 목록 해시 계산 함수
  const calculateMedicinesHash = useCallback((medicines: Medicine[]): string => {
    // 약물 목록을 정렬하여 일관된 해시 생성
    const sorted = medicines
      .map(m => `${m.medi_id || ''}_${m.name || ''}_${m.user_id || ''}`)
      .sort()
      .join('|');
    
    // 간단한 해시 함수 (실제로는 crypto 라이브러리 사용 권장)
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      const char = sorted.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }, []);
  
  // 🔥 캐시 무효화 함수
  const invalidateCaches = useCallback(() => {
    if (__DEV__) {
      console.log('🔄 [Cache] 캐시 무효화');
    }
    familyMedicinesCache.current = null;
    interactionResultCache.current = null;
  }, []);
  
  // 🔥 가족 전체 약물 상호작용 검사 함수 (캐싱 적용)
  const checkFamilyDrugInteractions = useCallback(async (forceRefresh: boolean = false): Promise<InteractionValidationResult | null> => {
    try {
      if (__DEV__) {
        console.log('🔍 [FamilyDrugInteraction] 가족 전체 약물 상호작용 검사 시작', forceRefresh ? '(강제 새로고침)' : '');
      }
      
      // 1. 약물 목록 수집 (캐시 사용 또는 API 호출)
      let allFamilyMedicines: Medicine[] = [];
      
      // 캐시가 있고 강제 새로고침이 아니면 캐시 사용
      if (!forceRefresh && familyMedicinesCache.current) {
        const cacheAge = Date.now() - familyMedicinesCache.current.lastUpdated;
        // 캐시가 5분 이내면 사용
        if (cacheAge < 5 * 60 * 1000) {
          if (__DEV__) {
            console.log('✅ [FamilyDrugInteraction] 캐시된 약물 목록 사용');
          }
          allFamilyMedicines = familyMedicinesCache.current.medicines;
        } else {
          if (__DEV__) {
            console.log('⏰ [FamilyDrugInteraction] 캐시 만료, 새로 로드');
          }
          familyMedicinesCache.current = null;
        }
      }
      
      // 캐시가 없거나 만료되었으면 API 호출
      if (allFamilyMedicines.length === 0) {
        if (__DEV__) {
          console.log('🔍 [FamilyDrugInteraction] 약물 목록 API 호출 시작');
        }
        
        // 🔥 병렬 처리로 속도 개선
        const medicinePromises = familyMembers.map(async (member) => {
          try {
            if (__DEV__) {
              console.log(`🔍 [FamilyDrugInteraction] ${member.name}(${member.role})의 약물 조회 중...`);
            }
            const response = await getMedicineList(member.user_id);
            
            if (response.success && response.data) {
              // 각 약물에 소유자 정보 추가
              const memberMedicines = response.data.map(medicine => ({
                ...medicine,
                ownerName: member.name,
                ownerRole: member.role,
                ownerId: member.user_id
              }));
              
              if (__DEV__) {
                console.log(`✅ [FamilyDrugInteraction] ${member.name}: ${memberMedicines.length}개 약물 수집`);
              }
              
              return memberMedicines;
            }
            return [];
          } catch (error) {
            console.error(`🔥 [FamilyDrugInteraction] ${member.name} 약물 조회 실패:`, error);
            return [];
          }
        });
        
        // 모든 약물 목록을 병렬로 수집
        const medicineArrays = await Promise.all(medicinePromises);
        allFamilyMedicines = medicineArrays.reduce((acc, arr) => [...acc, ...arr], []);
        
        // 약물 목록 캐시 업데이트
        const medicinesHash = calculateMedicinesHash(allFamilyMedicines);
        familyMedicinesCache.current = {
          medicines: allFamilyMedicines,
          lastUpdated: Date.now(),
          hash: medicinesHash
        };
        
        if (__DEV__) {
          console.log(`✅ [FamilyDrugInteraction] 약물 목록 캐시 업데이트: ${allFamilyMedicines.length}개`);
        }
      }
      
      if (__DEV__) {
        console.log(`🔍 [FamilyDrugInteraction] 가족 전체 약물 수: ${allFamilyMedicines.length}개`);
      }
      
      if (allFamilyMedicines.length < 2) {
        if (__DEV__) {
          console.log('🔍 [FamilyDrugInteraction] 가족 전체 약물이 2개 미만이므로 상호작용 검사 생략');
        }
        setInteractionResult(null);
        setShowInteractionAlert(false);
        interactionResultCache.current = null;
        return null;
      }
      
      // 2. 상호작용 검사 결과 캐시 확인
      const medicinesHash = calculateMedicinesHash(allFamilyMedicines);
      
      if (!forceRefresh && interactionResultCache.current && 
          interactionResultCache.current.medicinesHash === medicinesHash) {
        // 캐시된 결과 사용
        if (__DEV__) {
          console.log('✅ [FamilyDrugInteraction] 캐시된 상호작용 검사 결과 사용');
        }
        const cachedResult = interactionResultCache.current.result;
        if (cachedResult) {
          setInteractionResult(cachedResult);
          setShowInteractionAlert(cachedResult.hasInteractions);
        } else {
          setInteractionResult(null);
          setShowInteractionAlert(false);
        }
        return cachedResult;
      }
      
      // 3. 상호작용 검사 실행
      if (__DEV__) {
        console.log('🔍 [FamilyDrugInteraction] 상호작용 검사 실행');
      }
      const result = await DrugInteractionValidator.validateDrugInteractions(allFamilyMedicines);
      
      // 4. 상호작용이 있는 경우 소유자 정보 포함하여 결과 처리
      if (result.hasInteractions) {
        if (__DEV__) {
          console.log('⚠️ [FamilyDrugInteraction] 가족 간 약물 상호작용 발견!');
        }
        
        // 상호작용 결과에 소유자 정보 및 medi_id 추가
        const enhancedInteractions = result.interactions.map(interaction => {
          // 🔥 같은 이름의 약물이 여러 개 있을 수 있으므로, 모든 약물을 찾아서 매칭
          const drugAMedicines = allFamilyMedicines.filter(med => med.name === interaction.drugA);
          const drugBMedicines = allFamilyMedicines.filter(med => med.name === interaction.drugB);
          
          // 🔥 모든 복용자 정보 수집 (중복 제거)
          const drugAOwners = Array.from(new Map(
            drugAMedicines.map(med => [
              (med as any).ownerId,
              {
                name: (med as any).ownerName,
                role: (med as any).ownerRole,
                ownerId: (med as any).ownerId
              }
            ])
          ).values());
          
          const drugBOwners = Array.from(new Map(
            drugBMedicines.map(med => [
              (med as any).ownerId,
              {
                name: (med as any).ownerName,
                role: (med as any).ownerRole,
                ownerId: (med as any).ownerId
              }
            ])
          ).values());
          
          // 🔥 삭제를 위해 모든 medi_id 수집
          const drugAMediIds = drugAMedicines.map(med => med.medi_id).filter(Boolean);
          const drugBMediIds = drugBMedicines.map(med => med.medi_id).filter(Boolean);
          
          return {
            ...interaction,
            drugAOwners: drugAOwners.length > 0 ? drugAOwners : null,
            drugBOwners: drugBOwners.length > 0 ? drugBOwners : null,
            // 🔥 하위 호환성을 위해 첫 번째 소유자 정보도 유지
            drugAOwner: drugAOwners[0] || null,
            drugBOwner: drugBOwners[0] || null,
            drugAMediIds: drugAMediIds.length > 0 ? drugAMediIds : null,
            drugBMediIds: drugBMediIds.length > 0 ? drugBMediIds : null,
            // 🔥 하위 호환성을 위해 첫 번째 medi_id도 유지
            drugAMediId: drugAMediIds[0] || null,
            drugBMediId: drugBMediIds[0] || null
          };
        });
        
        // 🔥 중복 상호작용 제거 및 약물 쌍별로 가장 심각한 상호작용만 유지
        const interactionMap = new Map<string, typeof enhancedInteractions[0]>();
        const severityOrder = { critical: 0, major: 1, moderate: 2, minor: 3 };
        
        enhancedInteractions.forEach(interaction => {
          const drugPair = [interaction.drugA, interaction.drugB].sort().join('_');
          const drugAOwners = (interaction as any).drugAOwners || ((interaction as any).drugAOwner ? [(interaction as any).drugAOwner] : []);
          const drugBOwners = (interaction as any).drugBOwners || ((interaction as any).drugBOwner ? [(interaction as any).drugBOwner] : []);
          
          // 모든 소유자 ID를 정렬하여 키 생성
          const allOwnerIds = [
            ...drugAOwners.map((o: any) => o.ownerId),
            ...drugBOwners.map((o: any) => o.ownerId)
          ].filter(Boolean).sort();
          const ownerKey = allOwnerIds.join('_');
          
          const key = `${drugPair}_${ownerKey}`;
          
          // 기존 상호작용이 없거나, 현재가 더 심각한 경우 업데이트
          const existing = interactionMap.get(key);
          if (!existing || severityOrder[interaction.severity] < severityOrder[existing.severity]) {
            interactionMap.set(key, interaction);
          }
        });
        
        const uniqueInteractions = Array.from(interactionMap.values());
        
        // 🔥 중복 제거 후 카운트 재계산
        const criticalCount = uniqueInteractions.filter(i => i.severity === 'critical').length;
        const majorCount = uniqueInteractions.filter(i => i.severity === 'major').length;
        const warningCount = criticalCount + majorCount;
        
        const enhancedResult = {
          ...result,
          interactions: uniqueInteractions,
          hasInteractions: uniqueInteractions.length > 0,
          criticalCount,
          majorCount,
          warningCount
        };
        
        // 상호작용 검사 결과 캐시 업데이트
        interactionResultCache.current = {
          medicinesHash,
          result: enhancedResult,
          lastChecked: Date.now()
        };
        
        setInteractionResult(enhancedResult);
        setShowInteractionAlert(true);
        
        // 심각한 상호작용이 있는 경우 강제 알림 (재계산된 값 사용)
        if (criticalCount > 0) {
          Toast.show({
            type: 'error',
            text1: '⚠️ 가족 간 심각한 약물 상호작용 발견',
            text2: '즉시 의사와 상담하세요.',
            position: 'top',
            visibilityTime: 6000,
          });
        } else if (warningCount > 0) {
          Toast.show({
            type: 'warning',
            text1: '⚠️ 가족 간 약물 상호작용 주의',
            text2: '복용 전 약사와 상담하세요.',
            position: 'top',
            visibilityTime: 5000,
          });
        }
        
        return enhancedResult;
      } else {
        if (__DEV__) {
          console.log('✅ [FamilyDrugInteraction] 가족 간 상호작용 없음');
        }
        
        // 상호작용 검사 결과 캐시 업데이트 (상호작용 없음)
        interactionResultCache.current = {
          medicinesHash,
          result: null,
          lastChecked: Date.now()
        };
        
        setInteractionResult(null);
        setShowInteractionAlert(false);
        return null;
      }
      
    } catch (error) {
      console.error('🔥 [FamilyDrugInteraction] 가족 약물 상호작용 검사 중 오류:', error);
      return null;
    }
  }, [familyMembers, calculateMedicinesHash]);
  
  return {
    interactionResult,
    showInteractionAlert,
    setShowInteractionAlert,
    checkFamilyDrugInteractions,
    invalidateCaches,
  };
};

