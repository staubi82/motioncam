'use strict';
process.env.DB_PATH = ':memory:';
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
});

describe('settingsService', () => {
  test('get returns seeded default', () => {
    expect(settingsService.get('detection_enabled')).toBe('true');
  });

  test('set persists and updates cache', () => {
    settingsService.set('video_fps', '25');
    expect(settingsService.get('video_fps')).toBe('25');
  });

  test('getAll returns object with all keys', () => {
    const all = settingsService.getAll();
    expect(all).toHaveProperty('detection_enabled');
    expect(all).toHaveProperty('mail_enabled');
  });

  test('getBool returns boolean', () => {
    expect(settingsService.getBool('detection_enabled')).toBe(true);
    expect(settingsService.getBool('mail_enabled')).toBe(false);
  });

  test('getInt returns integer', () => {
    expect(settingsService.getInt('smtp_port')).toBe(587);
  });

  test('setMany persists multiple keys', () => {
    settingsService.setMany({ video_fps: '30', audio_bitrate: '192k' });
    expect(settingsService.get('video_fps')).toBe('30');
    expect(settingsService.get('audio_bitrate')).toBe('192k');
  });
});
