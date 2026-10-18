const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let win = null;
let queue = [];
let lastPoll = 0;
const PORT = 34872;

// Studio eklentisi (Bridge) bu yerel sunucuyu yoklar ve kodu alır.
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/poll') {
    lastPoll = Date.now();
    res.end(JSON.stringify(queue.shift() || {}));
  } else if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try { if (win) win.webContents.send('result', JSON.parse(body)); } catch (e) {}
      res.end('{}');
    });
  } else {
    res.statusCode = 404;
    res.end('{}');
  }
});
server.on('error', () => {});
server.listen(PORT, '127.0.0.1');

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0a0a10',
    autoHideMenuBar: true,
    title: 'Zenithex',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('send', (_e, code) => {
  queue.push({ code });
  return true;
});
ipcMain.handle('status', () => Date.now() - lastPoll < 3000);

ipcMain.handle('open', async () => {
  const r = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Lua / Luau', extensions: ['lua', 'luau', 'txt'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), content: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('save', async (_e, { name, content }) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: name.endsWith('.lua') ? name : name + '.lua',
    filters: [{ name: 'Lua / Luau', extensions: ['lua', 'luau'] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, content, 'utf8');
  return path.basename(r.filePath);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
