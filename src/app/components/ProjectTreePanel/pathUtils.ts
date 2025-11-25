import {type FileNode} from '../FileTree';
import {getParentPath, getPathSeparator} from '../../utils/path';

/**
 * Returns the separator used within the provided path.
 *
 * @param path - Path to inspect.
 * @returns Separator string, defaulting to '/'.
 */
export const getSeparator = (path: string): string => getPathSeparator(path);

/**
 * Resolves the parent directory of a given path string.
 *
 * @param path - File or directory path to inspect.
 * @returns Parent directory path or null when it cannot be determined.
 */
export const getParentDirectory = (path: string): string | null => getParentPath(path);

/**
 * Determines which directory the context menu actions should target.
 *
 * @param node - Node that triggered the context menu.
 * @param projectRoot - Optional root path for the project.
 * @returns Directory path that should receive context menu actions.
 */
export const resolveTargetDirectory = (node?: FileNode, projectRoot?: string): string | null => {
  if (node?.type === 'dir') {
    return node.path;
  }

  if (node?.type === 'file') {
    return getParentDirectory(node.path) ?? projectRoot ?? null;
  }

  return projectRoot ?? null;
};

/**
 * Resolves the label used to describe the context menu target directory.
 *
 * @param node - Node that triggered the context menu.
 * @param directoryPath - Directory path receiving context menu actions.
 * @returns Human-friendly label for the directory.
 */
export const getTargetLabel = (node: FileNode | undefined, directoryPath: string): string => {
  if (node?.type === 'dir') {
    return node.name;
  }

  if (node?.type === 'file') {
    const parentDirectory = getParentDirectory(node.path);
    if (!parentDirectory) {
      return node.name;
    }

    const separator = getSeparator(directoryPath);

    return parentDirectory.split(separator).pop() ?? node.name;
  }

  return 'project root';
};
