-- ========================================================================
-- TiDB Cloud (Serverless MySQL) Schema for Sistem Admin Jamaah Umrah
-- Compatible with MySQL 5.7 / 8.0 & TiDB Serverless Engine
-- ========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Admin Users
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(36) NOT NULL,
  `auth_user_id` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_admin_users_email` (`email`),
  KEY `idx_admin_users_auth_id` (`auth_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Master Jamaah
CREATE TABLE IF NOT EXISTS `jamaah` (
  `id` VARCHAR(36) NOT NULL,
  `identity_name` VARCHAR(255) NOT NULL,
  `passport_name` VARCHAR(255) NULL,
  `passport_number` VARCHAR(50) NULL,
  `birth_place` VARCHAR(100) NULL,
  `birth_date` DATE NULL,
  `gender` ENUM('MALE', 'FEMALE') NULL,
  `passport_issue_place` VARCHAR(100) NULL,
  `passport_issue_date` DATE NULL,
  `passport_expiry_date` DATE NULL,
  `ktp_name` VARCHAR(255) NULL,
  `nik` VARCHAR(30) NULL,
  `kk_number` VARCHAR(30) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_jamaah_passport_number` (`passport_number`),
  KEY `idx_jamaah_nik` (`nik`),
  KEY `idx_jamaah_identity_name` (`identity_name`),
  KEY `idx_jamaah_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Document Records
CREATE TABLE IF NOT EXISTS `documents` (
  `id` VARCHAR(36) NOT NULL,
  `jamaah_id` VARCHAR(36) NULL,
  `document_type` ENUM('PASSPORT', 'KTP', 'KK', 'VAKSIN', 'BUKU_NIKAH', 'OTHER') NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `original_file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `status` ENUM('UPLOADED', 'PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'CONFIRMED',
  `is_current` BOOLEAN NOT NULL DEFAULT TRUE,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_documents_jamaah_id` (`jamaah_id`),
  KEY `idx_documents_type` (`document_type`),
  CONSTRAINT `fk_documents_jamaah` FOREIGN KEY (`jamaah_id`) REFERENCES `jamaah` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Document Extractions (OCR Data)
CREATE TABLE IF NOT EXISTS `document_extractions` (
  `id` VARCHAR(36) NOT NULL,
  `document_id` VARCHAR(36) NOT NULL,
  `raw_extraction` TEXT NULL,
  `extracted_fields` JSON NULL,
  `classification_result` VARCHAR(50) NULL,
  `confidence_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `mrz_data` JSON NULL,
  `review_status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'CONFIRMED',
  `review_notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_extractions_document_id` (`document_id`),
  CONSTRAINT `fk_extractions_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Packages (Paket Umrah)
CREATE TABLE IF NOT EXISTS `packages` (
  `id` VARCHAR(36) NOT NULL,
  `package_name` VARCHAR(255) NOT NULL,
  `departure_date` DATE NOT NULL,
  `return_date` DATE NOT NULL,
  `b2b_price` BIGINT NOT NULL DEFAULT 0,
  `reference_price` BIGINT NOT NULL DEFAULT 0,
  `airline` VARCHAR(100) NULL,
  `makkah_hotel` VARCHAR(150) NULL,
  `madinah_hotel` VARCHAR(150) NULL,
  `schedule` TEXT NULL,
  `quota` INT NOT NULL DEFAULT 45,
  `status` ENUM('DRAFT', 'OPEN', 'FULL', 'DEPARTED', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_packages_departure_date` (`departure_date`),
  KEY `idx_packages_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PIC (Penanggung Jawab / Agen Rombongan)
CREATE TABLE IF NOT EXISTS `pics` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `agency_name` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pics_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Package Participants (Peserta Paket)
CREATE TABLE IF NOT EXISTS `package_participants` (
  `id` VARCHAR(36) NOT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `jamaah_id` VARCHAR(36) NOT NULL,
  `pic_id` VARCHAR(36) NULL,
  `selling_price` BIGINT NOT NULL DEFAULT 0,
  `room_type` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `status` ENUM('REGISTERED', 'CONFIRMED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'REGISTERED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_participants_package` (`package_id`),
  KEY `idx_participants_jamaah` (`jamaah_id`),
  KEY `idx_participants_pic` (`pic_id`),
  CONSTRAINT `fk_participants_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_participants_jamaah` FOREIGN KEY (`jamaah_id`) REFERENCES `jamaah` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_participants_pic` FOREIGN KEY (`pic_id`) REFERENCES `pics` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Invoices (Tagihan Keuangan)
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` VARCHAR(36) NOT NULL,
  `package_participant_id` VARCHAR(36) NOT NULL,
  `invoice_number` VARCHAR(100) NOT NULL,
  `total_amount` BIGINT NOT NULL DEFAULT 0,
  `status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'UNPAID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_invoices_number` (`invoice_number`),
  KEY `idx_invoices_participant` (`package_participant_id`),
  CONSTRAINT `fk_invoices_participant` FOREIGN KEY (`package_participant_id`) REFERENCES `package_participants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Invoice Items
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` VARCHAR(36) NOT NULL,
  `invoice_id` VARCHAR(36) NOT NULL,
  `item_type` ENUM('BASE_PRICE', 'ADDON', 'DISCOUNT') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` BIGINT NOT NULL DEFAULT 0,
  `discount_category` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_items_invoice` (`invoice_id`),
  CONSTRAINT `fk_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Payments (Transaksi Pembayaran)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(36) NOT NULL,
  `payment_number` VARCHAR(100) NOT NULL,
  `amount` BIGINT NOT NULL DEFAULT 0,
  `payment_date` DATE NOT NULL,
  `payment_type` ENUM('DP', 'CICILAN', 'PELUNASAN') NOT NULL DEFAULT 'CICILAN',
  `payment_method` ENUM('TRANSFER', 'CASH') NOT NULL DEFAULT 'TRANSFER',
  `sender_name` VARCHAR(255) NULL,
  `bank_name` VARCHAR(100) NULL,
  `proof_document_path` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `pic_id` VARCHAR(36) NULL,
  `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'VERIFIED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_payments_number` (`payment_number`),
  KEY `idx_payments_pic` (`pic_id`),
  CONSTRAINT `fk_payments_pic` FOREIGN KEY (`pic_id`) REFERENCES `pics` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Payment Allocations (Alokasi Pembayaran ke Invoice)
CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NOT NULL,
  `invoice_id` VARCHAR(36) NOT NULL,
  `allocated_amount` BIGINT NOT NULL DEFAULT 0,
  `status` ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_allocations_payment` (`payment_id`),
  KEY `idx_allocations_invoice` (`invoice_id`),
  CONSTRAINT `fk_allocations_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_allocations_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Equipment Items (Master Perlengkapan)
CREATE TABLE IF NOT EXISTS `equipment_items` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` ENUM('BAG', 'APPAREL', 'IBADAH', 'ACCESSORY', 'IDENTITY', 'DOCUMENT') NOT NULL,
  `description` TEXT NULL,
  `requires_variant` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Equipment Item Variants (Ukuran Seragam)
CREATE TABLE IF NOT EXISTS `equipment_item_variants` (
  `id` VARCHAR(50) NOT NULL,
  `equipment_item_id` VARCHAR(50) NOT NULL,
  `label` VARCHAR(50) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_eq_variants_item` (`equipment_item_id`),
  CONSTRAINT `fk_eq_variants_item` FOREIGN KEY (`equipment_item_id`) REFERENCES `equipment_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Package Equipment Items (Paket Perlengkapan per Trip)
CREATE TABLE IF NOT EXISTS `package_equipment_items` (
  `id` VARCHAR(50) NOT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `equipment_item_id` VARCHAR(50) NOT NULL,
  `applicability` ENUM('ALL', 'MALE_ONLY', 'FEMALE_ONLY', 'OPTIONAL') NOT NULL DEFAULT 'ALL',
  `is_included` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pkg_eq_package` (`package_id`),
  KEY `idx_pkg_eq_item` (`equipment_item_id`),
  CONSTRAINT `fk_pkg_eq_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pkg_eq_item` FOREIGN KEY (`equipment_item_id`) REFERENCES `equipment_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Participant Equipment Status (Status Penyerahan Perlengkapan)
CREATE TABLE IF NOT EXISTS `participant_equipment` (
  `id` VARCHAR(50) NOT NULL,
  `package_participant_id` VARCHAR(36) NOT NULL,
  `package_equipment_item_id` VARCHAR(50) NOT NULL,
  `variant_id` VARCHAR(50) NULL,
  `fulfillment_status` ENUM('UNFULFILLED', 'ORDERED', 'READY', 'HANDED_OVER', 'RETURNED') NOT NULL DEFAULT 'UNFULFILLED',
  `handed_over_at` DATETIME NULL,
  `handed_over_by` VARCHAR(255) NULL,
  `recipient_name` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_part_eq_participant` (`package_participant_id`),
  KEY `idx_part_eq_item` (`package_equipment_item_id`),
  CONSTRAINT `fk_part_eq_participant` FOREIGN KEY (`package_participant_id`) REFERENCES `package_participants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_part_eq_item` FOREIGN KEY (`package_equipment_item_id`) REFERENCES `package_equipment_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Operational Alerts
CREATE TABLE IF NOT EXISTS `operational_alerts` (
  `id` VARCHAR(50) NOT NULL,
  `severity` ENUM('CRITICAL', 'WARNING', 'INFO') NOT NULL DEFAULT 'INFO',
  `category` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `action_label` VARCHAR(100) NULL,
  `action_url` VARCHAR(255) NULL,
  `target_id` VARCHAR(100) NULL,
  `target_type` VARCHAR(50) NULL,
  `package_id` VARCHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_resolved` BOOLEAN NOT NULL DEFAULT FALSE,
  `resolved_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(50) NOT NULL,
  `admin_user_id` VARCHAR(100) NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
