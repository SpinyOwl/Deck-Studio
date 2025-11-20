// src/components/ProjectTreePanel.tsx
import React from 'react';
import {type FileNode, FileTree} from './FileTree';

interface Props {
  readonly tree: FileNode[];
  readonly selectedPath?: string;
  readonly onSelectFile: (node: FileNode) => void;
}

/**
 * Renders the project tree panel with a header and scrollable body.
 */
export const ProjectTreePanel: React.FC<Props> = ({ tree, selectedPath, onSelectFile }) => {
  const hasTree = tree.length > 0;

  return (
    <aside className="project-tree panel">
      <div className="panel__header">Files</div>
      <div className="panel__body">
        {hasTree ? (
          <FileTree nodes={tree} selectedPath={selectedPath} onSelectFile={onSelectFile} />
        ) : (
          <div className="placeholder-text">Open a project folder to see files here.</div>
        )}
      </div>
    </aside>
  );
};
