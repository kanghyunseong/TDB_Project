# JSON 데이터 정리 스크립트 📋

tablet.json과 medicine.json 파일의 비정상적인 패턴들을 자동으로 찾아서 정리하는 도구입니다.

## 🔍 발견되는 문제 패턴들

### 1. 뜬금없는 물음표
```
"수유부,?만 7세 이하의 어린이"  →  "수유부, 만 7세 이하의 어린이"
"알코올, 중추신경억제제, 페니토인을?함께"  →  "알코올, 중추신경억제제, 페니토인을 함께"
```

### 2. 전각 문자
```
"｛덱스트린 71.6 %｝"  →  "{덱스트린 71.6 %}"
"（발효강황분（강황분, 사과농축액, 유산균）)"  →  "(발효강황분(강황분, 사과농축액, 유산균))"
```

### 3. 특수 로마숫자
```
"닥터헬스청Ⅰ"  →  "닥터헬스청I"
"혈당케어-Ⅳ"  →  "혈당케어-IV"
```

### 4. 아래첨자/위첨자
```
"비타민B₁염산염"  →  "비타민B1염산염"
"비타민B₂"  →  "비타민B2"
```

### 5. 특수 공백 문자
- BOM 문자 (﻿)
- 전각 공백 및 기타 유니코드 공백 문자들
- 연속된 공백들

## 🚀 사용법

### 1. 패턴 분석만 하기 (수정하지 않고 문제점만 확인)
```bash
npm run analyze-data
```

### 2. 전체 정리 작업 (분석 + 정리 + 백업)
```bash
npm run clean-data
```

## 📂 생성되는 파일들

### 정리 작업 후 생성되는 파일들:
- `tablet_cleaned.json` - 정리된 tablet.json
- `medicine_cleaned.json` - 정리된 medicine.json
- `tablet_backup_YYYY-MM-DDTHH-MM-SS.json` - 원본 백업
- `medicine_backup_YYYY-MM-DDTHH-MM-SS.json` - 원본 백업

## 🔄 작업 프로세스

1. **분석 단계**: 비정상적인 패턴들을 찾아서 보고
2. **백업 단계**: 원본 파일들을 타임스탬프와 함께 백업
3. **정리 단계**: 모든 패턴을 정리해서 `_cleaned.json` 파일로 저장
4. **검증 단계**: 파일 크기 비교 및 결과 확인

## ⚠️ 주의사항

### 작업 전 확인사항:
- [ ] 원본 파일이 존재하는지 확인
- [ ] 충분한 디스크 공간이 있는지 확인 (백업 + 정리본 저장)
- [ ] 작업 중 다른 프로세스가 파일을 사용하지 않는지 확인

### 작업 후 검증:
1. `_cleaned.json` 파일들을 열어서 내용 확인
2. 중요한 데이터가 손실되지 않았는지 검증
3. 텍스트가 올바르게 정리되었는지 샘플 확인
4. 문제가 없다면 원본 파일을 교체

## 🔧 고급 사용법

### 개별 파일만 정리하기:
```javascript
const { cleanJsonFile } = require('./scripts/cleanJsonData.js');

// tablet.json만 정리
await cleanJsonFile('./src/assets/tablet.json', './src/assets/tablet_cleaned.json');
```

### 특정 패턴만 적용하기:
```javascript
const { cleanText, CLEANUP_PATTERNS } = require('./scripts/cleanJsonData.js');

// 물음표 패턴만 제거
const textWithoutQuestionMarks = cleanText(originalText);
```

### 새로운 패턴 추가하기:
`cleanJsonData.js`의 `CLEANUP_PATTERNS` 배열에 새로운 패턴을 추가할 수 있습니다:

```javascript
{
  pattern: /새로운패턴/g,
  replacement: '교체할텍스트',
  description: '패턴 설명'
}
```

## 📊 통계 정보

정리 작업 완료 후 다음 정보들이 표시됩니다:
- 처리된 파일 경로
- 원본 파일 크기 vs 정리된 파일 크기
- 발견된 문제 패턴 개수 및 유형별 통계

## 🛠️ 문제 해결

### 메모리 부족 에러가 발생하는 경우:
Node.js 메모리 제한을 늘려서 실행:
```bash
node --max-old-space-size=4096 scripts/cleanJsonData.js
```

### 특정 패턴이 제대로 정리되지 않는 경우:
1. `CLEANUP_PATTERNS`에서 해당 패턴의 정규식 확인
2. 테스트 케이스 추가
3. 패턴 수정 후 다시 실행

### 백업 파일이 너무 많이 쌓이는 경우:
정리 작업이 성공적으로 완료된 후 오래된 백업 파일들을 수동으로 삭제하세요.

## 📝 로그 예시

```
🚀 JSON 데이터 정리 스크립트 시작

=== 1단계: 패턴 분석 ===
🔍 패턴 분석 중: /src/assets/tablet.json
📋 발견된 문제 패턴: 247개

🔸 뜬금없는 물음표: 89개
   경로: [1234].RAWMTRL_NM
   패턴: ?%
   미리보기: L.plantarum1.5%,L.casei1.5%,B. longum?%,B. lactis?%...

🔸 특수 로마숫자: 158개
   경로: [5678].PRDLST_NM  
   패턴: Ⅰ, Ⅱ
   미리보기: 닥터헬스청Ⅰ...

=== 2단계: 데이터 정리 ===
💾 백업 생성: tablet_backup_2024-12-19T10-30-45.json
📂 파일 읽는 중: /src/assets/tablet.json
🔍 JSON 파싱 중...
🧹 데이터 정리 중...
💾 정리된 파일 저장 중...
✅ 정리 완료: /src/assets/tablet_cleaned.json
📊 크기 비교: 2847KB → 2831KB

✅ 모든 작업 완료!
``` 