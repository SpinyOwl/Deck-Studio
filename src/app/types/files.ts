// src/types/files.ts

/**
 * Represents a file or directory node within a project tree.
 */
export interface FileNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  children?: FileNode[];
}
