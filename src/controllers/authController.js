'use strict';
const authService = require('../services/authService');

function showLogin(req, res) {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { layout: false, error: req.session.error || null });
  delete req.session.error;
}

async function handleLogin(req, res) {
  const { username, password } = req.body;
  const user = await authService.findByUsername(username);
  if (!user || !(await authService.verifyPassword(password, user.password))) {
    req.session.error = 'Ungültiger Benutzername oder Passwort';
    return res.redirect('/login');
  }
  await authService.updateLastLogin(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/dashboard');
}

function handleLogout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, handleLogin, handleLogout };
