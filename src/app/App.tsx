// src/App.tsx
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {CardPreviewPanel} from './components/CardPreviewPanel';
import {EditorPanel} from './components/EditorPanel';
import {LogsPanel} from './components/LogsPanel';
import {ProjectTreePanel} from './components/ProjectTreePanel';
import {SettingsModal} from './components/SettingsModal';
import {logService} from './services/LogService';
import {fileService} from './services/FileService';
import {projectService} from './services/ProjectService';
import {layoutService} from './services/LayoutService';
import {yamlParsingService} from './services/YamlParsingService';
import {type FileNode} from './types/files';
import {type Project} from './types/project';
import {type AppSettings, type AutosaveSettingsConfig} from './types/settings';
import {PROJECT_CONFIG_FILENAME} from './constants/project';
import {
  containsPathSeparator,
  getParentPath,
  getPathSeparator,
  isDescendantPath,
  joinPathSegments,
} from './utils/path';
import './styles/AppLayout.css';
import './styles/Panel.css';
import { pdfExportService } from './services/PdfExportService';
import { NotificationPopup } from './components/NotificationPopup/NotificationPopup';

const MIN_TREE_PANEL_SIZE = 150;
const MIN_PREVIEW_PANEL_SIZE = 250;
const MIN_LOG_PANEL_SIZE = 150;
const COLLAPSED_THICKNESS = 0;
const SIDE_TOOLBAR_WIDTH = 32;
const RESIZE_HANDLE_THICKNESS = 4;
const MIN_EDITOR_WIDTH = 150;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];

type FileType = 'text' | 'image' | 'csv';

type OpenFile = {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  fileType: FileType;
};

type AutosaveSettings = {
  enabled: boolean;
  intervalSeconds: number;
};

const DEFAULT_AUTOSAVE_SETTINGS: AutosaveSettings = {
  enabled: false,
  intervalSeconds: 30,
};

const MIN_AUTOSAVE_INTERVAL_SECONDS = 5;

/**
 * Normalizes autosave configuration values, applying defaults for missing values.
 *
 * @param config - Raw autosave configuration from settings YAML.
 * @returns Normalized autosave settings with safe defaults.
 */
function normalizeAutosaveSettings(config: unknown): AutosaveSettings {
  if (typeof config === 'boolean') {
    return {...DEFAULT_AUTOSAVE_SETTINGS, enabled: config};
  }

  if (config && typeof config === 'object') {
    const autosaveConfig = config as AutosaveSettingsConfig;
    const interval = Number.isFinite(autosaveConfig.intervalSeconds)
      ? Math.max(MIN_AUTOSAVE_INTERVAL_SECONDS, Number(autosaveConfig.intervalSeconds))
      : DEFAULT_AUTOSAVE_SETTINGS.intervalSeconds;

    return {
      enabled: Boolean(autosaveConfig.enabled),
      intervalSeconds: interval,
    };
  }

  return DEFAULT_AUTOSAVE_SETTINGS;
}

/**
 * Extracts autosave preferences from a YAML document.
 *
 * @param yamlText - Raw YAML settings content.
 * @returns Parsed autosave settings with defaults on failure.
 */
function parseAutosaveSettings(yamlText: string): AutosaveSettings {
  try {
    const settings = yamlParsingService.parse<AppSettings>(yamlText);

    return normalizeAutosaveSettings(settings.autosave);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logService.warning(`Unable to parse settings. Using default autosave values. (${reason})`);

    return DEFAULT_AUTOSAVE_SETTINGS;
  }
}

/**
 * Checks whether the provided file path points to a supported image file.
 *
 * @param path - Absolute file system path of the file to inspect.
 * @returns True when the extension matches a known image type.
 */
function isImageFile(path: string): boolean {
  const lowerPath = path.toLowerCase();

  return IMAGE_EXTENSIONS.some(extension => lowerPath.endsWith(extension));
}

/**
 * Infers a MIME type for a file path, defaulting to a safe fallback when unknown.
 *
 * @param path - Absolute file system path of the file to inspect.
 * @returns MIME type string suitable for data URLs.
 */
function getImageMimeType(path: string): string {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith('.png')) return 'image/png';
  if (lowerPath.endsWith('.jpg' ) || lowerPath.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerPath.endsWith('.gif')) return 'image/gif';
  if (lowerPath.endsWith('.bmp')) return 'image/bmp';
  if (lowerPath.endsWith('.webp')) return 'image/webp';
  if (lowerPath.endsWith('.svg')) return 'image/svg+xml';

  return 'application/octet-stream';
}

/**
 * Identifies CSV files using their extension.
 *
 * @param path - Absolute file system path to evaluate.
 * @returns True when the file is a CSV document.
 */
function isCsvFile(path: string): boolean {
  return path.toLowerCase().endsWith('.csv');
}

