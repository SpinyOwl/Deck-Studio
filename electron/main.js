// electron/main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const isDev = !app.isPackaged;

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    if (isDev) {
        await win.loadURL('http://localhost:5173/');
        win.webContents.openDevTools();
    } else {
        await win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ---- Project folder + FS helpers ----

async function buildTree(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const children = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            children.push({
                type: 'dir',
                name: entry.name,
                path: fullPath,
                children: await buildTree(fullPath)
            });
        } else {
            children.push({
                type: 'file',
                name: entry.name,
                path: fullPath
            });
        }
    }
    return children.sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name);
        }

        return a.type === 'dir' ? -1 : 1;
    });
}

ipcMain.handle('select-project-folder', async () => {
    const res = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return null;

    const rootPath = res.filePaths[0];
    const tree = await buildTree(rootPath);
    return { rootPath, tree };
});

ipcMain.handle('read-file', async (_event, filePath) => {
    return fs.readFile(filePath, 'utf8');
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
});
