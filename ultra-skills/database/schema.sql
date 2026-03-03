-- database/schema.sql
-- Ultra Skills v2.0 — Cloudflare D1 Database Schema
-- CoreBlow Plan 1 · Production-Grade Web Scraping Engine

-- === CORE TABLES ===

CREATE TABLE IF NOT EXISTS scraped_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    extracted_data TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'success',
    content_hash TEXT,
    previous_hash TEXT,
    has_changes INTEGER DEFAULT 0,
    screenshot_url TEXT,
    page_number INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_id) REFERENCES scrape_targets(id)
);

CREATE TABLE IF NOT EXISTS scrape_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    selectors TEXT,
    selector_type TEXT DEFAULT 'css',
    schedule TEXT DEFAULT '0 */6 * * *',
    pagination_config TEXT,
    proxy_required INTEGER DEFAULT 0,
    screenshot_enabled INTEGER DEFAULT 0,
    notify_on_change_only INTEGER DEFAULT 0,
    notification_channels TEXT,
    webhook_url TEXT,
    headers TEXT,
    cookies TEXT,
    wait_for_selector TEXT,
    is_active INTEGER DEFAULT 1,
    last_scraped_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    target_id INTEGER,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    attempt INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    priority INTEGER DEFAULT 5,
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    duration_ms INTEGER,
    error_message TEXT,
    retry_after DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_id) REFERENCES scrape_targets(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT DEFAULT '["read"]',
    rate_limit INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    last_used_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    message TEXT,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_data_target ON scraped_data(target_id);
CREATE INDEX IF NOT EXISTS idx_data_created ON scraped_data(created_at);
CREATE INDEX IF NOT EXISTS idx_data_url ON scraped_data(url);
CREATE INDEX IF NOT EXISTS idx_data_status ON scraped_data(status);
CREATE INDEX IF NOT EXISTS idx_data_changes ON scraped_data(has_changes);
CREATE INDEX IF NOT EXISTS idx_targets_active ON scrape_targets(is_active);
CREATE INDEX IF NOT EXISTS idx_targets_schedule ON scrape_targets(schedule);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_target ON scrape_jobs(target_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON scrape_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON scrape_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
