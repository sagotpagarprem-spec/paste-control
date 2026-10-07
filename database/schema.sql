-- =====================================================================
-- UNIVERSAL PEST CONTROL — PRODUCTION DATABASE SCHEMA (MySQL 8.0+)
-- Phase 1: Core Foundation & Enterprise Schema
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `universal_pest_control`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `universal_pest_control`;

-- ---------------------------------------------------------------------
-- 1. ROLES TABLE (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. PERMISSIONS TABLE (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `module` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_permission_name` (`name`),
  INDEX `idx_permission_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. ROLE_PERMISSIONS TABLE (Many-to-Many RBAC Mapping)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. USERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `avatar_url` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `last_login_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. USER_ROLES TABLE (Many-to-Many User & Role Mapping)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. CUSTOMERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NULL,
  `phone` VARCHAR(20) NOT NULL,
  `property_type` VARCHAR(50) NOT NULL DEFAULT 'Residential',
  `address` TEXT NULL,
  `city` VARCHAR(50) NOT NULL DEFAULT 'Pune',
  `area` VARCHAR(100) NULL,
  `pincode` VARCHAR(10) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. SERVICES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'General',
  `description` TEXT NULL,
  `base_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `warranty_months` INT NOT NULL DEFAULT 12,
  `duration_hours` DECIMAL(3, 1) NOT NULL DEFAULT 2.0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_services_slug` (`slug`),
  INDEX `idx_services_category` (`category`),
  INDEX `idx_services_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. TECHNICIANS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `technicians` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `specialization` VARCHAR(100) NULL,
  `status` ENUM('Available', 'On Job', 'Off Duty') NOT NULL DEFAULT 'Available',
  `rating` DECIMAL(2, 1) NOT NULL DEFAULT 4.9,
  `jobs_completed` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tech_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_tech_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. LEADS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_code` VARCHAR(30) NOT NULL UNIQUE,
  `customer_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) NULL,
  `service_id` INT NULL,
  `service_name` VARCHAR(100) NOT NULL,
  `property_type` VARCHAR(50) NOT NULL DEFAULT 'Residential',
  `city` VARCHAR(50) NOT NULL DEFAULT 'Pune',
  `area` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `message` TEXT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'Website',
  `campaign` VARCHAR(100) NULL,
  `ad_name` VARCHAR(100) NULL,
  `utm_source` VARCHAR(100) NULL,
  `utm_medium` VARCHAR(100) NULL,
  `utm_campaign` VARCHAR(150) NULL,
  `utm_content` VARCHAR(150) NULL,
  `utm_term` VARCHAR(150) NULL,
  `fbclid` VARCHAR(255) NULL,
  `gclid` VARCHAR(255) NULL,
  `landing_page` VARCHAR(500) NULL,
  `referrer` VARCHAR(500) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'NEW',
  `urgency` VARCHAR(50) NOT NULL DEFAULT 'Today',
  `estimated_value` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `assigned_to` INT NULL,
  `follow_up_date` TIMESTAMP NULL DEFAULT NULL,
  `is_duplicate` BOOLEAN NOT NULL DEFAULT FALSE,
  `duplicate_count` INT NOT NULL DEFAULT 0,
  `duplicate_of_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_leads_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leads_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leads_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leads_dup` FOREIGN KEY (`duplicate_of_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  INDEX `idx_leads_status` (`status`),
  INDEX `idx_leads_phone` (`phone`),
  INDEX `idx_leads_source` (`source`),
  INDEX `idx_leads_created_at` (`created_at`),
  INDEX `idx_leads_assigned_to` (`assigned_to`),
  INDEX `idx_leads_dup` (`is_duplicate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. LEAD_NOTES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `user_id` INT NULL,
  `note` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notes_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_notes_lead_id` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. LEAD_ACTIVITIES TABLE (Timeline Audit)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `user_id` INT NULL,
  `activity_type` VARCHAR(50) NOT NULL DEFAULT 'INFO',
  `description` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_activities_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_activities_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_activities_lead_id` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. BOOKINGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_code` VARCHAR(40) NOT NULL UNIQUE,
  `lead_id` INT NULL,
  `customer_id` INT NULL,
  `service_id` INT NULL,
  `technician_id` INT NULL,
  `customer_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `service_name` VARCHAR(100) NOT NULL,
  `property_type` VARCHAR(50) NULL,
  `scheduled_date` DATE NOT NULL,
  `time_slot` VARCHAR(50) NOT NULL,
  `address` TEXT NULL,
  `city` VARCHAR(50) NOT NULL DEFAULT 'Pune',
  `instructions` TEXT NULL,
  `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  `notes` TEXT NULL,
  `is_archived` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bookings_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bookings_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bookings_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bookings_tech` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`) ON DELETE SET NULL,
  INDEX `idx_bookings_status` (`status`),
  INDEX `idx_bookings_date` (`scheduled_date`),
  INDEX `idx_bookings_tech` (`technician_id`),
  INDEX `idx_bookings_archived` (`is_archived`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12B. FOLLOWUPS TABLE (Follow-Up & Reminder Pipeline)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `followups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `assigned_to` INT NULL,
  `scheduled_date` DATE NOT NULL,
  `scheduled_time` VARCHAR(20) NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_followups_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_followups_user` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_followups_status` (`status`),
  INDEX `idx_followups_date` (`scheduled_date`),
  INDEX `idx_followups_assigned` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12C. CUSTOMER_REVIEWS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `booking_id` INT NULL,
  `rating` DECIMAL(2, 1) NOT NULL DEFAULT 5.0,
  `review_text` TEXT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'Direct',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_crev_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crev_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL,
  INDEX `idx_crev_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12D. CUSTOMER_NOTES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `user_id` INT NULL,
  `note` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cnotes_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cnotes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_cnotes_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. NOTIFICATIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'info',
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `link` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_notif_is_read` (`is_read`),
  INDEX `idx_notif_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 14. SETTINGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `description` VARCHAR(255) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 15. AUDIT_LOGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `details` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_entity` (`entity_type`),
  INDEX `idx_audit_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
