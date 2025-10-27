const fs = require('fs');
const path = require('path');

/**
 * JSON 데이터 정리 스크립트
 * tablet.json과 medicine.json의 비정상적인 패턴을 제거합니다.
 */

// 정리할 패턴들
const CLEANUP_PATTERNS = [
  // 1. 뜬금없는 물음표 제거 (단어 사이)
  {
    pattern: /([가-힣A-Za-z0-9])\?([가-힣A-Za-z0-9])/g,
    replacement: '$1$2',
    description: '단어 사이 물음표 제거'
  },
  
  // 1-2. 공백과 물음표 사이 물음표 제거
  {
    pattern: /([가-힣A-Za-z0-9,])\?\s*([가-힣A-Za-z0-9])/g,
    replacement: '$1 $2',
    description: '단어와 공백 사이 물음표 제거'
  },
  
  // 1-3. 구두점 뒤 물음표 제거
  {
    pattern: /([,])\?([가-힣A-Za-z0-9])/g,
    replacement: '$1 $2',
    description: '쉼표 뒤 물음표 제거'
  },
  
  // 2. 끝에 있는 물음표 제거 (문장 끝이 아닌 경우)
  {
    pattern: /([^\.!?])\?$/g,
    replacement: '$1',
    description: '문장 끝이 아닌 물음표 제거'
  },
  
  // 2-2. 줄 중간의 단독 물음표 제거
  {
    pattern: /\s\?\s/g,
    replacement: ' ',
    description: '공백 사이 단독 물음표 제거'
  },
  
  // 2-3. 문장 시작 부분의 물음표 제거
  {
    pattern: /^\?([가-힣A-Za-z])/gm,
    replacement: '$1',
    description: '문장 시작 물음표 제거'
  },
  
  // 2-4. 줄바꿈 후 물음표 제거
  {
    pattern: /\n\?([가-힣A-Za-z])/g,
    replacement: '\n$1',
    description: '줄바꿈 후 물음표 제거'
  },
  
  // 2-5. 문장 사이 물음표 제거 (마침표 뒤 물음표)
  {
    pattern: /\.\?([가-힣A-Za-z])/g,
    replacement: '.$1',
    description: '문장 사이 물음표 제거'
  },

  // ========== 가독성 향상을 위한 줄바꿈 ==========
  
  // 10-1. 성인/소아 용법 구분 줄바꿈
  {
    pattern: /\.(성인은?|소아는?|어린이는?|11~14세는?|7~10세는?|3~6세는?|1~2세는?)/g,
    replacement: '.\n$1',
    description: '연령별 용법 구분 줄바꿈'
  },
  
  // 10-2. 주요 용법 구분 줄바꿈
  {
    pattern: /\.(1일|권장용량|정해진 용법|체중이|공복시|편두통)/g,
    replacement: '.\n$1',
    description: '주요 용법 구분 줄바꿈'
  },
  
  // 10-3. 주의사항 구분 줄바꿈  
  {
    pattern: /\.(주의사항|부작용|금기사항|상호작용|보관방법)/g,
    replacement: '.\n$1',
    description: '주의사항 구분 줄바꿈'
  },
  
  // 10-4. 일반적인 마침표 뒤 줄바꿈 (가독성 향상)
  {
    pattern: /\.([가-힣A-Za-z])/g,
    replacement: '.\n$1',
    description: '마침표 뒤 일반 줄바꿈'
  },
  
  // 3. 전각 문자 정리
  {
    pattern: /｛/g,
    replacement: '{',
    description: '전각 중괄호 열기'
  },
  {
    pattern: /｝/g,
    replacement: '}',
    description: '전각 중괄호 닫기'
  },
  {
    pattern: /（/g,
    replacement: '(',
    description: '전각 소괄호 열기'
  },
  {
    pattern: /）/g,
    replacement: ')',
    description: '전각 소괄호 닫기'
  },
  
  // 4. 로마숫자 통일
  {
    pattern: /Ⅰ/g,
    replacement: 'I',
    description: '로마숫자 I 통일'
  },
  {
    pattern: /Ⅱ/g,
    replacement: 'II',
    description: '로마숫자 II 통일'
  },
  {
    pattern: /Ⅲ/g,
    replacement: 'III',
    description: '로마숫자 III 통일'
  },
  {
    pattern: /Ⅳ/g,
    replacement: 'IV',
    description: '로마숫자 IV 통일'
  },
  
  // 5. 특수문자 정리
  {
    pattern: /﻿/g,
    replacement: '',
    description: 'BOM 문자 제거'
  },
  {
    pattern: /，/g,
    replacement: ',',
    description: '전각 쉼표 반각으로 변경'
  },
  {
    pattern: /．/g,
    replacement: '.',
    description: '전각 마침표 반각으로 변경'
  },
  
  // 6. 특수한 공백 문자 정리
  {
    pattern: /[\u00A0\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/g,
    replacement: ' ',
    description: '특수 공백 문자 정리'
  },
  
  // 7. 아래첨자/위첨자 숫자 정리 (필요시)
  {
    pattern: /₁/g,
    replacement: '1',
    description: '아래첨자 1을 일반 숫자로'
  },
  {
    pattern: /₂/g,
    replacement: '2',
    description: '아래첨자 2를 일반 숫자로'
  },
  {
    pattern: /₃/g,
    replacement: '3',
    description: '아래첨자 3을 일반 숫자로'
  },
  
  // 8. 여러 개의 연속된 공백을 하나로
  {
    pattern: /\s{2,}/g,
    replacement: ' ',
    description: '연속된 공백을 하나로'
  },
  
  // 9. 앞뒤 공백 제거 (문자열 값에서)
  {
    pattern: /^\s+|\s+$/g,
    replacement: '',
    description: '앞뒤 공백 제거'
  }
];

/**
 * 문자열을 정리하는 함수
 */
function cleanText(text) {
  if (typeof text !== 'string') return text;
  
  let cleanedText = text;
  
  // 모든 패턴 적용
  CLEANUP_PATTERNS.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern.pattern, pattern.replacement);
  });
  
  return cleanedText;
}

