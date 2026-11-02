const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('YappDesktop', { notify: (t, b) => ipcRenderer.send('yc-notify', t, b), isDesktop: true });
