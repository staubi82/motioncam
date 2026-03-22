'use strict';
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

const TEMP_PATH = '/sys/class/thermal/thermal_zone0/temp';

function getRamInfo() {
  const ramTotalMB = os.totalmem() / (1024 * 1024);
  const ramUsedMB = (os.totalmem() - os.freemem()) / (1024 * 1024);
  return { ramTotalMB: Math.round(ramTotalMB), ramUsedMB: Math.round(ramUsedMB) };
}

function getTempCelsius() {
  try {
    const raw = fs.readFileSync(TEMP_PATH, 'utf8').trim();
    const temp = Math.round(parseInt(raw, 10) / 1000);
    return isNaN(temp) ? null : temp;
  } catch {
    return null;
  }
}

function getDiskInfo(storagePath) {
  return new Promise((resolve) => {
    execFile('df', ['-k', storagePath], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve({ diskUsedMB: 0, diskTotalMB: null });
      const lines = stdout.trim().split('\n');
      const parts = lines[1] && lines[1].trim().split(/\s+/);
      if (!parts || parts.length < 3) return resolve({ diskUsedMB: 0, diskTotalMB: null });
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      resolve({
        diskUsedMB: Math.round(usedKB / 1024),
        diskTotalMB: Math.round(totalKB / 1024),
      });
    });
  });
}

function getCpuPercent() {
  const snap = () => {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const cpu of cpus) {
      for (const val of Object.values(cpu.times)) total += val;
      idle += cpu.times.idle;
    }
    return { idle, total };
  };
  const before = snap();
  return new Promise((resolve) => {
    setTimeout(() => {
      const after = snap();
      const idleDiff = after.idle - before.idle;
      const totalDiff = after.total - before.total;
      const pct = totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
      resolve(Math.min(100, Math.max(0, pct)));
    }, 200);
  });
}

module.exports = { getRamInfo, getTempCelsius, getDiskInfo, getCpuPercent };
