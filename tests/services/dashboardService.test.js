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

describe('is_favorite migration', () => {
  test('recordings table has is_favorite column after migration', () => {
    const { getDb } = require('../../src/db');
    const cols = getDb().prepare('PRAGMA table_info(recordings)').all();
    const col = cols.find(c => c.name === 'is_favorite');
    expect(col).toBeDefined();
    expect(col.dflt_value).toBe('0');
  });
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
