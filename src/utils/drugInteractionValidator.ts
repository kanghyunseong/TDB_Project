import medicineData from '../assets/medicine.json';
import tabletData from '../assets/tablet.json';
import { Medicine } from '../types/tdb';

// 상호작용 위험도 레벨
export type InteractionSeverity = 'critical' | 'major' | 'moderate' | 'minor';

// 상호작용 카테고리
export type InteractionCategory = 
  | 'blood_thinner'      // 혈액응고방지제
  | 'blood_pressure'     // 혈압약
  | 'diabetes'           // 당뇨약
  | 'heart_medication'   // 심장약
  | 'pain_killer'        // 진통제
  | 'antibiotic'         // 항생제
  | 'vitamin'            // 비타민
  | 'mineral'            // 무기질
  | 'liver_metabolism'   // 간 대사 관련
  | 'kidney_function'    // 신장 기능 관련
  | 'central_nervous'    // 중추신경계
  | 'gastrointestinal'   // 위장관계
  | 'unknown';

// 상호작용 결과
export interface DrugInteraction {
  drugA: string;          // 약물 A 이름
  drugB: string;          // 약물 B 이름
  severity: InteractionSeverity;
  category: InteractionCategory;
  description: string;    // 상호작용 설명
  recommendation: string; // 권장사항
  sourceField: string;    // 데이터 출처 필드
  confidence: number;     // 신뢰도 (0-1)
}

// 검증 결과
export interface InteractionValidationResult {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  warningCount: number;
  criticalCount: number;
  recommendations: string[];
  overallRisk: InteractionSeverity;
}

export class DrugInteractionValidator {
  
  // 🔥 **핵심 상호작용 키워드 패턴**
  private static readonly INTERACTION_PATTERNS = {
    // 혈액응고방지제 관련
    blood_thinner: {
      keywords: ['와파린', '헤파린', '아스피린', '클로피도그렐', '항응고', '혈전', '출혈'],
      warnings: ['출혈위험', '혈액응고', '프로트롬빈', 'INR', '혈소판']
    },
    
    // 혈압약 관련
    blood_pressure: {
      keywords: ['ACE억제제', 'ARB', '베타차단제', '칼슘채널차단제', '이뇨제', '혈압'],
      warnings: ['저혈압', '고혈압', '심박수', '부정맥']
    },
    
    // 당뇨약 관련
    diabetes: {
      keywords: ['인슐린', '메트포민', '설폰요소', '글리타존', '혈당', '당뇨'],
      warnings: ['저혈당', '고혈당', '인슐린', '포도당']
    },
    
    // 진통제 관련
    pain_killer: {
      keywords: ['이부프로펜', '아세트아미노펜', '타이레놀', '부루펜', 'NSAIDs', '진통제'],
      warnings: ['위장출혈', '신장손상', '간독성', '위궤양']
    },
    
    // 항생제 관련
    antibiotic: {
      keywords: ['페니실린', '세팔로스포린', '퀴놀론', '마크로라이드', '항생제'],
      warnings: ['알레르기', '내성', '장내세균', 'QT연장']
    },
    
    // 비타민/미네랄 관련
    vitamin: {
      keywords: ['비타민', '칼슘', '철분', '마그네슘', '아연', '셀레늄'],
      warnings: ['흡수저해', '킬레이션', '과다섭취', '미네랄']
    },
    
    // 간 대사 관련
    liver_metabolism: {
      keywords: ['CYP450', '간효소', '간대사', 'P-glycoprotein'],
      warnings: ['간독성', '대사저해', '농도증가', '반감기']
    },
    
    // 중추신경계 관련
    central_nervous: {
      keywords: ['진정제', '수면제', '항우울제', '항경련제', '마약성'],
      warnings: ['중추억제', '호흡억제', '의식저하', '세로토닌증후군']
    }
  };

