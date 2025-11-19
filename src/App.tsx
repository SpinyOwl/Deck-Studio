// src/App.tsx
import {useState} from 'react';
import {type FileNode, FileTree} from './components/FileTree';
import {MonacoEditorPane} from './components/MonacoEditorPane';
import './App.css';

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);

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
    <div className="app-grid">
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

      <section className="editor">
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

      <section className="logs">
        <div className="panel-title">Logs</div>
        <div className="placeholder-text">Build, lint, and runtime logs will appear here.</div>
      </section>
    </div>
  );
}

export default App;
