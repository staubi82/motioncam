'use strict';
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const { getDb } = require('../../src/db');

let app;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  getDb().prepare('DELETE FROM recordings').run();

  const a = express();
  a.set('view engine', 'ejs');
  a.set('views', path.join(__dirname, '../../src/views'));
  a.use(expressLayouts);
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use((req, res, next) => { req.session.userId = 1; req.session.username = 'admin'; next(); });
  a.use('/archive', require('../../src/routes/archive'));
  app = a;
});

describe('GET /archive', () => {
  test('returns 200 with empty archive', async () => {
    const res = await request(app).get('/archive');
    expect(res.status).toBe(200);
  });

  test('shows recordings when present', async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed) VALUES ('test.mp4', '/tmp/test.mp4', 1)"
    ).run();
    const res = await request(app).get('/archive');
    expect(res.status).toBe(200);
    expect(res.text).toContain('test.mp4');
  });

  test('pagination: page param respected', async () => {
    const res = await request(app).get('/archive?page=1');
    expect(res.status).toBe(200);
  });
});

describe('GET /archive?favorites=1', () => {
  test('returns only favorite recordings', async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('fav.mp4', '/tmp/fav.mp4', 1, 1)"
    ).run();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('nonfav.mp4', '/tmp/nonfav.mp4', 1, 0)"
    ).run();
    const res = await request(app).get('/archive?favorites=1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('fav.mp4');
    expect(res.text).not.toContain('nonfav.mp4');
  });

  test('pagination preserves favorites filter', async () => {
    const res = await request(app).get('/archive?favorites=1&page=1');
    expect(res.status).toBe(200);
  });
});
