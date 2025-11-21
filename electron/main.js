// electron/main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const isDev = !app.isPackaged;

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
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

const SETTINGS_DIR_NAME = 'SpinyOwl.DeckStudio';
const SETTINGS_FILE_NAME = 'settings.yml';
const SETTINGS_TEMPLATE = `# Deck Studio application settings
# theme: Controls the editor theme. Allowed values: dark, light.
theme: dark

# autosave: Automatically save files when switching tabs. Allowed values: true, false.
autosave: false

editor:
  # fontSize: Font size used in the built-in editor. Allowed values: integer between 10 and 24.
  fontSize: 13
  # wordWrap: Line wrapping mode. Allowed values: off, on, wordWrapColumn.
  wordWrap: off
  # tabSize: Number of spaces inserted for a tab. Allowed values: integers 2 through 8.
  tabSize: 2

# recentProjects: List of recently opened project folders. Allowed values: absolute file system paths.
recentProjects: []
`;

/**
 * Builds the path to the settings directory and file using the user's app data folder.
 * This ensures the path resolves to "%USERPROFILE%/AppData/Roaming/SpinyOwl.DeckStudio" on Windows
 * and follows platform conventions elsewhere.
 * @returns {{ settingsDir: string; settingsFile: string }} Settings directory and file paths.
 */
function getSettingsPaths() {
    const appDataPath = app.getPath('appData');
    const settingsDir = path.join(appDataPath, SETTINGS_DIR_NAME);
    const settingsFile = path.join(settingsDir, SETTINGS_FILE_NAME);

    return { settingsDir, settingsFile };
}

/**
 * Ensures that the settings directory and file exist, creating them with the template when missing.
 * @returns {Promise<{ settingsDir: string; settingsFile: string }>} Settings directory and file paths.
 */
async function ensureSettingsFile() {
    const { settingsDir, settingsFile } = getSettingsPaths();

    await fs.mkdir(settingsDir, { recursive: true });

    try {
        await fs.access(settingsFile);
    } catch {
        await fs.writeFile(settingsFile, SETTINGS_TEMPLATE, 'utf8');
    }

    return { settingsDir, settingsFile };
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

ipcMain.handle('read-binary-file', async (_event, filePath) => {
    const buffer = await fs.readFile(filePath);

    return buffer.toString('base64');
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
});

ipcMain.handle('load-settings', async () => {
    const { settingsFile } = await ensureSettingsFile();
    const content = await fs.readFile(settingsFile, 'utf8');

    return { path: settingsFile, content };
});

ipcMain.handle('save-settings', async (_event, content) => {
    const { settingsFile } = await ensureSettingsFile();
    await fs.writeFile(settingsFile, content, 'utf8');

    return { path: settingsFile, content };
});
