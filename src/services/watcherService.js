'use strict';
const chokidar = require('chokidar');
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');
const thumbnailService = require('./thumbnailService');

let _watcher = null;

function start() {
  const watchDir = settingsService.get('storage_path');
  if (!watchDir) return;

  _watcher = chokidar.watch(path.join(watchDir, '*.mp4'), {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  });

  _watcher.on('add', async (filepath) => {
    const filename = path.basename(filepath);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM recordings WHERE filename=?').get(filename);
    if (existing) return;

    const thumbDir = settingsService.get('thumbnail_path');
    try {
      const meta = await thumbnailService.process(filepath, thumbDir);
      db.prepare(`
        INSERT INTO recordings (filename, filepath, thumbnail_path, duration_seconds,
          file_size, width, height, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(filename, filepath, meta.thumbnailPath, meta.duration, meta.fileSize, meta.width, meta.height);
    } catch (err) {
      console.error('Watcher: could not process', filepath, err.message);
    }
  });
}

function stop() {
  if (_watcher) { _watcher.close(); _watcher = null; }
}

module.exports = { start, stop };
