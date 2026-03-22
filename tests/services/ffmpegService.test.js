'use strict';
jest.mock('child_process');
const { spawn } = require('child_process');
const EventEmitter = require('events');

const ffmpegService = require('../../src/services/ffmpegService');
const { buildOverlayFilter } = require('../../src/services/ffmpegService');

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

  test('spawn uses -vf with scale when overlay is enabled', () => {
    const proc = makeMockProcess();
    spawn.mockReturnValue(proc);

    ffmpegService.spawn('/tmp/test.mp4', {
      cameraDevice: '/dev/video0',
      audioDevice: 'hw:1,0',
      videoFps: '15',
      videoResolution: '1280x720',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      audioEnabled: false,
      overlaySettings: {
        overlay_enabled: 'true',
        overlay_show_datetime: 'true',
        overlay_show_resolution: 'false',
        overlay_show_location: 'false',
        overlay_location_name: '',
        overlay_position: 'top-left',
        video_resolution: '1280x720',
      },
    });

    const args = spawn.mock.calls[0][1];
    expect(args).toContain('-vf');
    expect(args).not.toContain('-s');
    const vfIndex = args.indexOf('-vf');
    expect(args[vfIndex + 1]).toContain('scale=1280:720');
    expect(args[vfIndex + 1]).toContain('drawtext=');
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

describe('buildOverlayFilter', () => {
  const base = {
    overlay_enabled: 'true',
    overlay_show_datetime: 'true',
    overlay_show_resolution: 'false',
    overlay_show_location: 'false',
    overlay_location_name: '',
    overlay_position: 'top-left',
    video_resolution: '1280x720',
  };

  test('returns null when overlay disabled', () => {
    expect(buildOverlayFilter({ ...base, overlay_enabled: 'false' })).toBeNull();
  });

  test('returns null when no fields enabled', () => {
    expect(buildOverlayFilter({
      ...base,
      overlay_show_datetime: 'false',
    })).toBeNull();
  });

  test('returns filter string with position top-left', () => {
    const result = buildOverlayFilter(base);
    expect(result).toContain('drawtext=');
    expect(result).toContain('x=10');
    expect(result).toContain('y=10');
    expect(result).toContain('localtime');
  });

  test('returns filter with bottom-right position', () => {
    const result = buildOverlayFilter({ ...base, overlay_position: 'bottom-right' });
    expect(result).toContain('x=w-tw-10');
    expect(result).toContain('y=h-th-10');
  });

  test('includes resolution when enabled', () => {
    const result = buildOverlayFilter({ ...base, overlay_show_resolution: 'true' });
    expect(result).toContain('1280x720');
  });

  test('includes location when enabled and non-empty', () => {
    const result = buildOverlayFilter({
      ...base,
      overlay_show_location: 'true',
      overlay_location_name: 'Eingang',
    });
    expect(result).toContain('Eingang');
  });

  test('escapes special chars in location name', () => {
    const result = buildOverlayFilter({
      ...base,
      overlay_show_location: 'true',
      overlay_location_name: "Eingang: 1's",
    });
    expect(result).toContain("Eingang\\: 1\\'s");
  });

  test('falls back to top-left for invalid position', () => {
    const result = buildOverlayFilter({ ...base, overlay_position: 'center' });
    expect(result).toContain('x=10');
    expect(result).toContain('y=10');
  });
});
