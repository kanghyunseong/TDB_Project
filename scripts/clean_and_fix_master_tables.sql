-- ============================================================
-- 마스터 테이블 데이터 정리 및 수정 스크립트
-- medicine_master와 tablet_master에 중복된 데이터가 들어간 경우
-- ============================================================

USE `tdb`;

-- 1. 현재 상태 확인
SELECT 
    'medicine_master' as table_name,
    COUNT(*) as total_count
FROM medicine_master
UNION ALL
SELECT 
    'tablet_master' as table_name,
    COUNT(*) as total_count
FROM tablet_master;

-- 2. 중복 데이터 확인 (같은 report_no가 두 테이블에 모두 있는 경우)
SELECT 
    m.report_no,
    m.name as medicine_name,
    t.name as tablet_name,
    CASE 
        WHEN m.name = t.name THEN 'SAME_NAME'
        ELSE 'DIFFERENT_NAME'
    END as name_match
FROM medicine_master m
INNER JOIN tablet_master t ON m.report_no = t.report_no
LIMIT 100;

-- 3. ⚠️ 주의: 이 작업은 데이터를 삭제합니다!
-- 먼저 JSON 파일을 확인하세요: python3 scripts/verify_and_fix_data.py

-- 🔥 올바른 수정 방법:
-- 1) 두 테이블 모두 비우기
TRUNCATE TABLE medicine_master;
TRUNCATE TABLE tablet_master;

-- 2) JSON 파일 확인 후 올바른 데이터로 재삽입
--    python3 scripts/insert_master_data.py
-- 
--    medicine.json → medicine_master 테이블 (의약품)
--    tablet.json → tablet_master 테이블 (건강기능식품)

-- 옵션: 중복된 데이터만 삭제하려면 (더 안전하지만 권장하지 않음)
-- DELETE FROM tablet_master 
-- WHERE report_no IN (
--     SELECT report_no FROM medicine_master
-- );

-- 4. 데이터 재삽입 전 확인사항
-- - medicine.json 파일이 의약품 데이터인지 확인
-- - tablet.json 파일이 건강기능식품 데이터인지 확인
-- - 두 파일이 서로 다른 데이터 소스에서 왔는지 확인

-- 5. 권장 작업 순서:
-- 1) 먼저 백업: mysqldump -u username -p tdb medicine_master tablet_master > backup.sql
-- 2) 중복 데이터 확인 (위의 쿼리 실행)
-- 3) 올바른 테이블 결정 후 데이터 정리
-- 4) 올바른 JSON 파일로 데이터 재삽입

