// Oyun algılama: Steam, Epic, Riot, Xbox
const fs = require('fs');
const path = require('path');
const { reg } = require('./lib-ps');

const exists = (p) => { try { return fs.existsSync(p); } catch (e) { return false; } };
const readdir = (p) => { try { return fs.readdirSync(p); } catch (e) { return []; } };
const DRIVES = ['C', 'D', 'E', 'F', 'G'].map((d) => d + ':\\').filter(exists);

async function scanSteam() {
  const out = [];
  let sp = null;
  const r = await reg(['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']);
  const m = r.out.match(/SteamPath\s+REG_SZ\s+(.+)/);
  if (m) sp = m[1].trim().replace(/\//g, '\\');
  if (!sp || !exists(sp)) {
    for (const c of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']) if (exists(c)) sp = c;
  }
  if (!sp) return out;

  const libs = new Set([sp]);
  try {
    const v = fs.readFileSync(path.join(sp, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const mm of v.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(mm[1].replace(/\\\\/g, '\\'));
  } catch (e) {}

  for (const lib of libs) {
    const dir = path.join(lib, 'steamapps');
    for (const f of readdir(dir).filter((x) => /^appmanifest_\d+\.acf$/.test(x))) {
      try {
        const t = fs.readFileSync(path.join(dir, f), 'utf8');
        const id = t.match(/"appid"\s+"(\d+)"/)[1];
        const name = t.match(/"name"\s+"([^"]+)"/)[1];
        const inst = t.match(/"installdir"\s+"([^"]+)"/)[1];
        if (/redistributable|runtime|proton|steamworks|steamvr/i.test(name)) continue;
        out.push({
          id: 'steam:' + id,
          name,
          source: 'Steam',
          launch: { type: 'steam', appid: id },
          dir: path.join(dir, 'common', inst),
        });
      } catch (e) {}
    }
  }
  return out;
}

async function scanEpic() {
  const out = [];
  const dir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  for (const f of readdir(dir).filter((x) => x.endsWith('.item'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!j.DisplayName || !j.InstallLocation || !j.LaunchExecutable) continue;
      const exe = path.join(j.InstallLocation, j.LaunchExecutable);
      out.push({
        id: 'epic:' + (j.AppName || f),
        name: j.DisplayName,
        source: 'Epic Games',
        launch: { type: 'exe', path: exe },
        dir: j.InstallLocation,
      });
    } catch (e) {}
  }
  return out;
}

async function scanRiot() {
  const out = [];
  const products = {
    'VALORANT': 'valorant',
    'League of Legends': 'league_of_legends',
    'Legends of Runeterra': 'bacon',
  };
  for (const d of DRIVES) {
    const root = path.join(d, 'Riot Games');
    const client = path.join(root, 'Riot Client', 'RiotClientServices.exe');
    if (!exists(client)) continue;
    for (const [folder, code] of Object.entries(products)) {
      const dir = path.join(root, folder);
      if (!exists(dir)) continue;
      out.push({
        id: 'riot:' + code,
        name: folder,
        source: 'Riot Games',
        launch: { type: 'exe', path: client, args: ['--launch-product=' + code, '--launch-patchline=live'] },
        dir,
      });
    }
  }
  return out;
}

function biggestExe(dir) {
  let best = null, size = 0;
  for (const f of readdir(dir)) {
    if (!/\.exe$/i.test(f) || /crash|setup|redist|helper|unins|anticheat/i.test(f)) continue;
    try {
      const s = fs.statSync(path.join(dir, f)).size;
      if (s > size) { size = s; best = path.join(dir, f); }
    } catch (e) {}
  }
  return best;
}

async function scanXbox() {
  const out = [];
  for (const d of DRIVES) {
    const root = path.join(d, 'XboxGames');
    for (const g of readdir(root)) {
      const content = path.join(root, g, 'Content');
      const exe = biggestExe(content);
      if (!exe) continue;
      out.push({
        id: 'xbox:' + g,
        name: g.replace(/_/g, ' '),
        source: 'Xbox',
        launch: { type: 'exe', path: exe },
        dir: path.join(root, g),
      });
    }
  }
  return out;
}

async function scanAll() {
  const parts = await Promise.all([scanSteam(), scanEpic(), scanRiot(), scanXbox()]);
  const map = new Map();
  for (const g of parts.flat()) if (!map.has(g.id)) map.set(g.id, g);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { scanAll };
