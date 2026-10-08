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
  `short_description` TEXT NULL,
  `image` VARCHAR(255) NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `base_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `duration` VARCHAR(100) NULL DEFAULT '2 Hours',
  `duration_hours` DECIMAL(3, 1) NOT NULL DEFAULT 2.0,
  `warranty_months` INT NOT NULL DEFAULT 12,
  `benefits` JSON NULL,
  `process` JSON NULL,
  `faq` JSON NULL,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_services_slug` (`slug`),
  INDEX `idx_services_category` (`category`),
  INDEX `idx_services_status` (`status`),
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
  `email` VARCHAR(150) NULL,
  `specialization` VARCHAR(100) NULL,
  `skills` JSON NULL,
  `service_areas` JSON NULL,
  `availability` VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
  `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  `profile_image` VARCHAR(255) NULL,
  `rating` DECIMAL(2, 1) NOT NULL DEFAULT 4.9,
  `jobs_completed` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tech_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_tech_status` (`status`),
  INDEX `idx_tech_availability` (`availability`)
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
  `assigned_at` TIMESTAMP NULL DEFAULT NULL,
  `accepted_at` TIMESTAMP NULL DEFAULT NULL,
  `on_the_way_at` TIMESTAMP NULL DEFAULT NULL,
  `arrived_at` TIMESTAMP NULL DEFAULT NULL,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `cancelled_at` TIMESTAMP NULL DEFAULT NULL,
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

-- ---------------------------------------------------------------------
-- 16. OFFERS TABLE (Phase 4 CMS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `offers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `service` VARCHAR(100) NULL,
  `service_id` INT NULL,
  `discount` VARCHAR(50) NOT NULL,
  `valid_from` DATE NULL,
  `valid_until` DATE NULL,
  `image` VARCHAR(255) NULL,
  `cta` VARCHAR(100) NOT NULL DEFAULT 'Book Now',
  `terms` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_offers_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL,
  INDEX `idx_offers_status` (`status`),
  INDEX `idx_offers_valid_until` (`valid_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 17. REVIEWS TABLE (Phase 4 Public Reviews & Moderation CMS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer` VARCHAR(100) NOT NULL,
  `rating` DECIMAL(2, 1) NOT NULL DEFAULT 5.0,
  `review` TEXT NOT NULL,
  `service` VARCHAR(100) NULL,
  `location` VARCHAR(150) NULL,
  `image` VARCHAR(255) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  `featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reviews_status` (`status`),
  INDEX `idx_reviews_featured` (`featured`),
  INDEX `idx_reviews_rating` (`rating`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 18. BLOGS TABLE (Phase 4 Blog CMS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(200) NOT NULL UNIQUE,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NOT NULL,
  `featured_image` VARCHAR(255) NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'General',
  `author` VARCHAR(100) NOT NULL DEFAULT 'Universal Pest Specialist',
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  `published_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_blogs_slug` (`slug`),
  INDEX `idx_blogs_status` (`status`),
  INDEX `idx_blogs_category` (`category`),
  INDEX `idx_blogs_published` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 19. SERVICE_AREAS TABLE (Phase 4 Service Coverage CMS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_areas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Pune',
  `area` VARCHAR(150) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `service_availability` TEXT NULL,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_areas_city` (`city`),
  INDEX `idx_areas_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 20. WHATSAPP_TEMPLATES TABLE (Phase 6 WhatsApp Cloud API)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `whatsapp_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `category` VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
  `language` VARCHAR(10) NOT NULL DEFAULT 'en',
  `status` VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
  `header_text` VARCHAR(255) NULL,
  `body_text` TEXT NOT NULL,
  `footer_text` VARCHAR(150) NULL,
  `buttons` JSON NULL,
  `variables_sample` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_wat_name` (`name`),
  INDEX `idx_wat_status` (`status`),
  INDEX `idx_wat_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 21. WHATSAPP_MESSAGES TABLE (Phase 6 WhatsApp Conversations & History)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wam_id` VARCHAR(128) NULL UNIQUE,
  `direction` ENUM('OUTBOUND', 'INBOUND') NOT NULL DEFAULT 'OUTBOUND',
  `to_phone` VARCHAR(30) NOT NULL,
  `from_phone` VARCHAR(30) NOT NULL,
  `customer_id` INT NULL,
  `lead_id` INT NULL,
  `booking_id` INT NULL,
  `template_name` VARCHAR(100) NULL,
  `template_language` VARCHAR(10) DEFAULT 'en',
  `message_type` VARCHAR(30) NOT NULL DEFAULT 'TEMPLATE',
  `body` TEXT NOT NULL,
  `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `error_message` TEXT NULL,
  `metadata` JSON NULL,
  `delivered_at` TIMESTAMP NULL DEFAULT NULL,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wam_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wam_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wam_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL,
  INDEX `idx_wam_to_phone` (`to_phone`),
  INDEX `idx_wam_from_phone` (`from_phone`),
  INDEX `idx_wam_status` (`status`),
  INDEX `idx_wam_direction` (`direction`),
  INDEX `idx_wam_template` (`template_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 22. META_CONFIGURATIONS TABLE (Phase 7 Meta Connection & Account Storage)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `meta_configurations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `account_name` VARCHAR(150) NOT NULL DEFAULT 'Universal Pest Control Primary Meta Account',
  `business_account_id` VARCHAR(100) NULL,
  `ad_account_id` VARCHAR(100) NULL,
  `page_id` VARCHAR(100) NULL,
  `page_name` VARCHAR(150) NULL,
  `instagram_actor_id` VARCHAR(100) NULL,
  `app_id` VARCHAR(100) NULL,
  `app_secret` VARCHAR(255) NULL,
  `access_token` TEXT NULL,
  `pixel_id` VARCHAR(100) NULL,
  `webhook_verify_token` VARCHAR(150) NULL,
  `status` ENUM('CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR') DEFAULT 'CONNECTED',
  `last_synced_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_meta_status` (`status`),
  INDEX `idx_meta_page` (`page_id`),
  INDEX `idx_meta_ad_account` (`ad_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 23. META_LEAD_EVENTS TABLE (Phase 7 Webhook Event Audit & Retry Buffer)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `meta_lead_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` VARCHAR(128) NOT NULL UNIQUE,
  `leadgen_id` VARCHAR(100) NOT NULL,
  `page_id` VARCHAR(100) NULL,
  `form_id` VARCHAR(100) NULL,
  `adgroup_id` VARCHAR(100) NULL,
  `ad_id` VARCHAR(100) NULL,
  `platform` VARCHAR(50) NULL,
  `status` ENUM('RECEIVED', 'PROCESSED', 'FAILED', 'RETRYING') DEFAULT 'RECEIVED',
  `lead_id` INT NULL,
  `payload` JSON NOT NULL,
  `error_message` TEXT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_mle_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  INDEX `idx_mle_leadgen` (`leadgen_id`),
  INDEX `idx_mle_status` (`status`),
  INDEX `idx_mle_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


