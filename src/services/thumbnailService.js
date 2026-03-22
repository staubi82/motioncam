'use strict';
const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function process(videoPath, thumbDir) {
  // Step 1: ffprobe
  const stdout = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    videoPath,
  ]);

  const info = JSON.parse(stdout);
  const videoStream = info.streams?.find(s => s.codec_type === 'video') || null;
  const duration = parseFloat(info.format?.duration || '0') || 0;
  const fileSize = parseInt(info.format?.size || '0', 10) || 0;

  const width = videoStream?.width ?? null;
  const height = videoStream?.height ?? null;
  const codec = videoStream?.codec_name ?? null;

  // Step 2: Generate thumbnail at midpoint
  const basename = path.basename(videoPath, '.mp4');
  const thumbnailPath = path.join(thumbDir, `${basename}.jpg`);
  const seekTime = Math.max(0, duration / 2);

  await execFileAsync('ffmpeg', [
    '-ss', String(seekTime),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    '-y',
    thumbnailPath,
  ]);

  return { duration, fileSize, width, height, codec, thumbnailPath };
}

module.exports = { process };
