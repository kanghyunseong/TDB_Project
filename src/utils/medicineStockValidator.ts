// 약물 재고 유효성 검사 및 부족 예측 시스템
import { Medicine, FamilyMember, Schedule } from '../types/tdb';

export interface StockValidationResult {
  isValid: boolean;
  daysRemaining: number;
  warningLevel: 'safe' | 'warning' | 'critical' | 'insufficient';
  message: string;
  recommendations: string[];
}

export interface MedicineStockInfo {
  medicine: Medicine;
  currentStock: number;
  dailyConsumption: number;
  daysRemaining: number;
  userConsumptions: Array<{
    userId: string;
    userName: string;
    dailyDose: number;
  }>;
}

export class MedicineStockValidator {
  // 경고 임계값 설정
  private static readonly WARNING_DAYS = 7;   // 7일 이하 남으면 경고
  private static readonly CRITICAL_DAYS = 3;  // 3일 이하 남으면 위험

  // 🔥 보관 방법별 유통기한 가이드라인 (일)
  private static readonly STORAGE_SHELF_LIFE_GUIDE: Record<string, number> = {
    '실온': 365,      // 실온 보관: 1년
    '냉장': 180,      // 냉장 보관: 6개월
    '냉동': 730,      // 냉동 보관: 2년
    '서늘한곳': 365,  // 서늘한 곳: 1년
    '기본': 365       // 기본: 1년
  };
  
  // 🔥 약물 종류별 재고 관리 권장 사항
  private static readonly MEDICINE_TYPE_STOCK_GUIDE: Record<string, {
    minStockDays: number;
    recommendedStockDays: number;
    warningMessage: string;
  }> = {
    '항생제': {
      minStockDays: 3,
      recommendedStockDays: 7,
      warningMessage: '항생제는 처방 기간 동안 충분히 보유하세요.'
    },
    '만성질환약': {
      minStockDays: 14,
      recommendedStockDays: 30,
      warningMessage: '만성질환 약물은 최소 2주분 이상 보유를 권장합니다.'
    },
    '응급약': {
      minStockDays: 7,
      recommendedStockDays: 14,
      warningMessage: '응급 약물은 항상 충분한 재고를 유지하세요.'
    },
    '기본': {
      minStockDays: 3,
      recommendedStockDays: 7,
      warningMessage: '일반 약물은 최소 3일분 이상 보유하세요.'
    }
  };

  /**
   * 특정 약물의 재고 상태를 검증합니다
   */
  static async validateMedicineStock(
    medicine: Medicine, 
    familyMembers: FamilyMember[]
  ): Promise<StockValidationResult> {
    try {
      const stockInfo = await this.calculateMedicineStockInfo(medicine, familyMembers);
      
      return this.generateValidationResult(stockInfo);
    } catch (error) {
      console.error('재고 검증 에러:', error);
      return {
        isValid: false,
        daysRemaining: 0,
        warningLevel: 'critical',
        message: '재고 정보를 확인할 수 없습니다.',
        recommendations: ['약물 정보를 다시 확인해주세요.']
      };
    }
  }

  /**
   * 약물의 재고 정보를 계산합니다
   */
  private static async calculateMedicineStockInfo(
    medicine: Medicine, 
    familyMembers: FamilyMember[]
  ): Promise<MedicineStockInfo> {
    const currentStock = medicine.remain || 0;
    let totalDailyConsumption = 0;
    const userConsumptions: Array<{
      userId: string;
      userName: string;
      dailyDose: number;
    }> = [];

    // 🔥 각 가족 구성원의 일일 복용량 계산
    for (const member of familyMembers) {
      const dailyDose = await this.calculateUserDailyDose(medicine.medi_id, member.user_id);
      
      if (dailyDose > 0) {
        totalDailyConsumption += dailyDose;
        userConsumptions.push({
          userId: member.user_id,
          userName: member.name,
          dailyDose
        });
      }
    }

    const daysRemaining = totalDailyConsumption > 0 
      ? Math.floor(currentStock / totalDailyConsumption)
      : Infinity;

    return {
      medicine,
      currentStock,
      dailyConsumption: totalDailyConsumption,
      daysRemaining: daysRemaining === Infinity ? 999 : daysRemaining,
      userConsumptions
    };
  }

