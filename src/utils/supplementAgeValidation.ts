// 영양제 전용 연령 기반 유효성 검사 유틸리티

import { AgeValidationResult } from './ageValidation';

// 영양제별 연령 제한 규칙
interface SupplementAgeRestriction {
  [key: string]: {
    minAge: number;
    maxAge?: number;
    warningAge?: number;
    restrictions: string[];
    specialNotes?: string[];
    recommendedAge?: number;
  };
}

const SUPPLEMENT_AGE_RESTRICTIONS: SupplementAgeRestriction = {
  // 비타민 종류
  'vitamin_d': {
    minAge: 0,
    warningAge: 1,
    restrictions: ['신생아는 의사 처방 필요'],
    specialNotes: ['모유수유 시 모체를 통한 공급 우선'],
    recommendedAge: 12
  },
  'vitamin_c': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6개월 미만 금지'],
    specialNotes: ['과다 복용 시 설사 위험'],
    recommendedAge: 24
  },
  'multivitamin': {
    minAge: 12,
    warningAge: 24,
    restrictions: ['12개월 미만 금지'],
    specialNotes: ['연령별 전용 제품 권장'],
    recommendedAge: 36
  },
  
  // 미네랄 종류
  'iron': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6개월 미만 금지', '과다 복용 위험'],
    specialNotes: ['의사 처방 하에 복용 권장', '변비 부작용 주의'],
    recommendedAge: 12
  },
  'calcium': {
    minAge: 12,
    warningAge: 24,
    restrictions: ['12개월 미만 금지'],
    specialNotes: ['비타민D와 함께 복용 권장'],
    recommendedAge: 24
  },
  'zinc': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6개월 미만 금지'],
    specialNotes: ['과다 복용 시 구리 결핍 위험'],
    recommendedAge: 12
  },
  
  // 오메가-3
  'omega3': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6개월 미만 금지'],
    specialNotes: ['어류 알레르기 주의'],
    recommendedAge: 24
  },
  'dha': {
    minAge: 0,
    warningAge: 6,
    restrictions: ['신생아는 전용 제품 사용'],
    specialNotes: ['뇌 발달에 중요한 영양소'],
    recommendedAge: 0
  },
  
  // 프로바이오틱스
  'probiotics': {
    minAge: 3,
    warningAge: 6,
    restrictions: ['3개월 미만 금지'],
    specialNotes: ['면역력 약화 시 의사 상담'],
    recommendedAge: 6
  },
  
  // 단백질/아미노산
  'protein': {
    minAge: 12,
    warningAge: 24,
    restrictions: ['12개월 미만 금지'],
    specialNotes: ['신장 기능 고려 필요'],
    recommendedAge: 36
  },
  
  // 허브/식물 추출물
  'ginseng': {
    minAge: 144, // 12세
    warningAge: 192, // 16세
    restrictions: ['12세 미만 금지'],
    specialNotes: ['혈압, 혈당에 영향 가능'],
    recommendedAge: 240 // 20세
  },
  'echinacea': {
    minAge: 24,
    warningAge: 36,
    restrictions: ['2세 미만 금지'],
    specialNotes: ['알레르기 반응 주의'],
    recommendedAge: 48
  }
};

// 연령대별 영양제 복용량 비율
const SUPPLEMENT_AGE_DOSE_MULTIPLIER = {
  INFANT: 0,      // 0-6개월: 대부분 금지
  BABY: 0.1,      // 6-12개월: 10%
  TODDLER: 0.25,  // 1-3세: 25%
  PRESCHOOL: 0.5, // 3-6세: 50%
  CHILD: 0.75,    // 6-12세: 75%
  TEEN: 0.9,      // 12-18세: 90%
  ADULT: 1.0      // 18세 이상: 100%
};

/**
 * 영양제에 대한 연령 유효성 검사
 */
