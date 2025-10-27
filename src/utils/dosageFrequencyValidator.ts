// 복용 횟수별 스케줄 유효성 검사 시스템
import medicineData from '../assets/medicine.json';
import tabletData from '../assets/tablet.json';

export interface DosageFrequency {
  dailyCount: number; // 1일 복용 횟수
  maxPerDose: number; // 1회 최대 복용량
  source: 'medicine' | 'tablet';
  originalText: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScheduleValidationResult {
  isValid: boolean;
  maxAllowedSelections: number;
  currentSelections: number;
  violatedDays: string[];
  recommendations: string[];
  warningMessage?: string;
}

export class DosageFrequencyValidator {
  // 🔥 복용 횟수 추출 정규식 패턴들
  private static readonly FREQUENCY_PATTERNS = [
    // 기본 패턴: "1일 3회", "1일 2~3회"
    /1일\s*([1-9])(?:~([1-9]))?\s*회/g,
    // 복잡한 패턴: "1일 3~4회", "1일 2회(12시간마다)"
    /1일\s*([1-9])(?:~([1-9]))?\s*회/g,
    // 특수 패턴: "첫날 1회 2정 1일 4회"
    /1일\s*([1-9])\s*회/g,
  ];

  // 🔥 시간대 매핑
  private static readonly TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const;
  private static readonly DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  
  // 🔥 요일 한글 매핑
  private static readonly DAY_KOREAN_MAP: Record<string, string> = {
    'mon': '월요일',
    'tue': '화요일', 
    'wed': '수요일',
    'thu': '목요일',
    'fri': '금요일',
    'sat': '토요일',
    'sun': '일요일'
  };

  /**
   * 약물 ID로 복용 횟수 정보를 추출합니다
   */
  static extractDosageFrequency(medicineId: string): DosageFrequency | null {
    console.log(`🔥 [DosageFrequencyValidator] 복용 횟수 추출 시작: ${medicineId}`);
    
    try {
      // 1. medicine.json에서 검색
      console.log(`🔥 [DosageFrequencyValidator] medicine.json 검색 중...`);
      const medicineResult = this.searchInMedicineData(medicineId);
      if (medicineResult) {
        console.log(`🔥 [DosageFrequencyValidator] medicine.json에서 발견:`, medicineResult);
        return medicineResult;
      }

      // 2. tablet.json에서 검색
      console.log(`🔥 [DosageFrequencyValidator] tablet.json 검색 중...`);
      const tabletResult = this.searchInTabletData(medicineId);
      if (tabletResult) {
        console.log(`🔥 [DosageFrequencyValidator] tablet.json에서 발견:`, tabletResult);
        return tabletResult;
      }

      console.log(`🔥 [DosageFrequencyValidator] 복용 횟수 정보를 찾을 수 없습니다: ${medicineId}`);
      return null;
    } catch (error) {
      console.error('🔥 [DosageFrequencyValidator] 복용 횟수 추출 에러:', error);
      return null;
    }
  }

  /**
   * medicine.json에서 복용 횟수 정보를 검색합니다
   */
  private static searchInMedicineData(medicineId: string): DosageFrequency | null {
    try {
      const medicines = medicineData as any[];
      console.log(`🔥 [DosageFrequencyValidator] medicine.json 검색: ${medicineId}`);
      const medicine = medicines.find((item: any) => item['품목기준코드 [ITEMSEQ]'] === medicineId);
      console.log(`🔥 [DosageFrequencyValidator] 검색 결과:`, medicine ? '발견됨' : '없음');
      if (!medicine) return null;

      const usageText = medicine['문항2(사용법) [USEMETHODQESITM] '] || '';
      const frequency = this.parseFrequencyFromText(usageText);
      
      if (frequency.dailyCount > 0) {
        return {
          ...frequency,
          source: 'medicine',
          originalText: usageText
        };
      }
    } catch (error) {
      console.error('Medicine.json 검색 에러:', error);
    }
    return null;
  }

  /**
   * tablet.json에서 복용 횟수 정보를 검색합니다
   */
  private static searchInTabletData(medicineId: string): DosageFrequency | null {
    try {
      const tablets = tabletData as any[];
      console.log(`🔥 [DosageFrequencyValidator] tablet.json 검색: ${medicineId}`);
      // tablet.json에는 ID 필드가 없어서 제품명으로 검색하거나 별도 로직 필요
      const tablet = tablets.find((item: any) => 
        item.PRDLST_NM && item.PRDLST_NM.includes(medicineId.toString())
      );
      console.log(`🔥 [DosageFrequencyValidator] tablet.json 검색 결과:`, tablet ? '발견됨' : '없음');
      if (!tablet) return null;

      const methodText = tablet.NTK_MTHD || '';
      const frequency = this.parseFrequencyFromText(methodText);
      
      if (frequency.dailyCount > 0) {
        return {
          ...frequency,
          source: 'tablet',
          originalText: methodText
        };
      }
    } catch (error) {
      console.error('Tablet.json 검색 에러:', error);
    }
    return null;
  }