  /**
   * 특정 사용자의 특정 약물 일일 복용량을 계산합니다
   */
  private static async calculateUserDailyDose(medicineId: string, userId: string): Promise<number> {
    try {
      // 🔥 로그아웃 후에는 사용자 정보가 없을 수 있으므로 체크
      const { getCurrentUser } = await import('../api/userStorage');
      const currentUser = await getCurrentUser();
      
      // 🔥 사용자 정보가 없으면 0 반환 (로그아웃 상태)
      if (!currentUser) {
        return 0;
      }
      
      // 🔥 간단한 방법: 약물의 기본 복용량 사용 (실제 스케줄 대신)
      const { getMedicineSchedule } = await import('../api/family');
      
      // 🔥 404 에러는 약물이 삭제되었거나 스케줄이 없는 경우이므로 0 반환
      let schedule;
      try {
        schedule = await getMedicineSchedule(medicineId, userId);
      } catch (error: any) {
        // 🔥 404 에러는 약물이 삭제되었거나 스케줄이 없는 경우
        if (error?.response?.status === 404) {
          if (__DEV__) {
            console.log(`[MedicineStockValidator] 약물 스케줄 없음 (404): ${medicineId} - ${userId}`);
          }
          return 0;
        }
        // 🔥 403, 401 에러도 0 반환 (권한 없음 또는 인증 실패)
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          if (__DEV__) {
            console.log(`[MedicineStockValidator] 약물 스케줄 접근 불가 (${error?.response?.status}): ${medicineId} - ${userId}`);
          }
          return 0;
        }
        throw error; // 다른 에러는 재throw
      }
      
      // 🔥 schedule이 null이거나 빈 객체인 경우 0 반환
      if (!schedule) {
        if (__DEV__) {
          console.log(`[MedicineStockValidator] 약물 스케줄 데이터 없음: ${medicineId} - ${userId}`);
        }
        return 0;
      }
      
      // 🔥 doseCount가 없거나 0인 경우 0 반환 (스케줄이 등록되지 않은 경우)
      const doseCountStr = schedule.doseCount?.toString() || '0';
      const doseCount = parseInt(doseCountStr) || 0;
      
      if (doseCount === 0) {
        if (__DEV__) {
          console.log(`[MedicineStockValidator] 약물 스케줄 복용량 없음: ${medicineId} - ${userId}`);
      }
      return 0;
      }
      
      // 기본 1일 복용량으로 계산 (실제로는 스케줄에 따라 달라질 수 있음)
      return doseCount;
    } catch (error: any) {
      // 🔥 로그아웃 관련 에러는 조용히 처리 (401, 403 등)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return 0;
      }
      
