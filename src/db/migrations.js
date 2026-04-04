'use strict';
const { getDb } = require('./index');

function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      meta        TEXT
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      filename         TEXT NOT NULL UNIQUE,
      filepath         TEXT NOT NULL,
      thumbnail_path   TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      duration_seconds REAL,
      file_size        INTEGER,
      width            INTEGER,
      height           INTEGER,
      has_audio        INTEGER NOT NULL DEFAULT 1,
      event_id         INTEGER REFERENCES events(id),
      processed        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT NOT NULL,
      sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
      recipient TEXT,
      subject   TEXT,
      status    TEXT NOT NULL,
      error     TEXT
    );
  `);

  // Idempotent: add is_favorite column if not present
  const cols = db.prepare('PRAGMA table_info(recordings)').all();
  if (!cols.some(c => c.name === 'is_favorite')) {
    db.prepare('ALTER TABLE recordings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!cols.some(c => c.name === 'deleted_at')) {
    db.prepare('ALTER TABLE recordings ADD COLUMN deleted_at TEXT').run();
  }

  // Idempotent: add detection_min_frames setting if not present
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('detection_min_frames', '2')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('detection_lightswitch_percent', '25')").run();
}

module.exports = { runMigrations };
