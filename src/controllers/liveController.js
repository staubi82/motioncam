'use strict';

function showLive(req, res) {
  res.render('live', { username: req.session.username });
}

module.exports = { showLive };
