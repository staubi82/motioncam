'use strict';
const settingsService = require('../services/settingsService');
const authService = require('../services/authService');
const mailService = require('../services/mailService');
const motionService = require('../services/motionService');
const ffmpegService = require('../services/ffmpegService');
const recordingService = require('../services/recordingService');

const EDITABLE_KEYS = [
  'detection_enabled', 'detection_sensitivity', 'detection_min_area', 'detection_min_frames', 'detection_lightswitch_percent', 'event_cooldown_seconds',
  'recording_enabled', 'recording_nachlaufzeit_seconds', 'max_clip_duration_seconds', 'video_fps', 'video_resolution',
  'video_bitrate', 'audio_enabled', 'audio_bitrate', 'storage_path', 'thumbnail_path',
  'snapshot_path', 'camera_device', 'audio_device', 'trash_retention_days',
  'mail_enabled', 'mail_cooldown_seconds', 'mail_snapshot_attach',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_tls', 'smtp_from', 'mail_recipient',
  'overlay_enabled', 'overlay_show_datetime', 'overlay_show_resolution',
  'overlay_show_location', 'overlay_location_name', 'overlay_position',
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
      else if (['detection_enabled', 'recording_enabled', 'audio_enabled', 'mail_enabled', 'smtp_tls', 'mail_snapshot_attach', 'overlay_enabled', 'overlay_show_datetime', 'overlay_show_resolution', 'overlay_show_location'].includes(key)) {
        update[key] = 'false';
      }
    }
    settingsService.setMany(update);
    // Apply detection settings to motion daemon (non-blocking)
    const detectionKeys = ['detection_enabled', 'detection_sensitivity', 'detection_min_area', 'detection_min_frames', 'detection_lightswitch_percent'];
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

async function testMotion(req, res, next) {
  try {
    if (ffmpegService.isRecording()) {
      return res.status(409).json({ ok: false, message: 'Aufnahme läuft bereits' });
    }
    if (!settingsService.getBool('recording_enabled')) {
      return res.status(409).json({ ok: false, message: 'Aufnahme ist deaktiviert' });
    }

    await recordingService.startRecording(true);
    recordingService.scheduleStop();

    const sendMail = req.body.sendMail === true || req.body.sendMail === 'true';
    if (sendMail) {
      const smtpHost = settingsService.get('smtp_host');
      const smtpFrom = settingsService.get('smtp_from');
      const mailRecipient = settingsService.get('mail_recipient');
      if (!smtpHost || !smtpFrom || !mailRecipient) {
        return res.json({ ok: true, message: 'Testaufnahme gestartet', mailError: 'SMTP nicht vollständig konfiguriert' });
      }
      try {
        await mailService.sendTestMail();
      } catch (err) {
        return res.json({ ok: true, message: 'Testaufnahme gestartet', mailError: err.message });
      }
    }

    res.json({ ok: true, message: 'Testaufnahme gestartet' });
  } catch (err) {
    next(err);
  }
}

module.exports = { showSettings, saveSettings, testMail, changePassword, testMotion };
