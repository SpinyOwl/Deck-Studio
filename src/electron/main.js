// electron/main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const fsPromises = fs.promises;

const isDev = !app.isPackaged;

async function createWindow() {
    const layoutState = await loadLayoutState();
    const { width, height, x, y } = layoutState.window;

    const win = new BrowserWindow({
        width,
        height,
        ...(typeof x === 'number' ? { x } : {}),
        ...(typeof y === 'number' ? { y } : {}),
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    if (layoutState.window.isMaximized) {
        win.once('ready-to-show', () => win.maximize());
    }

    trackWindowBounds(win);

    if (isDev) {
        await win.loadURL('http://localhost:5173/');
        win.webContents.openDevTools();
    } else {
        await win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

const SETTINGS_DIR_NAME = 'SpinyOwl.DeckStudio';
const SETTINGS_FILE_NAME = 'settings.yml';
const LAYOUT_FILE_NAME = 'layout.json';
const DEFAULT_LAYOUT_STATE = {
    window: {
        width: 1200,
        height: 800,
        x: null,
        y: null,
        isMaximized: false
    },
    panels: {
        sidebarWidth: 280,
        previewWidth: 360,
        logsHeight: 200,
        isProjectTreeCollapsed: false,
        isPreviewCollapsed: false,
        isLogsCollapsed: false
    }
};
let layoutStateCache = normalizeLayoutState(DEFAULT_LAYOUT_STATE);
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
    const layoutFile = path.join(settingsDir, LAYOUT_FILE_NAME);

    return { settingsDir, settingsFile, layoutFile };
}

/**
 * Ensures that the settings directory and file exist, creating them with the template when missing.
 * @returns {Promise<{ settingsDir: string; settingsFile: string }>} Settings directory and file paths.
 */
async function ensureSettingsFile() {
    const { settingsDir, settingsFile } = getSettingsPaths();

    await fsPromises.mkdir(settingsDir, { recursive: true });

    try {
        await fsPromises.access(settingsFile);
    } catch {
        await fsPromises.writeFile(settingsFile, SETTINGS_TEMPLATE, 'utf8');
    }

    return { settingsDir, settingsFile };
}

/**
 * Normalizes panel layout values to ensure they are finite numbers and booleans.
 *
 * @param {Partial<typeof DEFAULT_LAYOUT_STATE.panels>} panels - Partial panel state to normalize.
 * @returns {typeof DEFAULT_LAYOUT_STATE.panels} Normalized panel state merged with defaults.
 */
function normalizePanels(panels = {}) {
    return {
        sidebarWidth: Number.isFinite(panels.sidebarWidth)
            ? panels.sidebarWidth
            : DEFAULT_LAYOUT_STATE.panels.sidebarWidth,
        previewWidth: Number.isFinite(panels.previewWidth)
            ? panels.previewWidth
            : DEFAULT_LAYOUT_STATE.panels.previewWidth,
        logsHeight: Number.isFinite(panels.logsHeight)
            ? panels.logsHeight
            : DEFAULT_LAYOUT_STATE.panels.logsHeight,
        isProjectTreeCollapsed: Boolean(panels.isProjectTreeCollapsed),
        isPreviewCollapsed: Boolean(panels.isPreviewCollapsed),
        isLogsCollapsed: Boolean(panels.isLogsCollapsed)
    };
}

/**
 * Normalizes window bounds to ensure finite numeric values and a boolean maximized flag.
 *
 * @param {Partial<typeof DEFAULT_LAYOUT_STATE.window>} windowState - Partial window state to normalize.
 * @returns {typeof DEFAULT_LAYOUT_STATE.window} Normalized window state merged with defaults.
 */
function normalizeWindowState(windowState = {}) {
    return {
        width: Number.isFinite(windowState.width)
            ? windowState.width
            : DEFAULT_LAYOUT_STATE.window.width,
        height: Number.isFinite(windowState.height)
            ? windowState.height
            : DEFAULT_LAYOUT_STATE.window.height,
        x: Number.isFinite(windowState.x) ? windowState.x : null,
        y: Number.isFinite(windowState.y) ? windowState.y : null,
        isMaximized: Boolean(windowState.isMaximized)
    };
}

/**
 * Merges layout state with defaults to guarantee required keys exist.
 *
 * @param {Partial<typeof DEFAULT_LAYOUT_STATE>} state - Partial layout state from disk or IPC payloads.
 * @returns {typeof DEFAULT_LAYOUT_STATE} Normalized layout state.
 */
function normalizeLayoutState(state = {}) {
    return {
        window: normalizeWindowState(state.window),
        panels: normalizePanels(state.panels)
    };
}

/**
 * Loads persisted layout configuration from disk, falling back to defaults when missing.
 *
 * @returns {Promise<typeof DEFAULT_LAYOUT_STATE>} Layout state retrieved from disk or defaults.
 */
async function loadLayoutState() {
    const { layoutFile, settingsDir } = getSettingsPaths();
    await fsPromises.mkdir(settingsDir, { recursive: true });

    try {
        const raw = await fsPromises.readFile(layoutFile, 'utf8');
        const parsed = JSON.parse(raw);
        layoutStateCache = normalizeLayoutState(parsed);
    } catch {
        layoutStateCache = normalizeLayoutState(DEFAULT_LAYOUT_STATE);
    }

    return layoutStateCache;
}

/**
 * Persists layout configuration to disk and updates the in-memory cache.
 *
 * @param {Partial<typeof DEFAULT_LAYOUT_STATE>} nextState - New layout values to merge and persist.
 * @returns {Promise<typeof DEFAULT_LAYOUT_STATE>} Persisted layout state.
 */
async function saveLayoutState(nextState) {
    const { layoutFile, settingsDir } = getSettingsPaths();
    await fsPromises.mkdir(settingsDir, { recursive: true });

    const merged = normalizeLayoutState({
        ...layoutStateCache,
        ...nextState,
        window: {
            ...layoutStateCache.window,
            ...(nextState.window ?? {})
        },
        panels: {
            ...layoutStateCache.panels,
            ...(nextState.panels ?? {})
        }
    });

    layoutStateCache = merged;
    await fsPromises.writeFile(layoutFile, JSON.stringify(merged, null, 2), 'utf8');

    return merged;
}

/**
 * Hooks into BrowserWindow move/resize events to keep layout state in sync.
 *
 * @param {BrowserWindow} win - Window instance to observe.
 */
function trackWindowBounds(win) {
    const persistBounds = async () => {
        if (win.isMinimized() || win.isDestroyed()) {
            return;
        }

        const bounds = win.getBounds();
        await saveLayoutState({
            window: {
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y,
                isMaximized: win.isMaximized()
            }
        });
    };

    win.on('resize', persistBounds);
    win.on('move', persistBounds);
    win.on('maximize', async () => {
        await saveLayoutState({
            window: {
                ...layoutStateCache.window,
                isMaximized: true
            }
        });
    });
    win.on('unmaximize', persistBounds);
    win.on('close', persistBounds);
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

const IGNORED_DIRECTORIES = ['node_modules'];
const IGNORED_PREFIXES = ['.git'];
const projectWatchers = new Map();

function shouldIgnoreDirectory(name) {
    return IGNORED_DIRECTORIES.includes(name) || IGNORED_PREFIXES.some(prefix => name.startsWith(prefix));
}

/**
 * Traverses the provided directory and collects all directories that should be watched for changes.
 *
 * @param {string} dir - Root directory of the project.
 * @returns {Promise<string[]>} List of directory paths to observe.
 */
async function collectWatchTargets(dir) {
    const directories = [dir];

    try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory() || shouldIgnoreDirectory(entry.name)) continue;

            const fullPath = path.join(dir, entry.name);
            directories.push(...(await collectWatchTargets(fullPath)));
        }
    } catch {
        return directories;
    }

    return directories;
}

/**
 * Schedules a debounced notification to the renderer that the project folder changed.
 *
 * @param {Electron.WebContents} webContents - Renderer to notify.
 * @param {string} rootPath - Project root path associated with the watcher.
 */
function scheduleProjectReload(webContents, rootPath) {
    const record = projectWatchers.get(webContents.id);
    if (!record) return;

    if (record.debounce) {
        clearTimeout(record.debounce);
    }

    record.debounce = setTimeout(() => {
        if (!webContents.isDestroyed()) {
            webContents.send('project-folder-changed', rootPath);
        }
    }, 200);
}

/**
 * Disposes all active watchers associated with the provided renderer process.
 *
 * @param {Electron.WebContents} webContents - Renderer that owns the watcher.
 */
function stopWatchingProjectFolder(webContents) {
    const record = projectWatchers.get(webContents.id);
    if (!record) return;

    record.watchers.forEach(watcher => watcher.close());
    if (record.debounce) {
        clearTimeout(record.debounce);
    }

    projectWatchers.delete(webContents.id);
}

/**
 * Recursively watches the project directory tree and emits a reload event when files change.
 *
 * @param {string} rootPath - Absolute path to the project root.
 * @param {Electron.WebContents} webContents - Renderer to notify of changes.
 * @returns {Promise<boolean>} Indicates whether watchers were established.
 */
async function watchProjectFolder(rootPath, webContents) {
    if (!rootPath) return false;

    stopWatchingProjectFolder(webContents);

    const watchTargets = await collectWatchTargets(rootPath);
    const watchers = watchTargets.map(target => {
        const watcher = fs.watch(target, { persistent: false }, () => {
            scheduleProjectReload(webContents, rootPath);
        });

        watcher.on('error', () => {});
        return watcher;
    });

    projectWatchers.set(webContents.id, { rootPath, watchers, debounce: null });

    return true;
}

app.on('web-contents-destroyed', (_event, contents) => {
    stopWatchingProjectFolder(contents);
});

async function buildTree(dir) {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    const children = [];
    for (const entry of entries) {
        if (shouldIgnoreDirectory(entry.name)) continue;

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

ipcMain.handle('load-project-folder', async (_event, rootPath) => {
    if (!rootPath) return null;

    try {
        const tree = await buildTree(rootPath);

        return { rootPath, tree };
    } catch {
        return null;
    }
});

ipcMain.handle('watch-project-folder', async (event, rootPath) => {
    try {
        return watchProjectFolder(rootPath, event.sender);
    } catch {
        return false;
    }
});

ipcMain.handle('read-file', async (_event, filePath) => {
    return fsPromises.readFile(filePath, 'utf8');
});

ipcMain.handle('read-binary-file', async (_event, filePath) => {
    const buffer = await fsPromises.readFile(filePath);

    return buffer.toString('base64');
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
    await fsPromises.writeFile(filePath, content, 'utf8');
    return true;
});

ipcMain.handle('load-settings', async () => {
    const { settingsFile } = await ensureSettingsFile();
    const content = await fsPromises.readFile(settingsFile, 'utf8');

    return { path: settingsFile, content };
});

ipcMain.handle('save-settings', async (_event, content) => {
    const { settingsFile } = await ensureSettingsFile();
    await fsPromises.writeFile(settingsFile, content, 'utf8');

    return { path: settingsFile, content };
});

ipcMain.handle('load-layout-state', async () => {
    return loadLayoutState();
});

ipcMain.handle('save-layout-state', async (_event, partialLayout) => {
    return saveLayoutState(partialLayout ?? {});
});
