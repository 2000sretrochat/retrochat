const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('YappDesktop', { notify: (t, b) => ipcRenderer.send('yc-notify', t, b), isDesktop: true, micVol: process.platform === 'win32' ? { get: () => ipcRenderer.invoke('yc-micvol', 0), step: d => ipcRenderer.invoke('yc-micvol', d) } : undefined });
