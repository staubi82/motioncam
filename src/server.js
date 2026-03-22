'use strict';
require('dotenv').config();
const config = require('./config');
const { runMigrations } = require('./db/migrations');
const { runSeeds } = require('./db/seeds');
const settingsService = require('./services/settingsService');
const watcherService = require('./services/watcherService');
const { createApp } = require('./app');

// Bootstrap DB
runMigrations();
runSeeds();
settingsService.loadAll();

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`MotionCam running on port ${config.port}`);
});

// Start file watcher
watcherService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    watcherService.stop();
    process.exit(0);
  });
});
