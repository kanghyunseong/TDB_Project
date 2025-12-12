# 뷰 설계 이유 설명

## 🤔 왜 `medicine_master`와 `tablet_master`를 분리하고 뷰로 통합했을까?

### 현재 구조
```
medicine_master (의약품 테이블)
    ↓
    └─ UNION ALL ─→ medicine_search_view (통합 뷰)
tablet_master (건강기능식품 테이블)
```

---

## ✅ 분리 설계의 장점

### 1. **법적/제도적 분리**
- **의약품**: 식약처의 의약품 관리 체계
- **건강기능식품**: 식약처의 건강기능식품 관리 체계
- 서로 다른 법적 분류와 규제를 따름
- 각각 다른 API 엔드포인트에서 데이터를 받아옴

### 2. **데이터 소스의 독립성**
```sql
-- 의약품: 공공데이터 API의 C003 서비스 (의약품 데이터)
-- 건강기능식품: 공공데이터 API의 C003 서비스 (건강기능식품 데이터)
```
- 각각 다른 업데이트 주기
- 각각 다른 데이터 형식이나 필드가 추가될 수 있음

### 3. **성능 최적화**
```sql
-- 각 테이블에 독립적인 인덱스
medicine_master: idx_name, idx_fulltext_name
tablet_master: idx_name, idx_fulltext_name
```
- **의약품만 검색**할 때**: `medicine_master`만 조회 → 빠름
- **건강기능식품만 검색**할 때: `tablet_master`만 조회 → 빠름
- **통합 검색**이 필요할 때만: `medicine_search_view` 사용

### 4. **유지보수 용이성**
- 의약품 테이블에만 필요한 필드 추가 가능
- 건강기능식품 테이블에만 필요한 필드 추가 가능
- 각 테이블의 스키마 변경이 서로 영향을 주지 않음

### 5. **확장성**
```sql
-- 나중에 의약품에만 필요한 필드 추가 예시
ALTER TABLE medicine_master 
ADD COLUMN prescription_required BOOLEAN DEFAULT FALSE;

-- 건강기능식품에만 필요한 필드 추가 예시
ALTER TABLE tablet_master 
ADD COLUMN health_claim TEXT;
```
- 각 테이블에 고유한 필드를 추가하기 쉬움
- 통합 테이블이었다면 많은 NULL 값이 생김

### 6. **데이터 무결성**
- 각 테이블의 제약조건을 독립적으로 설정 가능
- `report_no`가 중복될 가능성 제거 (의약품과 건강기능식품은 다른 번호 체계)

---

## 🔄 뷰를 사용하는 이유

### 1. **논리적 통합**
```sql
-- 통합 검색이 필요할 때
SELECT * FROM medicine_search_view WHERE name LIKE '%비타민%';
```
- 물리적으로는 분리되어 있지만, 논리적으로는 하나처럼 사용 가능
- 검색 시 두 테이블을 자동으로 합쳐서 반환

### 2. **유연성**
```sql
-- 의약품만 검색
SELECT * FROM medicine_master WHERE name LIKE '%타이레놀%';

-- 건강기능식품만 검색
SELECT * FROM tablet_master WHERE name LIKE '%비타민%';

-- 통합 검색
SELECT * FROM medicine_search_view WHERE name LIKE '%비타민%';
```
- 필요에 따라 개별 테이블 또는 뷰를 선택적으로 사용 가능

### 3. **타입 구분**
```sql
SELECT 
  type,  -- 'medicine' 또는 'tablet'
  name,
  company_name
FROM medicine_search_view
WHERE name LIKE '%비타민%';
```
- 뷰에서 `type` 컬럼으로 의약품인지 건강기능식품인지 구분 가능

---

## ❌ 통합 테이블로 만들면 생기는 문제

### 1. **NULL 값 증가**
```sql
-- 통합 테이블이라면
CREATE TABLE master_product (
  report_no VARCHAR(50),
  name VARCHAR(200),
  type ENUM('medicine', 'tablet'),  -- 타입 구분 컬럼 필요
  -- 의약품에만 필요한 필드들
  prescription_required BOOLEAN,  -- 건강기능식품은 항상 NULL
  -- 건강기능식품에만 필요한 필드들
  health_claim TEXT,  -- 의약품은 항상 NULL
  ...
);
```
- 많은 NULL 값으로 인한 저장 공간 낭비
- 데이터 무결성 검증이 복잡해짐

### 2. **인덱스 관리 복잡**
- 통합 테이블에서는 타입별로 다른 인덱스 전략이 필요
- 검색 성능이 저하될 수 있음

### 3. **확장성 제한**
- 새로운 제품 유형 추가 시 스키마 변경이 복잡
- 각 타입별 고유 필드 추가가 어려움

---

## 📊 실제 사용 예시

### 시나리오 1: 의약품만 검색
```sql
-- 빠른 검색 (medicine_master만 조회)
SELECT * FROM medicine_master 
WHERE name LIKE '%타이레놀%' 
LIMIT 20;
```

### 시나리오 2: 건강기능식품만 검색
```sql
-- 빠른 검색 (tablet_master만 조회)
SELECT * FROM tablet_master 
WHERE name LIKE '%비타민%' 
LIMIT 20;
```

### 시나리오 3: 통합 검색
```sql
-- 두 테이블 모두 검색 (뷰 사용)
SELECT * FROM medicine_search_view 
WHERE name LIKE '%비타민%' 
ORDER BY type, name
LIMIT 20;
```

---

## 🎯 결론

**분리 설계 + 뷰 통합**의 장점:
1. ✅ **성능**: 개별 검색 시 빠름
2. ✅ **유지보수**: 각 테이블 독립적 관리
3. ✅ **확장성**: 타입별 고유 필드 추가 용이
4. ✅ **유연성**: 필요에 따라 개별/통합 검색 선택 가능
5. ✅ **데이터 무결성**: 타입별 제약조건 독립 설정

**뷰는 "논리적 통합"을 위한 도구**이며, 물리적 분리는 유지하면서도 사용자에게는 통합된 인터페이스를 제공합니다.

