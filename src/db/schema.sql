USE favoritePhoto;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- DROP (재실행용)
DROP TABLE IF EXISTS point_box_draw;
DROP TABLE IF EXISTS point_history;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS purchase;
DROP TABLE IF EXISTS exchange_offer;
DROP TABLE IF EXISTS listing;
DROP TABLE IF EXISTS user_card;
DROP TABLE IF EXISTS photo_card;
DROP TABLE IF EXISTS oauth_accounts;
DROP TABLE IF EXISTS user;

-- 1) 유저
CREATE TABLE user (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  nickname VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NULL,
  points INT NOT NULL DEFAULT 0,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upt_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_email (email),
  UNIQUE KEY uk_user_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) OAuth 계정
CREATE TABLE oauth_accounts (
  oauth_account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_oauth_provider_user (provider, provider_user_id),
  KEY idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 포토카드
CREATE TABLE photo_card (
  photo_card_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  creator_user_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  genre VARCHAR(20) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  min_price INT NOT NULL DEFAULT 0,
  total_supply INT NOT NULL,
  image_url TEXT NOT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upt_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_photocard_creator (creator_user_id),
  CONSTRAINT fk_photocard_creator
    FOREIGN KEY (creator_user_id) REFERENCES user(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) 유저 소유 카드
CREATE TABLE user_card (
  user_card_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  photo_card_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upt_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_photocard (user_id, photo_card_id),
  KEY idx_usercard_user (user_id),
  KEY idx_usercard_photocard (photo_card_id),
  CONSTRAINT fk_usercard_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_usercard_photocard
    FOREIGN KEY (photo_card_id) REFERENCES photo_card(photo_card_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) 마켓 목록
CREATE TABLE listing (
  listing_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_card_id BIGINT NOT NULL,
  seller_user_id BIGINT NOT NULL,
  sale_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  price_per_unit INT NULL,
  desired_grade VARCHAR(20) NULL,
  desired_genre VARCHAR(20) NULL,
  desired_desc TEXT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upt_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_listing_user_card (user_card_id),
  KEY idx_listing_seller (seller_user_id),
  CONSTRAINT fk_listing_user_card
    FOREIGN KEY (user_card_id) REFERENCES user_card(user_card_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_listing_seller
    FOREIGN KEY (seller_user_id) REFERENCES user(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) 교환 제안
CREATE TABLE exchange_offer (
  exchange_offer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  listing_id BIGINT NOT NULL,
  seller_user_id BIGINT NOT NULL,
  offer_user_id BIGINT NOT NULL,
  requested_user_card_id BIGINT NOT NULL,
  offered_user_card_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upt_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_exchange_listing (listing_id),
  KEY idx_exchange_seller (seller_user_id),
  KEY idx_exchange_offer_user (offer_user_id),
  CONSTRAINT fk_exchange_listing
    FOREIGN KEY (listing_id) REFERENCES listing(listing_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_seller
    FOREIGN KEY (seller_user_id) REFERENCES user(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_offer_user
    FOREIGN KEY (offer_user_id) REFERENCES user(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_req_card
    FOREIGN KEY (requested_user_card_id) REFERENCES user_card(user_card_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_off_card
    FOREIGN KEY (offered_user_card_id) REFERENCES user_card(user_card_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) 구매
CREATE TABLE purchase (
  purchase_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  buyer_user_id BIGINT NOT NULL,
  listing_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  total_price INT NOT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_purchase_buyer (buyer_user_id),
  KEY idx_purchase_listing (listing_id),
  CONSTRAINT fk_purchase_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_purchase_listing
    FOREIGN KEY (listing_id) REFERENCES listing(listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) 포인트 내역
CREATE TABLE point_history (
  point_history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount INT NOT NULL,
  type VARCHAR(30) NOT NULL,
  ref_entity_type VARCHAR(30) NULL,
  ref_entity_id BIGINT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_point_user (user_id),
  CONSTRAINT fk_point_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9) 포인트 뽑기
CREATE TABLE point_box_draw (
  point_box_draw_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  point_history_id BIGINT NOT NULL,
  earned_points INT NOT NULL,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_draw_user (user_id),
  KEY idx_draw_point_history (point_history_id),
  CONSTRAINT fk_draw_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_draw_point_history
    FOREIGN KEY (point_history_id) REFERENCES point_history(point_history_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10) 알림
CREATE TABLE notification (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(40) NOT NULL,
  entity_type VARCHAR(30) NULL,
  entity_id BIGINT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  reg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_user (user_id),
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
