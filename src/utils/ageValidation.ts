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
  '아세트아미노펜': {
    minAge: 0,
    warningAge: 2,
    restrictions: ['3개월 미만은 의사 처방 필요'],
    specialNotes: ['체중 기반 용량 계산 권장']
  },
  '타이레놀': {
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
  '이부프로펜': {
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
  '아스피린': {
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
  '테트라사이클린': {
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
  '오메프라졸': {
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
  },
  
  // 정신과 약물 (임신/수유/고령자 주의)
  '아리피프라졸': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 금기', '고령자 주의', '안전성 미확립'],
    specialNotes: ['임신 중 복용 시 태아 기형 위험', '고령자는 용량 조절 필요']
  },
  '올란자핀': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 주의', '고령자 주의', '안전성 미확립'],
    specialNotes: ['고령자는 체중증가, 진정 부작용 증가']
  },
  '할로페리돌': {
    minAge: 3,
    warningAge: 65,
    restrictions: ['영아 금지', '임부 금기', '고령자 주의'],
    specialNotes: ['임신 말기 복용 시 신생아 부작용 위험']
  },
  '블로난세린': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 금기', '고령자 주의'],
    specialNotes: ['임신 3기 복용 시 신생아 추체외로장애 위험']
  },
  '팔리페리돈': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 금기', '고령자 주의'],
    specialNotes: ['임신 3기 복용 시 신생아 부작용 위험']
  },
  
  // 소화제
  '판크레아틴': {
    minAge: 0,
    warningAge: 0,
    restrictions: ['임부 주의'],
    specialNotes: ['돼지고기/소고기 과민증 환자 주의']
  },
  '크레온': {
    minAge: 0,
    warningAge: 0,
    restrictions: ['임부 주의'],
    specialNotes: ['돼지고기/소고기 과민증 환자 주의']
  },
  
  // 항응고제
  '와파린': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 금기', '고령자 주의'],
    specialNotes: ['정기적인 혈액검사 필요', '출혈 위험 증가']
  },
  '항응고': {
    minAge: 18,
    warningAge: 65,
    restrictions: ['임부 금기', '고령자 주의'],
    specialNotes: ['정기적인 혈액검사 필요']
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

// 🔥 주의사항 텍스트에서 연령 제한 정보 추출
const extractAgeRestrictionsFromPrecautions = (precautions: string | string[] | undefined): {
  minAge?: number;
  maxAge?: number;
  restrictedAges: number[];
  warnings: string[];
  isPregnantContraindicated: boolean;
  isElderlyCaution: boolean;
} => {
  const result: {
    minAge?: number;
    maxAge?: number;
    restrictedAges: number[];
    warnings: string[];
    isPregnantContraindicated: boolean;
    isElderlyCaution: boolean;
  } = {
    restrictedAges: [] as number[],
    warnings: [] as string[],
    isPregnantContraindicated: false,
    isElderlyCaution: false
  };

  // 🔥 precautions가 없거나 빈 값인 경우
  if (!precautions) return result;

  // 🔥 배열인 경우 첫 번째 요소 사용, 없으면 빈 문자열
  let precautionsText: string;
  if (Array.isArray(precautions)) {
    precautionsText = precautions.length > 0 ? String(precautions[0]) : '';
  } else {
    precautionsText = String(precautions);
  }

  // 🔥 빈 문자열이면 반환
  if (!precautionsText || precautionsText.trim() === '') return result;

  const lowerPrecautions = precautionsText.toLowerCase();

  // 영아/신생아 제한
  if (lowerPrecautions.includes('영아') || lowerPrecautions.includes('신생아') || 
      lowerPrecautions.includes('만 3개월') || lowerPrecautions.includes('3개월 미만')) {
    result.restrictedAges.push(0, 1, 2);
    result.warnings.push('영아(0-2세) 복용 금지');
  }

  // 유아 제한
  if (lowerPrecautions.includes('만 2세') || lowerPrecautions.includes('2세 미만')) {
    result.restrictedAges.push(0, 1);
    result.warnings.push('2세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 3세') || lowerPrecautions.includes('3세 미만')) {
    result.restrictedAges.push(0, 1, 2);
    result.warnings.push('3세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 4세') || lowerPrecautions.includes('4세 미만')) {
    result.restrictedAges.push(0, 1, 2, 3);
    result.warnings.push('4세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 6세') || lowerPrecautions.includes('6세 미만')) {
    result.restrictedAges.push(0, 1, 2, 3, 4, 5);
    result.warnings.push('6세 미만 복용 금지');
  }

  // 소아 제한
  if (lowerPrecautions.includes('만 7세') || lowerPrecautions.includes('7세 미만')) {
    result.restrictedAges.push(0, 1, 2, 3, 4, 5, 6);
    result.warnings.push('7세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 8세') || lowerPrecautions.includes('8세 미만')) {
    result.restrictedAges.push(0, 1, 2, 3, 4, 5, 6, 7);
    result.warnings.push('8세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 12세') || lowerPrecautions.includes('12세 미만')) {
    result.restrictedAges.push(...Array.from({ length: 12 }, (_, i) => i));
    result.warnings.push('12세 미만 복용 금지');
  }

  // 청소년 제한
  if (lowerPrecautions.includes('만 15세') || lowerPrecautions.includes('15세 미만')) {
    result.restrictedAges.push(...Array.from({ length: 15 }, (_, i) => i));
    result.warnings.push('15세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 16세') || lowerPrecautions.includes('16세 미만')) {
    result.restrictedAges.push(...Array.from({ length: 16 }, (_, i) => i));
    result.warnings.push('16세 미만 복용 금지');
  }
  if (lowerPrecautions.includes('만 18세') || lowerPrecautions.includes('18세 미만') || 
      lowerPrecautions.includes('미성년자')) {
    result.restrictedAges.push(...Array.from({ length: 18 }, (_, i) => i));
    result.warnings.push('18세 미만 복용 금지');
  }

  // 임신/수유 제한
  if (lowerPrecautions.includes('임부 금기') || lowerPrecautions.includes('임신 금기') ||
      lowerPrecautions.includes('임부에 대한 안전성 미확립')) {
    result.isPregnantContraindicated = true;
    result.warnings.push('임신 중 복용 금지');
  }
  if (lowerPrecautions.includes('수유부') || lowerPrecautions.includes('수유 중')) {
    result.warnings.push('수유 중 복용 주의');
  }

  // 고령자 주의
  if (lowerPrecautions.includes('고령자') || lowerPrecautions.includes('노인') ||
      lowerPrecautions.includes('65세 이상') || lowerPrecautions.includes('노인주의')) {
    result.isElderlyCaution = true;
    result.warnings.push('고령자 복용 시 주의 필요');
  }

  // 최소 연령 추출
  if (result.restrictedAges.length > 0) {
    result.minAge = Math.max(...result.restrictedAges) + 1;
  }

  return result;
};

// 향상된 연령 유효성 검사 함수
export const validateMedicineForAge = (
  age: number | null, 
  medicineInfo: any,
  options: {
    strictMode?: boolean;
    includeDetailedWarnings?: boolean;
    checkInteractions?: boolean;
    useMasterData?: boolean; // 🔥 서버 API 데이터 사용 여부
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

  // 🔥 서버 API를 통한 실제 약물 데이터 기반 검증 (선택적)
  if (options.useMasterData && medicineInfo?.name) {
    // 이 부분은 비동기로 처리되어야 하므로 별도 함수로 분리
    // validateMedicineForAgeWithMasterData 함수 사용 권장
  }

  // 특정 약물별 연령 제한 확인
  if (medicineInfo?.name) {
    const medicineName = medicineInfo.name.toLowerCase();
    
    // 약물명에서 주요 성분 찾기
    for (const [ingredient, restriction] of Object.entries(MEDICINE_AGE_RESTRICTIONS)) {
      if (medicineName.includes(ingredient.toLowerCase()) || 
          medicineName.includes(ingredient.replace(/[aeiou]/g, '').toLowerCase())) {
        
        // 최소 연령 확인
        if (age < restriction.minAge) {
          result.isValid = false;
          result.adjustedDose = 0;
          result.allowedToTake = false;
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

    // 🔥 주의사항 필드에서 연령 제한 정보 추출
    if (medicineInfo.precautions || medicineInfo.IFTKN_ATNT_MATR_CN || medicineInfo.atpnQesitm) {
      // 🔥 precautions가 배열인 경우 문자열로 변환
      let precautionsText: string | string[] | undefined = medicineInfo.precautions || medicineInfo.IFTKN_ATNT_MATR_CN || medicineInfo.atpnQesitm;
      
      // 🔥 배열인 경우 첫 번째 요소 사용
      if (Array.isArray(precautionsText)) {
        precautionsText = precautionsText.length > 0 ? precautionsText[0] : '';
      }
      
      // 🔥 문자열로 변환 (undefined나 null인 경우 빈 문자열)
      const precautionsString = precautionsText || '';
      const ageRestrictions = extractAgeRestrictionsFromPrecautions(precautionsString);
      
      // 추출된 연령 제한 적용
      if (ageRestrictions.minAge && age < ageRestrictions.minAge) {
        result.isValid = false;
        result.adjustedDose = 0;
        result.allowedToTake = false;
        result.errors.push(...ageRestrictions.warnings);
      } else if (ageRestrictions.restrictedAges.includes(age)) {
        result.isValid = false;
        result.adjustedDose = 0;
        result.allowedToTake = false;
        result.errors.push(...ageRestrictions.warnings);
      } else if (ageRestrictions.warnings.length > 0) {
        result.warnings.push(...ageRestrictions.warnings);
      }

      // 임신/수유 제한
      if (ageRestrictions.isPregnantContraindicated) {
        result.warnings.push('임신 중 복용 금지');
      }

      // 고령자 주의
      if (ageRestrictions.isElderlyCaution && age >= 65) {
        result.warnings.push('고령자는 용량 조절이 필요할 수 있습니다.');
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
    guidelines.push('보호자의 지도 하에 복용');
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

/**
 * 🔥 서버 API를 통한 실제 약물 데이터 기반 연령 검증 (비동기)
 */
export const validateMedicineForAgeWithMasterData = async (
  age: number | null,
  medicineName: string,
  options: {
    strictMode?: boolean;
    includeDetailedWarnings?: boolean;
  } = {}
): Promise<AgeValidationResult> => {
  const result: AgeValidationResult = {
    age,
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

  if (age === null) {
    result.isValid = false;
    result.warnings.push('나이 정보가 없어 안전한 복용량을 계산할 수 없습니다.');
    result.errors.push('사용자 나이 정보 필요');
    result.adjustedDose = 0;
    result.allowedToTake = false;
    return result;
  }

  try {
    // 🔥 서버 API에서 약물 정보 조회
    const { findMedicineMasterByName, findTabletMasterByName } = await import('../api/medicineMaster');
    
    const [medicineData, tabletData] = await Promise.all([
      findMedicineMasterByName(medicineName),
      findTabletMasterByName(medicineName)
    ]);

    const masterData = medicineData || tabletData;

    if (masterData) {
      // 🔥 주의사항에서 연령 제한 정보 추출
      const precautions = masterData.precautions || '';
      const ageRestrictions = extractAgeRestrictionsFromPrecautions(precautions);

      // 연령 제한 적용
      if (ageRestrictions.minAge && age < ageRestrictions.minAge) {
        result.isValid = false;
        result.adjustedDose = 0;
        result.allowedToTake = false;
        result.contraindicatedAge = true;
        result.errors.push(...ageRestrictions.warnings);
        result.errors.push(`${ageRestrictions.minAge}세 이상만 복용 가능합니다.`);
      } else if (ageRestrictions.restrictedAges.includes(age)) {
        result.isValid = false;
        result.adjustedDose = 0;
        result.allowedToTake = false;
        result.contraindicatedAge = true;
        result.errors.push(...ageRestrictions.warnings);
      } else {
        // 경고만 추가
        if (ageRestrictions.warnings.length > 0) {
          result.warnings.push(...ageRestrictions.warnings);
        }
      }

      // 임신/수유 제한
      if (ageRestrictions.isPregnantContraindicated) {
        result.warnings.push('임신 중 복용 금지');
      }

      // 고령자 주의
      if (ageRestrictions.isElderlyCaution && age >= 65) {
        result.warnings.push('고령자는 용량 조절이 필요할 수 있습니다.');
        result.dosageMultiplier = 0.75; // 고령자는 75% 용량 권장
        result.adjustedDose = 0.75;
      }
    }

    // 기본 연령대별 용량 조정 (마스터 데이터가 없어도 적용)
    if (age < 2) {
      result.adjustedDose = AGE_DOSE_MULTIPLIER.INFANT;
      if (!result.contraindicatedAge) {
        result.isValid = false;
        result.errors.push('영아기(0-2세)에는 대부분의 약물 복용이 금지됩니다.');
        result.errors.push('반드시 소아과 전문의와 상담 후 복용하세요.');
        result.allowedToTake = false;
        result.contraindicatedAge = true;
      }
    } else if (age < 7) {
      result.adjustedDose = AGE_DOSE_MULTIPLIER.TODDLER;
      if (!result.contraindicatedAge) {
        result.warnings.push('유아기에는 성인 용량의 25%로 복용하세요.');
        result.warnings.push('소아과 전문의와 상담을 권장합니다.');
      }
    } else if (age <= 14) {
      result.adjustedDose = AGE_DOSE_MULTIPLIER.CHILD;
      result.isChild = true;
      if (!result.contraindicatedAge) {
        result.warnings.push('아동기에는 성인 용량의 50%로 복용하세요.');
        result.warnings.push('체중을 고려한 용량 조절이 필요할 수 있습니다.');
      }
    } else if (age <= 19) {
      result.adjustedDose = AGE_DOSE_MULTIPLIER.TEEN;
      result.requiresParentalSupervision = true;
      if (!result.contraindicatedAge) {
        result.warnings.push('청소년기에는 성인 용량의 75%로 복용하세요.');
        result.warnings.push('개인차가 클 수 있으므로 주의 깊게 관찰하세요.');
      }
    }

    // 특정 약물별 연령 제한 확인
    const medicineNameLower = medicineName.toLowerCase();
    for (const [ingredient, restriction] of Object.entries(MEDICINE_AGE_RESTRICTIONS)) {
      if (medicineNameLower.includes(ingredient.toLowerCase())) {
        if (age < restriction.minAge) {
          result.isValid = false;
          result.adjustedDose = 0;
          result.allowedToTake = false;
          result.contraindicatedAge = true;
          result.errors.push(...restriction.restrictions);
        } else if (restriction.warningAge && age < restriction.warningAge) {
          result.warnings.push(`${restriction.warningAge}세 미만은 특별한 주의가 필요합니다.`);
        }
        
        if (restriction.specialNotes && options.includeDetailedWarnings) {
          result.warnings.push(...restriction.specialNotes);
        }
        break;
      }
    }

    // 추가 안전 검사
    if (options.strictMode) {
      if (age < 6 && result.isValid) {
        result.warnings.push('6세 미만은 특히 주의 깊은 관찰이 필요합니다.');
        result.warnings.push('복용 중 이상 증상 시 즉시 중단하고 의사와 상담하세요.');
      }
      
      if (age >= 65 && !masterData) {
        result.warnings.push('고령자는 약물 대사가 느려질 수 있어 주의가 필요합니다.');
        result.warnings.push('다른 복용 중인 약물과의 상호작용을 확인하세요.');
      }
    }

    // 최종 유효성 결정
    result.isValid = result.errors.length === 0;

    return result;
  } catch (error) {
    console.error('🔥 [validateMedicineForAgeWithMasterData] 검증 실패:', error);
    // 에러 발생 시 기본 검증 결과 반환
    return validateMedicineForAge(age, { name: medicineName }, options);
  }
}; 