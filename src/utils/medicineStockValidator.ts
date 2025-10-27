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
      // 🔥 간단한 방법: 약물의 기본 복용량 사용 (실제 스케줄 대신)
      const { getMedicineSchedule } = await import('../api/family');
      
      const schedule = await getMedicineSchedule(medicineId, userId);
      
      if (schedule && schedule.doseCount) {
        // 기본 1일 복용량으로 계산 (실제로는 스케줄에 따라 달라질 수 있음)
        return parseInt(schedule.doseCount) || 1;
      }
      
      return 0;
    } catch (error) {
      console.error(`사용자 ${userId} 일일 복용량 계산 에러:`, error);
      return 0;
    }
  }



  /**
   * 검증 결과를 생성합니다
   */
  private static generateValidationResult(stockInfo: MedicineStockInfo): StockValidationResult {
    const { medicine, currentStock, dailyConsumption, daysRemaining, userConsumptions } = stockInfo;

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
    } else if (daysRemaining <= this.WARNING_DAYS) {
      // 경고 (7일 이하)
      warningLevel = 'warning';
      message = `📢 ${medicine.name} 재고 경고! 약 ${daysRemaining}일분 남았습니다.`;
      recommendations.push('곧 약물을 보충할 계획을 세우세요.');
      recommendations.push('약국에 미리 연락해보세요.');
    } else {
      // 안전
      warningLevel = 'safe';
      message = `✅ ${medicine.name} 재고 충분! 약 ${daysRemaining}일분 사용 가능합니다.`;
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
    const allStockInfo = await this.validateAllMedicines(medicines, familyMembers);
    
    return allStockInfo.filter(info => 
      info.dailyConsumption > 0 && info.daysRemaining <= this.WARNING_DAYS
    );
  }
}

 