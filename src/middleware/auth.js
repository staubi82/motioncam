'use strict';

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect('/login');
}

module.exports = { requireLogin };
