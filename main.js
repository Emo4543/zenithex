const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const store = require('./lib-store');
const gamesLib = require('./lib-games');
const boost = require('./lib-boost');
const sys = require('./lib-system');
const gfx = require('./lib-tweaks');

let win = null;
const send = (c, d) => { if (win && !win.isDestroyed()) win.webContents.send(c, d); };

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1050,
    minHeight: 680,
    frame: false,
    backgroundColor: '#07070d',
    title: 'ZENITH',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile('index.html');
}

const allGames = () => {
  const d = store.get();
  return [...d.detected, ...d.manual];
};

// ---- Pencere ----
ipcMain.handle('win:min', () => win.minimize());
ipcMain.handle('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());

// ---- Oyunlar ----
ipcMain.handle('games:list', () => allGames());
ipcMain.handle('games:scan', async () => {
  store.get().detected = await gamesLib.scanAll();
  store.save();
  return allGames();
});
ipcMain.handle('games:add', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Oyun (.exe)', extensions: ['exe'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return allGames();
  const p = r.filePaths[0];
  const name = path.basename(p, path.extname(p));
  store.get().manual.push({
    id: 'manual:' + Buffer.from(p).toString('base64').slice(-16),
    name,
    source: 'Manuel',
    launch: { type: 'exe', path: p },
    dir: path.dirname(p),
  });
  store.save();
  return allGames();
});
ipcMain.handle('games:remove', (_e, id) => {
  const d = store.get();
  d.manual = d.manual.filter((g) => g.id !== id);
  store.save();
  return allGames();
});

// ---- Ayarlar ----
ipcMain.handle('settings:get', () => store.get().settings);
ipcMain.handle('settings:set', (_e, patch) => {
  const d = store.get();
  d.settings = { ...d.settings, ...patch };
  store.save();
  return d.settings;
});

// ---- Boost ----
ipcMain.handle('boost:launch', async (_e, id) => {
  const g = allGames().find((x) => x.id === id);
  if (!g) return { ok: false, error: 'Oyun bulunamadı' };
  const s = store.get().settings;
  return boost.launchBoosted(
    g,
    { power: s.power, ramClean: s.ramClean, priority: s.priority, suspend: s.suspend, restore: s.restore, apps: s.appsEnabled || [] },
    (m) => send('boost:status', m)
  );
});
ipcMain.handle('boost:stop', async () => { await boost.stop((m) => send('boost:status', m)); return true; });

// ---- Sistem ----
ipcMain.handle('sys:ram', () => sys.ramClean());
ipcMain.handle('sys:temp', () => sys.tempClean());
ipcMain.handle('sys:dns', () => sys.flushDns());
ipcMain.handle('sys:nagle:get', () => sys.nagleGet());
ipcMain.handle('sys:nagle:set', (_e, on) => sys.nagleSet(on));
ipcMain.handle('sys:gamebar:get', () => sys.gamebarGet());
ipcMain.handle('sys:gamebar:set', (_e, id, enabled) => sys.gamebarSet(id, enabled));
ipcMain.handle('sys:resume', async () => {
  await boost.resumeByNames(store.get().settings.apps || []);
  return true;
});

// ---- Grafik ----
ipcMain.handle('gfx:targets', () => gfx.targets());
ipcMain.handle('gfx:apply', (_e, t, s) => gfx.apply(t, s));
ipcMain.handle('gfx:restore', (_e, t) => gfx.restoreBackup(t.path));
ipcMain.handle('gfx:pickIni', async () => {
  const r = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Ayar dosyası', extensions: ['ini', 'cfg', 'txt', 'json'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ---- CPU / RAM canlı istatistik ----
let prev = os.cpus();
setInterval(() => {
  const cur = os.cpus();
  let idle = 0, total = 0;
  cur.forEach((c, i) => {
    for (const k in c.times) total += c.times[k] - prev[i].times[k];
    idle += c.times.idle - prev[i].times.idle;
  });
  prev = cur;
  send('stats', {
    cpu: total ? Math.round(100 * (1 - idle / total)) : 0,
    ramUsed: os.totalmem() - os.freemem(),
    ramTotal: os.totalmem(),
  });
}, 2000);

let quitting = false;
app.on('before-quit', async (e) => {
  if (quitting) return;
  quitting = true;
  if (boost.isActive()) {
    e.preventDefault();
    await boost.stop(() => {});
    app.quit();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
