'use strict';
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const authService = require('../../src/services/authService');

let app;
beforeAll(async () => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  await authService.createUser('admin', 'testpass');
  // Build minimal app for auth testing
  const express = require('express');
  const session = require('express-session');
  const a = express();
  a.set('view engine', 'ejs');
  a.set('views', require('path').join(__dirname, '../../src/views'));
  a.use(require('express-ejs-layouts'));
  a.use(express.urlencoded({ extended: false }));
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use('/', require('../../src/routes/auth'));
  a.use('/dashboard', (req, res) => res.send('dashboard'));
  app = a;
});

describe('GET /login', () => {
  test('returns 200', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
  });
});

describe('POST /login', () => {
  test('redirects to /dashboard on valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=testpass');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('sets a persistent cookie when rememberMe is checked', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=testpass&rememberMe=1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    expect(res.headers['set-cookie'][0]).toContain('Expires=');
  });

  test('keeps session cookie when rememberMe is not checked', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=testpass');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    expect(res.headers['set-cookie'][0]).not.toContain('Expires=');
  });

  test('redirects back to /login on wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=wrong');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
