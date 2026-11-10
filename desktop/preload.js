const { contextBridge, ipcRenderer } = require('electron');
// Keep YappDesktop API name: live Render web code already calls window.YappDesktop.
const api = {
  notify: (t, b) => ipcRenderer.send('yc-notify', t, b),
  openExternal: u => ipcRenderer.send('yc-open-external', String(u || '')), // e.g. footer logo -> homepage in the default browser
  isDesktop: true,
  inviteWindows: true, // room invites open in their own centered, always-on-top window
  // Saved screen names on this computer. Passwords stay in the main process (encrypted); the page only sees names.
  signin: {
    list: () => ipcRenderer.invoke('yc-signin-list'),
    signIn: o => ipcRenderer.invoke('yc-signin', { name: String(o?.name || ''), password: o?.password == null ? null : String(o.password), save: !!o?.save, invisible: typeof o?.invisible === 'boolean' ? o.invisible : undefined }),
    note: n => ipcRenderer.invoke('yc-signin-note', String(n || '')),
    remove: n => ipcRenderer.invoke('yc-signin-remove', String(n || ''))
  },
  // Help > Check for Updates; state = { status: idle|checking|downloading|downloaded|none|error|dev, version, percent, current }
  updates: {
    state: () => ipcRenderer.invoke('yc-upd-state'),
    check: () => ipcRenderer.invoke('yc-upd-check'),
    onState: cb => { if (typeof cb === 'function') ipcRenderer.on('yc-upd', (_, st) => cb(st)); }
  },
  // master recordings are saved to Documents/Razzle Recordings (see main.js)
  recordings: { open: n => ipcRenderer.invoke('yc-rec-open', n), write: (id, buf) => ipcRenderer.invoke('yc-rec-write', id, buf), close: id => ipcRenderer.invoke('yc-rec-close', id) },
  micVol: process.platform === 'win32'
    ? { get: () => ipcRenderer.invoke('yc-micvol', 0), step: d => ipcRenderer.invoke('yc-micvol', d) }
    : undefined
};
contextBridge.exposeInMainWorld('YappDesktop', api);
contextBridge.exposeInMainWorld('RazzleDesktop', api);
