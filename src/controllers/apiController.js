'use strict';
const http = require('http');
const fs = require('fs');
const config = require('../config');
const settingsService = require('../services/settingsService');
const dashboardService = require('../services/dashboardService');

function proxyStream(req, res, next) {
  const port = config.motionStreamPort;
  const options = { hostname: '127.0.0.1', port, path: '/', timeout: 3000 };

  const proxyReq = http.get(options, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'multipart/x-mixed-replace');
    proxyRes.pipe(res);
    res.on('close', () => proxyReq.destroy());
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) res.status(503).json({ error: 'Stream not available' });
  });
}

function getSnapshot(req, res) {
  const snapPath = settingsService.get('snapshot_path');
  if (!snapPath || !fs.existsSync(snapPath)) {
    return res.status(404).json({ error: 'Snapshot not available' });
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(require('path').resolve(snapPath));
}

function getDashboardStats(req, res, next) {
  try {
    res.json(dashboardService.getStats());
  } catch (err) { next(err); }
}

module.exports = { proxyStream, getSnapshot, getDashboardStats };