  /**
   * 텍스트에서 복용 횟수를 파싱합니다
   */
  private static parseFrequencyFromText(text: string): Omit<DosageFrequency, 'source' | 'originalText'> {
    const defaultResult = {
      dailyCount: 0,
      maxPerDose: 1,
      confidence: 'low' as const
    };

    if (!text) return defaultResult;

    // 🔥 다양한 패턴으로 복용 횟수 추출
    for (const pattern of this.FREQUENCY_PATTERNS) {
      const matches: RegExpMatchArray[] = [];
      let match;
      pattern.lastIndex = 0; // 정규식 리셋
      
      while ((match = pattern.exec(text)) !== null) {
        matches.push(match);
        if (!pattern.global) break;
      }
      
      if (matches.length > 0) {
        const firstMatch = matches[0];
        const min = parseInt(firstMatch[1]) || 0;
        const max = parseInt(firstMatch[2]) || min;
        
        return {
          dailyCount: max, // 최대값 사용 (유연성 제공)
          maxPerDose: this.extractMaxPerDose(text),
          confidence: matches.length === 1 ? 'high' : 'medium'
        };
      }
    }

    // 🔥 특수 케이스들 처리
    if (text.includes('필요시') || text.includes('묽은 변이 있을 때마다')) {
      return {
        dailyCount: 6, // 필요시 복용은 하루 최대 6회로 가정
        maxPerDose: 1,
        confidence: 'low'
      };
    }

    if (text.includes('취침시') && !text.includes('1일')) {
      return {
        dailyCount: 1, // 취침시만 복용
        maxPerDose: this.extractMaxPerDose(text),
        confidence: 'medium'
      };
    }

    return defaultResult;
  }

  /**
   * 텍스트에서 1회 최대 복용량을 추출합니다
   */
  private static extractMaxPerDose(text: string): number {
    // "1회 2정", "1회 3캡슐" 등의 패턴
    const dosePattern = /1회\s*([1-9][0-9]?)\s*[정캡슐]/g;
    const matches: RegExpMatchArray[] = [];
    let match;
    
    while ((match = dosePattern.exec(text)) !== null) {
      matches.push(match);
    }
    
    if (matches.length > 0) {
      const doses = matches.map(matchItem => parseInt(matchItem[1]) || 1);
      return Math.max(...doses); // 최대값 반환
    }
    
    return 1; // 기본값
  }

  /**
   * 스케줄의 유효성을 검사합니다
   */
  static validateSchedule(
    medicineId: string,
    schedule: Record<string, Record<string, boolean>>
  ): ScheduleValidationResult {
    const dosageInfo = this.extractDosageFrequency(medicineId);
    
    if (!dosageInfo) {
      return {
        isValid: true, // 정보가 없으면 제한하지 않음
        maxAllowedSelections: 3, // 기본값: 하루 3회까지
        currentSelections: 0,
        violatedDays: [],
        recommendations: ['복용 횟수 정보를 확인할 수 없어 제한을 적용하지 않습니다.']
      };
    }

    const maxAllowedSelections = dosageInfo.dailyCount;
    const violatedDays: string[] = [];
    let totalSelections = 0;

    // 🔥 각 요일별로 선택된 시간대 수 확인
    for (const day of this.DAY_NAMES) {
      const daySchedule = schedule[day] || {};
      const selectedCount = this.TIME_SLOTS.filter(time => daySchedule[time] === true).length;
      
      totalSelections += selectedCount;
      
      if (selectedCount > maxAllowedSelections) {
        violatedDays.push(day);
      }
    }

    const isValid = violatedDays.length === 0;
    
    // 🔥 영어 요일을 한글로 변환
    const violatedDaysKorean = violatedDays.map(day => this.DAY_KOREAN_MAP[day] || day);
    
    return {
      isValid,
      maxAllowedSelections,
      currentSelections: totalSelections,
      violatedDays: violatedDaysKorean,
      recommendations: this.generateRecommendations(dosageInfo, violatedDaysKorean),
      warningMessage: isValid ? undefined : this.generateWarningMessage(dosageInfo, violatedDaysKorean)
    };
  }

