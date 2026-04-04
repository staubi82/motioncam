'use strict';
process.env.DB_PATH = ':memory:';
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const express = require('express');
const session = require('express-session');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const { getDb } = require('../../src/db');

let app;
let tmpDir;

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motioncam-videos-test-'));

  const a = express();
  a.use(express.json());
  a.use(express.urlencoded({ extended: false }));
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use((req, res, next) => { req.session.userId = 1; req.session.username = 'admin'; next(); });
  a.use('/videos', require('../../src/routes/videos'));
  a.use((err, req, res, next) => {
    res.status(err.status || 500).json({ ok: false, message: err.message });
  });
  app = a;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM recordings').run();
});

describe('DELETE /videos/:id', () => {
  test('returns 409 for favorite recordings', async () => {
    const db = getDb();
    const fp = path.join(tmpDir, 'fav-single.mp4');
    fs.writeFileSync(fp, 'x');
    const id = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('fav-single.mp4', ?, 1)"
    ).run(fp).lastInsertRowid;

    const res = await request(app).delete(`/videos/${id}`);
    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(fs.existsSync(fp)).toBe(true);
  });

  test('moves non-favorite recording to trash', async () => {
    const db = getDb();
    const fp = path.join(tmpDir, 'to-trash.mp4');
    fs.writeFileSync(fp, 'x');
    const id = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('to-trash.mp4', ?, 0)"
    ).run(fp).lastInsertRowid;

    const res = await request(app).delete(`/videos/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row.deleted_at).toBeTruthy();
    expect(fs.existsSync(fp)).toBe(true);
  });

  test('permanently deletes recording from trash', async () => {
    const db = getDb();
    const fp = path.join(tmpDir, 'hard-del.mp4');
    fs.writeFileSync(fp, 'x');
    const id = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('hard-del.mp4', ?, datetime('now'))"
    ).run(fp).lastInsertRowid;

    const res = await request(app).delete(`/videos/${id}?permanent=1`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(fs.existsSync(fp)).toBe(false);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row).toBeUndefined();
  });
});

describe('DELETE /videos/bulk', () => {
  test('moves non-favorites to trash and keeps favorites', async () => {
    const db = getDb();
    const fpA = path.join(tmpDir, 'bulk-normal.mp4');
    const fpB = path.join(tmpDir, 'bulk-favorite.mp4');
    fs.writeFileSync(fpA, 'a');
    fs.writeFileSync(fpB, 'b');
    const normalId = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('bulk-normal.mp4', ?, 0)"
    ).run(fpA).lastInsertRowid;
    const favoriteId = db.prepare(
      "INSERT INTO recordings (filename, filepath, is_favorite) VALUES ('bulk-favorite.mp4', ?, 1)"
    ).run(fpB).lastInsertRowid;

    const res = await request(app)
      .delete('/videos/bulk')
      .send({ ids: [Number(normalId), Number(favoriteId)] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.movedIds).toEqual([Number(normalId)]);
    expect(res.body.protectedIds).toEqual([Number(favoriteId)]);
    expect(fs.existsSync(fpA)).toBe(true);
    expect(fs.existsSync(fpB)).toBe(true);
    const normal = db.prepare('SELECT * FROM recordings WHERE id=?').get(normalId);
    const favorite = db.prepare('SELECT * FROM recordings WHERE id=?').get(favoriteId);
    expect(normal.deleted_at).toBeTruthy();
    expect(favorite.deleted_at).toBeNull();
  });
});

describe('PATCH /videos/:id/restore and /videos/bulk/restore', () => {
  test('restores trashed recording', async () => {
    const db = getDb();
    const fp = path.join(tmpDir, 'restore-one.mp4');
    fs.writeFileSync(fp, 'x');
    const id = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('restore-one.mp4', ?, datetime('now'))"
    ).run(fp).lastInsertRowid;

    const res = await request(app).patch(`/videos/${id}/restore`);
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
    expect(row.deleted_at).toBeNull();
  });

  test('restores multiple trashed recordings', async () => {
    const db = getDb();
    const fpA = path.join(tmpDir, 'restore-a.mp4');
    const fpB = path.join(tmpDir, 'restore-b.mp4');
    fs.writeFileSync(fpA, 'a');
    fs.writeFileSync(fpB, 'b');
    const a = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('restore-a.mp4', ?, datetime('now'))"
    ).run(fpA).lastInsertRowid;
    const b = db.prepare(
      "INSERT INTO recordings (filename, filepath, deleted_at) VALUES ('restore-b.mp4', ?, datetime('now'))"
    ).run(fpB).lastInsertRowid;

    const res = await request(app)
      .patch('/videos/bulk/restore')
      .send({ ids: [Number(a), Number(b)] });

    expect(res.status).toBe(200);
    expect(res.body.restoredIds).toEqual([Number(a), Number(b)]);
  });
});
