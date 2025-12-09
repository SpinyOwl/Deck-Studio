// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
    savePdfDialog: (defaultPath) => ipcRenderer.invoke('save-pdf-dialog', defaultPath),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readBinaryFile: (filePath) => ipcRenderer.invoke('read-binary-file', filePath),
    writeBinaryFile: (filePath, content) => ipcRenderer.invoke('write-binary-file', filePath, content),
    createFile: (filePath, content) => ipcRenderer.invoke('create-file', filePath, content),
    createDirectory: (directoryPath) => ipcRenderer.invoke('create-directory', directoryPath),
    renamePath: (currentPath, nextPath) => ipcRenderer.invoke('rename-path', currentPath, nextPath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (content) => ipcRenderer.invoke('save-settings', content),
    loadThemes: () => ipcRenderer.invoke('load-themes'),
    loadLayoutState: () => ipcRenderer.invoke('load-layout-state'),
    saveLayoutState: (payload) => ipcRenderer.invoke('save-layout-state', payload),
    loadProjectFolder: (rootPath) => ipcRenderer.invoke('load-project-folder', rootPath),
    watchProjectFolder: (rootPath) => ipcRenderer.invoke('watch-project-folder', rootPath),
    resolveAssetUrl: (rootPath, relativePath) => ipcRenderer.invoke('resolve-asset-url', rootPath, relativePath),
    showDirectoryPicker: () => ipcRenderer.invoke('show-directory-picker'),
    copyTemplateProject: (destinationPath) => ipcRenderer.invoke('copy-template-project', destinationPath),
    onProjectFolderChanged: (callback) => {
        const subscription = (_event, payload) => callback(payload);
        ipcRenderer.on('project-folder-changed', subscription);

        return () => ipcRenderer.removeListener('project-folder-changed', subscription);
    }
});
