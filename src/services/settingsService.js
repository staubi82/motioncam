'use strict';
const { getDb } = require('../db');

let _cache = {};

function loadAll() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  _cache = {};
  for (const row of rows) _cache[row.key] = row.value;
}

function get(key) {
  return _cache[key] ?? null;
}

function getAll() {
  return { ..._cache };
}

function getBool(key) {
  return get(key) === 'true';
}

function getInt(key) {
  return parseInt(get(key), 10);
}

function set(key, value) {
  const db = getDb();
  const strVal = String(value);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, strVal);
  _cache[key] = strVal;
}

function setMany(obj) {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      const strVal = String(v);
      stmt.run(k, strVal);
      _cache[k] = strVal;
    }
  });
  tx(Object.entries(obj));
}

module.exports = { loadAll, get, getAll, getBool, getInt, set, setMany };
