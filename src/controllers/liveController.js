'use strict';
const settingsService = require('../services/settingsService');

function showLive(req, res) {
  const all = settingsService.getAll();
  const overlayConfig = {
    overlay_enabled:         all.overlay_enabled,
    overlay_show_datetime:   all.overlay_show_datetime,
    overlay_show_resolution: all.overlay_show_resolution,
    overlay_show_location:   all.overlay_show_location,
    overlay_location_name:   all.overlay_location_name,
    overlay_position:        all.overlay_position || 'top-left',
    video_resolution:        all.video_resolution,
  };
  res.render('live', { username: req.session.username, overlayConfig });
}

module.exports = { showLive };
