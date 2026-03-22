'use strict';
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');
const ffmpegService = require('./ffmpegService');
const thumbnailService = require('./thumbnailService');
const mailService = require('./mailService');

let _currentRecordingId = null;
let _currentFilepath = null;
let _stopTimer = null;

function reset() {
  _currentRecordingId = null;
  _currentFilepath = null;
  if (_stopTimer) { clearTimeout(_stopTimer); _stopTimer = null; }
}

function isStopScheduled() {
  return _stopTimer !== null;
}

async function startRecording(skipCooldown = false) {
  if (ffmpegService.isRecording()) return;

  const recordingEnabled = settingsService.getBool('recording_enabled');
  if (!recordingEnabled) return;

  const db = getDb();

  // Cooldown check
  if (!skipCooldown) {
    const cooldown = settingsService.getInt('event_cooldown_seconds');
    const lastEvent = db.prepare(
      "SELECT occurred_at FROM events WHERE type='motion_start' ORDER BY id DESC LIMIT 1"
    ).get();
    if (lastEvent) {
      const lastTime = new Date(lastEvent.occurred_at + 'Z').getTime();
      if (Date.now() - lastTime < cooldown * 1000) return;
    }
  }

  const now = new Date();
  const filename = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19) + '.mp4';
  const storagePath = settingsService.get('storage_path');
  const filepath = path.join(storagePath, filename);

  const opts = {
    cameraDevice: settingsService.get('camera_device'),
    audioDevice: settingsService.get('audio_device'),
    videoFps: settingsService.get('video_fps'),
    videoResolution: settingsService.get('video_resolution'),
    videoBitrate: settingsService.get('video_bitrate'),
    audioBitrate: settingsService.get('audio_bitrate'),
    audioEnabled: settingsService.getBool('audio_enabled'),
    overlaySettings: {
      overlay_enabled:         settingsService.get('overlay_enabled'),
      overlay_show_datetime:   settingsService.get('overlay_show_datetime'),
      overlay_show_resolution: settingsService.get('overlay_show_resolution'),
      overlay_show_location:   settingsService.get('overlay_show_location'),
      overlay_location_name:   settingsService.get('overlay_location_name'),
      overlay_position:        settingsService.get('overlay_position'),
      video_resolution:        settingsService.get('video_resolution'),
    },
  };

  ffmpegService.spawn(filepath, opts);

  // Log event
  const eventResult = db.prepare(
    "INSERT INTO events (type) VALUES ('motion_start')"
  ).run();

  // Create recording record
  const recResult = db.prepare(
    'INSERT INTO recordings (filename, filepath, event_id) VALUES (?, ?, ?)'
  ).run(filename, filepath, eventResult.lastInsertRowid);

  _currentRecordingId = recResult.lastInsertRowid;
  _currentFilepath = filepath;

  // Mail notification (non-blocking)
  mailService.notifyIfEnabled().catch(() => {});
}

function scheduleStop() {
  if (_stopTimer) return;
  const nachlaufzeit = settingsService.getInt('recording_nachlaufzeit_seconds') || 30;
  _stopTimer = setTimeout(() => _finishRecording(), nachlaufzeit * 1000);
}

async function _finishRecording() {
  _stopTimer = null;
  await ffmpegService.stop();

  if (!_currentRecordingId || !_currentFilepath) return;

  const db = getDb();
  const thumbPath = settingsService.get('thumbnail_path');
  try {
    const meta = await thumbnailService.process(_currentFilepath, thumbPath);
    db.prepare(`
      UPDATE recordings SET
        thumbnail_path = ?, duration_seconds = ?, file_size = ?,
        width = ?, height = ?, processed = 1
      WHERE id = ?
    `).run(meta.thumbnailPath, meta.duration, meta.fileSize, meta.width, meta.height, _currentRecordingId);
  } catch (err) {
    console.error('Post-processing failed:', err.message);
  }

  db.prepare("INSERT INTO events (type) VALUES ('recording_complete')").run();
  _currentRecordingId = null;
  _currentFilepath = null;
}

module.exports = { startRecording, scheduleStop, reset, isStopScheduled };
