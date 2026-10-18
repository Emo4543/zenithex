// Sistem optimizasyonları: RAM, temp, DNS, Nagle, Game Bar / DVR
const os = require('os');
const { ps, psElevated, reg } = require('./lib-ps');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ramClean() {
  const before = os.freemem();
  await ps(
    `Add-Type -Namespace Z -Name M -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr h);'
Get-Process | ForEach-Object { try { [Z.M]::EmptyWorkingSet($_.Handle) | Out-Null } catch {} }`,
    { timeout: 90000 }
  );
  await sleep(800);
  const after = os.freemem();
  return { freedMB: Math.max(0, Math.round((after - before) / 1048576)), freeMB: Math.round(after / 1048576) };
}

async function tempClean() {
  const r = await ps(
    `$paths = @($env:TEMP, "$env:WINDIR\\Temp", "$env:LOCALAPPDATA\\Temp") | Select-Object -Unique
$freed = 0
foreach ($p in $paths) {
  if (Test-Path $p) {
    Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
      try { $s = $_.Length; Remove-Item $_.FullName -Force -ErrorAction Stop; $freed += $s } catch {}
    }
  }
}
Write-Output $freed`,
    { timeout: 180000 }
  );
  const n = parseInt((r.out.split(/\r?\n/).pop() || '0').trim(), 10) || 0;
  return { freedMB: Math.round(n / 1048576) };
}

async function flushDns() {
  const r = await ps('ipconfig /flushdns');
  return { ok: r.ok };
}

const NAGLE_PATH = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces";

async function nagleGet() {
  const r = await ps(
    `$c = 0
Get-ChildItem '${NAGLE_PATH}' -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($p.TCPNoDelay -eq 1 -and $p.TcpAckFrequency -eq 1) { $c++ }
}
Write-Output $c`
  );
  return (parseInt(r.out, 10) || 0) > 0;
}

async function nagleSet(on) {
  const script = on
    ? `Get-ChildItem '${NAGLE_PATH}' | ForEach-Object {
  New-ItemProperty -Path $_.PSPath -Name TcpAckFrequency -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $_.PSPath -Name TCPNoDelay -Value 1 -PropertyType DWord -Force | Out-Null
}`
    : `Get-ChildItem '${NAGLE_PATH}' | ForEach-Object {
  Remove-ItemProperty -Path $_.PSPath -Name TcpAckFrequency -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $_.PSPath -Name TCPNoDelay -ErrorAction SilentlyContinue
}`;
  await psElevated(script);
  return nagleGet();
}

const ITEMS = {
  dvr: { key: 'HKCU\\System\\GameConfigStore', name: 'GameDVR_Enabled', test: (v) => v !== 0 },
  capture: { key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', name: 'AppCaptureEnabled', test: (v) => v !== 0 },
  fso: { key: 'HKCU\\System\\GameConfigStore', name: 'GameDVR_FSEBehaviorMode', test: (v) => v !== 2 },
  gamemode: { key: 'HKCU\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', test: (v) => v !== 0 },
};

async function readVal(key, name) {
  const r = await reg(['query', key, '/v', name]);
  const m = r.out.match(new RegExp(name + '\\s+REG_DWORD\\s+0x([0-9a-fA-F]+)'));
  return m ? parseInt(m[1], 16) : null;
}

// Dönen değer: özelliğin "etkin" (Windows varsayılanı) olup olmadığı
async function gamebarGet() {
  const o = {};
  for (const [id, it] of Object.entries(ITEMS)) {
    const v = await readVal(it.key, it.name);
    o[id] = v === null ? true : it.test(v);
  }
  return o;
}

async function gamebarSet(id, enabled) {
  const it = ITEMS[id];
  if (!it) return false;
  const val = id === 'fso' ? (enabled ? 0 : 2) : enabled ? 1 : 0;
  await reg(['add', it.key, '/v', it.name, '/t', 'REG_DWORD', '/d', String(val), '/f']);
  if (id === 'fso' && !enabled) {
    await reg(['add', it.key, '/v', 'GameDVR_HonorUserFSEBehaviorMode', '/t', 'REG_DWORD', '/d', '1', '/f']);
    await reg(['add', it.key, '/v', 'GameDVR_DXGIHonorFSEWindowsCompatible', '/t', 'REG_DWORD', '/d', '1', '/f']);
  }
  return true;
}

module.exports = { ramClean, tempClean, flushDns, nagleGet, nagleSet, gamebarGet, gamebarSet };
