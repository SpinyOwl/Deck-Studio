// src/components/FileTree.tsx
import React from 'react';

export interface FileNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  children?: FileNode[];
}

interface Props {
  nodes: FileNode[];
  selectedPath?: string;
  onSelectFile: (node: FileNode) => void;
}

export const FileTree: React.FC<Props> = ({ nodes, selectedPath, onSelectFile }) => {
  const renderNode = (node: FileNode) => {
    const isSelected = node.path === selectedPath;

    if (node.type === 'dir') {
      return (
        <div key={node.path} style={{ marginLeft: 8 }}>
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>{node.name}</div>
          {node.children?.map(child => renderNode(child))}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node)}
        style={{
          marginLeft: 16,
          cursor: 'pointer',
          background: isSelected ? '#2e3b4e' : 'transparent',
          color: isSelected ? 'white' : 'inherit',
          padding: '2px 4px',
          borderRadius: 4
        }}
      >
        {node.name}
      </div>
    );
  };

  return <div>{nodes.map(node => renderNode(node))}</div>;
};
