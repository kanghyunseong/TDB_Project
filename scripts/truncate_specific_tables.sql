-- ============================================================
-- 특정 테이블만 삭제하는 스크립트 (외래 키 제약 조건 고려)
-- ============================================================
-- 사용법: 필요한 테이블만 주석 해제하여 사용하세요

USE `tdb`;

-- 🔥 외래 키 체크 비활성화
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. users 테이블 삭제 (user_group에서 참조됨)
-- ============================================================
-- 먼저 참조하는 테이블 삭제
-- TRUNCATE TABLE `user_group_membership`;
-- TRUNCATE TABLE `user_group`;
-- TRUNCATE TABLE `users`;

-- ============================================================
-- 2. medicine 테이블 삭제 (machine_slot에서 참조됨)
-- ============================================================
-- 먼저 참조하는 테이블 삭제
-- TRUNCATE TABLE `machine_slot`;
-- TRUNCATE TABLE `schedule`;
-- TRUNCATE TABLE `dose_history`;
-- TRUNCATE TABLE `medicine`;

-- ============================================================
-- 3. machine 테이블 삭제 (machine_slot에서 참조됨)
-- ============================================================
-- 먼저 참조하는 테이블 삭제
-- TRUNCATE TABLE `machine_slot`;
-- TRUNCATE TABLE `machine`;

-- ============================================================
-- 4. user_group 테이블 삭제 (user_group_membership에서 참조됨)
-- ============================================================
-- 먼저 참조하는 테이블 삭제
-- TRUNCATE TABLE `user_group_membership`;
-- TRUNCATE TABLE `user_group`;

-- ============================================================
-- 5. 모든 테이블 삭제 (전체 초기화)
-- ============================================================
TRUNCATE TABLE `dose_history`;
TRUNCATE TABLE `schedule`;
TRUNCATE TABLE `machine_slot`;
TRUNCATE TABLE `user_group_membership`;
TRUNCATE TABLE `supplement`;
TRUNCATE TABLE `medicine`;
TRUNCATE TABLE `user_group`;
TRUNCATE TABLE `machine`;
TRUNCATE TABLE `users`;

-- 🔥 외래 키 체크 재활성화
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 확인
-- ============================================================
SELECT '✅ 모든 테이블 데이터 삭제 완료' AS status;

