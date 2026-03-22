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
}

module.exports = { runMigrations };
