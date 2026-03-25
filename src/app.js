'use strict';
const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const expressLayouts = require('express-ejs-layouts');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  // Body parsing
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Session
  app.use(session({
    store: new FileStore({ path: './sessions', retries: 1 }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  }));

  // Routes
  app.get('/', (req, res) => res.redirect('/dashboard'));
  app.use('/', require('./routes/auth'));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/live', require('./routes/live'));
  app.use('/archive', require('./routes/archive'));
  app.use('/videos', require('./routes/videos'));
  app.use('/settings', require('./routes/settings'));
  app.use('/log', require('./routes/log'));
  app.use('/api/hooks', require('./routes/hooks'));
  app.use('/api', require('./routes/api'));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
