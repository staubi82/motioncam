'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/dashboardService');

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const dashboardService = require('../../src/services/dashboardService');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');

let app;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  dashboardService.getStats.mockReturnValue({
    totalRecordings: 5, todayCount: 2, totalDuration: 120, diskUsage: 1000,
    isRecording: false, latestRecording: null,
  });

  const a = express();
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use((req, res, next) => { req.session.userId = 1; next(); });
  a.use('/api', require('../../src/routes/api'));
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
