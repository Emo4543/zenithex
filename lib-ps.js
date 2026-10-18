// PowerShell / reg.exe yardımcıları
const { execFile } = require('child_process');

function ps(script, { timeout = 60000 } = {}) {
  return new Promise((resolve) => {
    const enc = Buffer.from(script, 'utf16le').toString('base64');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
      { timeout, windowsHide: true, maxBuffer: 30 * 1024 * 1024 },
      (err, stdout, stderr) =>
        resolve({ ok: !err, out: (stdout || '').trim(), err: (stderr || '').trim() || (err ? err.message : '') })
    );
  });
}

// Yönetici izni (UAC penceresi) isteyerek çalıştırır
function psElevated(script) {
  const inner = Buffer.from(script, 'utf16le').toString('base64');
  const outer =
    "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','" +
    inner +
    "'";
  return ps(outer, { timeout: 120000 });
}

function reg(args) {
  return new Promise((resolve) =>
    execFile('reg', args, { windowsHide: true }, (e, o) => resolve({ ok: !e, out: o || '' }))
  );
}

module.exports = { ps, psElevated, reg };
