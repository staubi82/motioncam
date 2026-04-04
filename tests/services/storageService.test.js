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

  test('moveRecordingToTrash throws 404 for unknown id', () => {
    expect(() => storageService.moveRecordingToTrash(9999)).toThrow('Recording not found');
  });

  test('moveRecordingToTrash sets deleted_at and keeps file', () => {
    const fp = path.join(tmpDir, 'del.mp4');
    fs.writeFileSync(fp, 'data');
    const db = getDb();
    const res = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('del.mp4', ?)").run(fp);
    storageService.moveRecordingToTrash(res.lastInsertRowid);
    expect(fs.existsSync(fp)).toBe(true);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(res.lastInsertRowid);
    expect(row.deleted_at).toBeTruthy();
  });

  test('moveRecordingToTrash blocks deleting favorites', () => {
    const fp = path.join(tmpDir, 'fav-protected.mp4');
    fs.writeFileSync(fp, 'data');
    const db = getDb();
    const res = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('fav-protected.mp4', ?, 1)"
    ).run(fp);
    expect(() => storageService.moveRecordingToTrash(res.lastInsertRowid)).toThrow('Favoriten sind vor dem Löschen geschützt');
    expect(fs.existsSync(fp)).toBe(true);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(res.lastInsertRowid);
    expect(row).toBeTruthy();
  });

  test('moveRecordingsToTrash skips favorites and reports protected ids', () => {
    const fpA = path.join(tmpDir, 'bulk-a.mp4');
    const fpB = path.join(tmpDir, 'bulk-b.mp4');
    fs.writeFileSync(fpA, 'a');
    fs.writeFileSync(fpB, 'b');
    const db = getDb();
    const a = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('bulk-a.mp4', ?, 0)"
    ).run(fpA).lastInsertRowid;
    const b = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('bulk-b.mp4', ?, 1)"
    ).run(fpB).lastInsertRowid;

    const result = storageService.moveRecordingsToTrash([Number(a), Number(b)]);
    expect(result.movedIds).toEqual([Number(a)]);
    expect(result.protectedIds).toEqual([Number(b)]);
    expect(fs.existsSync(fpA)).toBe(true);
    expect(fs.existsSync(fpB)).toBe(true);
  });

  test('restoreRecording removes deleted_at', () => {
    const fp = path.join(tmpDir, 'restore.mp4');
    fs.writeFileSync(fp, 'x');
    const db = getDb();
    const id = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('restore.mp4', ?)").run(fp).lastInsertRowid;
    storageService.moveRecordingToTrash(id);
    storageService.restoreRecording(id);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row.deleted_at).toBeNull();
  });

  test('permanentlyDeleteRecording removes DB entry and file from trash', () => {
    const fp = path.join(tmpDir, 'hard-delete.mp4');
    fs.writeFileSync(fp, 'x');
    const db = getDb();
    const id = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('hard-delete.mp4', ?)").run(fp).lastInsertRowid;
    storageService.moveRecordingToTrash(id);
    storageService.permanentlyDeleteRecording(id);
    expect(fs.existsSync(fp)).toBe(false);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row).toBeUndefined();
  });

  test('purgeExpiredTrash respects retention days and deletes only old trash', () => {
    const db = getDb();
    const fpOld = path.join(tmpDir, 'old-trash.mp4');
    const fpRecent = path.join(tmpDir, 'recent-trash.mp4');
    fs.writeFileSync(fpOld, 'x');
    fs.writeFileSync(fpRecent, 'y');

    const oldId = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('old-trash.mp4', ?, '2000-01-01 00:00:00')"
    ).run(fpOld).lastInsertRowid;
    const recentId = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('recent-trash.mp4', ?, datetime('now'))"
    ).run(fpRecent).lastInsertRowid;

    const result = storageService.purgeExpiredTrash(7);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);

    const oldRow = db.prepare('SELECT * FROM recordings WHERE id=?').get(oldId);
    const recentRow = db.prepare('SELECT * FROM recordings WHERE id=?').get(recentId);
    expect(oldRow).toBeUndefined();
    expect(recentRow).toBeTruthy();
    expect(fs.existsSync(fpOld)).toBe(false);
    expect(fs.existsSync(fpRecent)).toBe(true);
  });

  test('purgeExpiredTrash with retention 0 does not delete anything', () => {
    const db = getDb();
    const fp = path.join(tmpDir, 'never-delete.mp4');
    fs.writeFileSync(fp, 'x');
    const id = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('never-delete.mp4', ?, '2000-01-01 00:00:00')"
    ).run(fp).lastInsertRowid;

    const result = storageService.purgeExpiredTrash(0);
    expect(result.deletedCount).toBe(0);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row).toBeTruthy();
    expect(fs.existsSync(fp)).toBe(true);
  });

  test('moveRecordingToTrash deletes immediately when trash is disabled', () => {
    settingsService.set('trash_enabled', 'false');
    const fp = path.join(tmpDir, 'trash-disabled.mp4');
    fs.writeFileSync(fp, 'x');
    const db = getDb();
    const id = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('trash-disabled.mp4', ?)").run(fp).lastInsertRowid;

    const result = storageService.moveRecordingToTrash(id);
    expect(result.deleted).toBe(true);
    expect(result.movedToTrash).toBe(false);
    expect(fs.existsSync(fp)).toBe(false);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row).toBeUndefined();
    settingsService.set('trash_enabled', 'true');
  });
});
