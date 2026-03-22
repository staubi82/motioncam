'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const mailService = require('../../src/services/mailService');
const { getDb } = require('../../src/db');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  settingsService.set('mail_enabled', 'true');
  settingsService.set('smtp_host', 'smtp.example.com');
  settingsService.set('smtp_user', 'user@example.com');
  settingsService.set('smtp_pass', 'secret');
  settingsService.set('mail_recipient', 'alert@example.com');
  settingsService.set('smtp_from', 'cam@example.com');
  mailService.reset();
});

describe('mailService', () => {
  test('notifyIfEnabled sends mail and logs notification', async () => {
    await mailService.notifyIfEnabled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const db = getDb();
    const notif = db.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 1").get();
    expect(notif.status).toBe('sent');
  });

  test('sendTestMail sends mail ignoring cooldown', async () => {
    mockSendMail.mockClear();
    await mailService.sendTestMail();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('notifyIfEnabled respects cooldown', async () => {
    mockSendMail.mockClear();
    mailService.reset(); // clear last-sent time
    settingsService.set('mail_cooldown_seconds', '300');

    await mailService.notifyIfEnabled(); // first — should send
    await mailService.notifyIfEnabled(); // second — within cooldown, should NOT send
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});
