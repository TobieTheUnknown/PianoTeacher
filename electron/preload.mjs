import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onMessage: (callback) => ipcRenderer.on('main-process-message', (_event, value) => callback(value))
});
