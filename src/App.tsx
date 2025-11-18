// src/App.tsx
import {useState} from 'react';
import {type FileNode, FileTree} from './components/FileTree';
import {MonacoEditorPane} from './components/MonacoEditorPane';

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

  return (<div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Top bar */}
      <div
        style={{
          padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8, background: '#1e1e1e', color: '#fff'
        }}
      >
        <button onClick={handleOpenProject}>Open Project Folder…</button>
        <button onClick={handleSave} disabled={!selectedFile || !dirty}>
          Save
        </button>
        <div style={{marginLeft: 'auto', fontSize: 12, opacity: 0.8}}>
          {rootPath ? `Project: ${rootPath}` : 'No project open'}
          {selectedFile && ` | File: ${selectedFile.path}${dirty ? ' *' : ''}`}
        </div>
      </div>

      {/* Main area */}
      <div style={{flex: 1, display: 'flex', minHeight: 0}}>
        {/* Sidebar */}
        <div
          style={{
            width: 260, borderRight: '1px solid #333', padding: 8, overflow: 'auto', background: '#111', color: '#ddd'
          }}
        >
          <div style={{fontWeight: 'bold', marginBottom: 8}}>Files</div>
          {tree.length === 0 ? (<div style={{fontSize: 12, opacity: 0.7}}>
              Open a project folder to see files here.
            </div>) : (<FileTree
              nodes={tree}
              selectedPath={selectedFile?.path}
              onSelectFile={handleSelectFile}
            />)}
        </div>

        {/* Editor */}
        <MonacoEditorPane
          path={selectedFile?.path}
          value={content}
          onChange={(val) => {
            setContent(val);
            setDirty(true);
          }}
        />
      </div>
    </div>);
}

export default App;
