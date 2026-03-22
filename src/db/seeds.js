'use strict';
const { getDb } = require('./index');
const config = require('../config');

const DEFAULTS = [
  ['detection_enabled', 'true'],
  ['detection_sensitivity', '50'],
  ['detection_min_area', '500'],
  ['event_cooldown_seconds', '60'],
  ['recording_enabled', 'true'],
  ['recording_nachlaufzeit_seconds', '30'],
  ['video_fps', '15'],
  ['video_resolution', '1280x720'],
  ['video_bitrate', '2000k'],
  ['audio_enabled', 'true'],
  ['audio_bitrate', '128k'],
  ['storage_path', config.videoPath],
  ['thumbnail_path', config.thumbnailPath],
  ['snapshot_path', config.snapshotPath],
  ['camera_device', config.cameraDevice],
  ['audio_device', config.audioDevice],
  ['mail_enabled', 'false'],
  ['mail_cooldown_seconds', '300'],
  ['mail_snapshot_attach', 'true'],
  ['smtp_host', ''],
  ['smtp_port', '587'],
  ['smtp_user', ''],
  ['smtp_pass', ''],
  ['smtp_tls', 'true'],
  ['smtp_from', ''],
  ['mail_recipient', ''],
  ['overlay_enabled', 'false'],
  ['overlay_show_datetime', 'true'],
  ['overlay_show_resolution', 'true'],
  ['overlay_show_location', 'true'],
  ['overlay_location_name', ''],
  ['overlay_position', 'top-left'],
];

function runSeeds() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const [key, value] of rows) insert.run(key, value);
  });
  insertMany(DEFAULTS);
}

module.exports = { runSeeds };
