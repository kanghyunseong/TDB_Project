// 클라이언트용 연령 기반 유효성 검사 유틸리티

export interface AgeValidationResult {
  age: number | null;
  isValid: boolean;
  warnings: string[];
  errors: string[];
  adjustedDose: number;
  isChild?: boolean;
  requiresParentalSupervision?: boolean;
  contraindicatedAge?: boolean;
  dosageMultiplier?: number;
  allowedToTake?: boolean;
}

// 특정 약물별 연령 제한 규칙
interface MedicineAgeRestriction {
  [key: string]: {
    minAge: number;
    warningAge?: number;
    restrictions: string[];
    specialNotes?: string[];
  };
}

const MEDICINE_AGE_RESTRICTIONS: MedicineAgeRestriction = {
  // 해열진통제
  'acetaminophen': {
    minAge: 0,
    warningAge: 2,
    restrictions: ['3개월 미만은 의사 처방 필요'],
    specialNotes: ['체중 기반 용량 계산 권장']
  },
  'ibuprofen': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6개월 미만 금지', '신장 기능 확인 필요'],
    specialNotes: ['식후 복용 권장']
  },
  'aspirin': {
    minAge: 16,
    warningAge: 18,
    restrictions: ['16세 미만 금지 (라이 증후군 위험)', '임신 중 주의'],
    specialNotes: ['혈액 응고에 영향을 줄 수 있음']
  },
  
  // 감기약
  'dextromethorphan': {
    minAge: 2,
    warningAge: 6,
    restrictions: ['2세 미만 금지', '호흡 억제 위험'],
    specialNotes: ['다른 기침약과 병용 금지']
  },
  'phenylephrine': {
    minAge: 4,
    warningAge: 12,
    restrictions: ['4세 미만 금지', '고혈압 환자 주의'],
    specialNotes: ['심혈관계 부작용 주의']
  },
  
  // 항생제
  'amoxicillin': {
    minAge: 0,
    warningAge: 1,
    restrictions: ['신생아는 의사 처방 필수'],
    specialNotes: ['알레르기 반응 주의 깊게 관찰']
  },
  'tetracycline': {
    minAge: 8,
    warningAge: 12,
    restrictions: ['8세 미만 금지 (치아 변색)', '임신 중 금기'],
    specialNotes: ['유제품과 함께 복용 금지']
  },
  
  // 위장약
  'omeprazole': {
    minAge: 1,
    warningAge: 17,
    restrictions: ['1세 미만 사용 제한'],
    specialNotes: ['장기 복용 시 정기 검진 필요']
  },
  
  // 항히스타민제
  'loratadine': {
    minAge: 2,
    warningAge: 6,
    restrictions: ['2세 미만 금지'],
    specialNotes: ['졸음 부작용 주의']
  },
  'diphenhydramine': {
    minAge: 6,
    warningAge: 12,
    restrictions: ['6세 미만 금지', '고령자 주의'],
    specialNotes: ['강한 진정 효과']
  }
};

// 연령대별 기본 복용량 비율
const AGE_DOSE_MULTIPLIER = {
  INFANT: 0,      // 0-2세: 금지
  TODDLER: 0.25,  // 2-6세: 25%
  CHILD: 0.5,     // 7-14세: 50%
  TEEN: 0.75,     // 15-19세: 75%
  ADULT: 1.0      // 20세 이상: 100%
};

export interface ValidationDisplay {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  showModal: boolean;
}

/**
 * 즉시 연령 검증 (클라이언트용) - 하위 호환성 유지
 */
