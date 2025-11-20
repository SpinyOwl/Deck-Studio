// src/components/FileTree.tsx
import React, {useEffect, useState} from 'react';
import './FileTree.css';

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

const INDENT_PER_LEVEL = 14;
const FILE_ICON_OFFSET = 26;

/**
 * Renders a Material Symbols icon with shared styling for the file tree.
 *
 * @param name - Icon glyph name.
 * @param className - Optional extra class names to append.
 * @returns Icon element ready for placement in the tree.
 */
function renderIcon(name: string, className = ''): React.ReactElement {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined file-tree__icon ${className}`.trim()}
    >
      {name}
    </span>
  );
}

/**
 * Collects directory paths from the provided file tree nodes.
 *
 * @param nodes - File tree nodes to search.
 * @returns Set containing all directory paths.
 */
function collectDirectoryPaths(nodes: FileNode[]): Set<string> {
  const directories = new Set<string>();

  nodes.forEach(node => {
    if (node.type === 'dir') {
      directories.add(node.path);
      if (node.children) {
        node.children.forEach(child => {
          collectDirectoryPaths([child]).forEach(path => {
            directories.add(path);
          });
        });
      }
    }
  });

  return directories;
}

/**
 * Displays a hierarchical file tree with selectable files and expandable directories.
 *
 * @param props - File tree configuration and callbacks.
 * @returns Rendered file tree component.
 */
export const FileTree: React.FC<Props> = ({ nodes, selectedPath, onSelectFile }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedPaths(collectDirectoryPaths(nodes));
  }, [nodes]);

  const toggleDirectory = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      next.add(path);
      return next;
    });
  };

  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    const paddingLeft = depth * INDENT_PER_LEVEL;

    if (node.type === 'dir') {
      const isExpanded = expandedPaths.has(node.path);
      return (
        <div key={node.path} className="file-tree__group">
          <div
            className="file-tree__row file-tree__row--dir"
            style={{ paddingLeft }}
            onClick={() => toggleDirectory(node.path)}
            aria-expanded={isExpanded}
            role="button"
          >
            <span className="file-tree__chevron" aria-hidden>
              {renderIcon(isExpanded ? 'expand_more' : 'chevron_right', 'file-tree__chevron-icon')}
            </span>
            {renderIcon(isExpanded ? 'folder_open' : 'folder', 'file-tree__icon--dir')}
            <span className="file-tree__name">{node.name}</span>
          </div>
          {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    const isSelected = node.path === selectedPath;
    return (
      <div
        key={node.path}
        className={`file-tree__row file-tree__row--file ${isSelected ? 'is-selected' : ''}`}
        style={{ paddingLeft: paddingLeft + FILE_ICON_OFFSET }}
        onClick={() => onSelectFile(node)}
        role="button"
      >
        {renderIcon('description', 'file-tree__icon--file')}
        <span className="file-tree__name">{node.name}</span>
      </div>
    );
  };

  return <div className="file-tree">{nodes.map(node => renderNode(node))}</div>;
};
