# 마스터 테이블 스키마 상세 설명

## 📋 목차
1. [테이블 개요](#테이블-개요)
2. [medicine_master 테이블](#medicine_master-테이블)
3. [tablet_master 테이블](#tablet_master-테이블)
4. [인덱스 전략](#인덱스-전략)
5. [데이터 타입 설명](#데이터-타입-설명)
6. [사용 예시](#사용-예시)

---

## 테이블 개요

### 공통 구조
두 테이블(`medicine_master`, `tablet_master`)은 동일한 스키마를 가지고 있으며, 공공데이터 API에서 받아온 데이터를 저장합니다.

### 데이터 소스
- **의약품**: 식약처 공공데이터 API (C003 서비스)
- **건강기능식품**: 식약처 공공데이터 API (C003 서비스)

---

## medicine_master 테이블

### 테이블 정보
- **테이블명**: `medicine_master`
- **엔진**: InnoDB
- **문자셋**: utf8mb4
- **콜레이션**: utf8mb4_0900_ai_ci
- **용도**: 의약품 마스터 데이터 저장

### 필드 상세 설명

#### 1. 기본 식별 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `report_no` | VARCHAR(50) | NOT NULL | 제품신고번호 (PRDLST_REPORT_NO) - **Primary Key** | "20230101001" |
| `name` | VARCHAR(200) | NOT NULL | 제품명 (PRDLST_NM) | "타이레놀정500mg" |
| `company_name` | VARCHAR(200) | NULL | 업체명 (BSSH_NM) | "한국얀센제약(주)" |
| `license_no` | VARCHAR(50) | NULL | 인허가번호 (LCNS_NO) | "63-1234" |

**설명**:
- `report_no`: 각 제품을 고유하게 식별하는 번호 (Primary Key)
- `name`: 실제 제품명 (검색의 주요 대상)
- `company_name`: 제조/수입 업체명
- `license_no`: 식약처에서 부여한 인허가 번호

#### 2. 제품 형태 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `product_shape` | VARCHAR(50) | NULL | 제품형태 (PRDT_SHAP_CD_NM) | "정제", "캡슐", "시럽" |
| `shape` | VARCHAR(100) | NULL | 형태 (SHAP) | "원형", "타원형" |
| `dispos` | TEXT | NULL | 성상/외형 (DISPOS) | "흰색의 원형 정제" |

**설명**:
- 제품의 물리적 형태와 외관 정보
- 사용자가 약을 식별하는 데 도움

#### 3. 기능 및 사용 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `primary_function` | TEXT | NULL | 주요기능성 (PRIMARY_FNCLTY) | "해열, 진통, 소염" |
| `intake_method` | TEXT | NULL | 섭취방법 (NTK_MTHD) | "성인 1회 1~2정, 1일 3회 식후 복용" |
| `precautions` | TEXT | NULL | 섭취시 주의사항 (IFTKN_ATNT_MATR_CN) | "위장장애, 간기능 이상 시 복용 금지" |

**설명**:
- `primary_function`: 약의 주요 효능/기능
- `intake_method`: 복용 방법 및 용법
- `precautions`: 주의사항 및 부작용 정보

#### 4. 보관 및 유통 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `storage_method` | TEXT | NULL | 보관방법 (CSTDY_MTHD) | "실온 보관, 직사광선 피함" |
| `shelf_life` | VARCHAR(100) | NULL | 유통기한 (POG_DAYCNT) | "제조일로부터 36개월" |

**설명**:
- 약물 보관 및 유통기한 정보
- 사용자에게 보관 방법 안내

#### 5. 원재료 및 규격 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `raw_materials` | TEXT | NULL | 원재료명 (RAWMTRL_NM) | "파라세타몰 500mg" |
| `standard_spec` | TEXT | NULL | 기준규격 (STDR_STND) | "한국약전 제11개정" |

**설명**:
- 약물의 성분 및 규격 정보
- 약물 상호작용 검사 시 사용

#### 6. 날짜 정보

| 필드명 | 타입 | NULL | 설명 | 예시 |
|--------|------|------|------|------|
| `permit_date` | VARCHAR(20) | NULL | 허가일자 (PRMS_DT) | "2023-01-01" |
| `create_date` | VARCHAR(20) | NULL | 생성일시 (CRET_DTM) | "2023-01-01 10:00:00" |
| `last_update_date` | VARCHAR(20) | NULL | 최종수정일시 (LAST_UPDT_DTM) | "2023-12-01 15:30:00" |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | DB 등록일시 | "2024-01-15 09:00:00" |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | DB 수정일시 | "2024-01-15 09:00:00" |

**설명**:
- `permit_date`: 식약처 허가일
- `create_date`, `last_update_date`: API 데이터의 생성/수정일
- `created_at`, `updated_at`: DB에 저장된 시점 (자동 관리)

---

## tablet_master 테이블

### 테이블 정보
- **테이블명**: `tablet_master`
- **엔진**: InnoDB
- **문자셋**: utf8mb4
- **콜레이션**: utf8mb4_0900_ai_ci
- **용도**: 건강기능식품 마스터 데이터 저장

### 필드 구조
`tablet_master`는 `medicine_master`와 **완전히 동일한 스키마**를 가지고 있습니다.

**차이점**:
- 테이블명만 다름
- 저장되는 데이터의 종류가 다름 (의약품 vs 건강기능식품)
- `report_no`는 서로 다른 번호 체계를 사용 (중복 없음)

---

## 인덱스 전략

### Primary Key
```sql
PRIMARY KEY (`report_no`)
```
- **용도**: 각 제품의 고유 식별
- **특징**: NULL 불가, 중복 불가

### B-tree 인덱스

#### 1. `idx_name` (제품명 전체 매칭)
```sql
KEY `idx_name` (`name`(100))
```
- **용도**: 제품명 전체 매칭 검색
- **예시**: `WHERE name = '타이레놀정500mg'`
- **성능**: O(log n)

#### 2. `idx_company` (업체명 검색)
```sql
KEY `idx_company` (`company_name`(100))
```
- **용도**: 업체명으로 검색
- **예시**: `WHERE company_name LIKE '%삼성%'`

#### 3. `idx_name_search` (제품명 부분 검색)
```sql
KEY `idx_name_search` (`name`(50))
```
- **용도**: 제품명 앞 50자만 인덱싱하여 부분 검색 최적화
- **예시**: `WHERE name LIKE '%타이레놀%'`
- **특징**: 앞 50자만 인덱싱하여 저장 공간 절약

### FULLTEXT 인덱스

#### 1. `idx_fulltext_name` (제품명 전문 검색)
```sql
FULLTEXT KEY `idx_fulltext_name` (`name`)
```
- **용도**: 제품명 전문 검색 (한글 형태소 분석)
- **예시**: 
  ```sql
  SELECT * FROM medicine_master 
  WHERE MATCH(name) AGAINST('타이레놀' IN NATURAL LANGUAGE MODE)
  ```
- **장점**: LIKE 검색보다 빠름, 한글 형태소 분석 지원

#### 2. `idx_fulltext_function` (기능성 전문 검색)
```sql
FULLTEXT KEY `idx_fulltext_function` (`primary_function`)
```
- **용도**: 주요 기능성으로 검색
- **예시**: 
  ```sql
  SELECT * FROM medicine_master 
  WHERE MATCH(primary_function) AGAINST('해열 진통' IN NATURAL LANGUAGE MODE)
  ```

---

## 데이터 타입 설명

### VARCHAR vs TEXT

| 타입 | 최대 길이 | 용도 | 예시 필드 |
|------|-----------|------|-----------|
| VARCHAR(50) | 50자 | 짧은 고정 정보 | `report_no`, `license_no` |
| VARCHAR(100) | 100자 | 중간 길이 정보 | `shelf_life`, `shape` |
| VARCHAR(200) | 200자 | 긴 문자열 | `name`, `company_name` |
| TEXT | 65,535자 | 매우 긴 텍스트 | `dispos`, `primary_function`, `intake_method` |

**선택 기준**:
- **VARCHAR**: 길이를 예측할 수 있고, 인덱싱이 필요한 경우
- **TEXT**: 길이를 예측하기 어렵거나, 매우 긴 텍스트인 경우

### DATETIME vs VARCHAR(20)

| 타입 | 용도 | 예시 |
|------|------|------|
| VARCHAR(20) | API에서 받은 원본 날짜 문자열 | `permit_date`, `create_date` |
| DATETIME | DB에서 자동 관리하는 날짜 | `created_at`, `updated_at` |

**차이점**:
- `VARCHAR(20)`: API 원본 데이터 보존
- `DATETIME`: DB 자동 관리 (CURRENT_TIMESTAMP)

---

## 사용 예시

### 1. 제품명으로 검색 (LIKE 검색)
```sql
-- 의약품 검색
SELECT 
  report_no,
  name,
  company_name,
  primary_function
FROM medicine_master
WHERE name LIKE '%타이레놀%'
LIMIT 20;

-- 건강기능식품 검색
SELECT 
  report_no,
  name,
  company_name,
  primary_function
FROM tablet_master
WHERE name LIKE '%비타민%'
LIMIT 20;
```

### 2. 전문 검색 (FULLTEXT - 더 빠름)
```sql
-- 제품명 전문 검색
SELECT 
  report_no,
  name,
  company_name
FROM medicine_master
WHERE MATCH(name) AGAINST('타이레놀' IN NATURAL LANGUAGE MODE)
LIMIT 20;

-- 기능성 전문 검색
SELECT 
  report_no,
  name,
  primary_function
FROM medicine_master
WHERE MATCH(primary_function) AGAINST('해열 진통' IN NATURAL LANGUAGE MODE)
LIMIT 20;
```

### 3. 업체명으로 검색
```sql
SELECT 
  report_no,
  name,
  company_name
FROM medicine_master
WHERE company_name LIKE '%삼성%'
LIMIT 20;
```

### 4. 제품신고번호로 상세 조회
```sql
SELECT *
FROM medicine_master
WHERE report_no = '20230101001';
```

### 5. 복합 조건 검색
```sql
SELECT 
  report_no,
  name,
  company_name,
  primary_function,
  intake_method
FROM medicine_master
WHERE name LIKE '%타이레놀%'
  AND company_name LIKE '%얀센%'
LIMIT 20;
```

### 6. 통합 검색 (뷰 사용)
```sql
-- 의약품 + 건강기능식품 통합 검색
SELECT 
  type,
  report_no,
  name,
  company_name,
  primary_function
FROM medicine_search_view
WHERE name LIKE '%비타민%'
ORDER BY type, name
LIMIT 20;
```

---

## 데이터 흐름

### 1. 데이터 수집
```
공공데이터 API (C003)
    ↓
Python 스크립트 (fetch_medicine_data.py, fetch_tablet_data.py)
    ↓
JSON 파일 (medicine.json, tablet.json)
    ↓
데이터 정제 (cleanJsonData.js)
    ↓
MySQL 데이터베이스 (medicine_master, tablet_master)
```

### 2. 데이터 사용
```
애플리케이션
    ↓
NestJS API (MedicineMasterService)
    ↓
MySQL 쿼리 (인덱스 활용)
    ↓
검색 결과 반환
```

---

## 성능 최적화 팁

### 1. 인덱스 활용
- **LIKE 검색**: `idx_name_search` 활용 (앞부분 매칭)
- **전문 검색**: `idx_fulltext_name` 활용 (MATCH ... AGAINST)
- **정확한 매칭**: `idx_name` 활용 (WHERE name = '...')

### 2. LIMIT 사용
- 항상 `LIMIT`을 사용하여 불필요한 데이터 조회 방지
- 검색 결과는 보통 20~100개면 충분

### 3. 필요한 컬럼만 선택
```sql
-- ❌ 비효율적
SELECT * FROM medicine_master WHERE name LIKE '%타이레놀%';

-- ✅ 효율적
SELECT report_no, name, company_name 
FROM medicine_master 
WHERE name LIKE '%타이레놀%' 
LIMIT 20;
```

---

## 주의사항

### 1. TEXT 타입 인덱싱
- TEXT 타입은 FULLTEXT 인덱스만 가능
- B-tree 인덱스는 VARCHAR에만 적용 가능

### 2. LIKE 검색 성능
- `LIKE '%검색어%'` (앞뒤 와일드카드): 인덱스 미사용, 느림
- `LIKE '검색어%'` (앞부분 매칭): 인덱스 사용, 빠름
- 가능하면 FULLTEXT 검색 사용 권장

### 3. 데이터 업데이트
- `created_at`, `updated_at`는 자동 관리
- API 데이터는 주기적으로 업데이트 필요

---

## 요약

### 테이블 구조
- **2개의 독립적인 테이블**: `medicine_master`, `tablet_master`
- **동일한 스키마**: 19개 필드 (식별, 형태, 기능, 보관, 원재료, 날짜)
- **Primary Key**: `report_no` (제품신고번호)

### 인덱스 전략
- **B-tree 인덱스**: 제품명, 업체명 (빠른 정확 매칭)
- **FULLTEXT 인덱스**: 제품명, 기능성 (빠른 전문 검색)

### 사용 목적
- **의약품 검색**: `medicine_master` 테이블 사용
- **건강기능식품 검색**: `tablet_master` 테이블 사용
- **통합 검색**: `medicine_search_view` 뷰 사용