export const validateUserAge = (age: number | null | undefined): AgeValidationResult => {
  const result: AgeValidationResult = {
    age: age || null,
    isValid: true,
    warnings: [],
    errors: [],
    adjustedDose: 1.0,
    isChild: false,
    requiresParentalSupervision: false,
    contraindicatedAge: false,
    dosageMultiplier: 1,
    allowedToTake: true
  };

  if (!age) {
    result.warnings.push('나이 정보가 없어 기본 검증만 수행됩니다.');
    result.isValid = false;
    result.adjustedDose = 0;
    return result;
  }

  // 연령대별 분류
  if (age < 3) {
    result.contraindicatedAge = true;
    result.allowedToTake = false;
    result.dosageMultiplier = 0;
    result.adjustedDose = 0;
    result.isValid = false;
    result.errors.push('2세 이하는 복용할 수 없습니다.');
  } else if (age < 7) {
    result.contraindicatedAge = true;
    result.allowedToTake = false;
    result.dosageMultiplier = 0.25;
    result.adjustedDose = 0.25;
    result.isValid = false;
    result.errors.push('7세 이하는 의사와 상담 후 복용하세요.');
  } else if (age < 15) {
    result.isChild = true;
    result.dosageMultiplier = 0.5;
    result.adjustedDose = 0.5;
    result.warnings.push('소아는 성인의 절반 용량으로 복용합니다.');
  } else if (age < 18) {
    result.requiresParentalSupervision = true;
    result.warnings.push('미성년자는 보호자 관리 하에 복용하세요.');
  }

  return result;
};

/**
 * 복용량 자동 조절
 */
export const adjustDosageForAge = (standardDose: number, age: number | null | undefined): number => {
  if (!age) return standardDose;
  
  const validation = validateUserAge(age);
  return Math.round(standardDose * (validation.dosageMultiplier || 1));
};

/**
 * UI 표시용 검증 결과 변환
 */
export const getValidationDisplay = (validation: AgeValidationResult, medicineName?: string): ValidationDisplay => {
  if (validation.contraindicatedAge) {
    return {
      type: 'error',
      title: '⚠️ 연령 제한',
      message: `${medicineName || '이 의약품'}은 연령 제한으로 복용할 수 없습니다.\n의사와 상담 후 복용하세요.`,
      showModal: true
    };
  }

  if (validation.isChild) {
    return {
      type: 'warning',
      title: '⚡ 소아 복용량',
      message: `소아는 성인의 ${(validation.dosageMultiplier || 0.5) * 100}% 복용량으로 자동 조절됩니다.`,
      showModal: false
    };
  }

  if (validation.requiresParentalSupervision) {
    return {
      type: 'info',
      title: '👥 보호자 관리',
      message: '미성년자는 보호자 관리 하에 복용하세요.',
      showModal: false
    };
  }

  return {
    type: 'success',
    title: '✅ 정상',
    message: '정상적으로 복용 가능합니다.',
    showModal: false
  };
};

/**
 * 실시간 입력 검증 (스케줄 작성 시)
 */
export const validateScheduleInput = (
  age: number | null | undefined,
  medicineName: string,
  plannedDose: number
): {
  valid: boolean;
  adjustedDose: number;
  display: ValidationDisplay;
} => {
  const validation = validateUserAge(age);
  const adjustedDose = adjustDosageForAge(plannedDose, age);
  const display = getValidationDisplay(validation, medicineName);

  return {
    valid: validation.allowedToTake || false,
    adjustedDose,
    display
  };
};

