-- ============================================================
-- 데이터베이스 레코드 수 확인 SQL 쿼리
-- ============================================================

-- 데이터베이스 선택
USE tdb;

-- 1. medicine_master 테이블 전체 레코드 수
SELECT COUNT(*) AS 'medicine_master 레코드 수' FROM medicine_master;

-- 2. tablet_master 테이블 전체 레코드 수
SELECT COUNT(*) AS 'tablet_master 레코드 수' FROM tablet_master;

-- 3. 두 테이블 모두 확인
SELECT 
    'medicine_master' AS 테이블명,
    COUNT(*) AS 레코드수
FROM medicine_master
UNION ALL
SELECT 
    'tablet_master' AS 테이블명,
    COUNT(*) AS 레코드수
FROM tablet_master;

-- 4. 고유한 report_no 수 확인 (중복 제거)
SELECT 
    COUNT(DISTINCT report_no) AS '고유한 report_no 수',
    COUNT(*) AS '전체 레코드 수'
FROM medicine_master;

-- 5. 중복된 report_no 확인
SELECT 
    report_no,
    COUNT(*) AS 중복횟수
FROM medicine_master
GROUP BY report_no
HAVING COUNT(*) > 1
ORDER BY 중복횟수 DESC
LIMIT 10;

-- 6. 샘플 데이터 확인 (처음 5개)
SELECT 
    report_no,
    name,
    company_name
FROM medicine_master
LIMIT 5;

-- 7. report_no 중복 확인 (중요!)
SELECT 
    COUNT(*) AS '전체 레코드 수',
    COUNT(DISTINCT report_no) AS '고유한 report_no 수',
    COUNT(*) - COUNT(DISTINCT report_no) AS '중복된 레코드 수'
FROM medicine_master;

-- 8. JSON 파일 항목 수와 비교
-- medicine.json에는 43,744개 항목이 있음
-- DB에 4,769개만 있다면 중복이 많거나 삽입 실패 가능성

-- 9. report_no별 그룹화하여 중복 확인
SELECT 
    report_no,
    COUNT(*) AS 중복횟수,
    GROUP_CONCAT(name SEPARATOR ' | ') AS 이름들
FROM medicine_master
GROUP BY report_no
HAVING COUNT(*) > 1
ORDER BY 중복횟수 DESC
LIMIT 20;

