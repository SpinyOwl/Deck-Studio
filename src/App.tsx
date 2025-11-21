// src/App.tsx
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {CardPreviewPanel} from './components/CardPreviewPanel';
import {EditorPanel} from './components/EditorPanel';
import {type FileNode} from './components/FileTree';
import {LogsPanel} from './components/LogsPanel';
import {ProjectTreePanel} from './components/ProjectTreePanel';
import {SettingsModal} from './components/SettingsModal';
import './styles/AppLayout.css';
import './styles/Panel.css';

const MIN_PANEL_SIZE = 150;
const COLLAPSED_THICKNESS = 0;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];

type FileType = 'text' | 'image';

type OpenFile = {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  fileType: FileType;
};

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
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerPath.endsWith('.gif')) return 'image/gif';
  if (lowerPath.endsWith('.bmp')) return 'image/bmp';
  if (lowerPath.endsWith('.webp')) return 'image/webp';
  if (lowerPath.endsWith('.svg')) return 'image/svg+xml';

  return 'application/octet-stream';
}

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);

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

  type DragTarget = 'sidebar' | 'preview' | 'logs';
  const dragState = useRef<{
    target: DragTarget;
    startX: number;
    startY: number;
    initialSidebarWidth: number;
    initialPreviewWidth: number;
    initialLogsHeight: number;
  } | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const state = dragState.current;
      if (!state) return;

      if (state.target === 'sidebar') {
        const nextWidth = Math.max(
          MIN_PANEL_SIZE,
          state.initialSidebarWidth + (event.clientX - state.startX),
        );
        setSidebarWidth(nextWidth);
      }

      if (state.target === 'preview') {
        const nextWidth = Math.max(
          MIN_PANEL_SIZE,
          state.initialPreviewWidth - (event.clientX - state.startX),
        );
        setPreviewWidth(nextWidth);
      }

      if (state.target === 'logs') {
        const nextHeight = Math.max(
          MIN_PANEL_SIZE,
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
      setSidebarWidth(Math.max(MIN_PANEL_SIZE, previousSidebarWidth));
      setIsProjectTreeCollapsed(false);
      return;
    }
    setIsProjectTreeCollapsed(true);
  }

  function togglePreview() {
    if (isPreviewCollapsed) {
      setPreviewWidth(Math.max(MIN_PANEL_SIZE, previousPreviewWidth));
      setIsPreviewCollapsed(false);
      return;
    }
    setIsPreviewCollapsed(true);
  }

  function toggleLogs() {
    if (isLogsCollapsed) {
      setLogsHeight(Math.max(MIN_PANEL_SIZE, previousLogsHeight));
      setIsLogsCollapsed(false);
      return;
    }
    setIsLogsCollapsed(true);
  }

  /**
   * Opens an existing project folder and hydrates the editor state with its tree.
   */
  async function handleOpenProject() {
    const res = await window.api.selectProjectFolder();
    if (!res) return;
    setRootPath(res.rootPath);
    setTree(res.tree);
    setOpenFiles([]);
    setActiveFilePath(null);
  }

  /**
   * Placeholder for creating a new project.
   */
  function handleCreateProject() {
    // No-op for now. Implementation will be added later.
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

    const isImage = isImageFile(node.path);
    if (isImage) {
      const base64Content = await window.api.readBinaryFile(node.path);
      const mimeType = getImageMimeType(node.path);
      const dataUrl = `data:${mimeType};base64,${base64Content}`;
      setOpenFiles(prev => [
        ...prev,
        { path: node.path, name: node.name, content: dataUrl, isDirty: false, fileType: 'image' },
      ]);
      setActiveFilePath(node.path);
      return;
    }

    const text = await window.api.readFile(node.path);
    setOpenFiles(prev => [
      ...prev,
      { path: node.path, name: node.name, content: text, isDirty: false, fileType: 'text' },
    ]);
    setActiveFilePath(node.path);
  }

  /**
   * Persists the active file to disk and clears its dirty state.
   */
  async function handleSave() {
    if (!activeFilePath) return;
    const targetFile = openFiles.find(file => file.path === activeFilePath);
    if (!targetFile || targetFile.fileType !== 'text') return;

    await window.api.writeFile(targetFile.path, targetFile.content);
    setOpenFiles(prev =>
      prev.map(file =>
        file.path === activeFilePath ? { ...file, isDirty: false } : file,
      ),
    );
  }

  /**
   * Opens the settings modal by hydrating it with the persisted YAML.
   */
  async function handleOpenSettings() {
    setSettingsError(null);
    try {
      const settings = await window.api.loadSettings();
      setSettingsContent(settings.content);
      setSettingsPath(settings.path);
      setIsSettingsOpen(true);
    } catch (error) {
      console.error('Failed to load settings', error);
      setSettingsError('Unable to load settings file.');
      setIsSettingsOpen(true);
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
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save settings', error);
      setSettingsError('Unable to save settings.');
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
  function handleEditorChange(val: string) {
    if (!activeFilePath) return;

    setOpenFiles(prev =>
      prev.map(file =>
        file.path === activeFilePath && file.fileType === 'text'
          ? { ...file, content: val, isDirty: true }
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
          {rootPath ? (
            <div className="toolbar__project">
              <span aria-hidden="true" className="material-symbols-outlined toolbar__chevron">
                chevron_right
              </span>
              <span aria-hidden="true" className="material-symbols-outlined toolbar__project-icon">
                folder_open
              </span>
              <span className="toolbar__project-path">{rootPath}</span>
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
            aria-label="Save file"
            disabled={!activeFile || !activeFile.isDirty}
            onClick={handleSave}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              save
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
        tree={tree}
        selectedPath={activeFile?.path}
        onSelectFile={handleSelectFile}
        collapsed={isProjectTreeCollapsed}
      />

      <div
        className="resize-handle resize-handle--vertical resize-handle--sidebar"
        data-state={isProjectTreeCollapsed ? 'disabled' : 'active'}
        role="separator"
        aria-label="Resize project tree"
        aria-orientation="vertical"
        aria-disabled={isProjectTreeCollapsed}
        onPointerDown={(event) => beginDrag('sidebar', event)}
      />

      <EditorPanel
        openFiles={openFiles}
        activePath={activeFile?.path ?? null}
        onChange={handleEditorChange}
        onSelectFile={setActiveFilePath}
        onCloseFile={handleCloseFile}
        isVisible={Boolean(rootPath)}
      />

      <CardPreviewPanel collapsed={isPreviewCollapsed} />

      <div
        className="resize-handle resize-handle--vertical resize-handle--preview"
        data-state={isPreviewCollapsed ? 'disabled' : 'active'}
        role="separator"
        aria-label="Resize card preview"
        aria-orientation="vertical"
        aria-disabled={isPreviewCollapsed}
        onPointerDown={(event) => beginDrag('preview', event)}
      />

      <div
        className="resize-handle resize-handle--horizontal resize-handle--logs"
        data-state={isLogsCollapsed ? 'disabled' : 'active'}
        role="separator"
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
    </div>
  );
}

export default App;
