// src/components/FileTree/FileTree.tsx
import React, {useEffect, useState} from 'react';
import {type FileNode} from '../../types/files';
import {
  getParentPath,
  getPathSeparator,
  isDescendantPath,
  joinPathSegments,
} from '../../utils/path';
import {PROJECT_CONFIG_FILENAME} from '../../constants/project';
import './FileTree.css';

interface Props {
  nodes: FileNode[];
  selectedPath?: string;
  onSelectFile: (node: FileNode) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>, node?: FileNode) => void;
  onMoveEntry: (sourcePath: string, targetDirectory: string) => void | Promise<void>;
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
 * Checks whether a given file system path matches the project config file.
 *
 * @param path - Absolute path to inspect.
 * @returns True when the path points to the project configuration file.
 */
const isProjectConfigPath = (path: string): boolean => {
  const separator = getPathSeparator(path);
  const fileName = path.split(separator).pop();

  return fileName === PROJECT_CONFIG_FILENAME;
};

/**
 * Displays a hierarchical file tree with selectable files and expandable directories.
 *
 * @param props - File tree configuration and callbacks.
 * @returns Rendered file tree component.
 */
export const FileTree: React.FC<Props> = ({ nodes, selectedPath, onSelectFile, onContextMenu, onMoveEntry }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  useEffect(() => {
    setExpandedPaths(prev => {
      const directories = collectDirectoryPaths(nodes);

      if (prev.size === 0) {
        return directories;
      }

      const next = new Set<string>();
      prev.forEach(path => {
        if (directories.has(path)) {
          next.add(path);
        }
      });

      return next;
    });
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

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>, nodeContext: FileNode): void => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event, nodeContext);
  };

  /**
   * Determines which directory a dragged item should target when hovering over a node.
   *
   * @param node - Node currently under the pointer.
   * @returns Directory path that can accept the drop, or null when unavailable.
   */
  const resolveDropDirectory = (node: FileNode): string | null => {
    if (node.type === 'dir') {
      return node.path;
    }

    return getParentPath(node.path);
  };

  /**
   * Combines a directory with the dragged entry name to produce the destination path.
   *
   * @param targetDirectory - Directory where the entry should be moved.
   * @param sourcePath - Original location of the dragged entry.
   * @returns Absolute destination path or null when the entry name cannot be derived.
   */
  const computeTargetPath = (targetDirectory: string, sourcePath: string): string | null => {
    const separator = getPathSeparator(sourcePath);
    const parts = sourcePath.split(separator);
    const name = parts.pop();

    if (!name) {
      return null;
    }

    return joinPathSegments(targetDirectory, name);
  };

  /**
   * Validates whether the dragged entry can be dropped onto the provided node.
   *
   * @param node - Potential drop target node.
   * @returns True when the drop action should be permitted.
   */
  const canDropOnNode = (node: FileNode): boolean => {
    if (!dragSourcePath) {
      return false;
    }

    if (isProjectConfigPath(dragSourcePath)) {
      return false;
    }

    const targetDirectory = resolveDropDirectory(node);
    if (!targetDirectory) {
      return false;
    }

    if (isDescendantPath(targetDirectory, dragSourcePath)) {
      return false;
    }

    const targetPath = computeTargetPath(targetDirectory, dragSourcePath);

    return !!targetPath && targetPath !== dragSourcePath;
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, sourcePath: string) => {
    if (isProjectConfigPath(sourcePath)) {
      event.preventDefault();
      return;
    }

    setDragSourcePath(sourcePath);
    setDropTargetPath(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourcePath);
  };

  const handleDragEnd = () => {
    setDragSourcePath(null);
    setDropTargetPath(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, node: FileNode) => {
    if (!canDropOnNode(node)) {
      return;
    }

    event.preventDefault();
    setDropTargetPath(node.path);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setDropTargetPath(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, node: FileNode) => {
    if (!dragSourcePath) {
      return;
    }

    const targetDirectory = resolveDropDirectory(node);
    if (!targetDirectory || isDescendantPath(targetDirectory, dragSourcePath)) {
      return;
    }

    const targetPath = computeTargetPath(targetDirectory, dragSourcePath);
    if (!targetPath || targetPath === dragSourcePath) {
      return;
    }

    event.preventDefault();
    setDropTargetPath(null);
    setDragSourcePath(null);
    void onMoveEntry(dragSourcePath, targetDirectory);
  };

  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    const paddingLeft = depth * INDENT_PER_LEVEL;

    if (node.type === 'dir') {
      const isExpanded = expandedPaths.has(node.path);
      return (
        <div key={node.path} className="file-tree__group">
          <div
            className={`file-tree__row file-tree__row--dir ${dropTargetPath === node.path ? 'file-tree__row--drop-target' : ''}`.trim()}
            style={{ paddingLeft }}
            onClick={() => toggleDirectory(node.path)}
            onContextMenu={(event) => handleContextMenu(event, node)}
            onDragStart={(event) => handleDragStart(event, node.path)}
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleDragOver(event, node)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, node)}
            aria-expanded={isExpanded}
            draggable
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
    const isProjectConfigFile = node.name === PROJECT_CONFIG_FILENAME;
    return (
      <div
        key={node.path}
        className={`file-tree__row file-tree__row--file ${isSelected ? 'is-selected' : ''} ${dropTargetPath === node.path ? 'file-tree__row--drop-target' : ''}`.trim()}
        style={{ paddingLeft: paddingLeft + FILE_ICON_OFFSET }}
        onClick={() => onSelectFile(node)}
        onContextMenu={(event) => handleContextMenu(event, node)}
        onDragStart={(event) => handleDragStart(event, node.path)}
        onDragEnd={handleDragEnd}
        onDragOver={(event) => handleDragOver(event, node)}
        onDragLeave={handleDragLeave}
        onDrop={(event) => handleDrop(event, node)}
        role="button"
        draggable={!isProjectConfigFile}
      >
        {renderIcon('description', 'file-tree__icon--file')}
        <span className="file-tree__name">{node.name}</span>
      </div>
    );
  };
  return (
    <div
      className="file-tree"
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onContextMenu?.(event);
        }
      }}
    >
      {nodes.map(node => renderNode(node))}
    </div>
  );
};
