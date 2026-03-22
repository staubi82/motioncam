'use strict';
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  dbPath: process.env.DB_PATH || './data/motioncam.db',
  videoPath: process.env.VIDEO_PATH || './public/uploads',
  thumbnailPath: process.env.THUMBNAIL_PATH || './public/thumbnails',
  snapshotPath: process.env.SNAPSHOT_PATH || '/tmp/lastsnap.jpg',
  cameraDevice: process.env.CAMERA_DEVICE || '/dev/video0',
  audioDevice: process.env.AUDIO_DEVICE || 'hw:1,0',
  motionStreamPort: parseInt(process.env.MOTION_STREAM_PORT || '8081', 10),
  motionConfPath: process.env.MOTION_CONF_PATH || '/etc/motion/motion.conf',
  hookSecret: process.env.HOOK_SECRET || 'dev-hook-secret',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
};
