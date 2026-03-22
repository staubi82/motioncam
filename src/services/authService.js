'use strict';
const bcrypt = require('bcrypt');
const { getDb } = require('../db');

const BCRYPT_ROUNDS = 12;

async function createUser(username, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const db = getDb();
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
}

async function findByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function updateLastLogin(userId) {
  const db = getDb();
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
}

async function changePassword(userId, newPlain) {
  const hash = await bcrypt.hash(newPlain, BCRYPT_ROUNDS);
  const db = getDb();
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
}

module.exports = { createUser, findByUsername, verifyPassword, updateLastLogin, changePassword };
