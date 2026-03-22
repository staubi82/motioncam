'use strict';
const dashboardService = require('../services/dashboardService');

function showDashboard(req, res, next) {
  try {
    const stats = dashboardService.getStats();
    res.render('dashboard', { stats, username: req.session.username });
  } catch (err) { next(err); }
}

module.exports = { showDashboard };
