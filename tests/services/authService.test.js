'use strict';
process.env.DB_PATH = ':memory:';
const { getDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrations');
const authService = require('../../src/services/authService');

beforeAll(() => { runMigrations(); });

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM users').run();
});

describe('authService', () => {
  test('createUser hashes password and stores user', async () => {
    await authService.createUser('admin', 'secret123');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='admin'").get();
    expect(user).toBeTruthy();
    expect(user.password).not.toBe('secret123');
  });

  test('verifyPassword returns true for correct password', async () => {
    await authService.createUser('user2', 'mypass');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user2'").get();
    const ok = await authService.verifyPassword('mypass', user.password);
    expect(ok).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    await authService.createUser('user3', 'correct');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user3'").get();
    const ok = await authService.verifyPassword('wrong', user.password);
    expect(ok).toBe(false);
  });

  test('findByUsername returns null for unknown user', async () => {
    const user = await authService.findByUsername('nobody');
    expect(user).toBeNull();
  });

  test('updateLastLogin updates last_login field', async () => {
    await authService.createUser('user4', 'pass');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user4'").get();
    await authService.updateLastLogin(user.id);
    const updated = db.prepare("SELECT last_login FROM users WHERE id=?").get(user.id);
    expect(updated.last_login).toBeTruthy();
  });
});
