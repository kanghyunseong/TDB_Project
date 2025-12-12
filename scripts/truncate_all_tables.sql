-- ============================================================
-- 모든 테이블 데이터 삭제 스크립트 (외래 키 제약 조건 고려)
-- ============================================================
-- 주의: 이 스크립트는 모든 데이터를 삭제합니다. 신중하게 사용하세요!

USE `tdb`;

-- 🔥 외래 키 체크 비활성화
SET FOREIGN_KEY_CHECKS = 0;

-- 참조되는 테이블부터 삭제 (자식 테이블)
TRUNCATE TABLE `dose_history`;
TRUNCATE TABLE `schedule`;
TRUNCATE TABLE `machine_slot`;
TRUNCATE TABLE `user_group_membership`;
TRUNCATE TABLE `supplement`;
TRUNCATE TABLE `medicine`;

-- 참조하는 테이블 삭제 (부모 테이블)
TRUNCATE TABLE `user_group`;
TRUNCATE TABLE `machine`;
TRUNCATE TABLE `users`;

-- 🔥 외래 키 체크 재활성화
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 확인 쿼리
-- ============================================================
-- SELECT 'users' AS table_name, COUNT(*) AS count FROM users
-- UNION ALL
-- SELECT 'user_group', COUNT(*) FROM user_group
-- UNION ALL
-- SELECT 'user_group_membership', COUNT(*) FROM user_group_membership
-- UNION ALL
-- SELECT 'medicine', COUNT(*) FROM medicine
-- UNION ALL
-- SELECT 'supplement', COUNT(*) FROM supplement
-- UNION ALL
-- SELECT 'schedule', COUNT(*) FROM schedule
-- UNION ALL
-- SELECT 'dose_history', COUNT(*) FROM dose_history
-- UNION ALL
-- SELECT 'machine', COUNT(*) FROM machine
-- UNION ALL
-- SELECT 'machine_slot', COUNT(*) FROM machine_slot;

