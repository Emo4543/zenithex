// Boost & Launch: güç planı, RAM, uygulama askıya alma, öncelik, geri alma
const { shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { ps } = require('./lib-ps');
const system = require('./lib-system');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NT = `Add-Type -Namespace W -Name N -MemberDefinition '[DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h); [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);'`;
const safe = (n) => String(n).replace(/\.exe$/i, '').replace(/[^\w.-]/g, '');
const psList = (a) => '@(' + a.map((x) => `'${x}'`).join(',') + ')';
const HIGH_PERF = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const ULTIMATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

let session = null;

async function currentPlan() {
  const r = await ps('powercfg /getactivescheme');
  const m = r.out.match(/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

async function setPerformancePlan() {
  // Zaten "Nihai Performans" planı varsa onu kullan, yoksa oluştur
  const list = await ps('powercfg /list');
  let guid = null;
  for (const line of list.out.split(/\r?\n/)) {
    if (/ultimate|nihai/i.test(line)) {
      const m = line.match(/([0-9a-fA-F-]{36})/);
      if (m) guid = m[1];
    }
  }
  if (!guid) {
    const d = await ps(`powercfg -duplicatescheme ${ULTIMATE}`);
    const m = d.out.match(/([0-9a-fA-F-]{36})/);
    if (m) guid = m[1];
  }
  let s = guid ? await ps(`powercfg /setactive ${guid}`) : { ok: false };
  if (!s.ok) {
    s = await ps(`powercfg /setactive ${HIGH_PERF}`);
    guid = HIGH_PERF;
  }
  return { ok: s.ok, guid };
}

async function suspendByNames(names) {
  const list = names.map(safe).filter(Boolean);
  if (!list.length) return [];
  const r = await ps(
    `${NT}
$ids = @()
Get-Process -Name ${psList(list)} -ErrorAction SilentlyContinue | ForEach-Object {
  try { [W.N]::NtSuspendProcess($_.Handle) | Out-Null; $ids += $_.Id } catch {}
}
($ids -join ',')`
  );
  const line = r.out.split(/\r?\n/).pop() || '';
  return line.split(',').map((x) => parseInt(x, 10)).filter(Boolean);
}

async function resumeByIds(ids) {
  if (!ids.length) return;
  await ps(
    `${NT}
@(${ids.join(',')}) | ForEach-Object {
  try { $p = Get-Process -Id $_ -ErrorAction Stop; [W.N]::NtResumeProcess($p.Handle) | Out-Null } catch {}
}`
  );
}

async function resumeByNames(names) {
  const list = names.map(safe).filter(Boolean);
  if (!list.length) return;
  await ps(
    `${NT}
Get-Process -Name ${psList(list)} -ErrorAction SilentlyContinue | ForEach-Object {
  try { [W.N]::NtResumeProcess($_.Handle) | Out-Null } catch {}
}`
  );
}

async function findGameProcs(game) {
  const r = await ps(
    `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | Select-Object ProcessId,Name,ExecutablePath | ConvertTo-Json -Compress`,
    { timeout: 30000 }
  );
  let arr;
  try { arr = JSON.parse(r.out); } catch (e) { return []; }
  if (!Array.isArray(arr)) arr = [arr];
  const dir = (game.dir || '').toLowerCase();
  if (!dir) return [];
  return arr.filter(
    (p) =>
      p.ExecutablePath.toLowerCase().startsWith(dir + '\\') &&
      !/crash|launcher|setup|redist|helper|easyanticheat|battleye|unins/i.test(p.Name)
  );
}

function launch(game) {
  const l = game.launch;
  if (l.type === 'steam') {
    return shell.openExternal(`steam://rungameid/${l.appid}`).then(() => ({ ok: true }), (e) => ({ ok: false, error: e.message }));
  }
  return new Promise((resolve) => {
    const c = spawn(l.path, l.args || [], { cwd: path.dirname(l.path), detached: true, stdio: 'ignore' });
    c.once('error', (e) => resolve({ ok: false, error: e.message }));
    c.once('spawn', () => { c.unref(); resolve({ ok: true }); });
  });
}

async function restore(emit) {
  if (!session) return;
  const s = session;
  session = null;
  s.stop = true;
  if (s.suspended.length) {
    await resumeByIds(s.suspended);
    emit('Askıya alınan uygulamalar devam ettirildi');
  }
  if (s.opts.restore && s.prevPlan) {
    await ps(`powercfg /setactive ${s.prevPlan}`);
    emit('Güç planı eski haline döndürüldü');
  }
  emit('✔ Boost bitti, her şey geri alındı');
  if (s.onEnd) s.onEnd();
}

async function launchBoosted(game, o, emit) {
  if (session) return { ok: false, error: 'Zaten bir boost oturumu aktif. Önce "Boost\'u Bitir" butonuna bas.' };
  session = { prevPlan: null, suspended: [], stop: false, opts: o };
  emit(`▶ ${game.name} için boost başlatılıyor...`);

  if (o.ramClean) {
    emit('RAM temizleniyor...');
    const r = await system.ramClean();
    emit(`RAM temizlendi (+${r.freedMB} MB boşaldı, ${r.freeMB} MB boş)`);
  }
  if (o.power) {
    session.prevPlan = await currentPlan();
    const r = await setPerformancePlan();
    emit(r.ok ? 'Güç planı: Nihai/Yüksek performans' : 'Güç planı değiştirilemedi');
  }
  if (o.suspend && o.apps && o.apps.length) {
    session.suspended = await suspendByNames(o.apps);
    emit(`${session.suspended.length} arka plan işlemi askıya alındı`);
  }

  emit('Oyun başlatılıyor...');
  const res = await launch(game);
  if (!res.ok) {
    emit('✖ Oyun başlatılamadı: ' + res.error);
    await restore(emit);
    return res;
  }

  const s = session;
  (async () => {
    let procs = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 120000 && !s.stop) {
      procs = await findGameProcs(game);
      if (procs.length) break;
      await sleep(2500);
    }
    if (s.stop) return;
    if (!procs.length) {
      emit('Oyun işlemi bulunamadı. Oyun kapanınca "Boost\'u Bitir" butonuna bas.');
      return;
    }
    if (o.priority) {
      await ps(`@(${procs.map((p) => p.ProcessId).join(',')}) | ForEach-Object { try { (Get-Process -Id $_).PriorityClass = 'High' } catch {} }`);
      emit(`CPU önceliği "Yüksek" yapıldı (${procs.map((p) => p.Name).join(', ')})`);
    }
    emit('Oyun çalışıyor. Kapanınca ayarlar otomatik geri alınacak.');
    while (!s.stop) {
      await sleep(5000);
      const now = await findGameProcs(game);
      if (!now.length) break;
    }
    if (!s.stop) await restore(emit);
  })();

  return { ok: true };
}

module.exports = {
  launchBoosted,
  stop: (emit) => restore(emit || (() => {})),
  isActive: () => !!session,
  resumeByNames,
};
