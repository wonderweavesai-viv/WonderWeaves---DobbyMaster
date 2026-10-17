const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const SUBFOLDERS = ['designs', 'weaves', 'yarns', 'palettes', 'colorways', 'looms', 'production', 'exports', 'backups'];
const EXTENSIONS = ['.wwdesign', '.wwweave', '.wwyarn', '.wwpalette'];

let mainWindow = null;
let rendererReady = false;
const pendingOpen = [];

/* ---------- workspace folder (remembered between runs) ---------- */
const configPath = () => path.join(app.getPath('userData'), 'workspace.json');
const readConfig = () => { try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; } };
const writeConfig = cfg => { try { fs.writeFileSync(configPath(), JSON.stringify(cfg)); } catch { /* ignore */ } };

const defaultRoot = () => path.join(app.getPath('documents'), 'WonderWeaves');

const ensureRoot = async root => {
  await fsp.mkdir(root, { recursive: true });
  for (const f of SUBFOLDERS) await fsp.mkdir(path.join(root, f), { recursive: true });
};

const getRoot = async () => {
  const cfg = readConfig();
  let root = cfg.root || defaultRoot();
  try { await ensureRoot(root); }
  catch {
    // A saved network folder can be offline. Fall back so the app still works.
    root = defaultRoot();
    await ensureRoot(root);
  }
  return root;
};

const safeJoin = async (folder, filename) => {
  if (!SUBFOLDERS.includes(folder)) throw new Error('Unknown folder');
  if (!filename || filename !== path.basename(filename)) throw new Error('Invalid file name');
  return path.join(await getRoot(), folder, filename);
};

/* ---------- IPC ---------- */
ipcMain.handle('ww:getRoot', () => getRoot());

ipcMain.handle('ww:chooseRoot', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose your WonderWeaves folder',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: await getRoot(),
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const root = res.filePaths[0];
  await ensureRoot(root);
  writeConfig({ ...readConfig(), root });
  return root;
});

ipcMain.handle('ww:list', async (_e, folder) => {
  if (!SUBFOLDERS.includes(folder)) return [];
  const dir = path.join(await getRoot(), folder);
  let names = [];
  try { names = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!EXTENSIONS.includes(path.extname(name).toLowerCase())) continue;
    try {
      const st = await fsp.stat(path.join(dir, name));
      if (st.isFile()) out.push({ filename: name, modified: st.mtimeMs, size: st.size });
    } catch { /* skip unreadable */ }
  }
  return out;
});

ipcMain.handle('ww:read', async (_e, folder, filename) => fsp.readFile(await safeJoin(folder, filename), 'utf8'));

// Write to a temporary file first, then rename, so a network drop or crash never leaves half a file.
ipcMain.handle('ww:write', async (_e, folder, filename, text) => {
  const target = await safeJoin(folder, filename);
  const tmp = target + '.tmp-' + process.pid;
  await fsp.writeFile(tmp, text, 'utf8');
  try { await fsp.rename(tmp, target); }
  catch (err) { await fsp.copyFile(tmp, target); await fsp.unlink(tmp).catch(() => {}); }
});

ipcMain.handle('ww:remove', async (_e, folder, filename) => { await fsp.unlink(await safeJoin(folder, filename)); });

ipcMain.handle('ww:exists', async (_e, folder, filename) => {
  try { await fsp.access(await safeJoin(folder, filename)); return true; } catch { return false; }
});

ipcMain.handle('ww:reveal', async (_e, folder, filename) => { shell.showItemInFolder(await safeJoin(folder, filename)); });

ipcMain.handle('ww:saveAs', async (_e, suggestedName, text) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save a copy',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
  });
  if (res.canceled || !res.filePath) return false;
  await fsp.writeFile(res.filePath, text, 'utf8');
  return true;
});

/* ---------- opening files from the operating system ---------- */
const sendFile = filePath => {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const payload = { name: path.basename(filePath), text };
    if (mainWindow && rendererReady) mainWindow.webContents.send('ww:open-file', payload);
    else pendingOpen.push(payload);
  } catch { /* ignore unreadable file */ }
};

ipcMain.on('ww:renderer-ready', () => {
  rendererReady = true;
  while (pendingOpen.length) mainWindow.webContents.send('ww:open-file', pendingOpen.shift());
});

const fileFromArgv = argv => argv.find(a => EXTENSIONS.includes(path.extname(a).toLowerCase()) && fs.existsSync(a));

app.on('open-file', (event, filePath) => { event.preventDefault(); sendFile(filePath); }); // macOS

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileFromArgv(argv);
    if (f) sendFile(f);
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'WonderWeaves - Dobby Master',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  rendererReady = false;
  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  const f = fileFromArgv(process.argv);
  if (f) sendFile(f);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
