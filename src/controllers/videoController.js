'use strict';
const { getDb } = require('../db');
const storageService = require('../services/storageService');

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

module.exports = { showVideo, deleteVideo, downloadVideo };
