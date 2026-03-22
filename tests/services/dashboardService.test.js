'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/storageService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const storageService = require('../../src/services/storageService');
const dashboardService = require('../../src/services/dashboardService');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  ffmpegService.isRecording.mockReturnValue(false);
  storageService.getDiskUsage.mockReturnValue(0);
  const { getDb } = require('../../src/db');
  getDb().prepare('DELETE FROM recordings').run();
});

describe('dashboardService.getStats', () => {
  test('returns stats object with expected keys', () => {
    const stats = dashboardService.getStats();
    expect(stats).toHaveProperty('totalRecordings');
    expect(stats).toHaveProperty('todayCount');
    expect(stats).toHaveProperty('totalDuration');
    expect(stats).toHaveProperty('isRecording');
    expect(stats).toHaveProperty('latestRecording');
  });

  test('totalRecordings is 0 for empty DB', () => {
    expect(dashboardService.getStats().totalRecordings).toBe(0);
  });
});
