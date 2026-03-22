'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/recordingService');
jest.mock('../../src/services/mailService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const recordingService = require('../../src/services/recordingService');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
});

beforeEach(() => {
  jest.clearAllMocks();
  ffmpegService.isRecording.mockReturnValue(false);
  recordingService.startRecording.mockResolvedValue();
  recordingService.scheduleStop.mockReturnValue();
});

describe('testMotion controller', () => {
  function makeRes() {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    return res;
  }

  test('returns 409 when already recording', async () => {
    ffmpegService.isRecording.mockReturnValue(true);
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: false }, session: {} };
    const res = makeRes();
    await testMotion(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  test('returns ok:true and calls startRecording when idle', async () => {
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: false }, session: {} };
    const res = makeRes();
    await testMotion(req, res);
    expect(recordingService.startRecording).toHaveBeenCalledWith(true);
    expect(recordingService.scheduleStop).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('returns 409 when recording is disabled', async () => {
    settingsService.set('recording_enabled', 'false');
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: false }, session: {} };
    const res = makeRes();
    await testMotion(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    settingsService.set('recording_enabled', 'true');
  });

  test('includes mailError when smtp not configured', async () => {
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: 'true' }, session: {} };
    const res = makeRes();
    await testMotion(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mailError: expect.any(String) }));
  });
});
