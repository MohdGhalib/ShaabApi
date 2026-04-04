-- ══════════════════════════════════════════════════════
-- إعداد قاعدة البيانات — نظام محامص الشعب
-- نفّذ هذا الملف مرة واحدة فقط عند الرفع
-- ══════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS shaab_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE shaab_db;

CREATE TABLE IF NOT EXISTS storage (
    store_key   VARCHAR(100) NOT NULL PRIMARY KEY,
    store_value LONGTEXT     NOT NULL,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
