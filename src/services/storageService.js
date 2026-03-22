'use strict';
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');

function getDiskUsage() {
  const dir = settingsService.get('storage_path');
  if (!dir || !fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).reduce((acc, f) => {
    try {
      return acc + fs.statSync(path.join(dir, f)).size;
    } catch { return acc; }
  }, 0);
}

function deleteRecording(id) {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if (!rec) throw Object.assign(new Error('Recording not found'), { status: 404 });

  try { fs.unlinkSync(rec.filepath); } catch {}
  if (rec.thumbnail_path) try { fs.unlinkSync(rec.thumbnail_path); } catch {}

  db.prepare('DELETE FROM recordings WHERE id=?').run(id);
}

module.exports = { getDiskUsage, deleteRecording };
