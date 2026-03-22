'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let _db = null;

function getDb() {
  if (!_db) {
    const dbPath = path.resolve(config.dbPath);
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
