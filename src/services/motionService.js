'use strict';
const fs = require('fs');
const { execFile } = require('child_process');
const config = require('../config');
const settingsService = require('./settingsService');

const CONF_MAP = {
  detection_sensitivity: 'threshold',
  detection_min_area: 'minimum_motion_frames',
};

function _rewriteConf(confPath) {
  if (!fs.existsSync(confPath)) return;

  let content = fs.readFileSync(confPath, 'utf-8');

  for (const [settingKey, directive] of Object.entries(CONF_MAP)) {
    const value = settingsService.get(settingKey);
    if (!value) continue;
    const regex = new RegExp(`^(${directive}\\s+).*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${directive} ${value}`;
    }
  }

  fs.writeFileSync(confPath, content, 'utf-8');
}

function _sendSighup() {
  return new Promise((resolve) => {
    execFile('pkill', ['-HUP', 'motion'], () => resolve());
  });
}

async function applyDetectionSettings() {
  _rewriteConf(config.motionConfPath);
  await _sendSighup();
}

module.exports = { applyDetectionSettings };
