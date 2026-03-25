'use strict';
const { getDb } = require('../db');

const PER_PAGE = 50;

function _getEntries(filter, limit, offset) {
  const db = getDb();

  const events = (filter === 'mail') ? [] : db.prepare(`
    SELECT
      e.id, e.type, e.occurred_at AS ts, e.meta,
      r.id   AS rec_id,
      r.filename,
      r.duration_seconds,
      r.file_size
    FROM events e
    LEFT JOIN recordings r ON r.event_id = e.id
    ORDER BY e.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset).map(e => ({ ...e, source: 'event' }));

  const mails = (filter === 'motion') ? [] : db.prepare(`
    SELECT id, type, sent_at AS ts, recipient, subject, status, error
    FROM notifications
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset).map(n => ({ ...n, source: 'notification' }));

  return [...events, ...mails]
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, limit);
}

function showLog(req, res, next) {
  try {
    const filter = ['all', 'motion', 'mail'].includes(req.query.filter) ? req.query.filter : 'all';
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    const entries = _getEntries(filter, PER_PAGE, offset);

    // Check if there are more pages (rough heuristic)
    const hasMore = entries.length === PER_PAGE;

    res.render('log', { entries, filter, page, hasMore, username: req.session.username });
  } catch (err) { next(err); }
}

function getLogJson(req, res, next) {
  try {
    const filter  = ['all', 'motion', 'mail'].includes(req.query.filter) ? req.query.filter : 'all';
    const since   = req.query.since; // ISO string — only return entries newer than this
    const entries = _getEntries(filter, 100, 0)
      .filter(e => !since || new Date(e.ts + 'Z') > new Date(since));
    res.json(entries);
  } catch (err) { next(err); }
}

module.exports = { showLog, getLogJson };
