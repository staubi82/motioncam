'use strict';
const { getDb } = require('../db');
const ffmpegService = require('./ffmpegService');
const storageService = require('./storageService');

function getStats() {
  const db = getDb();

  const totalRecordings = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1').get().n;
  const latestRecording = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 ORDER BY created_at DESC LIMIT 1'
  ).get() || null;
  const totalDuration = db.prepare(
    'SELECT SUM(duration_seconds) as s FROM recordings WHERE processed=1'
  ).get().s || 0;
  const todayCount = db.prepare(
    "SELECT COUNT(*) as n FROM recordings WHERE date(created_at)=date('now')"
  ).get().n;
  const diskUsage = storageService.getDiskUsage();
  const isRecording = ffmpegService.isRecording();

  return { totalRecordings, latestRecording, totalDuration, todayCount, diskUsage, isRecording };
}

module.exports = { getStats };
