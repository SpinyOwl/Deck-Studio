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
import './App.css';

const MIN_PANEL_SIZE = 150;
const COLLAPSED_THICKNESS = 0;

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [previewWidth, setPreviewWidth] = useState(360);
  const [logsHeight, setLogsHeight] = useState(200);
  const [previousSidebarWidth, setPreviousSidebarWidth] = useState(sidebarWidth);
  const [previousPreviewWidth, setPreviousPreviewWidth] = useState(previewWidth);
  const [previousLogsHeight, setPreviousLogsHeight] = useState(logsHeight);
  const [isProjectTreeCollapsed, setIsProjectTreeCollapsed] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [isLogsCollapsed, setIsLogsCollapsed] = useState(false);

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

  async function handleOpenProject() {
    const res = await window.api.selectProjectFolder();
    if (!res) return;
    setRootPath(res.rootPath);
    setTree(res.tree);
    setSelectedFile(null);
    setContent('');
    setDirty(false);
  }

  async function handleSelectFile(node: FileNode) {
    if (node.type !== 'file') return;
    const text = await window.api.readFile(node.path);
    setSelectedFile(node);
    setContent(text);
    setDirty(false);
  }

  async function handleSave() {
    if (!selectedFile) return;
    await window.api.writeFile(selectedFile.path, content);
    setDirty(false);
  }

  function handleEditorChange(val: string) {
    setContent(val);
    setDirty(true);
  }

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
        <button onClick={handleOpenProject}>Open Project Folder…</button>
        <button onClick={handleSave} disabled={!selectedFile || !dirty}>
          Save
        </button>
        <div className="toolbar__status">
          {rootPath ? `Project: ${rootPath}` : 'No project open'}
          {selectedFile && ` | File: ${selectedFile.path}${dirty ? ' *' : ''}`}
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
        selectedPath={selectedFile?.path}
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
        path={selectedFile?.path}
        value={content}
        onChange={handleEditorChange}
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
    </div>
  );
}

export default App;
