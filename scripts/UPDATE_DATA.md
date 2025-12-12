# JSON 데이터 업데이트 가이드 📋

이 프로젝트는 약물 및 영양제 데이터를 로컬 JSON 파일로 관리합니다. 최신 데이터로 업데이트하는 방법을 안내합니다.

## 📁 데이터 파일 위치

- `src/assets/medicine.json` - 의약품 데이터
- `src/assets/tablet.json` - 건강기능식품 데이터

## 🚀 업데이트 방법

### 방법 1: npm 스크립트 사용 (권장)

```bash
# 건강기능식품 데이터만 업데이트
npm run update-tablet

# 의약품 데이터만 업데이트
npm run update-medicine

# 모든 데이터 업데이트
npm run update-all
```

### 방법 2: Python 스크립트 직접 실행

```bash
# 건강기능식품 데이터 업데이트
python3 scripts/fetch_tablet_data.py

# 의약품 데이터 업데이트
python3 scripts/fetch_medicine_data.py
```

## 📊 현재 데이터 상태

### tablet.json (건강기능식품)
- **서비스 ID**: `C003`
- **API 최신 데이터**: 약 43,744개
- **로컬 파일**: 약 41,255개
- **차이**: 약 2,489개 부족 (5.7%)

### medicine.json (의약품)
- **서비스 ID**: 확인 필요 ⚠️
- **로컬 파일**: 약 4,797개
- **주의**: 현재 `C003`은 건강기능식품 데이터를 반환합니다. 의약품 낱알식별정보의 정확한 서비스 ID 확인이 필요합니다.

## 🔄 업데이트 프로세스

1. **백업 생성**: 기존 파일을 타임스탬프와 함께 백업합니다
   - 예: `tablet_backup_20250108_143022.json`

2. **API에서 데이터 다운로드**: 식품의약품안전처 공공데이터 API에서 최신 데이터를 가져옵니다

3. **JSON 파일 저장**: `src/assets/` 폴더에 저장합니다

4. **검증**: 파일 크기와 데이터 개수를 확인합니다

## ⚙️ 자동 업데이트 설정 (선택사항)

### GitHub Actions 사용

`.github/workflows/update-data.yml` 파일을 생성하여 주기적으로 업데이트할 수 있습니다:

```yaml
name: Update JSON Data

on:
  schedule:
    - cron: '0 0 * * 0'  # 매주 일요일 자정
  workflow_dispatch:  # 수동 실행 가능

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install requests
      - name: Update tablet data
        run: python3 scripts/fetch_tablet_data.py
      - name: Update medicine data
        run: python3 scripts/fetch_medicine_data.py
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/assets/*.json
          git commit -m "Update JSON data" || exit 0
          git push
```

### 로컬 cron 작업 설정 (macOS/Linux)

```bash
# 매주 일요일 오전 2시에 자동 업데이트
0 2 * * 0 cd /path/to/TDB_Project && npm run update-all
```

## ⚠️ 주의사항

1. **Python 의존성 설치**: 
   ```bash
   # requests 모듈 설치 (필수)
   python3 -m pip install requests --user
   
   # 또는 pip3 사용
   pip3 install requests
   ```

2. **API 키 확인**: `scripts/fetch_*.py` 파일의 `API_KEY`가 유효한지 확인하세요

3. **서비스 ID 확인**: 의약품 데이터의 경우 정확한 서비스 ID 확인이 필요합니다

4. **백업 확인**: 업데이트 전에 백업 파일이 생성되었는지 확인하세요

5. **테스트**: 업데이트 후 앱이 정상 작동하는지 테스트하세요

## 🔍 데이터 검증

업데이트 후 데이터를 검증하려면:

```bash
# 데이터 패턴 분석
npm run analyze-data

# 데이터 정리 (필요시)
npm run clean-data
```

## 📞 문제 해결

### API 요청 실패
- API 키가 유효한지 확인
- 네트워크 연결 확인
- API 서비스 상태 확인

### 필드 구조 불일치
- 서비스 ID가 올바른지 확인
- API 문서 확인
- 로컬 파일과 API 응답의 필드 구조 비교

### 메모리 부족
- 대용량 파일 처리 시 메모리 부족 발생 가능
- 배치 크기 조정 (`BATCH_SIZE` 변수 수정)

## 📝 업데이트 이력

업데이트할 때마다 다음 정보를 기록하는 것을 권장합니다:
- 업데이트 날짜
- 데이터 개수 변화
- 주요 변경사항

