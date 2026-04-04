'use strict';
const { getDb } = require('../db');
const ffmpegService = require('./ffmpegService');

function getStats() {
  const db = getDb();

  const totalRecordings = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1 AND deleted_at IS NULL').get().n;
  const latestRecordings = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 8'
  ).all();
  const totalDuration = db.prepare(
    'SELECT SUM(duration_seconds) as s FROM recordings WHERE processed=1 AND deleted_at IS NULL'
  ).get().s || 0;
  const todayCount = db.prepare(
    "SELECT COUNT(*) as n FROM recordings WHERE processed=1 AND deleted_at IS NULL AND date(created_at)=date('now')"
  ).get().n;
  const isRecording = ffmpegService.isRecording();
  const favoriteRecordings = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 AND deleted_at IS NULL AND is_favorite=1 ORDER BY created_at DESC LIMIT 6'
  ).all();

  return { totalRecordings, latestRecordings, totalDuration, todayCount, isRecording, favoriteRecordings };
}

function getLast7DaysActivity() {
  const db = getDb();
  // Get counts grouped by date for the last 7 days
  const rows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM recordings
    WHERE processed = 1
      AND deleted_at IS NULL
      AND date(created_at) >= date('now', '-6 days')
    GROUP BY date(created_at)
  `).all();

  // Build a map: { '2026-03-22': 5, ... }
  const countMap = {};
  for (const row of rows) countMap[row.day] = row.count;

  // Generate last 7 days with German labels
  const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    result.push({
      label: dayLabels[d.getDay()],
      count: countMap[iso] || 0,
      isToday: i === 0,
    });
  }
  return result;
}

module.exports = { getStats, getLast7DaysActivity };
