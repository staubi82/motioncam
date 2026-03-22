'use strict';
const { spawn: spawnProcess } = require('child_process');

let _proc = null;

function isRecording() {
  return _proc !== null;
}

function reset() {
  _proc = null;
}

function spawn(outputPath, opts) {
  if (_proc) throw new Error('FFmpeg already running');

  const args = [
    '-f', 'v4l2', '-i', opts.cameraDevice,
  ];

  if (opts.audioEnabled) {
    args.push('-f', 'alsa', '-i', opts.audioDevice);
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-b:v', opts.videoBitrate,
    '-r', String(opts.videoFps),
    '-s', opts.videoResolution,
  );

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

module.exports = { spawn, stop, isRecording, reset };