  // 🔥 **특정 약물 조합의 위험한 상호작용**
  private static readonly KNOWN_INTERACTIONS = [
    {
      drugs: ['와파린', '아스피린'],
      severity: 'critical' as InteractionSeverity,
      description: '출혈 위험이 현저히 증가할 수 있습니다.',
      recommendation: '반드시 의사와 상담 후 복용하세요. 정기적인 혈액검사가 필요합니다.'
    },
    {
      drugs: ['이부프로펜', 'ACE억제제'],
      severity: 'major' as InteractionSeverity,
      description: '신장 기능 저하 및 혈압약 효과 감소 위험이 있습니다.',
      recommendation: '신장 기능 모니터링이 필요하며, 대체 진통제 사용을 고려하세요.'
    },
    {
      drugs: ['칼슘', '철분'],
      severity: 'moderate' as InteractionSeverity,
      description: '철분 흡수가 저해될 수 있습니다.',
      recommendation: '복용 시간을 2시간 이상 간격을 두고 복용하세요.'
    },
    {
      drugs: ['메트포민', '요오드조영제'],
      severity: 'critical' as InteractionSeverity,
      description: '유산산증 위험이 있습니다.',
      recommendation: '검사 전후 메트포민 중단이 필요합니다. 반드시 의사와 상담하세요.'
    },
    {
      drugs: ['타이레놀', '아세트아미노펜'],
      severity: 'major' as InteractionSeverity,
      description: '동일 성분의 중복 복용으로 간독성 위험이 증가합니다.',
      recommendation: '중복 복용을 피하고 일일 최대 용량을 확인하세요.'
    },
    {
      drugs: ['오메가3', '와파린'],
      severity: 'major' as InteractionSeverity,
      description: '출혈 시간이 연장될 수 있습니다.',
      recommendation: '혈액응고 검사를 정기적으로 받고 의사와 상담하세요.'
    },
    {
      drugs: ['비타민D', '칼슘'],
      severity: 'minor' as InteractionSeverity,
      description: '칼슘 흡수가 증가하여 과다 섭취 위험이 있습니다.',
      recommendation: '일일 권장량을 확인하고 적절한 용량을 유지하세요.'
    }
  ];

  /**
   * 🔥 **메인 함수: 사용자의 모든 약물 간 상호작용 검사**
   */
  static async validateDrugInteractions(userMedicines: Medicine[]): Promise<InteractionValidationResult> {
    console.log('🔍 [DrugInteraction] 상호작용 검사 시작:', userMedicines.length, '개 약물');
    
    const interactions: DrugInteraction[] = [];
    const recommendations: string[] = [];
    
    // 🔥 1. 모든 약물 쌍에 대해 상호작용 검사
    for (let i = 0; i < userMedicines.length; i++) {
      for (let j = i + 1; j < userMedicines.length; j++) {
        const drugA = userMedicines[i];
        const drugB = userMedicines[j];
        
        // 🔥 약물 이름 정규화하여 중복 검사 방지
        const normalizedNameA = this.normalizeDrugName(drugA.name);
        const normalizedNameB = this.normalizeDrugName(drugB.name);
        
        // 동일한 약물인 경우 스킵
        if (normalizedNameA === normalizedNameB) {
          console.log(`🔍 [DrugInteraction] 동일한 약물이므로 스킵: ${drugA.name} === ${drugB.name}`);
          continue;
        }
        
        console.log(`🔍 [DrugInteraction] 검사 중: ${drugA.name} vs ${drugB.name}`);
        
        const pairInteractions = await this.checkDrugPairInteraction(drugA, drugB);
        interactions.push(...pairInteractions);
      }
    }
    
    // 🔥 2. 결과 분석
    const criticalCount = interactions.filter(i => i.severity === 'critical').length;
    const majorCount = interactions.filter(i => i.severity === 'major').length;
    const warningCount = criticalCount + majorCount;
    
    // 🔥 3. 전체 위험도 평가
    let overallRisk: InteractionSeverity = 'minor';
    if (criticalCount > 0) overallRisk = 'critical';
    else if (majorCount > 0) overallRisk = 'major';
    else if (interactions.length > 0) overallRisk = 'moderate';
    
    // 🔥 4. 권장사항 생성
    if (criticalCount > 0) {
      recommendations.push('⚠️ 심각한 상호작용이 발견되었습니다. 즉시 의사와 상담하세요.');
    }
    if (majorCount > 0) {
      recommendations.push('⚠️ 주의가 필요한 상호작용이 있습니다. 복용 전 약사와 상담하세요.');
    }
    if (interactions.length > 3) {
      recommendations.push('💡 복용 중인 약물이 많습니다. 정기적인 복약상담을 받으시기 바랍니다.');
    }
    
    console.log('🎯 [DrugInteraction] 검사 완료:', {
      총상호작용: interactions.length,
      심각한상호작용: criticalCount,
      주요상호작용: majorCount,
      전체위험도: overallRisk
    });
    
    return {
      hasInteractions: interactions.length > 0,
      interactions,
      warningCount,
      criticalCount,
      recommendations,
      overallRisk
    };
  }

