// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readBinaryFile: (filePath) => ipcRenderer.invoke('read-binary-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (content) => ipcRenderer.invoke('save-settings', content),
    loadLayoutState: () => ipcRenderer.invoke('load-layout-state'),
    saveLayoutState: (payload) => ipcRenderer.invoke('save-layout-state', payload),
    loadProjectFolder: (rootPath) => ipcRenderer.invoke('load-project-folder', rootPath),
    watchProjectFolder: (rootPath) => ipcRenderer.invoke('watch-project-folder', rootPath),
    resolveAssetUrl: (rootPath, relativePath) => ipcRenderer.invoke('resolve-asset-url', rootPath, relativePath),
    onProjectFolderChanged: (callback) => {
        const subscription = (_event, payload) => callback(payload);
        ipcRenderer.on('project-folder-changed', subscription);

        return () => ipcRenderer.removeListener('project-folder-changed', subscription);
    }
});
