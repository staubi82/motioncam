'use strict';
require('dotenv').config();
const config = require('./config');
const { runMigrations } = require('./db/migrations');
const { runSeeds } = require('./db/seeds');
const settingsService = require('./services/settingsService');
const watcherService = require('./services/watcherService');
const storageService = require('./services/storageService');
const { createApp } = require('./app');

// Bootstrap DB
runMigrations();
runSeeds();
settingsService.loadAll();

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`MotionCam running on port ${config.port}`);
});

function runTrashCleanup() {
  try {
    const result = storageService.purgeExpiredTrash();
    if (result.deletedCount > 0) {
      console.log(`Trash cleanup removed ${result.deletedCount} recordings (retention ${result.retentionDays} days)`);
    }
  } catch (err) {
    console.error('Trash cleanup failed:', err.message);
  }
}

runTrashCleanup();
const trashCleanupTimer = setInterval(runTrashCleanup, 60 * 60 * 1000);

// Start file watcher
watcherService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    clearInterval(trashCleanupTimer);
    watcherService.stop();
    process.exit(0);
  });
});