/**
 * 객체 전체를 재귀적으로 정리하는 함수
 */
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item));
  } else if (obj !== null && typeof obj === 'object') {
    const cleanedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedKey = cleanText(key);
      const cleanedValue = cleanObject(value);
      cleanedObj[cleanedKey] = cleanedValue;
    }
    return cleanedObj;
  } else if (typeof obj === 'string') {
    return cleanText(obj);
  }
  return obj;
}

/**
 * JSON 파일을 정리하는 함수
 */
async function cleanJsonFile(inputPath, outputPath) {
  try {
    console.log(`📂 파일 읽는 중: ${inputPath}`);
    
    // 파일 읽기 (스트림으로 큰 파일 처리)
    const data = fs.readFileSync(inputPath, 'utf8');
    
    console.log('🔍 JSON 파싱 중...');
    const jsonData = JSON.parse(data);
    
    console.log('🧹 데이터 정리 중...');
    const cleanedData = cleanObject(jsonData);
    
    console.log('💾 정리된 파일 저장 중...');
    fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2), 'utf8');
    
    console.log(`✅ 정리 완료: ${outputPath}`);
    
    // 통계 출력
    const originalSize = fs.statSync(inputPath).size;
    const cleanedSize = fs.statSync(outputPath).size;
    console.log(`📊 크기 비교: ${Math.round(originalSize/1024)}KB → ${Math.round(cleanedSize/1024)}KB`);
    
  } catch (error) {
    console.error(`❌ 에러 발생 (${inputPath}):`, error.message);
  }
}

/**
 * 비정상적인 패턴을 찾아서 보고하는 함수
 */
