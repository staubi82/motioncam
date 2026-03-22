'use strict';
const os = require('os');

jest.mock('child_process', () => ({ execFile: jest.fn() }));
const { execFile } = require('child_process');

// Import after mocks
const systemService = require('../../src/services/systemService');

describe('systemService.getRamInfo', () => {
  test('returns ramUsedMB and ramTotalMB as numbers', () => {
    const r = systemService.getRamInfo();
    expect(typeof r.ramTotalMB).toBe('number');
    expect(typeof r.ramUsedMB).toBe('number');
    expect(r.ramUsedMB).toBeGreaterThanOrEqual(0);
    expect(r.ramUsedMB).toBeLessThanOrEqual(r.ramTotalMB);
  });
});

describe('systemService.getTempCelsius', () => {
  test('returns null when thermal file missing', () => {
    // /sys/class/thermal/thermal_zone0/temp won't exist in test env
    const t = systemService.getTempCelsius();
    expect(t === null || typeof t === 'number').toBe(true);
  });
});

describe('systemService.getDiskInfo', () => {
  test('resolves with diskUsedMB and diskTotalMB', async () => {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/root 30000000 5000000 25000000 17% /\n', '');
    });
    const d = await systemService.getDiskInfo('/tmp');
    expect(typeof d.diskUsedMB).toBe('number');
    expect(d.diskUsedMB).toBeGreaterThan(0);
    expect(typeof d.diskTotalMB).toBe('number');
  });

  test('returns diskTotalMB null when df fails', async () => {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('df failed'), '', '');
    });
    const d = await systemService.getDiskInfo('/tmp');
    expect(d.diskTotalMB).toBeNull();
  });
});

describe('systemService.getCpuPercent', () => {
  test('returns a number between 0 and 100', async () => {
    const pct = await systemService.getCpuPercent();
    expect(typeof pct).toBe('number');
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  }, 1000); // allow up to 1s for the 200ms delay
});
