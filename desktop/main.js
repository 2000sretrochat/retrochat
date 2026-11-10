// Razzle Messenger desktop: loads the live site in a native Windows window.
const { app, BrowserWindow, Tray, Menu, shell, session, Notification, nativeImage, desktopCapturer, ipcMain } = require('electron');
const path = require('path'), fs = require('fs');
const URL0 = 'https://retrochat-izzg.onrender.com/', ORIGIN = new URL(URL0).origin;
// Keep legacy AppUserModelId so taskbar pinning / toast continuity matches prior installs.
app.setAppUserModelId('com.razzlesocial.messenger');
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
let win, tray, quitting = false;
const icon = nativeImage.createFromPath(path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'));
const PRE = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, spellcheck: true };
// remembered positions per window kind (messenger, browse, room, im_<name>)
const stF = () => path.join(app.getPath('userData'), 'windows.json');
let ST = {}; try { ST = JSON.parse(fs.readFileSync(stF(), 'utf8')) || {}; } catch {}
let saveT; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(stF(), JSON.stringify(ST)); } catch {} }, 400); };
function track(w, key) { const sv = () => { if (w.isDestroyed() || w.isMinimized()) return; ST[key] = w.getNormalBounds(); persist(); }; for (const ev of ['resize', 'move']) w.on(ev, sv); w.on('close', sv); }
const show = () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); };
app.on('second-instance', show);
const internal = u => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const SIZES = { browse: [760, 640], room: [1000, 700], im: [440, 560] };
function kindOf(url, frame) { if (/^yinvite_/.test(frame || '')) return 'invite'; if (frame === 'ybrowse') return 'browse'; if (/^yim_/.test(frame || '')) return 'im'; if (/\/rooms\.html/.test(url)) return 'room'; return 'other'; }
function popupOpts(url, frame) {
  if (kindOf(url, frame) === 'invite') return { key: null, o: { width: 360, height: 210, center: true, resizable: false, minimizable: false, maximizable: false, alwaysOnTop: true, show: false,
    icon, title: 'Chat Room Invitation', frame: true, autoHideMenuBar: true, menuBarVisible: false, backgroundColor: '#f4f8fc', webPreferences: PRE } };
  const k = kindOf(url, frame), key = k === 'im' ? frame : k, b = ST[key] || {}, d = SIZES[k] || [900, 680];
  return { key, o: {
    x: b.x, y: b.y, width: b.width || d[0], height: b.height || d[1],
    minWidth: k === 'im' ? 320 : k === 'room' ? 640 : 480,
    minHeight: k === 'room' ? 480 : 360,
    icon, title: 'Razzle Messenger',
    frame: true, autoHideMenuBar: true, menuBarVisible: false,
    backgroundColor: '#f4f8fc',
    webPreferences: PRE
  } };
}
function wire(wc) {
  wc.on('will-navigate', (e, url) => { if (!internal(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  wc.setWindowOpenHandler(({ url, frameName }) => {
    // about:blank popups are the messenger's own IM / Browse windows (same page, same connection)
    if (url === 'about:blank' || internal(url)) return { action: 'allow', overrideBrowserWindowOptions: popupOpts(url, frameName).o };
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' };
  });
  wc.on('did-create-window', (w, { url, frameName }) => {
    w.setMenuBarVisibility(false);
    w.setAutoHideMenuBar(true);
    if (kindOf(url, frameName) === 'invite') {
      // Center on the display the user is looking at, keep on top, and take focus.
      const { screen } = require('electron'), a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea, [bw, bh] = w.getSize();
      w.setBounds({ x: Math.round(a.x + (a.width - bw) / 2), y: Math.round(a.y + (a.height - bh) / 2), width: bw, height: bh });
      w.setAlwaysOnTop(true, 'floating'); w.show(); w.focus(); w.flashFrame(true);
      return;
    }
    track(w, popupOpts(url, frameName).key);
    if (kindOf(url, frameName) === 'room') w.on('page-title-updated', (e, t) => {
      e.preventDefault();
      w.setTitle(/Razzle/.test(t) ? t : 'Razzle Chat - Chat Room');
    });
  });
}
function create() {
  const s = ST.messenger || {};
  win = new BrowserWindow({
    x: s.x, y: s.y,
    width: s.width || 500, height: s.height || 760,
    minWidth: 380, minHeight: 640,
    title: 'Razzle Messenger',
    icon,
    frame: true,
    autoHideMenuBar: true,
    menuBarVisible: false,
    backgroundColor: '#f4f8fc',
    show: false,
    webPreferences: PRE
  });
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  win.loadURL(URL0);
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle('Razzle Messenger'); });
  track(win, 'messenger');
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
app.on('web-contents-created', (_, wc) => wire(wc));
app.whenReady().then(() => {
  // Remove Electron's default File/Edit/View menu so the shell feels like a desktop app, not a browser.
  Menu.setApplicationMenu(null);
  // Auto-update from GitHub releases (silent check; prompts to restart when an update is downloaded)
  if (app.isPackaged) { try { const { autoUpdater } = require('electron-updater'); autoUpdater.autoDownload = true; autoUpdater.on('error', () => {}); autoUpdater.checkForUpdatesAndNotify().catch(() => {}); setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 3600 * 1000); } catch (e) {} }
  const ses = session.defaultSession;
  const okP = ['media', 'notifications', 'display-capture', 'mediaKeySystem', 'clipboard-sanitized-write', 'fullscreen'];
  ses.setPermissionRequestHandler((wc, p, cb) => cb(internal(wc.getURL()) && okP.includes(p)));
  ses.setPermissionCheckHandler((wc, p, origin) => (origin ? new URL(origin).origin === ORIGIN : true) && okP.includes(p));
  // screen / window share with system audio (Windows loopback)
  ses.setDisplayMediaRequestHandler((req, cb) => desktopCapturer.getSources({ types: ['screen', 'window'] }).then(src => cb({ video: src[0], audio: 'loopback' })).catch(() => cb({})), { useSystemPicker: true });
  create();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Razzle Messenger ' + app.getVersion() + ' (Beta)');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Razzle Messenger', click: show },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', show);
});
// web Notifications from the page are native already; also flash the taskbar and offer a tray balloon when hidden
// Master room recordings: the page streams the recording here and it is written to
// Documents/Razzle Recordings/. Only our own site may call this, names are sanitized, files are
// append-only .webm inside that one folder, and each file is capped.
const REC_DIR = () => path.join(app.getPath('documents'), 'Razzle Recordings'), REC_MAX = 8 * 1024 ** 3, recFiles = new Map(); let recSeq = 0;
const recOk = e => { try { return new URL(e.senderFrame ? e.senderFrame.url : e.sender.getURL()).origin === ORIGIN; } catch { return false; } };
ipcMain.handle('yc-rec-open', (e, name) => {
  if (!recOk(e) || recFiles.size >= 4) throw new Error('not allowed');
  const base = String(name || '').replace(/[^A-Za-z0-9 _.-]+/g, '').replace(/^\.+/, '').slice(0, 100).replace(/\.webm$/i, '') || 'Razzle-recording';
  fs.mkdirSync(REC_DIR(), { recursive: true });
  let file = path.join(REC_DIR(), base + '.webm'); for (let i = 2; fs.existsSync(file); i++) file = path.join(REC_DIR(), base + '-' + i + '.webm');
  const id = 'r' + (++recSeq); recFiles.set(id, { file, fd: fs.openSync(file, 'wx'), size: 0, owner: e.sender.id });
  e.sender.once('destroyed', () => { const f = recFiles.get(id); if (f) { recFiles.delete(id); try { fs.closeSync(f.fd); } catch { } } }); // window closed mid-recording: keep what was written
  return id;
});
ipcMain.handle('yc-rec-write', (e, id, buf) => {
  const f = recFiles.get(id); if (!f || f.owner !== e.sender.id || !recOk(e)) throw new Error('not allowed');
  const b = Buffer.from(buf); if (f.size + b.length > REC_MAX) throw new Error('recording too large'); fs.writeSync(f.fd, b); f.size += b.length; return f.size;
});
ipcMain.handle('yc-rec-close', (e, id) => {
  const f = recFiles.get(id); if (!f || f.owner !== e.sender.id) return ''; recFiles.delete(id); try { fs.closeSync(f.fd); } catch { } return f.file;
});
const MICVOL = require('./micvol');
ipcMain.handle('yc-micvol', (_, d) => (d ? MICVOL.step(d) : MICVOL.get()));
ipcMain.on('yc-notify', (_, t, b) => {
  if (win && !win.isFocused()) {
    win.flashFrame(true);
    if (Notification.isSupported() && !win.isVisible()) {
      const n = new Notification({ title: String(t || 'Razzle Messenger'), body: String(b || ''), icon });
      n.on('click', show); n.show();
    }
  }
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
