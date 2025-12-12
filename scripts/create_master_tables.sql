-- ============================================================
-- 약물 및 영양제 마스터 데이터 테이블 생성
-- 공공데이터 API에서 가져온 전체 데이터를 저장
-- ============================================================

-- 데이터베이스 선택
USE `tdb`;

-- 1. 의약품 마스터 테이블 (medicine.json 데이터)
DROP TABLE IF EXISTS `medicine_master`;

CREATE TABLE `medicine_master` (
  `report_no` varchar(50) NOT NULL COMMENT '제품신고번호 (PRDLST_REPORT_NO)',
  `name` varchar(200) NOT NULL COMMENT '제품명 (PRDLST_NM)',
  `company_name` varchar(200) DEFAULT NULL COMMENT '업체명 (BSSH_NM)',
  `license_no` varchar(50) DEFAULT NULL COMMENT '인허가번호 (LCNS_NO)',
  `product_shape` varchar(50) DEFAULT NULL COMMENT '제품형태 (PRDT_SHAP_CD_NM)',
  `shape` varchar(100) DEFAULT NULL COMMENT '형태 (SHAP)',
  `dispos` text COMMENT '성상/외형 (DISPOS)',
  `primary_function` text COMMENT '주요기능성 (PRIMARY_FNCLTY)',
  `intake_method` text COMMENT '섭취방법 (NTK_MTHD)',
  `precautions` text COMMENT '섭취시 주의사항 (IFTKN_ATNT_MATR_CN)',
  `storage_method` text COMMENT '보관방법 (CSTDY_MTHD)',
  `shelf_life` varchar(100) DEFAULT NULL COMMENT '유통기한 (POG_DAYCNT)',
  `raw_materials` text COMMENT '원재료명 (RAWMTRL_NM)',
  `standard_spec` text COMMENT '기준규격 (STDR_STND)',
  `permit_date` varchar(20) DEFAULT NULL COMMENT '허가일자 (PRMS_DT)',
  `create_date` varchar(20) DEFAULT NULL COMMENT '생성일시 (CRET_DTM)',
  `last_update_date` varchar(20) DEFAULT NULL COMMENT '최종수정일시 (LAST_UPDT_DTM)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'DB 등록일시',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'DB 수정일시',
  PRIMARY KEY (`report_no`),
  KEY `idx_name` (`name`(100)) COMMENT '제품명 검색 인덱스',
  KEY `idx_company` (`company_name`(100)) COMMENT '업체명 검색 인덱스',
  KEY `idx_name_search` (`name`(50)) COMMENT '제품명 부분 검색용',
  FULLTEXT KEY `idx_fulltext_name` (`name`) COMMENT '제품명 전문 검색',
  FULLTEXT KEY `idx_fulltext_function` (`primary_function`) COMMENT '기능성 전문 검색'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='의약품 마스터 데이터 (공공데이터 API)';

-- 2. 건강기능식품 마스터 테이블 (tablet.json 데이터)
DROP TABLE IF EXISTS `tablet_master`;

CREATE TABLE `tablet_master` (
  `report_no` varchar(50) NOT NULL COMMENT '제품신고번호 (PRDLST_REPORT_NO)',
  `name` varchar(200) NOT NULL COMMENT '제품명 (PRDLST_NM)',
  `company_name` varchar(200) DEFAULT NULL COMMENT '업체명 (BSSH_NM)',
  `license_no` varchar(50) DEFAULT NULL COMMENT '인허가번호 (LCNS_NO)',
  `product_shape` varchar(50) DEFAULT NULL COMMENT '제품형태 (PRDT_SHAP_CD_NM)',
  `shape` varchar(100) DEFAULT NULL COMMENT '형태 (SHAP)',
  `dispos` text COMMENT '성상/외형 (DISPOS)',
  `primary_function` text COMMENT '주요기능성 (PRIMARY_FNCLTY)',
  `intake_method` text COMMENT '섭취방법 (NTK_MTHD)',
  `precautions` text COMMENT '섭취시 주의사항 (IFTKN_ATNT_MATR_CN)',
  `storage_method` text COMMENT '보관방법 (CSTDY_MTHD)',
  `shelf_life` varchar(100) DEFAULT NULL COMMENT '유통기한 (POG_DAYCNT)',
  `raw_materials` text COMMENT '원재료명 (RAWMTRL_NM)',
  `standard_spec` text COMMENT '기준규격 (STDR_STND)',
  `permit_date` varchar(20) DEFAULT NULL COMMENT '허가일자 (PRMS_DT)',
  `create_date` varchar(20) DEFAULT NULL COMMENT '생성일시 (CRET_DTM)',
  `last_update_date` varchar(20) DEFAULT NULL COMMENT '최종수정일시 (LAST_UPDT_DTM)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'DB 등록일시',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'DB 수정일시',
  PRIMARY KEY (`report_no`),
  KEY `idx_name` (`name`(100)) COMMENT '제품명 검색 인덱스',
  KEY `idx_company` (`company_name`(100)) COMMENT '업체명 검색 인덱스',
  KEY `idx_name_search` (`name`(50)) COMMENT '제품명 부분 검색용',
  FULLTEXT KEY `idx_fulltext_name` (`name`) COMMENT '제품명 전문 검색',
  FULLTEXT KEY `idx_fulltext_function` (`primary_function`) COMMENT '기능성 전문 검색'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='건강기능식품 마스터 데이터 (공공데이터 API)';

-- ============================================================
-- 인덱스 추가 설명
-- ============================================================
-- idx_name: 제품명 전체 매칭 검색용 (B-tree 인덱스)
-- idx_name_search: 제품명 부분 검색용 (앞 50자 인덱스)
-- idx_fulltext_name: 제품명 전문 검색용 (FULLTEXT 인덱스)
-- idx_fulltext_function: 기능성 전문 검색용 (FULLTEXT 인덱스)
-- idx_company: 업체명 검색용

-- ============================================================
-- 검색 성능 최적화를 위한 뷰 생성 (선택사항)
-- ============================================================

-- 통합 검색 뷰 (의약품 + 건강기능식품)
CREATE OR REPLACE VIEW `medicine_search_view` AS
SELECT 
  'medicine' AS `type`,
  `report_no`,
  `name`,
  `company_name`,
  `primary_function`,
  `intake_method`,
  `precautions`,
  `raw_materials`,
  `product_shape`,
  `created_at`
FROM `medicine_master`
UNION ALL
SELECT 
  'tablet' AS `type`,
  `report_no`,
  `name`,
  `company_name`,
  `primary_function`,
  `intake_method`,
  `precautions`,
  `raw_materials`,
  `product_shape`,
  `created_at`
FROM `tablet_master`;

-- ============================================================
-- 샘플 검색 쿼리 예시
-- ============================================================

-- 1. 제품명으로 검색 (LIKE 검색)
-- SELECT * FROM medicine_master WHERE name LIKE '%타이레놀%' LIMIT 20;

-- 2. 제품명 전문 검색 (FULLTEXT 검색 - 더 빠름)
-- SELECT * FROM medicine_master 
-- WHERE MATCH(name) AGAINST('타이레놀' IN NATURAL LANGUAGE MODE) 
-- LIMIT 20;

-- 3. 업체명으로 검색
-- SELECT * FROM medicine_master WHERE company_name LIKE '%삼성%' LIMIT 20;

-- 4. 통합 검색 (의약품 + 건강기능식품)
-- SELECT * FROM medicine_search_view WHERE name LIKE '%비타민%' LIMIT 20;

