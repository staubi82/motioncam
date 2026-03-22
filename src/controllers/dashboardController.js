'use strict';
const dashboardService = require('../services/dashboardService');

function showDashboard(req, res, next) {
  try {
    const stats = dashboardService.getStats();
    stats.last7Days = dashboardService.getLast7DaysActivity();
    res.render('dashboard', { stats, username: req.session.username });
  } catch (err) { next(err); }
}

module.exports = { showDashboard };
