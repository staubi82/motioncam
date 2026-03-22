'use strict';
const nodemailer = require('nodemailer');
const { getDb } = require('../db');
const config = require('../config');
const settingsService = require('./settingsService');

let _lastSent = null;

function reset() {
  _lastSent = null;
}

function _createTransport() {
  return nodemailer.createTransport({
    host: settingsService.get('smtp_host'),
    port: settingsService.getInt('smtp_port'),
    secure: settingsService.getBool('smtp_tls'),
    auth: {
      user: settingsService.get('smtp_user'),
      pass: settingsService.get('smtp_pass'),
    },
  });
}

async function _send(subject, html) {
  const transport = _createTransport();
  const info = await transport.sendMail({
    from: settingsService.get('smtp_from'),
    to: settingsService.get('mail_recipient'),
    subject,
    html,
  });

  const db = getDb();
  db.prepare(
    'INSERT INTO notifications (type, recipient, subject, status) VALUES (?, ?, ?, ?)'
  ).run('email', settingsService.get('mail_recipient'), subject, 'sent');

  return info;
}

async function notifyIfEnabled() {
  if (!settingsService.getBool('mail_enabled')) return;

  const cooldown = settingsService.getInt('mail_cooldown_seconds') * 1000;
  if (_lastSent && Date.now() - _lastSent < cooldown) return;

  const now = new Date();
  const subject = `[MotionCam] Bewegung erkannt – ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE')}`;
  const html = `<p>Bewegung erkannt um ${now.toLocaleString('de-DE')}</p>
                <p><a href="${config.appBaseUrl}">Archiv öffnen</a></p>`;

  try {
    await _send(subject, html);
    _lastSent = Date.now();
  } catch (err) {
    const db = getDb();
    db.prepare(
      'INSERT INTO notifications (type, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?)'
    ).run('email', settingsService.get('mail_recipient'), subject, 'failed', err.message);
  }
}

async function sendTestMail() {
  const subject = '[MotionCam] Test-E-Mail';
  const html = '<p>Diese E-Mail bestätigt, dass deine SMTP-Konfiguration funktioniert.</p>';
  await _send(subject, html);
}

module.exports = { notifyIfEnabled, sendTestMail, reset };
