'use strict';
const http = require('http');
const fs = require('fs');
const config = require('../config');
const settingsService = require('../services/settingsService');
const dashboardService = require('../services/dashboardService');
const systemService = require('../services/systemService');
const { getDb } = require('../db');

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

async function getSystemStatus(req, res, next) {
  try {
    const [cpuPercent, diskInfo] = await Promise.all([
      systemService.getCpuPercent(),
      systemService.getDiskInfo(settingsService.get('storage_path') || '/'),
    ]);
    const { ramUsedMB, ramTotalMB } = systemService.getRamInfo();
    const tempCelsius = systemService.getTempCelsius();
    res.json({ cpuPercent, ramUsedMB, ramTotalMB, tempCelsius, ...diskInfo });
  } catch (err) { next(err); }
}

function patchFavorite(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const val = req.body.is_favorite;
    if (val !== 0 && val !== 1) return res.status(400).json({ error: 'is_favorite must be 0 or 1' });
    const db = getDb();
    const rec = db.prepare('SELECT id FROM recordings WHERE id=?').get(id);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    db.prepare('UPDATE recordings SET is_favorite=? WHERE id=?').run(val, id);
    res.json({ id, is_favorite: val });
  } catch (err) { next(err); }
}

module.exports = { proxyStream, getSnapshot, getDashboardStats, getSystemStatus, patchFavorite };
