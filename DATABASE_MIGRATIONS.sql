-- ============================================
-- TDB 데이터베이스 마이그레이션 스크립트
-- 실행 날짜: 2025-10-05
-- ============================================

USE TDB;

-- ============================================
-- 1. Machine 테이블에 라즈베리파이 관련 컬럼 추가
-- ============================================
ALTER TABLE `machine` 
ADD COLUMN `raspberry_pi_ip` VARCHAR(45) NULL COMMENT '라즈베리파이 IP 주소',
ADD COLUMN `raspberry_pi_port` INT DEFAULT 5000 COMMENT '라즈베리파이 포트 (기본: 5000)',
ADD COLUMN `online_status` BOOLEAN DEFAULT FALSE COMMENT '온라인 상태',
ADD COLUMN `last_health_check` DATETIME NULL COMMENT '마지막 헬스체크 시간';

-- ============================================
-- 2. Notification 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS `notification` (
  `notification_id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `type` ENUM('medicine_reminder', 'low_stock', 'missed_dose', 'machine_error', 'machine_offline', 'schedule_update') DEFAULT 'medicine_reminder',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `read` BOOLEAN DEFAULT FALSE,
  `data` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_read` (`read`),
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='알림 테이블';

-- ============================================
-- 확인 쿼리
-- ============================================
-- Machine 테이블 구조 확인
DESC `machine`;

-- Notification 테이블 확인
SELECT COUNT(*) as notification_table_exists 
FROM information_schema.tables 
WHERE table_schema = 'TDB' AND table_name = 'notification';

-- ============================================
-- 완료 메시지
-- ============================================
SELECT '✅ 데이터베이스 마이그레이션 완료!' as status;
