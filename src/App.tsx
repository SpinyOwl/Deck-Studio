// src/App.tsx
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {type FileNode, FileTree} from './components/FileTree';
import {MonacoEditorPane} from './components/MonacoEditorPane';
import './App.css';

const MIN_PANEL_SIZE = 50;

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

      <aside className="project-tree">
        <div className="panel-title">Files</div>
        {tree.length === 0 ? (
          <div className="placeholder-text">Open a project folder to see files here.</div>
        ) : (
          <FileTree nodes={tree} selectedPath={selectedFile?.path} onSelectFile={handleSelectFile} />
        )}
      </aside>

      <div
        className="resize-handle resize-handle--vertical resize-handle--sidebar"
        role="separator"
        aria-label="Resize project tree"
        aria-orientation="vertical"
        onPointerDown={(event) => beginDrag('sidebar', event)}
      />

      <section className={`editor ${rootPath ? '' : 'editor--hidden'}`}>
        <MonacoEditorPane
          path={selectedFile?.path}
          value={content}
          onChange={(val) => {
            setContent(val);
            setDirty(true);
          }}
        />
      </section>

      <section className="card-preview">
        <div className="panel-title">Card preview</div>
        <div className="placeholder-text">Select a card file to see a preview.</div>
      </section>

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

      <section className="logs">
        <div className="panel-title">Logs</div>
        <div className="placeholder-text">Build, lint, and runtime logs will appear here.</div>
      </section>
    </div>
  );
}

export default App;
