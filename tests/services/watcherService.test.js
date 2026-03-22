'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('chokidar');
jest.mock('../../src/services/thumbnailService');

const chokidar = require('chokidar');
const { EventEmitter } = require('events');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const watcherService = require('../../src/services/watcherService');
const thumbnailService = require('../../src/services/thumbnailService');
const { getDb } = require('../../src/db');

let mockWatcher;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  settingsService.set('storage_path', '/tmp/uploads');
  settingsService.set('thumbnail_path', '/tmp/thumbs');
  mockWatcher = new EventEmitter();
  mockWatcher.close = jest.fn();
  chokidar.watch.mockReturnValue(mockWatcher);
});

afterEach(() => watcherService.stop());

describe('watcherService', () => {
  test('start() calls chokidar.watch', () => {
    watcherService.start();
    expect(chokidar.watch).toHaveBeenCalled();
  });

  test('new untracked .mp4 triggers DB insert', async () => {
    thumbnailService.process.mockResolvedValue({
      duration: 5, fileSize: 500, width: 1280, height: 720, codec: 'h264',
      thumbnailPath: '/tmp/thumbs/new.jpg',
    });
    watcherService.start();
    mockWatcher.emit('add', '/tmp/uploads/new.mp4');
    await new Promise(r => setTimeout(r, 50));
    const db = getDb();
    const row = db.prepare("SELECT * FROM recordings WHERE filename='new.mp4'").get();
    expect(row).toBeTruthy();
    expect(row.processed).toBe(1);
  });
});