  /**
   * 권장사항을 생성합니다
   */
  private static generateRecommendations(
    dosageInfo: DosageFrequency,
    violatedDays: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (violatedDays.length > 0) {
      recommendations.push(
        `⚠️ ${violatedDays.join(', ')} 요일에 1일 ${dosageInfo.dailyCount}회를 초과했습니다.`
      );
    }

    switch (dosageInfo.dailyCount) {
      case 1:
        recommendations.push('💊 1일 1회: 아침, 점심, 저녁 중 하나만 선택하세요.');
        break;
      case 2:
        recommendations.push('💊 1일 2회: 아침+저녁 또는 점심+저녁 조합을 권장합니다.');
        break;
      case 3:
        recommendations.push('💊 1일 3회: 아침, 점심, 저녁 모두 선택 가능합니다.');
        break;
      case 4:
        recommendations.push('💊 1일 4회: 의사와 상담 후 복용 시간을 정하세요.');
        break;
      default:
        recommendations.push(`💊 1일 ${dosageInfo.dailyCount}회: 전문의와 상담하여 복용하세요.`);
    }

    if (dosageInfo.confidence === 'low') {
      recommendations.push('⚠️ 복용 횟수 정보의 정확도가 낮습니다. 의사나 약사와 상담하세요.');
    }

    return recommendations;
  }

  /**
   * 경고 메시지를 생성합니다
   */
  private static generateWarningMessage(
    dosageInfo: DosageFrequency,
    violatedDays: string[]
  ): string {
    return `🚨 주의: ${violatedDays.join(', ')} 요일에 1일 권장 복용 횟수(${dosageInfo.dailyCount}회)를 초과했습니다. 안전을 위해 복용 횟수를 줄여주세요.`;
  }

  /**
   * 특정 요일의 특정 시간대 선택 가능 여부를 확인합니다
   */
  static canSelectTimeSlot(
    medicineId: string,
    schedule: Record<string, Record<string, boolean>>,
    day: string,
    timeSlot: string
  ): boolean {
    console.log('🔥 [DosageFrequencyValidator] canSelectTimeSlot 시작:', { medicineId, day, timeSlot });
    console.log('🔥 [DosageFrequencyValidator] 전체 스케줄:', schedule);
    
    const dosageInfo = this.extractDosageFrequency(medicineId);
    console.log('🔥 [DosageFrequencyValidator] 추출된 복용량 정보:', dosageInfo);
    
    if (!dosageInfo) {
      console.log('🔥 [DosageFrequencyValidator] 복용량 정보 없음 - 허용');
      return true; // 정보가 없으면 허용
    }

    const daySchedule = schedule[day] || {};
    console.log('🔥 [DosageFrequencyValidator] 해당 요일 스케줄:', daySchedule);
    
    const currentSelections = this.TIME_SLOTS.filter(time => daySchedule[time] === true).length;
    console.log('🔥 [DosageFrequencyValidator] 현재 선택된 개수:', currentSelections, '최대 허용:', dosageInfo.dailyCount);
    
    // 이미 선택된 시간대는 허용 (토글 해제 가능)
    if (daySchedule[timeSlot] === true) {
      console.log('🔥 [DosageFrequencyValidator] 이미 선택된 시간대 - 토글 해제 허용');
      return true;
    }
    
    // 최대 선택 가능한 횟수를 초과하는지 확인
    const canSelect = currentSelections < dosageInfo.dailyCount;
    console.log('🔥 [DosageFrequencyValidator] 선택 가능 여부:', canSelect);
    
    return canSelect;
  }

  /**
   * 약물 정보에 기반한 권장 스케줄을 생성합니다
   */
  static generateRecommendedSchedule(medicineId: string): Record<string, Record<string, boolean>> {
    const dosageInfo = this.extractDosageFrequency(medicineId);
    const schedule: Record<string, Record<string, boolean>> = {};

    // 기본 스케줄 초기화
    for (const day of this.DAY_NAMES) {
      schedule[day] = {
        morning: false,
        afternoon: false,
        evening: false
      };
    }

    if (!dosageInfo) return schedule;

    // 🔥 복용 횟수에 따른 권장 시간대 설정
    const recommendedTimes: string[] = [];
    switch (dosageInfo.dailyCount) {
      case 1:
        recommendedTimes.push('morning'); // 아침만
        break;
      case 2:
        recommendedTimes.push('morning', 'evening'); // 아침, 저녁
        break;
      case 3:
        recommendedTimes.push('morning', 'afternoon', 'evening'); // 3회 모두
        break;
      default:
        recommendedTimes.push('morning', 'evening'); // 기본값
    }

    // 모든 요일에 권장 시간대 적용
    for (const day of this.DAY_NAMES) {
      for (const time of recommendedTimes) {
        if (this.TIME_SLOTS.includes(time as any)) {
          schedule[day][time] = true;
        }
      }
    }

    return schedule;
  }
}

export default DosageFrequencyValidator; 