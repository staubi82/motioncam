'use strict';
const { getDb } = require('../db');

const ALLOWED_PAGE_SIZES = [8, 16, 24, 48];

function showArchive(req, res, next) {
  try {
    const perPage = ALLOWED_PAGE_SIZES.includes(parseInt(req.query.per_page, 10))
      ? parseInt(req.query.per_page, 10)
      : 8;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * perPage;
    const favoritesActive = req.query.favorites === '1';
    const db = getDb();

    const where = favoritesActive
      ? 'WHERE processed=1 AND is_favorite=1'
      : 'WHERE processed=1';

    const total = db.prepare(`SELECT COUNT(*) as n FROM recordings ${where}`).get().n;
    const recordings = db.prepare(
      `SELECT * FROM recordings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(perPage, offset);

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      favoritesActive,
      perPage,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
