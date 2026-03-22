'use strict';
jest.mock('child_process');
const { execFile } = require('child_process');

const thumbnailService = require('../../src/services/thumbnailService');

describe('thumbnailService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('process calls ffprobe then ffmpeg', async () => {
    const ffprobeOutput = JSON.stringify({
      streams: [{ codec_type: 'video', width: 1280, height: 720, codec_name: 'h264' }],
      format: { duration: '60.0', size: '5000000' },
    });

    execFile.mockImplementation((cmd, args, cb) => {
      if (cmd === 'ffprobe') cb(null, { stdout: ffprobeOutput, stderr: '' });
      else cb(null, { stdout: '', stderr: '' });
    });

    const result = await thumbnailService.process('/tmp/test.mp4', '/tmp/thumbs');
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(result.duration).toBeCloseTo(60);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.thumbnailPath).toContain('.jpg');
  });

  test('process handles missing video stream gracefully', async () => {
    const ffprobeOutput = JSON.stringify({ streams: [], format: { duration: '0', size: '0' } });
    execFile.mockImplementation((cmd, args, cb) => cb(null, { stdout: ffprobeOutput, stderr: '' }));

    const result = await thumbnailService.process('/tmp/empty.mp4', '/tmp/thumbs');
    expect(result.duration).toBe(0);
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });
});
