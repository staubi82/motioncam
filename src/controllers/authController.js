'use strict';
const authService = require('../services/authService');

function showLogin(req, res) {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', {
    layout: false,
    error: req.session.error || null,
    rememberMe: Boolean(req.session.rememberMe),
  });
  delete req.session.error;
  delete req.session.rememberMe;
}

async function handleLogin(req, res) {
  const { username, password, rememberMe } = req.body;
  const keepLoggedIn = Boolean(rememberMe);
  const user = await authService.findByUsername(username);
  if (!user || !(await authService.verifyPassword(password, user.password))) {
    req.session.error = 'Ungültiger Benutzername oder Passwort';
    req.session.rememberMe = keepLoggedIn;
    return res.redirect('/login');
  }
  await authService.updateLastLogin(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  if (keepLoggedIn) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  } else {
    req.session.cookie.expires = false;
    req.session.cookie.maxAge = null;
  }
  res.redirect('/dashboard');
}

function handleLogout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, handleLogin, handleLogout };
