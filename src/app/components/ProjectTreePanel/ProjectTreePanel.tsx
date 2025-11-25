// src/components/ProjectTreePanel/ProjectTreePanel.tsx
import React, {useEffect, useRef, useState} from 'react';
import {type FileNode, FileTree} from '../FileTree';
import './ProjectTreePanel.css';

interface Props {
  readonly tree: FileNode[];
  readonly selectedPath?: string;
  readonly onSelectFile: (node: FileNode) => void;
  readonly collapsed: boolean;
  readonly projectRoot?: string;
  readonly onCreateFile: (directoryPath: string, fileName: string) => Promise<void>;
  readonly onCreateFolder: (directoryPath: string, folderName: string) => Promise<void>;
  readonly onRenameEntry: (currentPath: string, nextName: string) => Promise<void>;
}

type ContextMenuState = {
  readonly x: number;
  readonly y: number;
  readonly directoryPath: string;
  readonly targetLabel: string;
  readonly targetPath?: string;
  readonly targetType?: FileNode['type'];
  readonly targetName?: string;
};

type NamePromptState = {
  readonly directoryPath: string;
  readonly kind: 'file' | 'folder';
  readonly mode: 'create' | 'rename';
  readonly targetPath?: string;
};

/**
 * Renders the project tree panel with a header and scrollable body.
 */
export const ProjectTreePanel: React.FC<Props> = ({
  tree,
  selectedPath,
  onSelectFile,
  collapsed,
  projectRoot,
  onCreateFile,
  onCreateFolder,
  onRenameEntry,
}) => {
  const hasTree = tree.length > 0;
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  /**
   * Returns the appropriate path separator for a given path.
   */
  const getSeparator = (path: string): string => (path.includes('\\') ? '\\' : '/');

  /**
   * Resolves the parent directory of a given path string.
   */
  const getParentDirectory = (path: string): string | null => {
    const separator = getSeparator(path);
    const trimmedPath = path.endsWith(separator) ? path.slice(0, -1) : path;
    const segments = trimmedPath.split(separator);
    if (segments.length <= 1) {
      return null;
    }

    segments.pop();
    const parent = segments.join(separator);

    return parent || null;
  };

  /**
   * Determines which directory the context menu actions should target.
   */
  const resolveTargetDirectory = (node?: FileNode): string | null => {
    if (node?.type === 'dir') {
      return node.path;
    }

    if (node?.type === 'file') {
      return getParentDirectory(node.path) ?? projectRoot ?? null;
    }

    return projectRoot ?? null;
  };

  /**
   * Opens the context menu anchored to the mouse position.
   */
  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>, node?: FileNode): void => {
    event.preventDefault();
    const directoryPath = resolveTargetDirectory(node);
    if (!directoryPath) {
      return;
    }

    const directoryLabel = node?.type === 'dir'
      ? node.name
      : node?.type === 'file'
        ? getParentDirectory(node.path)?.split(getSeparator(directoryPath)).pop() ?? node.name
        : 'project root';

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      directoryPath,
      targetLabel: directoryLabel ?? 'project root',
      targetPath: node?.path,
      targetType: node?.type,
      targetName: node?.name,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  /**
   * Starts the name entry flow for creating a file or folder.
   */
  const showNamePrompt = (kind: NamePromptState['kind']) => {
    if (!contextMenu) return;

    setNameInput('');
    setNamePrompt({
      directoryPath: contextMenu.directoryPath,
      kind,
      mode: 'create',
    });
    setContextMenu(null);
  };

  const showRenamePrompt = () => {
    if (!contextMenu?.targetPath || !contextMenu.targetName || !contextMenu.targetType) return;

    const parentDirectory = getParentDirectory(contextMenu.targetPath);
    if (!parentDirectory) return;

    setNameInput(contextMenu.targetName);
    setNamePrompt({
      directoryPath: parentDirectory,
      kind: contextMenu.targetType === 'dir' ? 'folder' : 'file',
      mode: 'rename',
      targetPath: contextMenu.targetPath,
    });
    setContextMenu(null);
  };

  useEffect(() => {
    if (!namePrompt) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNamePrompt(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [namePrompt]);

  useEffect(() => {
    if (!namePrompt) return;
    nameInputRef.current?.focus();
  }, [namePrompt]);

  const closeNamePrompt = () => setNamePrompt(null);

  const handleNameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!namePrompt) return;

    const sanitized = nameInput.trim();
    if (!sanitized) {
      setNamePrompt(null);
      return;
    }

    try {
      if (namePrompt.mode === 'rename' && namePrompt.targetPath) {
        await onRenameEntry(namePrompt.targetPath, sanitized);
      } else if (namePrompt.kind === 'file') {
        await onCreateFile(namePrompt.directoryPath, sanitized);
      } else {
        await onCreateFolder(namePrompt.directoryPath, sanitized);
      }
    } finally {
      setNamePrompt(null);
    }
  };

  return (
    <aside className={`project-tree panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
      <div className="panel__header">Files</div>
      <div className="panel__body" onContextMenu={(event) => openContextMenu(event)}>
        {hasTree ? (
          <FileTree
            nodes={tree}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            onContextMenu={openContextMenu}
          />
        ) : (
          <div className="placeholder-text">Open a project folder to see files here.</div>
        )}
      </div>
      {contextMenu && (
        <>
          <div className="project-tree__context-backdrop" onClick={closeContextMenu} onKeyUp={closeContextMenu} onContextMenu={closeContextMenu} />
          <div
            className="project-tree__context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            role="menu"
          >
            <div className="project-tree__context-header">Create in {contextMenu.targetLabel}</div>
            <button type="button" className="project-tree__context-item" onClick={() => showNamePrompt('file')}>
              <span aria-hidden className="material-symbols-outlined">note_add</span>
              <span>New File</span>
            </button>
            <button type="button" className="project-tree__context-item" onClick={() => showNamePrompt('folder')}>
              <span aria-hidden className="material-symbols-outlined">create_new_folder</span>
              <span>New Folder</span>
            </button>
            {contextMenu.targetPath && (
              <>
                <div className="project-tree__context-header">Rename {contextMenu.targetName}</div>
                <button type="button" className="project-tree__context-item" onClick={showRenamePrompt}>
                  <span aria-hidden className="material-symbols-outlined">drive_file_rename_outline</span>
                  <span>Rename</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
      {namePrompt && (
        <div className="project-tree__prompt" role="dialog" aria-modal="true" aria-labelledby="project-tree__prompt-title">
            <div className="project-tree__prompt-card">
            <div className="project-tree__prompt-header">
              <h3 id="project-tree__prompt-title">
                {namePrompt.mode === 'rename'
                  ? `Rename ${namePrompt.kind === 'file' ? 'File' : 'Folder'}`
                  : namePrompt.kind === 'file'
                    ? 'New File'
                    : 'New Folder'}
              </h3>
              <p className="project-tree__prompt-subtitle">{namePrompt.directoryPath}</p>
            </div>
            <form className="project-tree__prompt-form" onSubmit={handleNameSubmit}>
              <label className="project-tree__prompt-label" htmlFor="project-tree__prompt-input">
                Name
              </label>
              <input
                ref={nameInputRef}
                id="project-tree__prompt-input"
                className="project-tree__prompt-input"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                autoComplete="off"
              />
              <div className="project-tree__prompt-actions">
                <button type="button" className="button button--ghost" onClick={closeNamePrompt}>
                  Cancel
                </button>
                <button type="submit" className="button">
                  {namePrompt.mode === 'rename' ? 'Rename' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
