'use strict';
const { getDb } = require('../db');

const PAGE_SIZE = 8;

function showArchive(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * PAGE_SIZE;
    const favoritesActive = req.query.favorites === '1';
    const db = getDb();

    const where = favoritesActive
      ? 'WHERE processed=1 AND is_favorite=1'
      : 'WHERE processed=1';

    const total = db.prepare(`SELECT COUNT(*) as n FROM recordings ${where}`).get().n;
    const recordings = db.prepare(
      `SELECT * FROM recordings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(PAGE_SIZE, offset);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      favoritesActive,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
