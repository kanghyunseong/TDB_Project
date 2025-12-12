# 🔧 마스터 테이블 중복 데이터 수정 가이드

## 문제 상황
`medicine_master`와 `tablet_master` 테이블에 같은 데이터가 들어간 경우

## 원인 분석

### 가능한 원인들:
1. **JSON 파일 문제**: `medicine.json`과 `tablet.json` 파일이 같은 데이터를 포함
2. **스크립트 실행 오류**: 같은 JSON 파일을 두 테이블에 모두 삽입
3. **데이터 소스 오류**: 공공데이터 API에서 잘못된 데이터를 받아옴

## 해결 방법

### 1단계: 현재 상태 확인

```sql
-- 각 테이블의 데이터 개수 확인
SELECT 'medicine_master' as table_name, COUNT(*) as count FROM medicine_master
UNION ALL
SELECT 'tablet_master' as table_name, COUNT(*) as count FROM tablet_master;

-- 중복된 report_no 확인
SELECT 
    m.report_no,
    m.name as medicine_name,
    t.name as tablet_name
FROM medicine_master m
INNER JOIN tablet_master t ON m.report_no = t.report_no
LIMIT 20;
```

### 2단계: 백업 생성

```bash
# 데이터베이스 백업
mysqldump -u [username] -p tdb medicine_master tablet_master > backup_master_tables_$(date +%Y%m%d_%H%M%S).sql
```

### 3단계: JSON 파일 확인

```bash
# medicine.json과 tablet.json 파일이 다른 데이터인지 확인
# 파일 경로: src/assets/medicine.json, src/assets/tablet.json

# 샘플 데이터 확인 (처음 5개 항목)
head -n 20 src/assets/medicine.json
head -n 20 src/assets/tablet.json
```

**확인 사항:**
- `medicine.json`: 의약품 데이터여야 함 (예: 타이레놀, 아스피린 등)
- `tablet.json`: 건강기능식품 데이터여야 함 (예: 비타민, 영양제 등)
- 두 파일의 `PRDLST_REPORT_NO`가 서로 달라야 함

### 4단계: 데이터 정리

#### 옵션 A: tablet_master만 비우기 (의약품 데이터가 잘못 들어간 경우)

```sql
USE tdb;
TRUNCATE TABLE tablet_master;
```

#### 옵션 B: medicine_master만 비우기 (영양제 데이터가 잘못 들어간 경우)

```sql
USE tdb;
TRUNCATE TABLE medicine_master;
```

#### 옵션 C: 중복된 데이터만 삭제 (더 안전)

```sql
USE tdb;

-- tablet_master에서 medicine_master와 중복된 데이터 삭제
DELETE FROM tablet_master 
WHERE report_no IN (
    SELECT report_no FROM medicine_master
);

-- 또는 medicine_master에서 tablet_master와 중복된 데이터 삭제
DELETE FROM medicine_master 
WHERE report_no IN (
    SELECT report_no FROM tablet_master
);
```

### 5단계: 올바른 데이터 재삽입

#### JSON 파일이 올바른지 확인 후:

```bash
# Python 스크립트 실행
python3 scripts/insert_master_data.py
```

**주의사항:**
- `medicine.json` 파일이 의약품 데이터인지 확인
- `tablet.json` 파일이 건강기능식품 데이터인지 확인
- 두 파일이 서로 다른 데이터 소스에서 왔는지 확인

### 6단계: 검증

```sql
-- 각 테이블의 데이터 개수 확인
SELECT 'medicine_master' as table_name, COUNT(*) as count FROM medicine_master
UNION ALL
SELECT 'tablet_master' as table_name, COUNT(*) as count FROM tablet_master;

-- 중복 확인 (결과가 없어야 함)
SELECT COUNT(*) as duplicate_count
FROM medicine_master m
INNER JOIN tablet_master t ON m.report_no = t.report_no;

-- 샘플 데이터 확인
SELECT name, company_name FROM medicine_master LIMIT 5;
SELECT name, company_name FROM tablet_master LIMIT 5;
```

## 예방 방법

1. **데이터 소스 확인**: 공공데이터 API에서 데이터를 가져올 때 올바른 카테고리 선택
2. **JSON 파일 검증**: 삽입 전에 JSON 파일의 내용 확인
3. **스크립트 실행 전 확인**: 어떤 파일을 어떤 테이블에 삽입하는지 명확히 확인

## 추가 확인 사항

### 공공데이터 API 확인
- 의약품 API와 건강기능식품 API가 서로 다른 엔드포인트를 사용하는지 확인
- API 응답 데이터의 카테고리가 올바른지 확인

### 데이터 소스 확인
- `medicine.json` 파일이 의약품 공공데이터에서 왔는지 확인
- `tablet.json` 파일이 건강기능식품 공공데이터에서 왔는지 확인

