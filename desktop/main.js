// YappChat desktop: loads the live site in its own window.
const { app, BrowserWindow, Tray, Menu, shell, session, Notification, nativeImage, desktopCapturer, ipcMain } = require('electron');
const path = require('path'), fs = require('fs');
const URL0 = 'https://retrochat-izzg.onrender.com/', ORIGIN = new URL(URL0).origin;
app.setAppUserModelId('app.yappchat.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
let win, tray, quitting = false;
const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
const PRE = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false };
// remembered positions per window kind (messenger, browse, room, im_<name>)
const stF = () => path.join(app.getPath('userData'), 'windows.json');
let ST = {}; try { ST = JSON.parse(fs.readFileSync(stF(), 'utf8')) || {}; } catch {}
let saveT; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(stF(), JSON.stringify(ST)); } catch {} }, 400); };
function track(w, key) { const sv = () => { if (w.isDestroyed() || w.isMinimized()) return; ST[key] = w.getNormalBounds(); persist(); }; for (const ev of ['resize', 'move']) w.on(ev, sv); w.on('close', sv); }
const show = () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); };
app.on('second-instance', show);
const internal = u => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const SIZES = { browse: [760, 640], room: [1000, 700], im: [440, 560] };
function kindOf(url, frame) { if (frame === 'ybrowse') return 'browse'; if (/^yim_/.test(frame || '')) return 'im'; if (/\/rooms\.html/.test(url)) return 'room'; return 'other'; }
function popupOpts(url, frame) {
  const k = kindOf(url, frame), key = k === 'im' ? frame : k, b = ST[key] || {}, d = SIZES[k] || [900, 680];
  return { key, o: { x: b.x, y: b.y, width: b.width || d[0], height: b.height || d[1], minWidth: k === 'im' ? 320 : k === 'room' ? 760 : 480, minHeight: k === 'room' ? 600 : 360, icon, title: 'YappChat', autoHideMenuBar: true, menuBarVisible: false, webPreferences: PRE } };
}
function wire(wc) {
  wc.on('will-navigate', (e, url) => { if (!internal(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  wc.setWindowOpenHandler(({ url, frameName }) => {
    // about:blank popups are the messenger's own IM / Browse windows (same page, same connection)
    if (url === 'about:blank' || internal(url)) return { action: 'allow', overrideBrowserWindowOptions: popupOpts(url, frameName).o };
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' };
  });
  wc.on('did-create-window', (w, { url, frameName }) => { w.setMenuBarVisibility(false); track(w, popupOpts(url, frameName).key);
    if (kindOf(url, frameName) === 'room') w.on('page-title-updated', (e, t) => { e.preventDefault(); w.setTitle(/YappChat/.test(t) ? t : 'YappChat - Chat Room'); }); });
}
function create() {
  const s = ST.messenger || {};
  win = new BrowserWindow({ x: s.x, y: s.y, width: s.width || 320, height: s.height || 640, minWidth: 280, minHeight: 420, title: 'YappChat Messenger', icon, autoHideMenuBar: true, menuBarVisible: false, webPreferences: PRE });
  win.setMenuBarVisibility(false);
  win.loadURL(URL0);
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle('YappChat Messenger'); });
  track(win, 'messenger');
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
app.on('web-contents-created', (_, wc) => wire(wc));
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
