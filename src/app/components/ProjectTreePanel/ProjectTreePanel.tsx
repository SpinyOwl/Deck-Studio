// src/components/ProjectTreePanel/ProjectTreePanel.tsx
import React from 'react';
import {type FileNode, FileTree} from '../FileTree';
import {NamePrompt} from './NamePrompt';
import {useProjectTreeContextMenu} from './useProjectTreeContextMenu';
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
  readonly onMoveEntry: (sourcePath: string, targetDirectory: string) => Promise<void>;
}

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
  onMoveEntry,
}) => {
  const hasTree = tree.length > 0;
  const {
    contextMenu,
    namePrompt,
    nameInput,
    nameInputRef,
    openContextMenu,
    closeContextMenu,
    showNamePrompt,
    showRenamePrompt,
    closeNamePrompt,
    handleNameSubmit,
    setNameInput,
  } = useProjectTreeContextMenu({
    projectRoot,
    onCreateFile,
    onCreateFolder,
    onRenameEntry,
  });

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
            onMoveEntry={onMoveEntry}
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
        <NamePrompt
          prompt={namePrompt}
          nameInput={nameInput}
          inputRef={nameInputRef}
          onNameChange={setNameInput}
          onCancel={closeNamePrompt}
          onSubmit={handleNameSubmit}
        />
      )}
    </aside>
  );
};