function analyzePatterns(inputPath) {
  try {
    console.log(`🔍 패턴 분석 중: ${inputPath}`);
    
    const data = fs.readFileSync(inputPath, 'utf8');
    const jsonData = JSON.parse(data);
    
    const issues = [];
    
    function analyzeValue(value, path = '') {
      if (typeof value === 'string') {
        // 물음표 패턴 체크
        const questionMarkMatches = value.match(/[가-힣A-Za-z0-9]\?[가-힣A-Za-z0-9]/g);
        if (questionMarkMatches) {
          issues.push({
            type: '뜬금없는 물음표',
            path,
            matches: questionMarkMatches,
            preview: value.substring(0, 100)
          });
        }
        
        // 전각 문자 체크
        const fullWidthMatches = value.match(/[｛｝（）]/g);
        if (fullWidthMatches) {
          issues.push({
            type: '전각 문자',
            path,
            matches: fullWidthMatches,
            preview: value.substring(0, 100)
          });
        }
        
        // 특수 로마숫자 체크
        const romanMatches = value.match(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g);
        if (romanMatches) {
          issues.push({
            type: '특수 로마숫자',
            path,
            matches: romanMatches,
            preview: value.substring(0, 100)
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          analyzeValue(item, `${path}[${index}]`);
        });
      } else if (value !== null && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => {
          analyzeValue(val, path ? `${path}.${key}` : key);
        });
      }
    }
    
    analyzeValue(jsonData);
    
    console.log(`📋 발견된 문제 패턴: ${issues.length}개`);
    
    // 타입별로 그룹화
    const groupedIssues = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});
    
    Object.entries(groupedIssues).forEach(([type, typeIssues]) => {
      console.log(`\n🔸 ${type}: ${typeIssues.length}개`);
      // 처음 3개만 샘플로 출력
      typeIssues.slice(0, 3).forEach(issue => {
        console.log(`   경로: ${issue.path}`);
        console.log(`   패턴: ${issue.matches.join(', ')}`);
        console.log(`   미리보기: ${issue.preview}...`);
        console.log('');
      });
      
      if (typeIssues.length > 3) {
        console.log(`   ... 추가 ${typeIssues.length - 3}개 발견됨`);
      }
    });
    
  } catch (error) {
    console.error(`❌ 분석 에러 (${inputPath}):`, error.message);
  }
}

// 메인 실행 함수
async function main() {
  const assetsDir = path.join(__dirname, '../src/assets');
  
  console.log('🚀 JSON 데이터 정리 스크립트 시작\n');
  
  // 1. 패턴 분석
  console.log('=== 1단계: 패턴 분석 ===');
  analyzePatterns(path.join(assetsDir, 'tablet.json'));
  analyzePatterns(path.join(assetsDir, 'medicine.json'));
  
  console.log('\n=== 2단계: 데이터 정리 ===');
  
  // 2. 백업 생성
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const tabletBackup = path.join(assetsDir, `tablet_backup_${timestamp}.json`);
  const medicineBackup = path.join(assetsDir, `medicine_backup_${timestamp}.json`);
  
  if (fs.existsSync(path.join(assetsDir, 'tablet.json'))) {
    fs.copyFileSync(path.join(assetsDir, 'tablet.json'), tabletBackup);
    console.log(`💾 백업 생성: ${tabletBackup}`);
  }
  
  if (fs.existsSync(path.join(assetsDir, 'medicine.json'))) {
    fs.copyFileSync(path.join(assetsDir, 'medicine.json'), medicineBackup);
    console.log(`💾 백업 생성: ${medicineBackup}`);
  }
  
  // 3. 파일 정리
  await cleanJsonFile(
    path.join(assetsDir, 'tablet.json'), 
    path.join(assetsDir, 'tablet_cleaned.json')
  );
  
  await cleanJsonFile(
    path.join(assetsDir, 'medicine.json'), 
    path.join(assetsDir, 'medicine_cleaned.json')
  );
  
  console.log('\n✅ 모든 작업 완료!');
  console.log('\n📝 다음 단계:');
  console.log('1. tablet_cleaned.json과 medicine_cleaned.json 파일을 확인하세요');
  console.log('2. 정리가 잘 되었다면 원본 파일을 교체하세요');
  console.log('3. 백업 파일은 문제가 없을 때까지 보관하세요');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  cleanText,
  cleanObject,
  cleanJsonFile,
  analyzePatterns,
  CLEANUP_PATTERNS
}; 