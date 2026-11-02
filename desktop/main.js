// YappChat desktop: loads the live site in its own window.
const { app, BrowserWindow, Tray, Menu, shell, session, Notification, nativeImage, desktopCapturer, ipcMain } = require('electron');
const path = require('path'), fs = require('fs');
const URL0 = 'https://retrochat-izzg.onrender.com/', ORIGIN = new URL(URL0).origin;
app.setAppUserModelId('app.yappchat.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
let win, tray, quitting = false;
const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
const stF = () => path.join(app.getPath('userData'), 'window.json');
const loadSt = () => { try { return JSON.parse(fs.readFileSync(stF(), 'utf8')); } catch { return { width: 1100, height: 760 }; } };
const saveSt = () => { if (!win || win.isMinimized()) return; try { fs.writeFileSync(stF(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch {} };
const show = () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); };
app.on('second-instance', show);
const internal = u => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
function create() {
  const s = loadSt();
  win = new BrowserWindow({ x: s.x, y: s.y, width: s.width, height: s.height, minWidth: 640, minHeight: 480, title: 'YappChat', icon, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false } });
  if (s.max) win.maximize();
  win.loadURL(URL0);
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle('YappChat'); });
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) win.on(ev, saveSt);
  win.on('close', e => { saveSt(); if (!quitting) { e.preventDefault(); win.hide(); } });
  // popups from the site (e.g. the rooms window) stay in-app; everything else opens in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (internal(url)) return { action: 'allow', overrideBrowserWindowOptions: { icon, title: 'YappChat', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false } } };
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' };
  });
  app.on('web-contents-created', (_, wc) => {
    wc.on('will-navigate', (e, url) => { if (!internal(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
    wc.setWindowOpenHandler(({ url }) => { if (internal(url)) return { action: 'allow', overrideBrowserWindowOptions: { icon, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false } } }; if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  });
}
app.whenReady().then(() => {
  const ses = session.defaultSession;
  const okP = ['media', 'notifications', 'display-capture', 'mediaKeySystem', 'clipboard-sanitized-write', 'fullscreen'];
  ses.setPermissionRequestHandler((wc, p, cb) => cb(internal(wc.getURL()) && okP.includes(p)));
  ses.setPermissionCheckHandler((wc, p, origin) => (origin ? new URL(origin).origin === ORIGIN : true) && okP.includes(p));
  // screen / window share with system audio (Windows loopback)
  ses.setDisplayMediaRequestHandler((req, cb) => desktopCapturer.getSources({ types: ['screen', 'window'] }).then(src => cb({ video: src[0], audio: 'loopback' })).catch(() => cb({})), { useSystemPicker: true });
  create();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('YappChat');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open YappChat', click: show }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; app.quit(); } }]));
  tray.on('click', show);
});
// web Notifications from the page are native already; also flash the taskbar and offer a tray balloon when hidden
ipcMain.on('yc-notify', (_, t, b) => { if (win && !win.isFocused()) { win.flashFrame(true); if (Notification.isSupported() && !win.isVisible()) { const n = new Notification({ title: String(t || 'YappChat'), body: String(b || ''), icon }); n.on('click', show); n.show(); } } });
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
