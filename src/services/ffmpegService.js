'use strict';
const { spawn: spawnProcess } = require('child_process');
const fs = require('fs');

const DEJAVU_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
const FONT_AVAILABLE = fs.existsSync(DEJAVU_FONT);

const POSITION_MAP = {
  'top-left':     { x: '10',      y: '10' },
  'top-right':    { x: 'w-tw-10', y: '10' },
  'bottom-left':  { x: '10',      y: 'h-th-10' },
  'bottom-right': { x: 'w-tw-10', y: 'h-th-10' },
};

function escapeDrawtext(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');
}

function buildOverlayFilter(settings) {
  if (settings.overlay_enabled !== 'true') return null;

  const parts = [];
  if (settings.overlay_show_datetime === 'true') {
    parts.push('%{localtime\\:%d.%m.%Y %H\\:%M\\:%S}');
  }
  if (settings.overlay_show_resolution === 'true') {
    parts.push(escapeDrawtext(settings.video_resolution || ''));
  }
  if (settings.overlay_show_location === 'true' && settings.overlay_location_name) {
    parts.push(escapeDrawtext(settings.overlay_location_name));
  }

  if (parts.length === 0) return null;

  const pos = POSITION_MAP[settings.overlay_position] || POSITION_MAP['top-left'];
  const text = parts.join('\\n');

  const fontPart = FONT_AVAILABLE ? `fontfile=${DEJAVU_FONT}:` : '';
  return `drawtext=${fontPart}fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=4:x=${pos.x}:y=${pos.y}:text='${text}'`;
}

let _proc = null;

function isRecording() {
  return _proc !== null;
}

function reset() {
  _proc = null;
}

function spawn(outputPath, opts) {
  if (_proc) throw new Error('FFmpeg already running');

  const isHttpSource = opts.cameraDevice.startsWith('http');
  const args = isHttpSource
    ? ['-i', opts.cameraDevice]
    : ['-f', 'v4l2', '-i', opts.cameraDevice];

  if (opts.audioEnabled) {
    args.push('-f', 'alsa', '-i', opts.audioDevice);
  }

  const overlayFilter = buildOverlayFilter(opts.overlaySettings || {});

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-b:v', opts.videoBitrate,
    '-r', String(opts.videoFps),
  );

  const ALLOWED_RESOLUTIONS = new Set(['640x480', '1280x720', '1920x1080']);
  const resolution = ALLOWED_RESOLUTIONS.has(opts.videoResolution) ? opts.videoResolution : '1280x720';

  if (overlayFilter) {
    const [w, h] = resolution.split('x');
    args.push('-vf', `scale=${w}:${h},${overlayFilter}`);
  } else {
    args.push('-s', resolution);
  }

  if (opts.audioEnabled) {
    args.push('-c:a', 'aac', '-b:a', opts.audioBitrate);
  }

  args.push('-movflags', '+faststart', outputPath);

  _proc = spawnProcess('ffmpeg', args);

  _proc.on('close', () => { _proc = null; });
  _proc.stderr?.on('data', () => {}); // suppress stderr

  return _proc;
}

function stop() {
  return new Promise((resolve) => {
    if (!_proc) return resolve();
    _proc.once('close', resolve);
    _proc.kill('SIGINT');
  });
}

module.exports = { spawn, stop, isRecording, reset, buildOverlayFilter };
