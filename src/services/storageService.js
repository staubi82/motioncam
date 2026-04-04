'use strict';
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');

function getDiskUsage() {
  const dir = settingsService.get('storage_path');
  if (!dir || !fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).reduce((acc, f) => {
    try {
      return acc + fs.statSync(path.join(dir, f)).size;
    } catch { return acc; }
  }, 0);
}

function _hardDelete(rec) {
  const db = getDb();
  try { fs.unlinkSync(rec.filepath); } catch {}
  if (rec.thumbnail_path) try { fs.unlinkSync(rec.thumbnail_path); } catch {}
  db.prepare('DELETE FROM recordings WHERE id=?').run(rec.id);
}

function moveRecordingToTrash(id) {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if (!rec) throw Object.assign(new Error('Recording not found'), { status: 404 });
  if (rec.is_favorite) {
    throw Object.assign(new Error('Favoriten sind vor dem Löschen geschützt'), { status: 409 });
  }
  if (rec.deleted_at) {
    throw Object.assign(new Error('Aufnahme ist bereits im Papierkorb'), { status: 409 });
  }
  db.prepare("UPDATE recordings SET deleted_at=datetime('now') WHERE id=?").run(id);
}

function restoreRecording(id) {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if (!rec) throw Object.assign(new Error('Recording not found'), { status: 404 });
  if (!rec.deleted_at) {
    throw Object.assign(new Error('Aufnahme ist nicht im Papierkorb'), { status: 409 });
  }
  db.prepare('UPDATE recordings SET deleted_at=NULL WHERE id=?').run(id);
}

function permanentlyDeleteRecording(id) {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if (!rec) throw Object.assign(new Error('Recording not found'), { status: 404 });
  if (!rec.deleted_at) {
    throw Object.assign(new Error('Endgültiges Löschen nur aus dem Papierkorb erlaubt'), { status: 409 });
  }
  _hardDelete(rec);
}

function moveRecordingsToTrash(ids) {
  const db = getDb();
  const result = {
    movedIds: [],
    protectedIds: [],
    missingIds: [],
    alreadyTrashedIds: [],
  };
  const tx = db.transaction((list) => {
    for (const id of list) {
      const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
      if (!rec) {
        result.missingIds.push(id);
        continue;
      }
      if (rec.is_favorite) {
        result.protectedIds.push(id);
        continue;
      }
      if (rec.deleted_at) {
        result.alreadyTrashedIds.push(id);
        continue;
      }
      db.prepare("UPDATE recordings SET deleted_at=datetime('now') WHERE id=?").run(id);
      result.movedIds.push(id);
    }
  });
  tx(ids);
  return result;
}

function restoreRecordings(ids) {
  const db = getDb();
  const result = {
    restoredIds: [],
    missingIds: [],
    notTrashedIds: [],
  };
  const tx = db.transaction((list) => {
    for (const id of list) {
      const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
      if (!rec) {
        result.missingIds.push(id);
        continue;
      }
      if (!rec.deleted_at) {
        result.notTrashedIds.push(id);
        continue;
      }
      db.prepare('UPDATE recordings SET deleted_at=NULL WHERE id=?').run(id);
      result.restoredIds.push(id);
    }
  });
  tx(ids);
  return result;
}

function permanentlyDeleteRecordings(ids) {
  const db = getDb();
  const result = {
    deletedIds: [],
    missingIds: [],
    notTrashedIds: [],
  };
  const tx = db.transaction((list) => {
    for (const id of list) {
      const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
      if (!rec) {
        result.missingIds.push(id);
        continue;
      }
      if (!rec.deleted_at) {
        result.notTrashedIds.push(id);
        continue;
      }
      _hardDelete(rec);
      result.deletedIds.push(id);
    }
  });
  tx(ids);
  return result;
}

module.exports = {
  getDiskUsage,
  moveRecordingToTrash,
  moveRecordingsToTrash,
  restoreRecording,
  restoreRecordings,
  permanentlyDeleteRecording,
  permanentlyDeleteRecordings,
};
