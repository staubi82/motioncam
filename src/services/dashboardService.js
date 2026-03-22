'use strict';
const { getDb } = require('../db');
const ffmpegService = require('./ffmpegService');

function getStats() {
  const db = getDb();

  const totalRecordings = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1').get().n;
  const latestRecordings = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 ORDER BY created_at DESC LIMIT 8'
  ).all();
  const totalDuration = db.prepare(
    'SELECT SUM(duration_seconds) as s FROM recordings WHERE processed=1'
  ).get().s || 0;
  const todayCount = db.prepare(
    "SELECT COUNT(*) as n FROM recordings WHERE date(created_at)=date('now')"
  ).get().n;
  const isRecording = ffmpegService.isRecording();
  const favoriteRecordings = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 AND is_favorite=1 ORDER BY created_at DESC LIMIT 6'
  ).all();

  return { totalRecordings, latestRecordings, totalDuration, todayCount, isRecording, favoriteRecordings };
}

module.exports = { getStats };
