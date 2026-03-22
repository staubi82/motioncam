'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/dashboardService');
jest.mock('../../src/services/systemService');

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const dashboardService = require('../../src/services/dashboardService');
const systemService = require('../../src/services/systemService');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');

let app;
beforeAll(() => {
  runMigrations();
  runSeeds();
  const { getDb } = require('../../src/db');
  getDb().prepare(
    "INSERT OR IGNORE INTO recordings (id, filename, filepath, processed) VALUES (99, 'fav-test.mp4', '/tmp/fav-test.mp4', 1)"
  ).run();
  settingsService.loadAll();
  dashboardService.getStats.mockReturnValue({
    totalRecordings: 5, todayCount: 2, totalDuration: 120,
    isRecording: false, latestRecording: null, favoriteRecordings: [],
  });
  systemService.getCpuPercent.mockResolvedValue(42);
  systemService.getRamInfo.mockReturnValue({ ramUsedMB: 512, ramTotalMB: 1024 });
  systemService.getTempCelsius.mockReturnValue(55);
  systemService.getDiskInfo.mockResolvedValue({ diskUsedMB: 200, diskTotalMB: 28000 });

  const a = express();
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use((req, res, next) => { req.session.userId = 1; next(); });
  a.use('/api', require('../../src/routes/api'));
  a.use((err, req, res, next) => { res.status(err.status || 500).json({ error: err.message }); });
  app = a;
});

describe('GET /api/dashboard/stats', () => {
  test('returns stats JSON', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalRecordings).toBe(5);
    expect(res.body.isRecording).toBe(false);
  });
});

describe('GET /api/live/snapshot', () => {
  test('returns 404 when snapshot file does not exist', async () => {
    settingsService.set('snapshot_path', '/tmp/nonexistent-snap-xyz.jpg');
    const res = await request(app).get('/api/live/snapshot');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/recordings/:id/favorite', () => {
  test('marks recording as favorite', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(200);
    expect(res.body.is_favorite).toBe(1);
  });

  test('unmarks recording as favorite', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 0 });
    expect(res.status).toBe(200);
    expect(res.body.is_favorite).toBe(0);
  });

  test('returns 400 for invalid is_favorite value', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 2 });
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .patch('/api/recordings/abc/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(400);
  });

  test('returns 404 for missing recording', async () => {
    const res = await request(app)
      .patch('/api/recordings/9999/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/system-status', () => {
  test('returns system status JSON', async () => {
    const res = await request(app).get('/api/system-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cpuPercent', 42);
    expect(res.body).toHaveProperty('ramUsedMB', 512);
    expect(res.body).toHaveProperty('ramTotalMB', 1024);
    expect(res.body).toHaveProperty('tempCelsius', 55);
    expect(res.body).toHaveProperty('diskUsedMB', 200);
    expect(res.body).toHaveProperty('diskTotalMB', 28000);
  });

  test('returns 500 when service rejects', async () => {
    systemService.getCpuPercent.mockRejectedValueOnce(new Error('cpu fail'));
    const res = await request(app).get('/api/system-status');
    expect(res.status).toBe(500);
    // Restore mock for subsequent tests
    systemService.getCpuPercent.mockResolvedValue(42);
  });
});
