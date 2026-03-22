'use strict';
process.env.DB_PATH = ':memory:';
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const storageService = require('../../src/services/storageService');
const { getDb } = require('../../src/db');

let tmpDir;
beforeAll(() => {
  runMigrations();
  runSeeds();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motioncam-test-'));
  settingsService.loadAll();
  settingsService.set('storage_path', tmpDir);
});
afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('storageService', () => {
  test('getDiskUsage returns 0 for empty dir', () => {
    expect(storageService.getDiskUsage()).toBe(0);
  });

  test('getDiskUsage counts file sizes', () => {
    fs.writeFileSync(path.join(tmpDir, 'test.mp4'), 'x'.repeat(100));
    expect(storageService.getDiskUsage()).toBe(100);
  });

  test('deleteRecording throws 404 for unknown id', () => {
    expect(() => storageService.deleteRecording(9999)).toThrow('Recording not found');
  });

  test('deleteRecording removes DB entry and file', () => {
    const fp = path.join(tmpDir, 'del.mp4');
    fs.writeFileSync(fp, 'data');
    const db = getDb();
    const res = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('del.mp4', ?)").run(fp);
    storageService.deleteRecording(res.lastInsertRowid);
    expect(fs.existsSync(fp)).toBe(false);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(res.lastInsertRowid);
    expect(row).toBeUndefined();
  });
});
