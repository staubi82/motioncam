'use strict';
const { getDb } = require('../db');

const PAGE_SIZE = 8;

function showArchive(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * PAGE_SIZE;
    const db = getDb();

    const total = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1').get().n;
    const recordings = db.prepare(
      'SELECT * FROM recordings WHERE processed=1 ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(PAGE_SIZE, offset);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