      // 🔥 다른 에러만 로그 출력
      if (__DEV__) {
        console.error(`사용자 ${userId} 일일 복용량 계산 에러:`, error);
      }
      return 0;
    }
  }

  /**
   * 🔥 약물의 보관 방법을 추출합니다
   */
  private static extractStorageMethod(medicine: Medicine): string {
    // 서버 API에서 보관 방법 정보 가져오기
    const storageMethod = (medicine as any).storage_method || (medicine as any).DEPOSIT_METHOD_QESITM || '';
    
    if (!storageMethod) return '기본';
    
    const lowerStorage = storageMethod.toLowerCase();
    
    if (lowerStorage.includes('냉장') || lowerStorage.includes('2~8도') || lowerStorage.includes('4도')) {
      return '냉장';
    } else if (lowerStorage.includes('냉동') || lowerStorage.includes('0도')) {
      return '냉동';
    } else if (lowerStorage.includes('서늘한') || lowerStorage.includes('직사광선') || lowerStorage.includes('습기')) {
      return '서늘한곳';
    } else if (lowerStorage.includes('실온') || lowerStorage.includes('상온')) {
      return '실온';
    }
    
    return '기본';
  }

  /**
   * 🔥 약물 종류를 추정합니다
   */
  private static estimateMedicineType(medicine: Medicine): string {
    const name = medicine.name?.toLowerCase() || '';
    const functionText = (medicine as any).primary_function?.toLowerCase() || '';
    const combined = `${name} ${functionText}`;
    
    if (combined.includes('항생') || combined.includes('antibiotic')) {
      return '항생제';
    } else if (combined.includes('고혈압') || combined.includes('당뇨') || combined.includes('심장') || 
               combined.includes('만성') || combined.includes('고지혈증')) {
      return '만성질환약';
    } else if (combined.includes('응급') || combined.includes('구급') || combined.includes('심정지')) {
      return '응급약';
    }
    
    return '기본';
  }

  /**
   * 검증 결과를 생성합니다
   */
  private static generateValidationResult(stockInfo: MedicineStockInfo): StockValidationResult {
    const { medicine, currentStock, dailyConsumption, daysRemaining, userConsumptions } = stockInfo;

    // 🔥 약물 종류 및 보관 방법 추출
    const medicineType = this.estimateMedicineType(medicine);
    const storageMethod = this.extractStorageMethod(medicine);
    const stockGuide = this.MEDICINE_TYPE_STOCK_GUIDE[medicineType] || this.MEDICINE_TYPE_STOCK_GUIDE['기본'];

    // 🔥 재고 상태 판정
    let warningLevel: 'safe' | 'warning' | 'critical' | 'insufficient';
    let message: string;
    const recommendations: string[] = [];

    if (dailyConsumption === 0) {
      // 아무도 복용하지 않는 약물
      warningLevel = 'safe';
      message = `${medicine.name}은(는) 현재 복용 스케줄이 없습니다.`;
    } else if (daysRemaining <= 0) {
      // 즉시 부족
      warningLevel = 'insufficient';
      message = `🚨 ${medicine.name} 재고 부족! 현재 ${currentStock}알로는 하루도 사용할 수 없습니다.`;
      recommendations.push('즉시 약물을 보충하거나 복용 스케줄을 조정하세요.');
      recommendations.push('가족 구성원들의 복용량을 재검토하세요.');
    } else if (daysRemaining <= this.CRITICAL_DAYS) {
      // 위험 (3일 이하)
      warningLevel = 'critical';
      message = `⚠️ ${medicine.name} 재고 위험! 약 ${daysRemaining}일분만 남았습니다.`;
      recommendations.push('긴급히 약물을 보충하세요.');
      recommendations.push('약국에 주문하거나 처방을 받으세요.');
      if (medicineType !== '기본') {
        recommendations.push(stockGuide.warningMessage);
      }
    } else if (daysRemaining <= this.WARNING_DAYS) {
      // 경고 (7일 이하)
      warningLevel = 'warning';
      message = `📢 ${medicine.name} 재고 경고! 약 ${daysRemaining}일분 남았습니다.`;
      recommendations.push('곧 약물을 보충할 계획을 세우세요.');
      recommendations.push('약국에 미리 연락해보세요.');
      if (daysRemaining < stockGuide.recommendedStockDays) {
        recommendations.push(`권장 재고량(${stockGuide.recommendedStockDays}일분)보다 부족합니다.`);
      }
    } else if (daysRemaining < stockGuide.recommendedStockDays) {
      // 권장량 미만 (안전하지만 권장량보다 적음)
      warningLevel = 'safe';
      message = `✅ ${medicine.name} 재고 안전! 약 ${daysRemaining}일분 사용 가능합니다.`;
      if (medicineType !== '기본') {
        recommendations.push(`권장 재고량(${stockGuide.recommendedStockDays}일분)을 유지하시면 더 안전합니다.`);
      }
    } else {
      // 안전 (권장량 이상)
      warningLevel = 'safe';
      message = `✅ ${medicine.name} 재고 충분! 약 ${daysRemaining}일분 사용 가능합니다.`;
    }
    
    // 🔥 보관 방법 관련 권장사항 추가
    if (storageMethod !== '기본') {
      const shelfLife = this.STORAGE_SHELF_LIFE_GUIDE[storageMethod] || 365;
      recommendations.push(`${storageMethod} 보관 시 유통기한은 약 ${Math.floor(shelfLife / 30)}개월입니다.`);
      if (storageMethod === '냉장') {
        recommendations.push('냉장 보관 약물은 온도 변화에 주의하세요.');
      }
    }

    // 🔥 사용자별 소비량 정보 추가
    if (userConsumptions.length > 0) {
      const consumptionDetails = userConsumptions
        .map(user => `${user.userName}: ${user.dailyDose}정/일`)
        .join(', ');
      message += `\n일일 총 소비량: ${dailyConsumption}정 (${consumptionDetails})`;
    }

    return {
      isValid: warningLevel !== 'insufficient',
      daysRemaining,
      warningLevel,
      message,
      recommendations
    };
  }

  /**
   * 모든 약물의 재고 상태를 일괄 검증합니다
   */
  static async validateAllMedicines(
    medicines: Medicine[], 
    familyMembers: FamilyMember[]
  ): Promise<MedicineStockInfo[]> {
    const validationPromises = medicines.map(medicine => 
      this.calculateMedicineStockInfo(medicine, familyMembers)
    );

    return await Promise.all(validationPromises);
  }

  /**
   * 재고 부족 약물 목록을 반환합니다
   */
  static async getInsufficientMedicines(
    medicines: Medicine[], 
    familyMembers: FamilyMember[]
  ): Promise<MedicineStockInfo[]> {
    // 🔥 약물이 없으면 빈 배열 반환
    if (!medicines || medicines.length === 0) {
      return [];
    }
    
    const allStockInfo = await this.validateAllMedicines(medicines, familyMembers);
    
    // 🔥 재고 부족 약물만 필터링 (일일 소비량이 있고, 경고 기간 이하인 경우)
    return allStockInfo.filter(info => {
      // 약물이 유효한지 확인 (삭제된 약물은 제외)
      const medicineExists = medicines.some(m => m.medi_id === info.medicine.medi_id);
      if (!medicineExists) {
        return false; // 삭제된 약물은 제외
      }
      
      // 일일 소비량이 있고, 경고 기간 이하인 경우만 포함
      return info.dailyConsumption > 0 && info.daysRemaining <= this.WARNING_DAYS;
    });
  }
}

 