export const validateSupplementForAge = (
  age: number | null, 
  supplementInfo: any,
  options: {
    strictMode?: boolean;
    includeDetailedWarnings?: boolean;
    checkInteractions?: boolean;
  } = {}
): AgeValidationResult => {
  if (age === null) {
    return {
      age: null,
      isValid: false,
      warnings: ['나이 정보가 없어 안전한 복용량을 계산할 수 없습니다.'],
      errors: ['사용자 나이 정보 필요'],
      adjustedDose: 0
    };
  }

  const ageInMonths = age * 12; // 개월 단위로 변환
  const result: AgeValidationResult = {
    age,
    isValid: true,
    warnings: [],
    errors: [],
    adjustedDose: 1.0
  };

  // 기본 연령대별 용량 조정
  if (ageInMonths < 6) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.INFANT;
    result.isValid = false;
    result.errors.push('6개월 미만 영아에게는 대부분의 영양제가 금지됩니다.');
    result.errors.push('모유나 분유를 통한 영양 공급이 우선입니다.');
  } else if (ageInMonths < 12) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.BABY;
    result.warnings.push('6-12개월 영아에게는 특별한 주의가 필요합니다.');
    result.warnings.push('소아과 전문의와 상담을 권장합니다.');
  } else if (age < 3) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.TODDLER;
    result.warnings.push('유아기에는 성인 용량의 25%로 복용하세요.');
    result.warnings.push('씹을 수 있는 형태나 액상 제품을 선택하세요.');
  } else if (age < 6) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.PRESCHOOL;
    result.warnings.push('학령전기에는 성인 용량의 50%로 복용하세요.');
  } else if (age < 12) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.CHILD;
    result.warnings.push('아동기에는 성인 용량의 75%로 복용하세요.');
  } else if (age < 18) {
    result.adjustedDose = SUPPLEMENT_AGE_DOSE_MULTIPLIER.TEEN;
    result.warnings.push('청소년기에는 성인 용량의 90%로 복용하세요.');
    result.warnings.push('성장기 특성을 고려한 영양 관리가 중요합니다.');
  }

  // 특정 영양제별 연령 제한 확인
  if (supplementInfo?.name) {
    const supplementName = supplementInfo.name.toLowerCase();
    
    // 영양제명에서 주요 성분 찾기
    for (const [ingredient, restriction] of Object.entries(SUPPLEMENT_AGE_RESTRICTIONS)) {
      if (supplementName.includes(ingredient) || 
          supplementName.includes(ingredient.replace(/_/g, '')) ||
          supplementName.includes(ingredient.replace(/_/g, ' '))) {
        
        // 최소 연령 확인 (개월 단위)
        if (ageInMonths < restriction.minAge) {
          result.isValid = false;
          result.adjustedDose = 0;
          result.errors.push(...restriction.restrictions);
        }
        
        // 최대 연령 확인 (있는 경우)
        if (restriction.maxAge && ageInMonths > restriction.maxAge) {
          result.warnings.push(`${Math.floor(restriction.maxAge / 12)}세 이상에서는 효과가 제한적일 수 있습니다.`);
        }
        
        // 경고 연령 확인
        if (restriction.warningAge && ageInMonths < restriction.warningAge) {
          result.warnings.push(`${Math.floor(restriction.warningAge / 12)}세 미만은 특별한 주의가 필요합니다.`);
        }
        
        // 권장 연령 정보
        if (restriction.recommendedAge && ageInMonths >= restriction.recommendedAge) {
          result.warnings.push(`이 연령대에 적합한 영양제입니다.`);
        }
        
        // 특별 주의사항 추가
        if (restriction.specialNotes && options.includeDetailedWarnings) {
          result.warnings.push(...restriction.specialNotes);
        }
        
        break;
      }
    }
  }

  // 추가 안전 검사
  if (options.strictMode) {
    if (age < 1 && result.isValid) {
      result.warnings.push('1세 미만은 영양제보다 모유/분유 영양이 우선됩니다.');
      result.warnings.push('반드시 소아과 전문의와 상담하세요.');
    }
    
    if (age >= 65) {
      result.warnings.push('고령자는 다른 약물과의 상호작용을 주의하세요.');
      result.warnings.push('만성질환이 있는 경우 의사와 상담하세요.');
    }
    
    if (age >= 3 && age <= 12) {
      result.warnings.push('성장기 아동은 균형 잡힌 식사가 더 중요합니다.');
      result.warnings.push('영양제는 보조적 역할임을 기억하세요.');
    }
  }

  // 상호작용 검사
  if (options.checkInteractions && supplementInfo?.category) {
    if (age < 6 && supplementInfo.category === '종합비타민') {
      result.warnings.push('여러 영양소가 한 번에 들어있어 과다 복용 위험이 있습니다.');
    }
  }

  // 최종 유효성 결정
  result.isValid = result.errors.length === 0;

  return result;
};

/**
 * 영양제별 연령대 특별 주의사항 제공
 */
