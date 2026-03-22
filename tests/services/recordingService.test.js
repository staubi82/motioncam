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

  test('startRecording(skipCooldown=true) bypasses cooldown', async () => {
    ffmpegService.spawn.mockReturnValue({ pid: 1 });

    // Insert a very recent motion_start event to trigger cooldown
    const db = getDb();
    db.prepare("INSERT INTO events (type) VALUES ('motion_start')").run();

    // Without skipCooldown: should be blocked by cooldown
    await recordingService.startRecording();
    expect(ffmpegService.spawn).not.toHaveBeenCalled();

    // With skipCooldown=true: should start despite cooldown
    await recordingService.startRecording(true);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);
  });

  test('max_clip_duration > 0 rotates clip after timeout', async () => {
    jest.useFakeTimers();
    settingsService.set('max_clip_duration_seconds', '60');
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    ffmpegService.stop.mockResolvedValue();
    thumbnailService.process.mockResolvedValue({
      duration: 60, fileSize: 5000, width: 1280, height: 720, thumbnailPath: '/tmp/t.jpg'
    });
    // Second startRecording (after rotation) should see isRecording=false, then set to true
    ffmpegService.isRecording
      .mockReturnValueOnce(false)  // initial startRecording check
      .mockReturnValueOnce(false)  // rotation: startRecording(true) check
      .mockReturnValue(true);      // block any further recursive starts

    await recordingService.startRecording(true);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);

    // Advance exactly 60s so only the first max-duration timer fires
    await jest.advanceTimersByTimeAsync(60000);
    expect(ffmpegService.stop).toHaveBeenCalledTimes(1);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
    settingsService.set('max_clip_duration_seconds', '0');
  });

  test('max_clip_duration = 0 does not rotate clip', async () => {
    jest.useFakeTimers();
    settingsService.set('max_clip_duration_seconds', '0');
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    ffmpegService.stop.mockResolvedValue();

    await recordingService.startRecording(true);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);

    await jest.runAllTimersAsync();
    expect(ffmpegService.stop).not.toHaveBeenCalled();
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test('scheduleStop cancels _maxDurationTimer', async () => {
    jest.useFakeTimers();
    settingsService.set('max_clip_duration_seconds', '60');
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    ffmpegService.stop.mockResolvedValue();
    thumbnailService.process.mockResolvedValue({
      duration: 5, fileSize: 500, width: 1280, height: 720, thumbnailPath: '/tmp/t.jpg'
    });

    await recordingService.startRecording(true);
    recordingService.scheduleStop();

    // scheduleStop fires (nachlaufzeit), rotation should NOT start a second clip
    await jest.runAllTimersAsync();
    // Only one spawn (from start), stop called once by scheduleStop
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);
    expect(ffmpegService.stop).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
    settingsService.set('max_clip_duration_seconds', '0');
  });
});
