'use strict';
const { getDb } = require('../db');

const ALLOWED_PAGE_SIZES = [8, 16, 24, 48];

function showArchive(req, res, next) {
  try {
    const perPage = ALLOWED_PAGE_SIZES.includes(parseInt(req.query.per_page, 10))
      ? parseInt(req.query.per_page, 10)
      : 8;
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const trashActive = req.query.trash === '1';
    const favoritesActive = !trashActive && req.query.favorites === '1';
    const db = getDb();

    const where = trashActive
      ? 'WHERE processed=1 AND deleted_at IS NOT NULL'
      : favoritesActive
        ? 'WHERE processed=1 AND is_favorite=1 AND deleted_at IS NULL'
        : 'WHERE processed=1 AND deleted_at IS NULL';

    const total = db.prepare(`SELECT COUNT(*) as n FROM recordings ${where}`).get().n;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (requestedPage > totalPages) {
      const params = new URLSearchParams({
        page: String(totalPages),
        per_page: String(perPage),
      });
      if (trashActive) params.set('trash', '1');
      else if (favoritesActive) params.set('favorites', '1');
      return res.redirect(`/archive?${params.toString()}`);
    }

    const page = requestedPage;
    const offset = (page - 1) * perPage;
    const recordings = db.prepare(
      `SELECT * FROM recordings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(perPage, offset);

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      favoritesActive,
      trashActive,
      perPage,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