export const getSupplementAgeSpecificGuidelines = (age: number | null): string[] => {
  if (age === null) return ['나이 정보가 필요합니다.'];
  
  const guidelines: string[] = [];
  const ageInMonths = age * 12;
  
  if (ageInMonths < 6) {
    guidelines.push('영아기: 모유/분유로 충분한 영양 공급');
    guidelines.push('비타민D만 예외적으로 의사 처방 하에 가능');
    guidelines.push('임의로 영양제 투여 금지');
  } else if (ageInMonths < 12) {
    guidelines.push('후기 영아기: 이유식 시작과 함께 제한적 영양제 가능');
    guidelines.push('철분, 비타민D 중점 관리');
    guidelines.push('액상 또는 분말 형태 우선');
  } else if (age < 3) {
    guidelines.push('유아기: 성장에 필요한 기본 영양소 중심');
    guidelines.push('씹을 수 있는 젤리 형태나 액상 제품');
    guidelines.push('종합비타민보다 단일 성분 우선');
  } else if (age < 6) {
    guidelines.push('학령전기: 편식 교정과 함께 영양제 보조');
    guidelines.push('면역력 강화 영양소 고려');
    guidelines.push('정기적인 성장 발달 모니터링');
  } else if (age < 12) {
    guidelines.push('학령기: 학습과 성장을 위한 영양 관리');
    guidelines.push('오메가-3, 비타민B군 고려');
    guidelines.push('균형 잡힌 식사가 우선');
  } else if (age < 18) {
    guidelines.push('청소년기: 급성장기 영양 요구량 증가');
    guidelines.push('칼슘, 철분, 아연 등 미네랄 중요');
    guidelines.push('스트레스 관리와 충분한 수면');
  } else if (age < 65) {
    guidelines.push('성인: 개인별 생활 패턴에 맞는 영양제 선택');
    guidelines.push('만성질환 예방을 위한 항산화 영양소');
    guidelines.push('정기적인 건강 검진과 함께');
  } else {
    guidelines.push('고령자: 흡수율 저하를 고려한 용량 조절');
    guidelines.push('다른 약물과의 상호작용 주의');
    guidelines.push('골다공증, 인지 기능 관련 영양소 중점');
  }
  
  return guidelines;
};

/**
 * 영양제 복용량 자동 계산 함수
 */
export const calculateSupplementAdjustedDose = (
  standardDose: number,
  age: number | null,
  weight?: number | null
): {
  adjustedDose: number;
  method: 'age-based' | 'weight-based' | 'combined' | 'standard';
  recommendation: string;
} => {
  if (age === null) {
    return {
      adjustedDose: 0,
      method: 'standard',
      recommendation: '나이 정보가 없어 용량을 계산할 수 없습니다.'
    };
  }

  const ageInMonths = age * 12;
  let multiplier = 1.0;
  let method: 'age-based' | 'weight-based' | 'combined' | 'standard' = 'age-based';
  let recommendation = '';

  // 연령 기반 계산
  if (ageInMonths < 6) {
    multiplier = 0;
    recommendation = '6개월 미만에게는 영양제 복용을 권장하지 않습니다.';
  } else if (ageInMonths < 12) {
    multiplier = 0.1;
    recommendation = '후기 영아기 용량으로 조절되었습니다.';
  } else if (age < 3) {
    multiplier = 0.25;
    recommendation = '유아기 용량으로 조절되었습니다.';
  } else if (age < 6) {
    multiplier = 0.5;
    recommendation = '학령전기 용량으로 조절되었습니다.';
  } else if (age < 12) {
    multiplier = 0.75;
    recommendation = '아동기 용량으로 조절되었습니다.';
  } else if (age < 18) {
    multiplier = 0.9;
    recommendation = '청소년기 용량으로 조절되었습니다.';
  } else {
    multiplier = 1.0;
    method = 'standard';
    recommendation = '성인 표준 용량입니다.';
  }

  // 체중 기반 계산 (선택적)
  if (weight && age < 18) {
    const weightBasedMultiplier = Math.min(weight / 70, 1.0); // 성인 평균 체중 70kg 기준
    if (Math.abs(weightBasedMultiplier - multiplier) > 0.1) {
      multiplier = (multiplier + weightBasedMultiplier) / 2;
      method = 'combined';
      recommendation += ' (연령과 체중을 함께 고려했습니다.)';
    }
  }

  return {
    adjustedDose: standardDose * multiplier,
    method,
    recommendation
  };
}; 