  /**
   * 🔥 **약물 이름 정규화 (공백, 특수문자 제거하여 중복 검사)** 
   */
  private static normalizeDrugName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '') // 모든 공백 제거
      .replace(/[^\w가-힣]/g, '') // 특수문자 제거 (한글, 영문, 숫자만 유지)
      .trim();
  }

  /**
   * 🔥 **두 약물 간 상호작용 검사**
   */
  private static async checkDrugPairInteraction(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    // 1. 기존 알려진 상호작용 확인
    const knownInteraction = this.checkKnownInteractions(drugA.name, drugB.name);
    if (knownInteraction) {
      interactions.push(knownInteraction);
    }
    
    // 2. medicine.json 데이터로 상호작용 검사
    const medicineInteractions = await this.checkMedicineDataInteractions(drugA, drugB);
    interactions.push(...medicineInteractions);
    
    // 3. tablet.json 데이터로 상호작용 검사 (영양제)
    const tabletInteractions = await this.checkTabletDataInteractions(drugA, drugB);
    interactions.push(...tabletInteractions);
    
    return interactions;
  }

  /**
   * 🔥 **알려진 상호작용 DB 확인**
   */
  private static checkKnownInteractions(drugA: string, drugB: string): DrugInteraction | null {
    for (const interaction of this.KNOWN_INTERACTIONS) {
      const { drugs, severity, description, recommendation } = interaction;
      
      const hasA = drugs.some(drug => drugA.includes(drug) || drug.includes(drugA));
      const hasB = drugs.some(drug => drugB.includes(drug) || drug.includes(drugB));
      
      if (hasA && hasB) {
        console.log(`🚨 [DrugInteraction] 알려진 상호작용 발견: ${drugA} + ${drugB}`);
        return {
          drugA,
          drugB,
          severity,
          category: 'unknown',
          description,
          recommendation,
          sourceField: 'known_interactions',
          confidence: 0.9
        };
      }
    }
    return null;
  }

  /**
   * 🔥 **medicine.json 데이터 기반 상호작용 검사**
   */
  private static async checkMedicineDataInteractions(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    try {
      const medicines = medicineData as any[];
      
      // drugA 정보 찾기
      const medicineA = medicines.find((med: any) => 
        med['제품명 [ITEMNAME] ']?.includes(drugA.name) || 
        drugA.name.includes(med['제품명 [ITEMNAME] '])
      );
      
      // drugB 정보 찾기
      const medicineB = medicines.find((med: any) => 
        med['제품명 [ITEMNAME] ']?.includes(drugB.name) || 
        drugB.name.includes(med['제품명 [ITEMNAME] '])
      );
      
      if (medicineA && medicineB) {
        // 🔥 주요 필드들 검사
        const fieldsToCheck = [
          { field: '문항4(주의사항) [ATPNQESITM] ', name: '주의사항' },
          { field: '문항5(상호작용) [INTRCQESITM] ', name: '상호작용' },
          { field: '문항6(부작용) [SEQESITM] ', name: '부작용' }
        ];
        
        for (const { field, name } of fieldsToCheck) {
          const contentA = medicineA[field] || '';
          const contentB = medicineB[field] || '';
          
          const interaction = this.analyzeInteractionContent(
            drugA.name, drugB.name, contentA, contentB, field
          );
          
          if (interaction) {
            interactions.push(interaction);
          }
        }
      }
    } catch (error) {
      console.error('🔥 [DrugInteraction] medicine.json 검사 중 오류:', error);
    }
    
    return interactions;
  }

  /**
   * 🔥 **tablet.json 데이터 기반 상호작용 검사 (영양제)**
   */
  private static async checkTabletDataInteractions(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    try {
      const tablets = tabletData as any[];
      
      // 영양제 정보 찾기
      const tabletA = tablets.find((tablet: any) => 
        tablet.PRDLST_NM?.includes(drugA.name) || 
        drugA.name.includes(tablet.PRDLST_NM)
      );
      
      const tabletB = tablets.find((tablet: any) => 
        tablet.PRDLST_NM?.includes(drugB.name) || 
        drugB.name.includes(tablet.PRDLST_NM)
      );
      
      if (tabletA && tabletB) {
        // 🔥 IFTKN_ATNT_MATR_CN (복용시주의사항) 필드 검사
        const contentA = tabletA.IFTKN_ATNT_MATR_CN || '';
        const contentB = tabletB.IFTKN_ATNT_MATR_CN || '';
        
        const interaction = this.analyzeInteractionContent(
          drugA.name, drugB.name, contentA, contentB, 'IFTKN_ATNT_MATR_CN'
        );
        
        if (interaction) {
          interactions.push(interaction);
        }
        
        // 🔥 원료 성분 기반 상호작용 검사
        const ingredientInteraction = this.checkIngredientInteraction(tabletA, tabletB);
        if (ingredientInteraction) {
          interactions.push(ingredientInteraction);
        }
      }
    } catch (error) {
      console.error('🔥 [DrugInteraction] tablet.json 검사 중 오류:', error);
    }
    
    return interactions;
  }

  /**
   * 🔥 **텍스트 내용 기반 상호작용 분석**
   */
  private static analyzeInteractionContent(
    drugA: string, 
    drugB: string, 
    contentA: string, 
    contentB: string, 
    sourceField: string
  ): DrugInteraction | null {
    
    // 🔥 패턴 매칭으로 상호작용 위험 요소 찾기
    for (const [category, patterns] of Object.entries(this.INTERACTION_PATTERNS)) {
      const { keywords, warnings } = patterns;
      
      // drugA 내용에서 카테고리 키워드 찾기
      const drugAMatches = keywords.some(keyword => contentA.includes(keyword));
      const drugBMatches = keywords.some(keyword => contentB.includes(keyword));
      
      // 둘 다 같은 카테고리면 잠재적 상호작용
      if (drugAMatches && drugBMatches) {
        // 경고 키워드 확인
        const hasWarnings = warnings.some(warning => 
          contentA.includes(warning) || contentB.includes(warning)
        );
        
        if (hasWarnings) {
          console.log(`⚠️ [DrugInteraction] 상호작용 발견: ${drugA} + ${drugB} (카테고리: ${category})`);
          
          return {
            drugA,
            drugB,
            severity: this.determineSeverity(category, hasWarnings),
            category: category as InteractionCategory,
            description: `${category} 계열 약물 간 상호작용이 발견되었습니다.`,
            recommendation: this.getRecommendationForCategory(category),
            sourceField,
            confidence: 0.7
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 🔥 **영양제 원료 성분 기반 상호작용 검사**
   */
  private static checkIngredientInteraction(tabletA: any, tabletB: any): DrugInteraction | null {
    const ingredientsA = (tabletA.RAWMTRL_NM || '').toLowerCase();
    const ingredientsB = (tabletB.RAWMTRL_NM || '').toLowerCase();
    
    // 🔥 중복 성분 확인 (과다 섭취 위험)
    const commonIngredients = this.findCommonIngredients(ingredientsA, ingredientsB);
    
    if (commonIngredients.length > 0) {
      return {
        drugA: tabletA.PRDLST_NM,
        drugB: tabletB.PRDLST_NM,
        severity: 'moderate',
        category: 'vitamin',
        description: `공통 성분(${commonIngredients.join(', ')})으로 인한 과다 섭취 위험이 있습니다.`,
        recommendation: '동일 성분의 중복 섭취를 피하고, 일일 권장량을 확인하세요.',
        sourceField: 'RAWMTRL_NM',
        confidence: 0.8
      };
    }
    
    return null;
  }

  /**
   * 🔥 **공통 성분 찾기**
   */
  private static findCommonIngredients(ingredientsA: string, ingredientsB: string): string[] {
    const vitaminMinerals = [
      '비타민a', '비타민b', '비타민c', '비타민d', '비타민e', '비타민k',
      '칼슘', '철분', '아연', '마그네슘', '셀레늄', '요오드', '구리', '망간'
    ];
    
    return vitaminMinerals.filter(ingredient => 
      ingredientsA.includes(ingredient) && ingredientsB.includes(ingredient)
    );
  }

  /**
   * 🔥 **위험도 결정**
   */
  private static determineSeverity(category: string, hasWarnings: boolean): InteractionSeverity {
    if (category === 'blood_thinner' || category === 'heart_medication') {
      return hasWarnings ? 'critical' : 'major';
    }
    if (category === 'blood_pressure' || category === 'diabetes') {
      return hasWarnings ? 'major' : 'moderate';
    }
    if (category === 'pain_killer' || category === 'antibiotic') {
      return hasWarnings ? 'major' : 'moderate';
    }
    return hasWarnings ? 'moderate' : 'minor';
  }

  /**
   * 🔥 **카테고리별 권장사항**
   */
  private static getRecommendationForCategory(category: string): string {
    const recommendations: Record<string, string> = {
      blood_thinner: '출혈 위험이 있습니다. 반드시 의사와 상담하고 정기적인 혈액검사를 받으세요.',
      blood_pressure: '혈압 변화를 주의 깊게 모니터링하고 의사와 상담하세요.',
      diabetes: '혈당 수치를 자주 확인하고 저혈당 증상에 주의하세요.',
      pain_killer: '위장 보호제 복용을 고려하고 신장 기능을 모니터링하세요.',
      antibiotic: '복용 시간을 조정하거나 프로바이오틱스 복용을 고려하세요.',
      vitamin: '복용 시간을 2시간 이상 간격을 두거나 용량을 조정하세요.',
      liver_metabolism: '간 기능 검사를 정기적으로 받고 약물 농도를 모니터링하세요.',
      central_nervous: '졸음, 어지러움 등의 증상에 주의하고 운전을 피하세요.'
    };
    
    return recommendations[category] || '복용 전 의료진과 상담하세요.';
  }
} 