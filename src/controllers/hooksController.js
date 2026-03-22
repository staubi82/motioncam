'use strict';
const recordingService = require('../services/recordingService');

async function motionStart(req, res, next) {
  try {
    await recordingService.startRecording();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function motionEnd(req, res, next) {
  try {
    recordingService.scheduleStop();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { motionStart, motionEnd };
