-- ODDSIQ Database Schema
-- MySQL Migration Script
-- Created: 2026-04-10

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- BANKROLLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bankrolls (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  initial_amount INT NOT NULL,
  current_amount INT NOT NULL,
  start_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY idx_bankrolls_user (user_id),
  CONSTRAINT fk_bankrolls_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- BANKROLL MOVEMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bankroll_movements (
  id VARCHAR(36) PRIMARY KEY,
  bankroll_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  bet_id VARCHAR(36) DEFAULT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_movements_bankroll FOREIGN KEY (bankroll_id) REFERENCES bankrolls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- ANALYSES TABLE (NEW FOR ODDSIQ)
-- =====================================================
CREATE TABLE IF NOT EXISTS analyses (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  sport ENUM('BASKETBALL', 'FOOTBALL', 'TENNIS', 'OTHER') NOT NULL,
  home_team VARCHAR(200) NOT NULL,
  away_team VARCHAR(200) NOT NULL,
  tournament VARCHAR(200) DEFAULT NULL,
  event_date DATETIME DEFAULT NULL,
  user_odds DECIMAL(6,2) DEFAULT NULL,
  user_sportsbook VARCHAR(100) DEFAULT NULL,
  analysis LONGTEXT NOT NULL,
  sources JSON DEFAULT NULL,
  recommended_selection VARCHAR(300) DEFAULT NULL,
  recommended_odds DECIMAL(6,2) DEFAULT NULL,
  recommended_stake INT DEFAULT NULL,
  confidence ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT NULL,
  mini_max_model VARCHAR(50) DEFAULT NULL,
  mini_max_tokens INT DEFAULT NULL,
  mini_max_cost DECIMAL(10,4) DEFAULT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_analyses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_analyses_user (user_id),
  INDEX idx_analyses_sport (sport),
  INDEX idx_analyses_event (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- MATCH CACHE TABLE (NEW FOR ODDSIQ)
-- =====================================================
CREATE TABLE IF NOT EXISTS match_cache (
  id VARCHAR(36) PRIMARY KEY,
  external_id VARCHAR(100) DEFAULT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(200) NOT NULL,
  away_team VARCHAR(200) NOT NULL,
  tournament VARCHAR(200) DEFAULT NULL,
  event_date DATETIME NOT NULL,
  sofascore_data JSON DEFAULT NULL,
  espn_data JSON DEFAULT NULL,
  odds_data JSON DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_cache_sport_date (sport, event_date),
  INDEX idx_cache_external (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- BETS TABLE (EXISTING - ADDING NEW COLUMNS FOR ODDSIQ)
-- =====================================================
CREATE TABLE IF NOT EXISTS bets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  sport VARCHAR(200) NOT NULL,
  tournament VARCHAR(200) NOT NULL,
  home_team VARCHAR(200) NOT NULL,
  away_team VARCHAR(200) NOT NULL,
  event_date DATETIME NOT NULL,
  bet_type VARCHAR(50) NOT NULL,
  selection VARCHAR(300) NOT NULL,
  odds DECIMAL(6,2) NOT NULL,
  amount INT NOT NULL,
  category VARCHAR(1) NOT NULL,
  confidence TINYINT NOT NULL DEFAULT 2,
  reasoning TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  potential_win INT NOT NULL,
  profit INT NOT NULL DEFAULT 0,
  cashout_amount INT DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  post_notes TEXT DEFAULT NULL,
  parlay_id VARCHAR(36) DEFAULT NULL,
  -- NEW COLUMNS FOR ODDSIQ:
  analysis_id VARCHAR(36) DEFAULT NULL,
  user_odds DECIMAL(6,2) DEFAULT NULL,
  user_sportsbook VARCHAR(100) DEFAULT NULL,
  is_value_bet BOOLEAN DEFAULT FALSE,
  mini_max_tokens INT DEFAULT NULL,
  mini_max_cost DECIMAL(10,4) DEFAULT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_bets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bets_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE SET NULL,
  INDEX idx_bets_user (user_id),
  INDEX idx_bets_status (status),
  INDEX idx_bets_analysis (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- PARLAYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS parlays (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  bet_ids JSON NOT NULL,
  combined_odds DECIMAL(8,4) NOT NULL,
  amount INT NOT NULL,
  potential_win INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  profit INT NOT NULL DEFAULT 0,
  resolved_at DATETIME DEFAULT NULL,
  post_notes TEXT DEFAULT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_parlays_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_parlays_user (user_id),
  INDEX idx_parlays_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- DAILY SNAPSHOTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  snapshot_date DATE NOT NULL,
  opening_balance INT NOT NULL,
  closing_balance INT NOT NULL,
  bets_count INT NOT NULL DEFAULT 0,
  won_count INT NOT NULL DEFAULT 0,
  lost_count INT NOT NULL DEFAULT 0,
  daily_profit INT NOT NULL DEFAULT 0,
  stop_loss_hit TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY idx_snapshots_user_date (user_id, snapshot_date),
  CONSTRAINT fk_snapshots_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- REFRESH TOKENS TABLE (FOR JWT REFRESH)
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_token (token(255)),
  INDEX idx_refresh_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
