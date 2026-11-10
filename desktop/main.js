// Razzle Messenger desktop: loads the live site in a native Windows window.
const { app, BrowserWindow, Tray, Menu, shell, session, Notification, nativeImage, desktopCapturer, ipcMain, dialog, net, safeStorage } = require('electron');
const { createSigninStore } = require('./signin-store');
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
// ---------- sign-in: saved screen names, no silent auto-login, sign out on Close ----------
const COOKIE = 'yc_sid';
let names; // created after app ready (safeStorage needs it)
// Talk to the live site from the main process using the app's own cookie jar.
function siteRequest(method, p, body, ms = 8000) {
  return new Promise(resolve => {
    let done = false; const fin = v => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
    const t = setTimeout(() => { try { req.abort(); } catch {} fin({ status: 0, json: {} }); }, ms);
    const req = net.request({ method, url: ORIGIN + p, session: session.defaultSession, useSessionCookies: true });
    req.setHeader('Accept', 'application/json');
    if (body) req.setHeader('Content-Type', 'application/json');
    req.on('response', res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch {} fin({ status: res.statusCode, json: j }); }); res.on('error', () => fin({ status: 0, json: {} })); });
    req.on('error', () => fin({ status: 0, json: {} }));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
// End the session on the server, then drop the cookie locally. Saved names/passwords are kept.
async function signOutSession() {
  const ses = session.defaultSession;
  const c = await ses.cookies.get({ url: ORIGIN, name: COOKIE }).catch(() => []);
  if (c.length) await siteRequest('POST', '/api/logout', {}, 4000);
  await ses.cookies.remove(ORIGIN, COOKIE).catch(() => {});
  await ses.cookies.flushStore().catch(() => {});
}
const fromSite = e => internal(e.senderFrame?.url || e.sender.getURL());
ipcMain.handle('yc-signin-list', e => fromSite(e) ? { names: names.list(), canSave: names.canSavePasswords() } : { names: [], canSave: false });
// The page sends the typed password, or null to use the saved one. The saved password is never sent to the page.
ipcMain.handle('yc-signin', async (e, o) => {
  if (!fromSite(e) || !o || typeof o.name !== 'string') return { error: 'Sign-in is not available here.' };
  const name = o.name.trim(), typed = typeof o.password === 'string' && o.password ? o.password.slice(0, 100) : null;
  const password = typed ?? names.password(name);
  if (!password) return { error: 'Enter your password.' };
  const r = await siteRequest('POST', '/api/login', { name, password, remember: false });
  if (r.status !== 200 || !r.json.ok) return { error: r.json.error || (r.status ? 'Sign-in failed.' : 'Could not reach Razzle. Check your connection and try again.') };
  names.record(r.json.name || name, { password: typed, save: !!o.save, invisible: typeof o.invisible === 'boolean' ? o.invisible : undefined });
  return { ok: true, name: r.json.name || name };
});
// After a sign-in the page did itself (sign-up, room sign-in), remember the name if it really is the signed-in one.
ipcMain.handle('yc-signin-note', async (e, n) => {
  if (!fromSite(e)) return false;
  const r = await siteRequest('GET', '/api/me');
  if (!r.json.name || String(r.json.name).toLowerCase() !== String(n || '').trim().toLowerCase()) return false;
  if (!names.list().some(x => x.name.toLowerCase() === r.json.name.toLowerCase())) names.record(r.json.name);
  return true;
});
ipcMain.handle('yc-signin-remove', (e, n) => fromSite(e) ? names.remove(String(n || '')) : false);
// ---------- updates: background check, Help > Check for Updates, restart prompt, local log ----------
const UPD = { status: 'idle', version: null, percent: 0 };
let updater = null, manualUpd = false;
function ulog(level, m) {
  try {
    const f = path.join(app.getPath('userData'), 'logs', 'updater.log');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    try { if (fs.statSync(f).size > 512e3) fs.renameSync(f, f + '.old'); } catch {}
    const line = String((m && m.message) || m).split('\n')[0].replace(/([?&](?:token|sig|jwt|se|skoid|sktid)=)[^&\s]+/gi, '$1...').replace(/(authorization|bearer)\s*[:=]?\s*\S+/gi, '$1 ...').slice(0, 2000);
    fs.appendFileSync(f, new Date().toISOString() + ' ' + level + ' ' + line + '\n');
  } catch {}
}
function refreshTray() {
  if (!tray) return;
  const t = [{ label: 'Open Razzle Messenger', click: show }];
  if (UPD.status === 'downloaded') t.push({ label: 'Restart to update (' + UPD.version + ')', click: () => promptRestart() });
  t.push({ type: 'separator' }, { label: 'Close', click: () => { confirmClose(); } });
  tray.setContextMenu(Menu.buildFromTemplate(t));
}
function updSet(p) {
  const was = UPD.status; Object.assign(UPD, p);
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('yc-upd', { ...UPD, current: app.getVersion() });
  if (win && !win.isDestroyed()) win.setProgressBar(UPD.status === 'downloading' ? Math.max(0.01, (UPD.percent || 0) / 100) : -1);
  if (UPD.status !== was) refreshTray();
}
const note = (type, message, detail) => dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, { type, buttons: ['OK'], title: 'Razzle Messenger', message, detail, icon });
async function promptRestart() {
  const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
    type: 'info', buttons: ['Restart to update', 'Later'], defaultId: 0, cancelId: 1, noLink: true, title: 'Razzle Messenger', icon,
    message: 'Razzle Messenger ' + UPD.version + ' (Beta) is ready to install.', detail: 'Razzle Messenger will close, update, and open again. You will need to sign in again.'
  });
  if (response !== 0 || !updater) return;
  ulog('info', 'user chose restart to update ' + UPD.version);
  await signOutSession().catch(() => {});
  quitting = true; updater.quitAndInstall(true, true);
}
function initUpdater() {
  if (!app.isPackaged) { UPD.status = 'dev'; return; }
  try { updater = require('electron-updater').autoUpdater; } catch (e) { ulog('error', e); UPD.status = 'error'; return; }
  updater.autoDownload = true; updater.autoInstallOnAppQuit = true;
  updater.logger = { info: m => ulog('info', m), warn: m => ulog('warn', m), error: () => {}, debug: () => {} }; // errors are logged once, below
  updater.on('checking-for-update', () => updSet({ status: 'checking' }));
  updater.on('update-available', i => updSet({ status: 'downloading', version: i.version, percent: 0 }));
  updater.on('download-progress', p => updSet({ status: 'downloading', percent: Math.round(p.percent || 0) }));
  updater.on('update-not-available', () => {
    updSet({ status: 'none', version: null });
    if (manualUpd) { manualUpd = false; note('info', "You're on the latest version (" + app.getVersion() + ' Beta).'); }
  });
  updater.on('update-downloaded', i => {
    updSet({ status: 'downloaded', version: i.version, percent: 100 });
    ulog('info', 'update downloaded ' + i.version);
    if (manualUpd) { manualUpd = false; promptRestart(); }
  });
  updater.on('error', e => {
    ulog('error', (e && e.message || String(e)).split('\n')[0]);
    updSet({ status: UPD.status === 'downloaded' ? 'downloaded' : 'error' });
    if (manualUpd) { manualUpd = false; note('warning', "Couldn't check for updates right now.", 'Please try again later. If this keeps happening, download the latest installer from the Razzle website.'); }
  });
  const bg = () => { if (!['checking', 'downloading', 'downloaded'].includes(UPD.status)) updater.checkForUpdates().catch(() => {}); }; // failures arrive via the 'error' event
  setTimeout(bg, 10e3); setInterval(bg, 4 * 3600e3);
  ulog('info', 'updater ready, installed ' + app.getVersion());
}
function manualCheck() {
  if (!updater) return note('info', UPD.status === 'dev' ? 'Updates are checked only in the installed app.' : "Couldn't check for updates right now.", 'Installed version: ' + app.getVersion() + ' (Beta)');
  if (UPD.status === 'downloaded') return promptRestart();
  manualUpd = true;
  if (UPD.status === 'downloading') return note('info', 'Downloading Razzle Messenger ' + UPD.version + ' (' + (UPD.percent || 0) + '%)...', "You'll be asked to restart when it's ready.");
  if (UPD.status !== 'checking') updater.checkForUpdates().catch(() => {});
}
ipcMain.handle('yc-upd-state', e => fromSite(e) ? { ...UPD, current: app.getVersion() } : null);
ipcMain.handle('yc-upd-check', e => { if (fromSite(e)) manualCheck(); return true; });
async function confirmClose() {
  if (win && !win.isDestroyed()) show();
  const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
    type: 'question', buttons: ['Yes', 'No'], defaultId: 1, cancelId: 1, noLink: true,
    title: 'Razzle Messenger', message: 'Are you sure you want to close Razzle Messenger?', icon
  });
  if (response !== 0) return;
  tray && tray.setToolTip('Razzle Messenger - signing out...');
  await signOutSession();
  quitting = true; app.quit();
}
app.whenReady().then(async () => {
  // Remove Electron's default File/Edit/View menu so the shell feels like a desktop app, not a browser.
  Menu.setApplicationMenu(null);
  initUpdater();
  const ses = session.defaultSession;
  const okP = ['media', 'notifications', 'display-capture', 'mediaKeySystem', 'clipboard-sanitized-write', 'fullscreen'];
  ses.setPermissionRequestHandler((wc, p, cb) => cb(internal(wc.getURL()) && okP.includes(p)));
  ses.setPermissionCheckHandler((wc, p, origin) => (origin ? new URL(origin).origin === ORIGIN : true) && okP.includes(p));
  // screen / window share with system audio (Windows loopback)
  ses.setDisplayMediaRequestHandler((req, cb) => desktopCapturer.getSources({ types: ['screen', 'window'] }).then(src => cb({ video: src[0], audio: 'loopback' })).catch(() => cb({})), { useSystemPicker: true });
  names = createSigninStore({ file: path.join(app.getPath('userData'), 'signin-names.json'), crypto: safeStorage });
  // No silent auto-login: a session left over from last time (crash, shutdown, update) is ended before the sign-in screen loads.
  await signOutSession().catch(() => {});
  create();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Razzle Messenger ' + app.getVersion() + ' (Beta)');
  refreshTray();
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
