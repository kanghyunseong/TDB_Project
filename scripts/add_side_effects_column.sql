-- ============================================================
-- 부작용 필드 추가 (ALTER TABLE)
-- ============================================================

USE `tdb`;

-- 1. medicine_master 테이블에 side_effects 컬럼 추가
ALTER TABLE `medicine_master` 
ADD COLUMN `side_effects` TEXT NULL COMMENT '부작용 (SEQESITM)' 
AFTER `precautions`;

-- 2. tablet_master 테이블에 side_effects 컬럼 추가
ALTER TABLE `tablet_master` 
ADD COLUMN `side_effects` TEXT NULL COMMENT '부작용 (SEQESITM)' 
AFTER `precautions`;

-- 3. 인덱스 추가 (선택사항 - 부작용 검색용)
-- ALTER TABLE `medicine_master` ADD FULLTEXT KEY `idx_fulltext_side_effects` (`side_effects`);
-- ALTER TABLE `tablet_master` ADD FULLTEXT KEY `idx_fulltext_side_effects` (`side_effects`);

-- ============================================================
-- 확인 쿼리
-- ============================================================
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'tdb' 
--   AND TABLE_NAME IN ('medicine_master', 'tablet_master')
--   AND COLUMN_NAME = 'side_effects';

