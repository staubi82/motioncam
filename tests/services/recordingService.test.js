'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/thumbnailService');
jest.mock('../../src/services/mailService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const thumbnailService = require('../../src/services/thumbnailService');
const mailService = require('../../src/services/mailService');
const recordingService = require('../../src/services/recordingService');
const { getDb } = require('../../src/db');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
});

beforeEach(() => {
  jest.clearAllMocks();
  recordingService.reset();
  ffmpegService.isRecording.mockReturnValue(false);
  mailService.notifyIfEnabled.mockResolvedValue();

  // Clear recordings table to avoid UNIQUE constraint violations
  const db = getDb();
  db.prepare('DELETE FROM recordings').run();
  db.prepare('DELETE FROM events').run();
});

describe('recordingService', () => {
  test('startRecording spawns ffmpeg and creates DB record', async () => {
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    await recordingService.startRecording();

    const db = getDb();
    const recording = db.prepare("SELECT * FROM recordings ORDER BY id DESC LIMIT 1").get();
    expect(recording).toBeTruthy();
    expect(recording.processed).toBe(0);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);
  });

  test('startRecording does nothing if already recording', async () => {
    ffmpegService.isRecording.mockReturnValue(true);
    await recordingService.startRecording();
    expect(ffmpegService.spawn).not.toHaveBeenCalled();
  });

  test('scheduleStop sets a timer', async () => {
    jest.useFakeTimers();
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    ffmpegService.stop.mockResolvedValue();
    thumbnailService.process.mockResolvedValue({
      duration: 10, fileSize: 1000, width: 1280, height: 720, codec: 'h264', thumbnailPath: '/tmp/t.jpg'
    });

    await recordingService.startRecording();
    recordingService.scheduleStop();

    expect(recordingService.isStopScheduled()).toBe(true);
    jest.runAllTimers();
    jest.useRealTimers();
  });
});
