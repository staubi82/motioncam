'use strict';
process.env.DB_PATH = ':memory:';
const { getDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');

describe('DB migrations + seeds', () => {
  beforeAll(() => {
    runMigrations();
    runSeeds();
  });

  test('users table exists', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    expect(row).toBeTruthy();
  });

  test('settings seeded with detection_enabled', () => {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key='detection_enabled'").get();
    expect(row.value).toBe('true');
  });

  test('all 4 tables exist', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'settings', 'events', 'recordings', 'notifications']));
  });
});
