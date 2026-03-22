'use strict';
const settingsService = require('../services/settingsService');
const authService = require('../services/authService');
const mailService = require('../services/mailService');
const motionService = require('../services/motionService');

const EDITABLE_KEYS = [
  'detection_enabled', 'detection_sensitivity', 'detection_min_area', 'event_cooldown_seconds',
  'recording_enabled', 'recording_nachlaufzeit_seconds', 'video_fps', 'video_resolution',
  'video_bitrate', 'audio_enabled', 'audio_bitrate', 'storage_path', 'thumbnail_path',
  'snapshot_path', 'camera_device', 'audio_device',
  'mail_enabled', 'mail_cooldown_seconds', 'mail_snapshot_attach',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_tls', 'smtp_from', 'mail_recipient',
];

function showSettings(req, res) {
  res.render('settings', {
    settings: settingsService.getAll(),
    username: req.session.username,
    flash: req.session.flash || null,
  });
  delete req.session.flash;
}

function saveSettings(req, res, next) {
  try {
    const update = {};
    for (const key of EDITABLE_KEYS) {
      if (key in req.body) update[key] = req.body[key];
      // Checkboxes: if not in body, they are false
      else if (['detection_enabled', 'recording_enabled', 'audio_enabled', 'mail_enabled', 'smtp_tls', 'mail_snapshot_attach'].includes(key)) {
        update[key] = 'false';
      }
    }
    settingsService.setMany(update);
    // Apply detection settings to motion daemon (non-blocking)
    const detectionKeys = ['detection_enabled', 'detection_sensitivity', 'detection_min_area'];
    if (detectionKeys.some(k => k in update)) motionService.applyDetectionSettings().catch(console.error);
    req.session.flash = { type: 'success', message: 'Einstellungen gespeichert.' };
    res.redirect('/settings');
  } catch (err) { next(err); }
}

async function testMail(req, res, next) {
  try {
    await mailService.sendTestMail();
    res.json({ ok: true, message: 'Test-E-Mail gesendet.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function changePassword(req, res, next) {
  try {
    const { current, newPass, confirm } = req.body;
    if (newPass !== confirm) {
      req.session.flash = { type: 'error', message: 'Neue Passwörter stimmen nicht überein.' };
      return res.redirect('/settings');
    }
    const db = require('../db').getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
    const ok = await authService.verifyPassword(current, user.password);
    if (!ok) {
      req.session.flash = { type: 'error', message: 'Aktuelles Passwort falsch.' };
      return res.redirect('/settings');
    }
    await authService.changePassword(req.session.userId, newPass);
    req.session.flash = { type: 'success', message: 'Passwort geändert.' };
    res.redirect('/settings');
  } catch (err) { next(err); }
}

module.exports = { showSettings, saveSettings, testMail, changePassword };
