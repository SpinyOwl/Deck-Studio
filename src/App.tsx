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

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [previewWidth, setPreviewWidth] = useState(360);
  const [logsHeight, setLogsHeight] = useState(200);

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

  function beginDrag(target: DragTarget, event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
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
        '--sidebar-width': `${sidebarWidth}px`,
        '--preview-width': `${previewWidth}px`,
        '--logs-height': `${logsHeight}px`,
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

      <ProjectTreePanel
        tree={tree}
        selectedPath={selectedFile?.path}
        onSelectFile={handleSelectFile}
      />

      <div
        className="resize-handle resize-handle--vertical resize-handle--sidebar"
        role="separator"
        aria-label="Resize project tree"
        aria-orientation="vertical"
        onPointerDown={(event) => beginDrag('sidebar', event)}
      />

      <EditorPanel
        path={selectedFile?.path}
        value={content}
        onChange={handleEditorChange}
        isVisible={Boolean(rootPath)}
      />

      <CardPreviewPanel />

      <div
        className="resize-handle resize-handle--vertical resize-handle--preview"
        role="separator"
        aria-label="Resize card preview"
        aria-orientation="vertical"
        onPointerDown={(event) => beginDrag('preview', event)}
      />

      <div
        className="resize-handle resize-handle--horizontal resize-handle--logs"
        role="separator"
        aria-label="Resize logs panel"
        aria-orientation="horizontal"
        onPointerDown={(event) => beginDrag('logs', event)}
      />

      <LogsPanel />
    </div>
  );
}

export default App;
