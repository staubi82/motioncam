'use strict';
const config = require('../config');

function requireHookSecret(req, res, next) {
  const secret = req.headers['x-hook-secret'];
  if (!secret || secret !== config.hookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireHookSecret };
