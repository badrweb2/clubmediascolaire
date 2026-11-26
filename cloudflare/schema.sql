CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  class_section TEXT NOT NULL DEFAULT '',
  publish_date TEXT NOT NULL DEFAULT (date('now')),
  content_type TEXT NOT NULL,
  source_method TEXT NOT NULL,
  original_url TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  media_mime TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  gallery_urls TEXT NOT NULL DEFAULT '[]',
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  keywords TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  featured INTEGER NOT NULL DEFAULT 0,
  embed_status TEXT NOT NULL DEFAULT 'ok',
  embed_note TEXT NOT NULL DEFAULT '',
  views_count INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
