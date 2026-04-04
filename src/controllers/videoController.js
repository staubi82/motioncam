'use strict';
const { getDb } = require('../db');
const storageService = require('../services/storageService');
const ALLOWED_PAGE_SIZES = [8, 16, 24, 48];

function bulkDeleteVideos(req, res, next) {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ ok: false, message: 'Keine IDs angegeben' });
    const permanent = req.query.permanent === '1' || req.body.permanent === true;
    const result = permanent
      ? storageService.permanentlyDeleteRecordings(ids.map(Number))
      : storageService.moveRecordingsToTrash(ids.map(Number));
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

function bulkRestoreVideos(req, res, next) {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ ok: false, message: 'Keine IDs angegeben' });
    const result = storageService.restoreRecordings(ids.map(Number));
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

function showVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).render('error', { message: 'Video nicht gefunden', status: 404 });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = ALLOWED_PAGE_SIZES.includes(parseInt(req.query.per_page, 10))
      ? parseInt(req.query.per_page, 10)
      : 8;
    const trashActive = req.query.trash === '1';
    const favoritesActive = !trashActive && req.query.favorites === '1';
    const where = trashActive
      ? 'processed=1 AND deleted_at IS NOT NULL'
      : favoritesActive
        ? 'processed=1 AND is_favorite=1 AND deleted_at IS NULL'
        : 'processed=1 AND deleted_at IS NULL';

    const prevRecording = db.prepare(`
      SELECT id, filename, thumbnail_path, created_at
      FROM recordings
      WHERE ${where}
        AND (created_at > ? OR (created_at = ? AND id > ?))
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(recording.created_at, recording.created_at, recording.id) || null;

    const nextRecording = db.prepare(`
      SELECT id, filename, thumbnail_path, created_at
      FROM recordings
      WHERE ${where}
        AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(recording.created_at, recording.created_at, recording.id) || null;

    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (trashActive) query.set('trash', '1');
    else if (favoritesActive) query.set('favorites', '1');
    const queryString = query.toString();
    const archiveUrl = `/archive?${queryString}`;

    const toVideoUrl = (id) => `/videos/${id}?${queryString}`;

    res.render('video', {
      recording,
      prevRecording,
      nextRecording,
      archiveUrl,
      prevUrl: prevRecording ? toVideoUrl(prevRecording.id) : null,
      nextUrl: nextRecording ? toVideoUrl(nextRecording.id) : null,
      trashActive,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

function deleteVideo(req, res, next) {
  try {
    const permanent = req.query.permanent === '1';
    if (permanent) storageService.permanentlyDeleteRecording(req.params.id);
    else storageService.moveRecordingToTrash(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

function restoreVideo(req, res, next) {
  try {
    storageService.restoreRecording(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

function downloadVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Not found' });
    res.download(recording.filepath, recording.filename);
  } catch (err) { next(err); }
}

module.exports = {
  showVideo,
  deleteVideo,
  restoreVideo,
  downloadVideo,
  bulkDeleteVideos,
  bulkRestoreVideos,
};