// 향상된 연령 유효성 검사 함수
export const validateMedicineForAge = (
  age: number | null, 
  medicineInfo: any,
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

  const result: AgeValidationResult = {
    age,
    isValid: true,
    warnings: [],
    errors: [],
    adjustedDose: 1.0
  };

  // 기본 연령대별 용량 조정
  if (age < 2) {
    result.adjustedDose = AGE_DOSE_MULTIPLIER.INFANT;
    result.isValid = false;
    result.errors.push('영아기(0-2세)에는 대부분의 약물 복용이 금지됩니다.');
    result.errors.push('반드시 소아과 전문의와 상담 후 복용하세요.');
  } else if (age < 7) {
    result.adjustedDose = AGE_DOSE_MULTIPLIER.TODDLER;
    result.warnings.push('유아기에는 성인 용량의 25%로 복용하세요.');
    result.warnings.push('소아과 전문의와 상담을 권장합니다.');
  } else if (age <= 14) {
    result.adjustedDose = AGE_DOSE_MULTIPLIER.CHILD;
    result.warnings.push('아동기에는 성인 용량의 50%로 복용하세요.');
    result.warnings.push('체중을 고려한 용량 조절이 필요할 수 있습니다.');
  } else if (age <= 19) {
    result.adjustedDose = AGE_DOSE_MULTIPLIER.TEEN;
    result.warnings.push('청소년기에는 성인 용량의 75%로 복용하세요.');
    result.warnings.push('개인차가 클 수 있으므로 주의 깊게 관찰하세요.');
  }

  // 특정 약물별 연령 제한 확인
  if (medicineInfo?.name) {
    const medicineName = medicineInfo.name.toLowerCase();
    
    // 약물명에서 주요 성분 찾기
    for (const [ingredient, restriction] of Object.entries(MEDICINE_AGE_RESTRICTIONS)) {
      if (medicineName.includes(ingredient) || 
          medicineName.includes(ingredient.replace(/[aeiou]/g, ''))) {
        
        // 최소 연령 확인
        if (age < restriction.minAge) {
          result.isValid = false;
          result.adjustedDose = 0;
          result.errors.push(...restriction.restrictions);
        }
        
        // 경고 연령 확인
        if (restriction.warningAge && age < restriction.warningAge) {
          result.warnings.push(`${restriction.warningAge}세 미만은 특별한 주의가 필요합니다.`);
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
    if (age < 6 && result.isValid) {
      result.warnings.push('6세 미만은 특히 주의 깊은 관찰이 필요합니다.');
      result.warnings.push('복용 중 이상 증상 시 즉시 중단하고 의사와 상담하세요.');
    }
    
    if (age >= 65) {
      result.warnings.push('고령자는 약물 대사가 느려질 수 있어 주의가 필요합니다.');
      result.warnings.push('다른 복용 중인 약물과의 상호작용을 확인하세요.');
    }
  }

  // 상호작용 검사 (간단한 예시)
  if (options.checkInteractions && medicineInfo?.category) {
    if (age < 12 && medicineInfo.category === '진통제') {
      result.warnings.push('다른 해열진통제와 함께 복용하지 마세요.');
    }
  }

  // 최종 유효성 결정
  result.isValid = result.errors.length === 0;

  return result;
};

// 연령대별 특별 주의사항 제공
export const getAgeSpecificGuidelines = (age: number | null): string[] => {
  if (age === null) return ['나이 정보가 필요합니다.'];
  
  const guidelines: string[] = [];
  
  if (age < 2) {
    guidelines.push('영아기: 모든 약물은 의사 처방 후에만 사용');
    guidelines.push('체온 조절과 수분 공급에 특별한 주의');
    guidelines.push('모유수유 중인 경우 약물이 모유로 전달될 수 있음');
  } else if (age < 7) {
    guidelines.push('유아기: 성인 용량의 1/4 수준');
    guidelines.push('액상 제형이나 분할 가능한 제형 선호');
    guidelines.push('체중 기반 용량 계산 권장');
  } else if (age <= 14) {
    guidelines.push('아동기: 성인 용량의 1/2 수준');
    guidelines.push('학교 생활을 고려한 복용 시간 조정');
    guidelines.push('부모나 보호자의 지도 하에 복용');
  } else if (age <= 19) {
    guidelines.push('청소년기: 성인 용량의 3/4 수준');
    guidelines.push('호르몬 변화와 성장기 특성 고려');
    guidelines.push('학업 스트레스와 수면 패턴 고려');
  } else if (age < 65) {
    guidelines.push('성인: 표준 용법·용량 준수');
    guidelines.push('임신 계획이 있는 경우 사전 상담');
    guidelines.push('정기적인 건강 검진과 함께 복용');
  } else {
    guidelines.push('고령자: 약물 대사 저하를 고려한 용량 조절');
    guidelines.push('다제 복용에 따른 상호작용 주의');
    guidelines.push('인지 기능과 복용 능력 고려');
  }
  
  return guidelines;
};

// 복용량 자동 계산 함수
export const calculateAdjustedDose = (
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

  let multiplier = 1.0;
  let method: 'age-based' | 'weight-based' | 'combined' | 'standard' = 'age-based';
  let recommendation = '';

  // 연령 기반 계산
  if (age < 2) {
    multiplier = 0;
    recommendation = '영아기에는 복용을 금지합니다.';
  } else if (age < 7) {
    multiplier = 0.25;
    recommendation = '유아기 용량으로 조절되었습니다.';
  } else if (age <= 14) {
    multiplier = 0.5;
    recommendation = '아동기 용량으로 조절되었습니다.';
  } else if (age <= 19) {
    multiplier = 0.75;
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