/**
 * Determines whether a file supports saving through the text pipeline.
 *
 * @param file - Open file metadata.
 * @returns True when the file content can be persisted as text.
 */
function isEditableFile(file: OpenFile): boolean {
  return file.fileType === 'text' || file.fileType === 'csv';
}

/**
 * Serializes an open file into the persisted text representation.
 *
 * @param file - Open file metadata.
 * @returns String content to write to disk.
 */
function serializeOpenFile(file: OpenFile): string {
  return file.content;
}

function App() {
  const [project, setProject] = useState<Project | null>(null);

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [previewWidth, setPreviewWidth] = useState(360);
  const [logsHeight, setLogsHeight] = useState(200);
  const [previousSidebarWidth, setPreviousSidebarWidth] = useState(sidebarWidth);
  const [previousPreviewWidth, setPreviousPreviewWidth] = useState(previewWidth);
  const [previousLogsHeight, setPreviousLogsHeight] = useState(logsHeight);
  const [isProjectTreeCollapsed, setIsProjectTreeCollapsed] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [isLogsCollapsed, setIsLogsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsContent, setSettingsContent] = useState('');
  const [settingsPath, setSettingsPath] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [autosaveSettings, setAutosaveSettings] = useState<AutosaveSettings>(
    DEFAULT_AUTOSAVE_SETTINGS,
  );
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  type DragTarget = 'sidebar' | 'preview' | 'logs';
  const dragState = useRef<{
    target: DragTarget;
    startX: number;
    startY: number;
    initialSidebarWidth: number;
    initialPreviewWidth: number;
    initialLogsHeight: number;
  } | null>(null);
  const openFilesRef = useRef<OpenFile[]>([]);
  const autosaveTimerId = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const autosaveInProgress = useRef(false);
  const performAutosaveRef = useRef<() => Promise<void>>(async () => {});
  const layoutHydrated = useRef(false);
  const textChangeTimeoutId = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  /**
   * Clears any pending autosave timer.
   */
  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerId.current) {
      window.clearTimeout(autosaveTimerId.current);
      autosaveTimerId.current = null;
    }
  }, []);

  /**
   * Schedules an autosave to run after the configured idle interval following the last edit.
   */
  const scheduleAutosaveAfterIdle = useCallback(() => {
    clearAutosaveTimer();

    if (!project || !autosaveSettings.enabled) {
      return;
    }

    const hasDirtyFiles = openFilesRef.current.some(
      file => isEditableFile(file) && file.isDirty,
    );

    if (!hasDirtyFiles) {
      return;
    }

    const delayMs =
      Math.max(MIN_AUTOSAVE_INTERVAL_SECONDS, autosaveSettings.intervalSeconds) * 1000;

    autosaveTimerId.current = setTimeout(() => {
      void performAutosaveRef.current();
    }, delayMs);
  }, [autosaveSettings, clearAutosaveTimer, project]);

  useEffect(() => {
    logService.info('Deck Studio ready.');
  }, []);

  useEffect(() => {
    async function hydrateSettings() {
      try {
        const settings = await window.api.loadSettings();
        setSettingsContent(settings.content);
        setSettingsPath(settings.path);
        setAutosaveSettings(parseAutosaveSettings(settings.content));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.warning(`Unable to load settings. Using defaults. (${reason})`);
      }
    }

    void hydrateSettings();
  }, []);

  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);

  useEffect(() => {
    async function hydrateLayout() {
      try {
        const layout = await layoutService.loadLayout();
        setSidebarWidth(layout.panels.sidebarWidth);
        setPreviewWidth(layout.panels.previewWidth);
        setLogsHeight(layout.panels.logsHeight);
        setPreviousSidebarWidth(layout.panels.sidebarWidth);
        setPreviousPreviewWidth(layout.panels.previewWidth);
        setPreviousLogsHeight(layout.panels.logsHeight);
        setIsProjectTreeCollapsed(layout.panels.isProjectTreeCollapsed);
        setIsPreviewCollapsed(layout.panels.isPreviewCollapsed);
        setIsLogsCollapsed(layout.panels.isLogsCollapsed);
      } catch (error) {
        console.error('Failed to hydrate layout state', error);
        logService.warning('Unable to restore saved layout. Using defaults.');
      } finally {
        layoutHydrated.current = true;
      }
    }

    hydrateLayout();
  }, []);

  useEffect(() => {
    if (!project) {
      return undefined;
    }

    const rootPath = project.rootPath;
    const currentLocale = project.localization?.locale;

    async function startWatchingProject() {
      try {
        const started = await window.api.watchProjectFolder(rootPath);
        if (!started) {
          logService.warning('Unable to start watching the project folder for changes.');
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.warning(`Failed to watch project folder: ${reason}`);
      }
    }

    const unsubscribe = window.api.onProjectFolderChanged(async (changedRootPath: any) => {
      if (changedRootPath !== rootPath) {
        return;
      }

      logService.info('Detected changes in project files. Reloading project...');
      try {
        const reloaded = await projectService.reloadProject(changedRootPath, currentLocale);
        if (!reloaded) {
          return;
        }

        setProject(current => (current?.rootPath === changedRootPath ? reloaded : current));
        logService.info('Project reloaded after file system updates.');
        void startWatchingProject();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.error(`Unable to reload project after detecting changes: ${reason}`);
      }
    });

    void startWatchingProject();

    return () => {
      unsubscribe();
    };
  }, [project]);

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer]);

  useEffect(() => {
    if (!project || !autosaveSettings.enabled) {
      clearAutosaveTimer();
      return;
    }

    const hasDirtyFiles = openFiles.some(file => isEditableFile(file) && file.isDirty);

    if (!hasDirtyFiles) {
      clearAutosaveTimer();
      return;
    }

    scheduleAutosaveAfterIdle();
  }, [
    autosaveSettings,
    clearAutosaveTimer,
    openFiles,
    project,
    scheduleAutosaveAfterIdle,
  ]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const state = dragState.current;
      if (!state) return;

      if (state.target === 'sidebar') {
        const nextWidth = Math.max(
          MIN_TREE_PANEL_SIZE,
          state.initialSidebarWidth + (event.clientX - state.startX),
        );
        setSidebarWidth(nextWidth);
      }

      if (state.target === 'preview') {
        const nextWidth = Math.max(
          MIN_PREVIEW_PANEL_SIZE,
          state.initialPreviewWidth - (event.clientX - state.startX),
        );
        setPreviewWidth(nextWidth);
      }

      if (state.target === 'logs') {
        const nextHeight = Math.max(
          MIN_LOG_PANEL_SIZE,
          state.initialLogsHeight - (event.clientY - state.startY),
        );
        setLogsHeight(nextHeight);
      }
    }

    function handlePointerUp() {
      dragState.current = null;
    }

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  useEffect(() => {
    if (!isProjectTreeCollapsed) {
      setPreviousSidebarWidth(sidebarWidth);
    }
  }, [isProjectTreeCollapsed, sidebarWidth]);

  useEffect(() => {
    if (!isPreviewCollapsed) {
      setPreviousPreviewWidth(previewWidth);
    }
  }, [isPreviewCollapsed, previewWidth]);

  useEffect(() => {
    if (!isLogsCollapsed) {
      setPreviousLogsHeight(logsHeight);
    }
  }, [isLogsCollapsed, logsHeight]);

  /**
   * Adjusts resizable panel widths when the viewport becomes smaller than the
   * combined panel widths to prevent the layout from overflowing the window.
   */
  useEffect(() => {
    function clampPanelsToViewport() {
      const viewportWidth = window.innerWidth;
      const reservedWidth =
        SIDE_TOOLBAR_WIDTH * 2 + RESIZE_HANDLE_THICKNESS * 2 + MIN_EDITOR_WIDTH;
      const availableWidth = viewportWidth - reservedWidth;

      if (availableWidth <= 0) {
        return;
      }

      const minSidebarSpace = isProjectTreeCollapsed ? COLLAPSED_THICKNESS : MIN_TREE_PANEL_SIZE;
      const minPreviewSpace = isPreviewCollapsed ? COLLAPSED_THICKNESS : MIN_PREVIEW_PANEL_SIZE;
      const minimumRequiredWidth = minSidebarSpace + minPreviewSpace;

      if (availableWidth < minimumRequiredWidth) {
        if (!isProjectTreeCollapsed) {
          setSidebarWidth(minSidebarSpace);
        }

        if (!isPreviewCollapsed) {
          setPreviewWidth(minPreviewSpace);
        }
        return;
      }

      const sidebarSpace = isProjectTreeCollapsed ? COLLAPSED_THICKNESS : sidebarWidth;
      const previewSpace = isPreviewCollapsed ? COLLAPSED_THICKNESS : previewWidth;
      const combinedResizableWidth = sidebarSpace + previewSpace;

      if (combinedResizableWidth <= availableWidth) {
        return;
      }

      const overflow = combinedResizableWidth - availableWidth;
      const sidebarFlex = Math.max(sidebarSpace - minSidebarSpace, 0);
      const previewFlex = Math.max(previewSpace - minPreviewSpace, 0);
      const totalFlex = sidebarFlex + previewFlex;

      if (totalFlex <= 0) {
        return;
      }

      const sidebarReduction = (sidebarFlex / totalFlex) * overflow;
      const previewReduction = (previewFlex / totalFlex) * overflow;

      if (!isProjectTreeCollapsed) {
        setSidebarWidth(Math.max(minSidebarSpace, sidebarSpace - sidebarReduction));
      }

      if (!isPreviewCollapsed) {
        setPreviewWidth(Math.max(minPreviewSpace, previewSpace - previewReduction));
      }
    }

    clampPanelsToViewport();
    window.addEventListener('resize', clampPanelsToViewport);

    return () => {
      window.removeEventListener('resize', clampPanelsToViewport);
    };
  }, [
    isPreviewCollapsed,
    isProjectTreeCollapsed,
    previewWidth,
    sidebarWidth,
  ]);

  useEffect(() => {
    if (!layoutHydrated.current) {
      return;
    }

    layoutService
      .savePanels({
        sidebarWidth,
        previewWidth,
        logsHeight,
        isProjectTreeCollapsed,
        isPreviewCollapsed,
        isLogsCollapsed,
      })
      .catch(error => {
        console.error('Failed to persist layout state', error);
        logService.error('Unable to save layout preferences.');
      });
  }, [
    sidebarWidth,
    previewWidth,
    logsHeight,
    isProjectTreeCollapsed,
    isPreviewCollapsed,
    isLogsCollapsed,
  ]);

  function beginDrag(target: DragTarget, event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const isSidebarTarget = target === 'sidebar';
    const isPreviewTarget = target === 'preview';
    const isLogsTarget = target === 'logs';

    if ((isSidebarTarget && isProjectTreeCollapsed) || (isPreviewTarget && isPreviewCollapsed) || (isLogsTarget && isLogsCollapsed)) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    dragState.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      initialSidebarWidth: sidebarWidth,
      initialPreviewWidth: previewWidth,
      initialLogsHeight: logsHeight,
    };
  }

  function toggleProjectTree() {
    if (isProjectTreeCollapsed) {
      setSidebarWidth(Math.max(MIN_TREE_PANEL_SIZE, previousSidebarWidth));
      setIsProjectTreeCollapsed(false);
      return;
    }
    setIsProjectTreeCollapsed(true);
  }

  function togglePreview() {
    if (isPreviewCollapsed) {
      setPreviewWidth(Math.max(MIN_PREVIEW_PANEL_SIZE, previousPreviewWidth));
      setIsPreviewCollapsed(false);
      return;
    }
    setIsPreviewCollapsed(true);
  }

  function toggleLogs() {
    if (isLogsCollapsed) {
      setLogsHeight(Math.max(MIN_LOG_PANEL_SIZE, previousLogsHeight));
      setIsLogsCollapsed(false);
      return;
    }
    setIsLogsCollapsed(true);
  }

  /**
   * Opens an existing project folder and hydrates the editor state with its tree.
   */
  async function handleOpenProject() {
    const nextProject = await projectService.selectProject();
    if (!nextProject) {
      logService.warning('Project selection cancelled.');
      return;
    }

    setProject(nextProject);
    setOpenFiles([]);
    setActiveFilePath(null);
    logService.info(`Loaded project at ${nextProject.rootPath}`);

    if (nextProject.config) {
      logService.info(
        `Parsed ${nextProject.configPath}: ${JSON.stringify(nextProject.config, null, 2)}`,
      );
    } else {
      logService.warning('No card-deck-project.yml found in the selected project.');
    }

    if (nextProject.cards) {
      logService.info(`Loaded ${nextProject.cards.length} cards from cards.csv.`);
    } else {
      logService.warning('No cards.csv found in the selected project.');
    }
  }

  /**
   * Closes the current project and clears editor state.
   */
  function handleCloseProject() {
    if (!project) {
      return;
    }

    clearAutosaveTimer();
    setProject(null);
    setOpenFiles([]);
    setActiveFilePath(null);
    logService.info(`Closed project at ${project.rootPath}`);
  }

  /**
   * Updates the current project to use a different localization bundle and re-render cards.
   *
   * @param locale - Locale code selected from the preview toolbar.
   */
  async function handleChangeLocale(locale: string) {
    if (!project) {
      return;
    }

    try {
      const updatedProject = await projectService.changeLocale(project, locale);
      setProject(updatedProject);
      logService.info(`Switched localization to ${updatedProject.localization?.locale ?? locale}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Failed to change localization: ${reason}`);
    }
  }

  /**
   * Handles creating a new project.
   * It asks the user to select a folder for a new project.
   * If there is no such folder, it should be created.
   * When the folder for the new project exists, the application should copy
   * the content of the `new_project` folder to it and then open the project.
   */
  async function handleCreateProject() {
    logService.info('Attempting to create a new project...');
    try {
      // 1. Ask user to select a folder for a new project.
      const selectedDirectoryPath = await window.api.showDirectoryPicker();

      if (!selectedDirectoryPath) {
        logService.warning('Project creation cancelled: No directory selected.');
        return;
      }

      logService.info(`Selected directory for new project: ${selectedDirectoryPath}`);

      // 2. If there is no such folder - folder should be created.
      // We assume window.api.copyTemplateProject will handle directory creation if needed.

      // 3. Copy content of `new_project` folder to it.
      await window.api.copyTemplateProject(selectedDirectoryPath);
      logService.info(`Copied new project template to ${selectedDirectoryPath}`);

      // 4. Open the project.
      // Using projectService.reloadProject to load the project from the selected path.
      // For a new project, there's no existing locale, so we pass undefined.
      const nextProject = await projectService.reloadProject(selectedDirectoryPath, undefined);

      if (!nextProject) {
        logService.error(`Failed to load the newly created project at ${selectedDirectoryPath}.`);
        return;
      }

      setProject(nextProject);
      setOpenFiles([]);
      setActiveFilePath(null);
      logService.info(`Successfully created and loaded new project at ${nextProject.rootPath}`);

      if (nextProject.config) {
        logService.info(
          `Parsed ${nextProject.configPath}: ${JSON.stringify(nextProject.config, null, 2)}`,
        );
      } else {
        logService.warning('No card-deck-project.yml found in the new project.');
      }

      if (nextProject.cards) {
        logService.info(`Loaded ${nextProject.cards.length} cards from cards.csv.`);
      } else {
        logService.warning('No cards.csv found in the new project.');
      }

    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Error creating new project: ${reason}`);
    }
  }

  async function handleExport() {
    if (project) {
      setExportProgress(0);
      await pdfExportService.exportToPdf(project, (progress) => {
        setExportProgress(progress);
      });
      setExportProgress(null);
    }
  }

  /**
   * Opens a file in a new tab or focuses it when already open.
   *
   * @param node - File node selected from the project tree.
   */
  async function handleSelectFile(node: FileNode) {
    if (node.type !== 'file') return;

    const existing = openFiles.find(file => file.path === node.path);
    if (existing) {
      setActiveFilePath(node.path);
      return;
    }

    try {
      const isImage = isImageFile(node.path);
      const isCsv = isCsvFile(node.path);
      if (isImage) {
        const base64Content = await fileService.readBinaryFile(node.path);
        const mimeType = getImageMimeType(node.path);
        const dataUrl = `data:${mimeType};base64,${base64Content}`;
        setOpenFiles(prev => [
          ...prev,
          { path: node.path, name: node.name, content: dataUrl, isDirty: false, fileType: 'image' },
        ]);
        setActiveFilePath(node.path);
        logService.info(`Opened image file ${node.name}`);
        return;
      }

      const text = await fileService.readTextFile(node.path);

      if (isCsv) {
        setOpenFiles(prev => [
          ...prev,
          {
            path: node.path,
            name: node.name,
            content: text,
            isDirty: false,
            fileType: 'csv',
          },
        ]);
        setActiveFilePath(node.path);
        logService.info(`Opened CSV file ${node.name}`);
        return;
      }

      setOpenFiles(prev => [
        ...prev,
        { path: node.path, name: node.name, content: text, isDirty: false, fileType: 'text' },
      ]);
      setActiveFilePath(node.path);
      logService.info(`Opened text file ${node.name}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Failed to open ${node.name}: ${reason}`);
    }
  }

  /**
   * Creates a new file or folder within the selected directory and reloads the project tree.
   *
   * @param directoryPath - Absolute path to the target directory.
   * @param name - Name of the entry to create.
   * @param entryType - Type of entry to create.
   */
  async function handleCreateTreeEntry(
    directoryPath: string,
    name: string,
    entryType: 'file' | 'folder',
  ): Promise<void> {
    const trimmedName = name.trim();
    if (!project) {
      logService.warning('Open a project before creating files or folders.');
      return;
    }

    if (!trimmedName) {
      logService.warning('Name cannot be empty.');
      return;
    }

    if (containsPathSeparator(trimmedName)) {
      logService.warning('Names cannot contain path separators.');
      return;
    }

    const targetPath = joinPathSegments(directoryPath, trimmedName);

    try {
      if (entryType === 'file') {
        await fileService.createFile(targetPath);
        logService.info(`Created file ${trimmedName}.`);
      } else {
        await fileService.createDirectory(targetPath);
        logService.info(`Created folder ${trimmedName}.`);
      }

      const refreshed = await projectService.reloadProject(project.rootPath, project.localization?.locale);
      if (refreshed) {
        setProject(refreshed);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const entryLabel = entryType === 'file' ? 'file' : 'folder';
      logService.error(`Failed to create ${entryLabel} ${trimmedName}: ${reason}`);
    }
  }

  /**
   * Renames a file or folder and synchronizes open tabs and project tree state.
   *
   * @param currentPath - Existing absolute path of the entry to rename.
   * @param nextName - New name to apply within the same parent directory.
   */
  async function handleRenameEntry(currentPath: string, nextName: string): Promise<void> {
    const trimmedName = nextName.trim();
    if (!project) {
      logService.warning('Open a project before renaming files or folders.');
      return;
    }

    if (!trimmedName) {
      logService.warning('Name cannot be empty.');
      return;
    }

    if (containsPathSeparator(trimmedName)) {
      logService.warning('Names cannot contain path separators.');
      return;
    }

    const parentPath = getParentPath(currentPath);
    if (!parentPath) {
      logService.error('Unable to determine the parent directory for this entry.');
      return;
    }

    const currentName = currentPath.split(getPathSeparator(currentPath)).pop() ?? 'entry';
    const nextPath = joinPathSegments(parentPath, trimmedName);

    if (nextPath === currentPath) {
      logService.warning('The new name matches the current name.');
      return;
    }

    try {
      await fileService.renamePath(currentPath, nextPath);
      setOpenFiles(prev =>
        prev.map(file =>
          file.path === currentPath
            ? { ...file, path: nextPath, name: trimmedName }
            : file,
        ),
      );
      setActiveFilePath(prev => (prev === currentPath ? nextPath : prev));

      const refreshed = await projectService.reloadProject(project.rootPath, project.localization?.locale);
      if (refreshed) {
        setProject(refreshed);
      }

      logService.info(`Renamed ${currentName} to ${trimmedName}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Failed to rename ${currentName}: ${reason}`);
    }
  }

  /**
   * Moves a file or folder into a different directory.
   *
   * @param sourcePath - Absolute path of the entry to move.
   * @param targetDirectory - Destination directory where the entry will be placed.
   */
  async function handleMoveEntry(sourcePath: string, targetDirectory: string): Promise<void> {
    if (!project) {
      logService.warning('Open a project before moving files or folders.');
      return;
    }

    if (!targetDirectory.trim()) {
      logService.warning('Select a valid destination directory.');
      return;
    }

    if (isDescendantPath(targetDirectory, sourcePath)) {
      logService.warning('Cannot move a folder into one of its own subfolders.');
      return;
    }

    const entrySeparator = getPathSeparator(sourcePath);
    const entryName = sourcePath.split(entrySeparator).pop() ?? 'entry';

    if (entryName === PROJECT_CONFIG_FILENAME) {
      logService.warning(`${PROJECT_CONFIG_FILENAME} must stay in the project root.`);
      return;
    }

    const destinationPath = joinPathSegments(targetDirectory, entryName);

    if (destinationPath === sourcePath) {
      logService.warning('Select a different destination to move this entry.');
      return;
    }

    try {
      await fileService.renamePath(sourcePath, destinationPath);

      setOpenFiles(prev =>
        prev.map(file =>
          file.path === sourcePath
            ? { ...file, path: destinationPath, name: entryName }
            : file,
        ),
      );
      setActiveFilePath(prev => (prev === sourcePath ? destinationPath : prev));

      const refreshed = await projectService.reloadProject(project.rootPath, project.localization?.locale);
      if (refreshed) {
        setProject(refreshed);
      }

      logService.info(`Moved ${entryName} to ${targetDirectory}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Failed to move ${entryName}: ${reason}`);
    }
  }

  /**
   * Persists the active file to disk and clears its dirty state.
   */
  async function handleSave() {
    if (!activeFilePath) return;
    const targetFile = openFiles.find(file => file.path === activeFilePath);
    if (!targetFile || !isEditableFile(targetFile)) return;

    try {
      const content = serializeOpenFile(targetFile);
      await fileService.saveTextFile(targetFile.path, content);
      setOpenFiles(prev =>
        prev.map(file =>
          file.path === activeFilePath && isEditableFile(file)
            ? { ...file, isDirty: false, content }
            : file,
        ),
      );
      logService.info(`Saved ${targetFile.name}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Failed to save ${targetFile.name}: ${reason}`);
    }
  }

  /**
   * Saves all dirty text files using the configured autosave interval.
   */
  const performAutosave = useCallback(async () => {
    if (autosaveInProgress.current) {
      return;
    }

    const dirtyFiles = openFilesRef.current.filter(
      file => isEditableFile(file) && file.isDirty,
    );

    if (dirtyFiles.length === 0) {
      return;
    }

    autosaveInProgress.current = true;

    try {
      for (const file of dirtyFiles) {
        await fileService.saveTextFile(file.path, serializeOpenFile(file));
      }

      const savedPaths = new Set(dirtyFiles.map(file => file.path));
      const savedNames = dirtyFiles.map(file => file.name).join(', ');

      setOpenFiles(prev => {
        const nextFiles = prev.map(file => {
          if (!savedPaths.has(file.path) || !isEditableFile(file)) {
            return file;
          }

          const content = serializeOpenFile(file);

          return { ...file, isDirty: false, content };
        });

        openFilesRef.current = nextFiles;

        return nextFiles;
      });

      const countLabel = dirtyFiles.length === 1 ? 'file' : 'files';
      logService.info(`Autosaved ${dirtyFiles.length} ${countLabel}: ${savedNames}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logService.error(`Autosave failed: ${reason}`);
    } finally {
      autosaveInProgress.current = false;
      if (openFilesRef.current.some(file => isEditableFile(file) && file.isDirty)) {
        scheduleAutosaveAfterIdle();
      }
    }
  }, [scheduleAutosaveAfterIdle]);

  useEffect(() => {
    performAutosaveRef.current = performAutosave;
  }, [performAutosave]);

  /**
   * Opens the settings modal by hydrating it with the persisted YAML.
   */
  async function handleOpenSettings() {
    setSettingsError(null);
    try {
      const settings = await window.api.loadSettings();
      setSettingsContent(settings.content);
      setSettingsPath(settings.path);
      setAutosaveSettings(parseAutosaveSettings(settings.content));
      setIsSettingsOpen(true);
      logService.info(`Loaded settings from ${settings.path}`);
    } catch (error) {
      console.error('Failed to load settings', error);
      setSettingsError('Unable to load settings file.');
      logService.error('Unable to load settings file.');
    }
  }

  /**
   * Tracks edits to the YAML content inside the settings modal.
   * @param val Updated YAML content.
   */
  function handleSettingsChange(val: string) {
    setSettingsContent(val);
  }

  /**
   * Saves the YAML configuration back to disk using the main process.
   */
  async function handleSaveSettings() {
    setSettingsError(null);
    setIsSavingSettings(true);
    try {
      const result = await window.api.saveSettings(settingsContent);
      setSettingsPath(result.path);
      logService.info(`Settings saved to ${result.path}`);
      setAutosaveSettings(parseAutosaveSettings(settingsContent));
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save settings', error);
      setSettingsError('Unable to save settings. Please check your YAML syntax.');
      logService.error('Unable to save settings. Please check your YAML syntax.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  /**
   * Closes the settings modal without persisting changes.
   */
  function handleCloseSettings() {
    setIsSettingsOpen(false);
  }

  /**
   * Updates the active file content and marks it as dirty.
   *
   * @param val - New editor content value.
   */
  function handleTextEditorChange(val: string) {
    if (!activeFilePath) return;

    const currentFile = openFiles.find(
      file => file.path === activeFilePath && file.fileType === 'text',
    );

    if (!currentFile || currentFile.content === val) return;

    if (textChangeTimeoutId.current) {
      window.clearTimeout(textChangeTimeoutId.current);
    }

    const targetPath = activeFilePath;

    setOpenFiles(prev =>
      prev.map(file =>
        file.path === targetPath && file.fileType === 'text'
          ? {...file, isDirty: true}
          : file,
      ),
    )

    textChangeTimeoutId.current = setTimeout(() => {
      setOpenFiles(prev =>
        prev.map(file =>
          file.path === targetPath && file.fileType === 'text'
            ? {...file, content: val, isDirty: true}
            : file,
        ),
      );
    }, 300);
  }

  useEffect(
    () => () => {
      if (textChangeTimeoutId.current) {
        window.clearTimeout(textChangeTimeoutId.current);
      }
    },
    [],
  );

  /**
   * Normalizes and tracks edits from the CSV grid editor.
   *
   * @param nextData - Updated CSV matrix from the grid component.
   */
  function handleCsvEditorChange(nextContent: string) {
    if (!activeFilePath) return;

    setOpenFiles(prev =>
      prev.map(file =>
        file.path === activeFilePath && file.fileType === 'csv'
          ? { ...file, content: nextContent, isDirty: true }
          : file,
      ),
    );
  }

  /**
   * Closes an open file tab and updates the active file accordingly.
   */
  function handleCloseFile(path: string) {
    setOpenFiles(prev => {
      const closedIndex = prev.findIndex(file => file.path === path);
      const nextFiles = prev.filter(file => file.path !== path);

      if (path === activeFilePath) {
        const fallback = prev[closedIndex + 1] ?? prev[closedIndex - 1];
        setActiveFilePath(fallback?.path ?? null);
      }

      return nextFiles;
    });
  }

  const activeFile = openFiles.find(file => file.path === activeFilePath) ?? null;
  const projectPath = project?.rootPath ?? null;
  const projectTree = project?.tree ?? [];
  const createFileAt = (directoryPath: string, fileName: string) =>
    handleCreateTreeEntry(directoryPath, fileName, 'file');
  const createFolderAt = (directoryPath: string, folderName: string) =>
    handleCreateTreeEntry(directoryPath, folderName, 'folder');
  const renameEntry = (currentPath: string, nextName: string) =>
    handleRenameEntry(currentPath, nextName);
  const moveEntry = (sourcePath: string, targetDirectory: string) =>
    handleMoveEntry(sourcePath, targetDirectory);

  return (
    <div
      className="app-grid"
      style={{
        '--sidebar-width': `${isProjectTreeCollapsed ? COLLAPSED_THICKNESS : sidebarWidth}px`,
        '--preview-width': `${isPreviewCollapsed ? COLLAPSED_THICKNESS : previewWidth}px`,
        '--logs-height': `${isLogsCollapsed ? COLLAPSED_THICKNESS : logsHeight}px`,
      } as CSSProperties}
    >
      <header className="toolbar">
        <div className="toolbar__title">
          <span className="toolbar__app-name">Deck Studio</span>
          {projectPath ? (
            <div className="toolbar__project">
              <span aria-hidden="true" className="material-symbols-outlined toolbar__chevron">
                chevron_right
              </span>
              <span aria-hidden="true" className="material-symbols-outlined toolbar__project-icon">
                folder_open
              </span>
              <span className="toolbar__project-path">{projectPath}</span>
            </div>
          ) : null}
        </div>

        <div className="toolbar__actions">
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label="Create new project"
            onClick={handleCreateProject}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              create_new_folder
            </span>
          </button>
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label="Open existing project"
            onClick={handleOpenProject}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              folder_open
            </span>
          </button>
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label="Export to PDF"
            disabled={!project?.resolvedCards.length}
            onClick={handleExport}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              picture_as_pdf
            </span>
          </button>
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label="Open settings"
            onClick={handleOpenSettings}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              settings
            </span>
          </button>
          <div className="toolbar__separator" />
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label="Close project"
            disabled={!project}
            onClick={handleCloseProject}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              close
            </span>
          </button>
        </div>
      </header>

      <aside className="side-toolbar side-toolbar--left">
        <div className="side-toolbar__section side-toolbar__section--top">
          <button
            type="button"
            className="side-toolbar__button"
            aria-label={isProjectTreeCollapsed ? 'Expand project tree' : 'Collapse project tree'}
            data-state={isProjectTreeCollapsed ? 'collapsed' : 'expanded'}
            onClick={toggleProjectTree}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              folder
            </span>
          </button>
        </div>
        <div className="side-toolbar__section side-toolbar__section--bottom">
          <button
            type="button"
            className="side-toolbar__button"
            aria-label={isLogsCollapsed ? 'Expand logs' : 'Collapse logs'}
            data-state={isLogsCollapsed ? 'collapsed' : 'expanded'}
            onClick={toggleLogs}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              terminal
            </span>
          </button>
        </div>
      </aside>

      <ProjectTreePanel
        tree={projectTree}
        selectedPath={activeFile?.path}
        onSelectFile={handleSelectFile}
        collapsed={isProjectTreeCollapsed}
        projectRoot={projectPath ?? undefined}
        onCreateFile={createFileAt}
        onCreateFolder={createFolderAt}
        onRenameEntry={renameEntry}
        onMoveEntry={moveEntry}
      />

      <div
        className="resize-handle resize-handle--vertical resize-handle--sidebar"
        data-state={isProjectTreeCollapsed ? 'disabled' : 'active'}
        aria-label="Resize project tree"
        aria-orientation="vertical"
        aria-disabled={isProjectTreeCollapsed}
        onPointerDown={(event) => beginDrag('sidebar', event)}
      />

      <EditorPanel
        openFiles={openFiles}
        activePath={activeFile?.path ?? null}
        onChange={handleTextEditorChange}
        onCsvChange={handleCsvEditorChange}
        onSave={handleSave}
        onSelectFile={setActiveFilePath}
        onCloseFile={handleCloseFile}
        isVisible={Boolean(project)}
      />

      <CardPreviewPanel
        collapsed={isPreviewCollapsed}
        project={project}
        onChangeLocale={handleChangeLocale}
        exportProgress={exportProgress}
      />

      <div
        className="resize-handle resize-handle--vertical resize-handle--preview"
        data-state={isPreviewCollapsed ? 'disabled' : 'active'}
        aria-label="Resize card preview"
        aria-orientation="vertical"
        aria-disabled={isPreviewCollapsed}
        onPointerDown={(event) => beginDrag('preview', event)}
      />

      <div
        className="resize-handle resize-handle--horizontal resize-handle--logs"
        data-state={isLogsCollapsed ? 'disabled' : 'active'}
        aria-label="Resize logs panel"
        aria-orientation="horizontal"
        aria-disabled={isLogsCollapsed}
        onPointerDown={(event) => beginDrag('logs', event)}
      />

      <LogsPanel collapsed={isLogsCollapsed} />

      <aside className="side-toolbar side-toolbar--right">
        <div className="side-toolbar__section side-toolbar__section--top">
          <button
            type="button"
            className="side-toolbar__button"
            aria-label={isPreviewCollapsed ? 'Expand card preview' : 'Collapse card preview'}
            data-state={isPreviewCollapsed ? 'collapsed' : 'expanded'}
            onClick={togglePreview}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              visibility
            </span>
          </button>
        </div>
      </aside>

      <SettingsModal
        isOpen={isSettingsOpen}
        content={settingsContent}
        path={settingsPath}
        error={settingsError}
        isSaving={isSavingSettings}
        onChange={handleSettingsChange}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
      />
      <NotificationPopup />
    </div>
  );
}

export default App;
