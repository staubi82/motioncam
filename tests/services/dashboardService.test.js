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

describe('dashboardService.getStats — favoriteRecordings', () => {
  test('returns favoriteRecordings array', () => {
    const stats = dashboardService.getStats();
    expect(stats).toHaveProperty('favoriteRecordings');
    expect(Array.isArray(stats.favoriteRecordings)).toBe(true);
  });

  test('favoriteRecordings contains only is_favorite=1 recordings, max 6', () => {
    const { getDb } = require('../../src/db');
    const db = getDb();
    // Insert 7 favorites and 1 non-favorite
    for (let i = 1; i <= 7; i++) {
      db.prepare(
        `INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('fav${i}.mp4', '/tmp/fav${i}.mp4', 1, 1)`
      ).run();
    }
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('nonfav.mp4', '/tmp/nonfav.mp4', 1, 0)"
    ).run();
    const stats = dashboardService.getStats();
    expect(stats.favoriteRecordings.length).toBeLessThanOrEqual(6);
    expect(stats.favoriteRecordings.every(r => r.is_favorite === 1)).toBe(true);
  });
});
