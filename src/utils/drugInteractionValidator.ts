// 🔥 JSON 파일 import 제거 (데이터베이스 사용)
// import medicineData from '../assets/medicine.json';
// import tabletData from '../assets/tablet.json';
import { Medicine } from '../types/tdb';
import { findMedicineMasterByName, findTabletMasterByName } from '../api/medicineMaster';

// 🔥 서버 API를 통한 데이터 조회 (캐싱은 서버에서 처리)
const getMedicineDataByName = async (medicineName: string) => {
  try {
    return await findMedicineMasterByName(medicineName);
  } catch (error) {
    console.error('🔥 [DrugInteraction] 약물 정보 조회 실패:', error);
    return null;
  }
};

const getTabletDataByName = async (tabletName: string) => {
  try {
    return await findTabletMasterByName(tabletName);
  } catch (error) {
    console.error('🔥 [DrugInteraction] 영양제 정보 조회 실패:', error);
    return null;
  }
};

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
    },
    {
      drugs: ['디곡신', '칼슘'],
      severity: 'critical' as InteractionSeverity,
      description: '칼슘이 디곡신의 심장 독성을 증가시킬 수 있습니다.',
      recommendation: '반드시 의사와 상담하세요. 칼슘 보충제 복용 시 디곡신 농도를 정기적으로 모니터링해야 합니다.'
    },
    {
      drugs: ['리튬', '이뇨제'],
      severity: 'critical' as InteractionSeverity,
      description: '이뇨제가 리튬 배설을 감소시켜 리튬 중독 위험이 있습니다.',
      recommendation: '리튬 농도를 정기적으로 모니터링하고, 이뇨제 복용 시 리튬 용량 조정이 필요할 수 있습니다. 반드시 의사와 상담하세요.'
    },
    {
      drugs: ['항우울제', 'MAO억제제'],
      severity: 'critical' as InteractionSeverity,
      description: '세로토닌 증후군을 일으킬 수 있는 위험한 상호작용입니다.',
      recommendation: 'MAO억제제 중단 후 최소 2주 이상 경과한 후 항우울제를 복용해야 합니다. 반드시 의사와 상담하세요.'
    },
    {
      drugs: ['테트라사이클린', '칼슘'],
      severity: 'major' as InteractionSeverity,
      description: '칼슘이 테트라사이클린의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '테트라사이클린 복용 2시간 전 또는 4시간 후에 칼슘제를 복용하세요.'
    },
    {
      drugs: ['테트라사이클린', '철분'],
      severity: 'major' as InteractionSeverity,
      description: '철분이 테트라사이클린의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '테트라사이클린 복용 2시간 전 또는 4시간 후에 철분제를 복용하세요.'
    },
    {
      drugs: ['테트라사이클린', '마그네슘'],
      severity: 'major' as InteractionSeverity,
      description: '마그네슘이 테트라사이클린의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '테트라사이클린 복용 2시간 전 또는 4시간 후에 마그네슘제를 복용하세요.'
    },
    {
      drugs: ['퀴놀론', '칼슘'],
      severity: 'major' as InteractionSeverity,
      description: '칼슘이 퀴놀론 계열 항생제의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '퀴놀론 항생제 복용 2시간 전 또는 4시간 후에 칼슘제를 복용하세요.'
    },
    {
      drugs: ['퀴놀론', '철분'],
      severity: 'major' as InteractionSeverity,
      description: '철분이 퀴놀론 계열 항생제의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '퀴놀론 항생제 복용 2시간 전 또는 4시간 후에 철분제를 복용하세요.'
    },
    {
      drugs: ['퀴놀론', '마그네슘'],
      severity: 'major' as InteractionSeverity,
      description: '마그네슘이 퀴놀론 계열 항생제의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '퀴놀론 항생제 복용 2시간 전 또는 4시간 후에 마그네슘제를 복용하세요.'
    },
    {
      drugs: ['퀴놀론', '알루미늄'],
      severity: 'major' as InteractionSeverity,
      description: '알루미늄이 퀴놀론 계열 항생제의 흡수를 저해하여 항생제 효과가 감소할 수 있습니다.',
      recommendation: '퀴놀론 항생제 복용 2시간 전 또는 4시간 후에 알루미늄 함유 제산제를 복용하세요.'
    },
    {
      drugs: ['와파린', '비타민K'],
      severity: 'critical' as InteractionSeverity,
      description: '비타민K가 와파린의 항응고 효과를 감소시킬 수 있습니다.',
      recommendation: '비타민K 함유 식품이나 보충제의 섭취를 일정하게 유지하고, 정기적인 혈액응고 검사(INR)를 받으세요. 의사와 상담하세요.'
    },
    {
      drugs: ['아스피린', '메토트렉세이트'],
      severity: 'major' as InteractionSeverity,
      description: '아스피린이 메토트렉세이트의 배설을 감소시켜 독성 위험이 증가할 수 있습니다.',
      recommendation: '메토트렉세이트 복용 중 아스피린 사용 시 의사와 상담하세요. 정기적인 혈액검사가 필요할 수 있습니다.'
    },
    {
      drugs: ['디곡신', '이뇨제'],
      severity: 'major' as InteractionSeverity,
      description: '이뇨제로 인한 칼륨 감소가 디곡신 독성을 증가시킬 수 있습니다.',
      recommendation: '칼륨 수치를 정기적으로 모니터링하고, 칼륨 보충이 필요할 수 있습니다. 의사와 상담하세요.'
    }
  ];

  /**
   * 🔥 **빠른 상호작용 검사 (알려진 상호작용만 체크, API 호출 없음)**
   */
  static async quickCheckKnownInteractions(userMedicines: Medicine[]): Promise<InteractionValidationResult> {
    console.log('⚡ [DrugInteraction] 빠른 상호작용 검사 시작:', userMedicines.length, '개 약물');
    
    const interactions: DrugInteraction[] = [];
    
    // 🔥 알려진 상호작용만 빠르게 체크 (API 호출 없음)
    for (let i = 0; i < userMedicines.length; i++) {
      for (let j = i + 1; j < userMedicines.length; j++) {
        const drugA = userMedicines[i];
        const drugB = userMedicines[j];
        
        // 🔥 약물 이름 정규화하여 중복 검사 방지
        const normalizedNameA = this.normalizeDrugName(drugA.name);
        const normalizedNameB = this.normalizeDrugName(drugB.name);
        
        // 동일한 약물인 경우 스킵
        if (normalizedNameA === normalizedNameB) {
          continue;
        }
        
        // 🔥 알려진 상호작용만 체크 (동기, 빠름)
        const knownInteraction = this.checkKnownInteractions(drugA.name, drugB.name);
        if (knownInteraction) {
          interactions.push(knownInteraction);
        }
      }
    }
    
    const criticalCount = interactions.filter(i => i.severity === 'critical').length;
    const majorCount = interactions.filter(i => i.severity === 'major').length;
    const warningCount = criticalCount + majorCount;
    
    let overallRisk: InteractionSeverity = 'minor';
    if (criticalCount > 0) overallRisk = 'critical';
    else if (majorCount > 0) overallRisk = 'major';
    else if (interactions.length > 0) overallRisk = 'moderate';
    
    console.log('⚡ [DrugInteraction] 빠른 검사 완료:', {
      총상호작용: interactions.length,
      심각한상호작용: criticalCount,
      주요상호작용: majorCount
    });
    
    return {
      hasInteractions: interactions.length > 0,
      interactions,
      warningCount,
      criticalCount,
      recommendations: [],
      overallRisk
    };
  }

  /**
   * 🔥 **메인 함수: 사용자의 모든 약물 간 상호작용 검사 (상세 검사)**
   */
  static async validateDrugInteractions(userMedicines: Medicine[]): Promise<InteractionValidationResult> {
    console.log('🔍 [DrugInteraction] 상세 상호작용 검사 시작:', userMedicines.length, '개 약물');
    
    const interactions: DrugInteraction[] = [];
    const recommendations: string[] = [];
    
    // 🔥 1. 알려진 상호작용 먼저 체크 (빠름)
    const quickResult = await this.quickCheckKnownInteractions(userMedicines);
    interactions.push(...quickResult.interactions);
    
    // 🔥 2. 모든 약물 쌍에 대해 상세 상호작용 검사 (API 호출 포함)
    for (let i = 0; i < userMedicines.length; i++) {
      for (let j = i + 1; j < userMedicines.length; j++) {
        const drugA = userMedicines[i];
        const drugB = userMedicines[j];
        
        // 🔥 약물 이름 정규화하여 중복 검사 방지
        const normalizedNameA = this.normalizeDrugName(drugA.name);
        const normalizedNameB = this.normalizeDrugName(drugB.name);
        
        // 동일한 약물인 경우 스킵
        if (normalizedNameA === normalizedNameB) {
          continue;
        }
        
        // 🔥 알려진 상호작용은 이미 체크했으므로 스킵
        const alreadyChecked = interactions.some(
          i => (i.drugA === drugA.name && i.drugB === drugB.name) || 
               (i.drugA === drugB.name && i.drugB === drugA.name)
        );
        
        if (alreadyChecked) {
          continue;
        }
        
        try {
          const pairInteractions = await this.checkDrugPairInteraction(drugA, drugB);
          interactions.push(...pairInteractions);
        } catch (error) {
          console.warn(`⚠️ [DrugInteraction] 상세 검사 실패: ${drugA.name} vs ${drugB.name}`, error);
        }
      }
    }
    
    // 🔥 3. 결과 분석
    const criticalCount = interactions.filter(i => i.severity === 'critical').length;
    const majorCount = interactions.filter(i => i.severity === 'major').length;
    const warningCount = criticalCount + majorCount;
    
    // 🔥 4. 전체 위험도 평가
    let overallRisk: InteractionSeverity = 'minor';
    if (criticalCount > 0) overallRisk = 'critical';
    else if (majorCount > 0) overallRisk = 'major';
    else if (interactions.length > 0) overallRisk = 'moderate';
    
    // 🔥 5. 권장사항 생성
    if (criticalCount > 0) {
      recommendations.push('⚠️ 심각한 상호작용이 발견되었습니다. 즉시 의사와 상담하세요.');
    }
    if (majorCount > 0) {
      recommendations.push('⚠️ 주의가 필요한 상호작용이 있습니다. 복용 전 약사와 상담하세요.');
    }
    if (interactions.length > 3) {
      recommendations.push('💡 복용 중인 약물이 많습니다. 정기적인 복약상담을 받으시기 바랍니다.');
    }
    
    console.log('🎯 [DrugInteraction] 상세 검사 완료:', {
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
   * 🔥 **두 약물 간 상호작용 검사 (타임아웃 및 에러 처리 추가)**
   */
  private static async checkDrugPairInteraction(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    try {
      // 1. 기존 알려진 상호작용 확인 (동기, 빠름)
      const knownInteraction = this.checkKnownInteractions(drugA.name, drugB.name);
      if (knownInteraction) {
        interactions.push(knownInteraction);
      }
      
      // 2. medicine.json 데이터로 상호작용 검사 (타임아웃 적용)
      try {
        const medicineTimeout = new Promise<DrugInteraction[]>((resolve) => {
          setTimeout(() => resolve([]), 3000); // 3초 타임아웃
        });
        const medicineCheck = this.checkMedicineDataInteractions(drugA, drugB);
        const medicineInteractions = await Promise.race([medicineCheck, medicineTimeout]);
        interactions.push(...medicineInteractions);
      } catch (error) {
        console.warn(`⚠️ [DrugInteraction] 의약품 상호작용 검사 실패: ${drugA.name} vs ${drugB.name}`, error);
      }
      
      // 3. tablet.json 데이터로 상호작용 검사 (타임아웃 적용)
      try {
        const tabletTimeout = new Promise<DrugInteraction[]>((resolve) => {
          setTimeout(() => resolve([]), 3000); // 3초 타임아웃
        });
        const tabletCheck = this.checkTabletDataInteractions(drugA, drugB);
        const tabletInteractions = await Promise.race([tabletCheck, tabletTimeout]);
        interactions.push(...tabletInteractions);
      } catch (error) {
        console.warn(`⚠️ [DrugInteraction] 영양제 상호작용 검사 실패: ${drugA.name} vs ${drugB.name}`, error);
      }
    } catch (error) {
      console.error(`❌ [DrugInteraction] 상호작용 검사 중 오류: ${drugA.name} vs ${drugB.name}`, error);
    }
    
    return interactions;
  }

  /**
   * 🔥 **알려진 상호작용 DB 확인**
   */
  private static checkKnownInteractions(drugA: string, drugB: string): DrugInteraction | null {
    for (const interaction of this.KNOWN_INTERACTIONS) {
      const { drugs, severity, description, recommendation } = interaction;
      
      // 🔥 정규화된 이름으로도 매칭하여 "칼슘정"과 "칼슘" 같은 경우도 감지
      const normalizedA = this.normalizeDrugName(drugA);
      const normalizedB = this.normalizeDrugName(drugB);
      
      const hasA = drugs.some(drug => {
        const normalizedDrug = this.normalizeDrugName(drug);
        return drugA.includes(drug) || drug.includes(drugA) || 
               normalizedA.includes(normalizedDrug) || normalizedDrug.includes(normalizedA);
      });
      
      const hasB = drugs.some(drug => {
        const normalizedDrug = this.normalizeDrugName(drug);
        return drugB.includes(drug) || drug.includes(drugB) || 
               normalizedB.includes(normalizedDrug) || normalizedDrug.includes(normalizedB);
      });
      
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
   * 🔥 **서버 API 데이터 기반 상호작용 검사 (의약품)**
   */
  private static async checkMedicineDataInteractions(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    try {
      // 🔥 서버 API에서 약물 정보 조회
      const [medicineA, medicineB] = await Promise.all([
        getMedicineDataByName(drugA.name),
        getMedicineDataByName(drugB.name)
      ]);
      
      if (medicineA && medicineB) {
        // 🔥 주요 필드들 검사 (여러 형식 지원)
        const fieldsToCheck = [
          { 
            field: 'precautions', 
            name: '주의사항', 
            getValue: (m: any) => m.precautions || m.IFTKN_ATNT_MATR_CN || m.atpnQesitm || m.atpnWarnQesitm || '' 
          },
          { 
            field: 'standard_spec', 
            name: '기준규격', 
            getValue: (m: any) => m.standard_spec || m.STDR_STND || '' 
          },
          { 
            field: 'primary_function', 
            name: '주요기능성', 
            getValue: (m: any) => m.primary_function || m.PRIMARY_FNCLTY || m.efcyQesitm || '' 
          }
        ];
        
        for (const { field, name, getValue } of fieldsToCheck) {
          const contentA = getValue(medicineA);
          const contentB = getValue(medicineB);
          
          // 🔥 내용이 있을 때만 검사
          if (contentA && contentB) {
            const interaction = this.analyzeInteractionContent(
              drugA.name, drugB.name, contentA, contentB, field
            );
            
            if (interaction) {
              interactions.push(interaction);
            }
          }
        }
      }
    } catch (error) {
      console.error('🔥 [DrugInteraction] 서버 API 검사 중 오류:', error);
    }
    
    return interactions;
  }

  /**
   * 🔥 **서버 API 데이터 기반 상호작용 검사 (건강기능식품)**
   */
  private static async checkTabletDataInteractions(drugA: Medicine, drugB: Medicine): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    
    try {
      // 🔥 서버 API에서 영양제 정보 조회
      const [tabletA, tabletB] = await Promise.all([
        getTabletDataByName(drugA.name),
        getTabletDataByName(drugB.name)
      ]);
      
      if (tabletA && tabletB) {
        // 🔥 타입 단언을 사용하여 모든 필드 접근 가능하도록 처리
        const tabletAAny = tabletA as any;
        const tabletBAny = tabletB as any;
        
        // 🔥 precautions (복용시주의사항) 필드 검사 (여러 형식 지원)
        const contentA = tabletAAny.precautions || tabletAAny.IFTKN_ATNT_MATR_CN || '';
        const contentB = tabletBAny.precautions || tabletBAny.IFTKN_ATNT_MATR_CN || '';
        
        // 🔥 내용이 있을 때만 검사
        if (contentA && contentB) {
          const interaction = this.analyzeInteractionContent(
            drugA.name, drugB.name, contentA, contentB, 'IFTKN_ATNT_MATR_CN'
          );
          
          if (interaction) {
            interactions.push(interaction);
          }
        }
        
        // 🔥 원료 성분 기반 상호작용 검사
        const ingredientInteraction = this.checkIngredientInteraction(tabletAAny, tabletBAny);
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
    
    // 🔥 내용이 없으면 검사 건너뛰기
    if (!contentA || !contentB) {
      return null;
    }
    
    // 🔥 패턴 매칭으로 상호작용 위험 요소 찾기
    for (const [category, patterns] of Object.entries(this.INTERACTION_PATTERNS)) {
      const { keywords, warnings } = patterns;
      
      // 🔥 대소문자 무시 검색을 위해 소문자로 변환
      const contentALower = contentA.toLowerCase();
      const contentBLower = contentB.toLowerCase();
      
      // drugA 내용에서 카테고리 키워드 찾기
      const drugAMatches = keywords.some(keyword => 
        contentALower.includes(keyword.toLowerCase())
      );
      const drugBMatches = keywords.some(keyword => 
        contentBLower.includes(keyword.toLowerCase())
      );
      
      // 둘 다 같은 카테고리면 잠재적 상호작용
      if (drugAMatches && drugBMatches) {
        // 경고 키워드 확인
        const hasWarnings = warnings.some(warning => 
          contentALower.includes(warning.toLowerCase()) || 
          contentBLower.includes(warning.toLowerCase())
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
    // 🔥 여러 형식 지원 (서버 API 필드명과 JSON 필드명 모두 지원)
    const ingredientsA = ((tabletA.RAWMTRL_NM || tabletA.raw_materials || '') + '').toLowerCase();
    const ingredientsB = ((tabletB.RAWMTRL_NM || tabletB.raw_materials || '') + '').toLowerCase();
    
    // 🔥 내용이 없으면 검사 건너뛰기
    if (!ingredientsA || !ingredientsB) {
      return null;
    }
    
    // 🔥 중복 성분 확인 (과다 섭취 위험)
    const commonIngredients = this.findCommonIngredients(ingredientsA, ingredientsB);
    
    if (commonIngredients.length > 0) {
      return {
        drugA: tabletA.PRDLST_NM || tabletA.name || '',
        drugB: tabletB.PRDLST_NM || tabletB.name || '',
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