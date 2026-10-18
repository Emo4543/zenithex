// Oyuna özel grafik ayarları: Unreal (GameUserSettings.ini), Minecraft (options.txt), Özel INI
const fs = require('fs');
const path = require('path');

const exists = (p) => { try { return fs.existsSync(p); } catch (e) { return false; } };

function findUnreal() {
  const base = process.env.LOCALAPPDATA;
  const res = [];
  if (!base) return res;
  let top = [];
  try { top = fs.readdirSync(base); } catch (e) { return res; }

  function walk(d, depth, game) {
    if (depth > 4) return;
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1, game);
      else if (e.name.toLowerCase() === 'gameusersettings.ini') {
        res.push({ id: 'ue:' + p, label: game + ' (Unreal Engine)', type: 'ue', path: p });
      }
    }
  }
  for (const g of top) {
    const cfg = path.join(base, g, 'Saved', 'Config');
    if (exists(cfg)) walk(cfg, 0, g);
  }
  return res;
}

function targets() {
  const list = findUnreal();
  const mc = path.join(process.env.APPDATA || '', '.minecraft', 'options.txt');
  if (exists(mc)) list.push({ id: 'mc:' + mc, label: 'Minecraft Java', type: 'mc', path: mc });
  return list;
}

function backup(file) {
  const bak = file + '.zenith.bak';
  if (!exists(bak)) fs.copyFileSync(file, bak); // ilk orijinali sakla
}

function restoreBackup(file) {
  const bak = file + '.zenith.bak';
  if (!exists(bak)) return { ok: false, error: 'Bu dosya için yedek bulunamadı.' };
  fs.copyFileSync(bak, file);
  return { ok: true };
}

function setIni(file, section, kv) {
  const txt = fs.readFileSync(file, 'utf8');
  const eol = txt.includes('\r\n') ? '\r\n' : '\n';
  const lines = txt.split(/\r?\n/);
  const hdr = `[${section}]`.toLowerCase();
  let sec = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === hdr) {
      sec = i;
      end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s*\[.+\]\s*$/.test(lines[j])) { end = j; break; }
      }
      break;
    }
  }
  if (sec < 0) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`[${section}]`);
    sec = lines.length - 1;
    end = lines.length;
  }
  for (const [k, v] of Object.entries(kv)) {
    let found = false;
    for (let i = sec + 1; i < end; i++) {
      const m = lines[i].match(/^\s*([^=;#\s][^=]*?)\s*=/);
      if (m && m[1].toLowerCase() === k.toLowerCase()) { lines[i] = `${k}=${v}`; found = true; break; }
    }
    if (!found) { lines.splice(end, 0, `${k}=${v}`); end++; }
  }
  fs.writeFileSync(file, lines.join(eol), 'utf8');
}

function setKeyValueFile(file, kv) {
  const txt = fs.readFileSync(file, 'utf8');
  const eol = txt.includes('\r\n') ? '\r\n' : '\n';
  const lines = txt.split(/\r?\n/);
  for (const [k, v] of Object.entries(kv)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(k + ':')) { lines[i] = `${k}:${v}`; found = true; break; }
    }
    if (!found) lines.push(`${k}:${v}`);
  }
  fs.writeFileSync(file, lines.join(eol), 'utf8');
}

const UE_Q = { low: 0, medium: 1, high: 2 };
const FS_MODE = { fullscreen: 0, borderless: 1, windowed: 2 };
const MC_PRESET = {
  low: { graphics: 'fast', renderDistance: 6, particles: 2, entityShadows: 'false', maxFps: 260 },
  medium: { graphics: 'fast', renderDistance: 10, particles: 1, entityShadows: 'true', maxFps: 260 },
  high: { graphics: 'fancy', renderDistance: 16, particles: 0, entityShadows: 'true', maxFps: 260 },
};

function apply(t, s) {
  if (!t || !t.path || !exists(t.path)) return { ok: false, error: 'Ayar dosyası bulunamadı.' };
  try {
    backup(t.path);
    if (t.type === 'ue') {
      const q = UE_Q[s.preset] ?? 1;
      const kv = {
        'sg.TextureQuality': q,
        'sg.ShadowQuality': q,
        'sg.EffectsQuality': q,
        'sg.PostProcessQuality': q,
        'sg.ViewDistanceQuality': q,
        'sg.AntiAliasingQuality': q,
        'sg.FoliageQuality': q,
        'sg.ShadingQuality': q,
      };
      if (s.width && s.height) {
        Object.assign(kv, {
          ResolutionSizeX: s.width,
          ResolutionSizeY: s.height,
          LastUserConfirmedResolutionSizeX: s.width,
          LastUserConfirmedResolutionSizeY: s.height,
          DesiredScreenWidth: s.width,
          DesiredScreenHeight: s.height,
        });
      }
      if (s.fullscreen in FS_MODE) {
        const m = FS_MODE[s.fullscreen];
        Object.assign(kv, { FullscreenMode: m, LastConfirmedFullscreenMode: m, PreferredFullscreenMode: m });
      }
      setIni(t.path, '/Script/Engine.GameUserSettings', kv);
      return { ok: true, note: 'Oyun kapalıyken uygulandı. Bazı oyunlar çıkışta ayarı kendi üzerine yazabilir.' };
    }
    if (t.type === 'mc') {
      const kv = { ...(MC_PRESET[s.preset] || MC_PRESET.medium) };
      kv.fullscreen = s.fullscreen === 'windowed' ? 'false' : 'true';
      if (typeof s.brightness === 'number') kv.gamma = (Math.max(0, Math.min(100, s.brightness)) / 100).toFixed(2);
      setKeyValueFile(t.path, kv);
      return { ok: true, note: 'Minecraft kapalıyken uygulandı (parlaklık = gamma).' };
    }
    if (t.type === 'custom') {
      const groups = {};
      for (const raw of String(s.custom || '').split(/\r?\n/)) {
        const m = raw.match(/^\s*([^|]+?)\s*\|\s*([^=]+?)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        (groups[m[1]] = groups[m[1]] || {})[m[2]] = m[3];
      }
      const names = Object.keys(groups);
      if (!names.length) return { ok: false, error: 'Geçerli satır yok. Biçim: Bölüm | Anahtar = Değer' };
      for (const sec of names) setIni(t.path, sec, groups[sec]);
      return { ok: true, note: `${names.length} bölüm güncellendi.` };
    }
    return { ok: false, error: 'Bilinmeyen hedef türü.' };
  } catch (e) {
    return { ok: false, error: 'Yazılamadı: ' + e.message + ' (dosya salt okunur olabilir)' };
  }
}

module.exports = { targets, apply, restoreBackup };
