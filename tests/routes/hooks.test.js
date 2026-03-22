'use strict';
process.env.DB_PATH = ':memory:';
process.env.HOOK_SECRET = 'test-secret';
jest.mock('../../src/services/recordingService');

const request = require('supertest');
const express = require('express');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const recordingService = require('../../src/services/recordingService');
const hooksRouter = require('../../src/routes/hooks');

const app = express();
app.use(express.json());
app.use('/api/hooks', hooksRouter);

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  recordingService.startRecording.mockResolvedValue();
  recordingService.scheduleStop.mockReturnValue();
});

describe('POST /api/hooks/motion-start', () => {
  test('returns 401 without secret', async () => {
    const res = await request(app).post('/api/hooks/motion-start');
    expect(res.status).toBe(401);
  });

  test('returns 200 with valid secret', async () => {
    const res = await request(app)
      .post('/api/hooks/motion-start')
      .set('x-hook-secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(recordingService.startRecording).toHaveBeenCalled();
  });
});

describe('POST /api/hooks/motion-end', () => {
  test('returns 200 and schedules stop', async () => {
    const res = await request(app)
      .post('/api/hooks/motion-end')
      .set('x-hook-secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(recordingService.scheduleStop).toHaveBeenCalled();
  });
});
