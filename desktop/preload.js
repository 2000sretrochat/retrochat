const { contextBridge, ipcRenderer } = require('electron');
// Keep YappDesktop API name: live Render web code already calls window.YappDesktop.
const api = {
  notify: (t, b) => ipcRenderer.send('yc-notify', t, b),
  isDesktop: true,
  inviteWindows: true, // room invites open in their own centered, always-on-top window
  micVol: process.platform === 'win32'
    ? { get: () => ipcRenderer.invoke('yc-micvol', 0), step: d => ipcRenderer.invoke('yc-micvol', d) }
    : undefined
};
contextBridge.exposeInMainWorld('YappDesktop', api);
contextBridge.exposeInMainWorld('RazzleDesktop', api);
