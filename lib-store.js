// Basit JSON kalıcı depo (ayarlar + elle eklenen oyunlar)
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  manual: [],
  detected: [],
  settings: {
    accent: 'purple',
    power: true,
    ramClean: true,
    priority: true,
    suspend: false,
    restore: true,
    apps: ['chrome', 'msedge', 'firefox', 'brave', 'discord', 'spotify'],
    appsEnabled: [],
  },
};

let data = null;
const file = () => path.join(app.getPath('userData'), 'zenith.json');

function get() {
  if (data) return data;
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    data = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...raw };
    data.settings = { ...DEFAULTS.settings, ...(raw.settings || {}) };
  } catch (e) {
    data = JSON.parse(JSON.stringify(DEFAULTS));
  }
  return data;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(data, null, 2));
  } catch (e) {}
}

module.exports = { get, save };
