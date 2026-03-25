'use strict';
const { getDb } = require('../db');
const storageService = require('../services/storageService');

function bulkDeleteVideos(req, res, next) {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ ok: false, message: 'Keine IDs angegeben' });
    storageService.deleteRecordings(ids.map(Number));
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function showVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).render('error', { message: 'Video nicht gefunden', status: 404 });
    res.render('video', { recording, username: req.session.username });
  } catch (err) { next(err); }
}

function deleteVideo(req, res, next) {
  try {
    storageService.deleteRecording(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function downloadVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Not found' });
    res.download(recording.filepath, recording.filename);
  } catch (err) { next(err); }
}

module.exports = { showVideo, deleteVideo, downloadVideo, bulkDeleteVideos };
