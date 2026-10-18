const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = [
  'games:list', 'games:scan', 'games:add', 'games:remove',
  'boost:launch', 'boost:stop', 'settings:get', 'settings:set',
  'sys:ram', 'sys:temp', 'sys:dns', 'sys:nagle:get', 'sys:nagle:set',
  'sys:gamebar:get', 'sys:gamebar:set', 'sys:resume',
  'gfx:targets', 'gfx:apply', 'gfx:restore', 'gfx:pickIni',
  'win:min', 'win:max', 'win:close',
];
const ON = ['stats', 'boost:status'];

contextBridge.exposeInMainWorld('zenith', {
  invoke: (ch, ...args) => (INVOKE.includes(ch) ? ipcRenderer.invoke(ch, ...args) : Promise.reject(new Error('blocked'))),
  on: (ch, cb) => { if (ON.includes(ch)) ipcRenderer.on(ch, (_e, d) => cb(d)); },
});
