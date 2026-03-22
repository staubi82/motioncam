'use strict';
jest.mock('child_process');
const { spawn } = require('child_process');
const EventEmitter = require('events');

const ffmpegService = require('../../src/services/ffmpegService');

function makeMockProcess() {
  const proc = new EventEmitter();
  proc.pid = 12345;
  proc.kill = jest.fn();
  proc.stdin = { end: jest.fn() };
  return proc;
}

describe('ffmpegService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ffmpegService.reset();
  });

  test('isRecording returns false initially', () => {
    expect(ffmpegService.isRecording()).toBe(false);
  });

  test('spawn starts a process and isRecording becomes true', () => {
    const proc = makeMockProcess();
    spawn.mockReturnValue(proc);

    ffmpegService.spawn('/tmp/test.mp4', {
      cameraDevice: '/dev/video0',
      audioDevice: 'hw:1,0',
      videoFps: '15',
      videoResolution: '1280x720',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      audioEnabled: true,
    });

    expect(spawn).toHaveBeenCalledWith('ffmpeg', expect.any(Array));
    expect(ffmpegService.isRecording()).toBe(true);
  });

  test('stop sends SIGINT and resolves when process exits', async () => {
    const proc = makeMockProcess();
    spawn.mockReturnValue(proc);

    ffmpegService.spawn('/tmp/test.mp4', {
      cameraDevice: '/dev/video0',
      audioDevice: 'hw:1,0',
      videoFps: '15',
      videoResolution: '1280x720',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      audioEnabled: true,
    });

    const stopPromise = ffmpegService.stop();
    expect(proc.kill).toHaveBeenCalledWith('SIGINT');
    proc.emit('close', 0);
    await stopPromise;
    expect(ffmpegService.isRecording()).toBe(false);
  });
});
