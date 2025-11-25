// src/utils/path.ts

/**
 * Identifies the separator used by a path.
 *
 * @param path - Path to inspect.
 * @returns The detected separator, defaulting to '/'.
 */
export function getPathSeparator(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

/**
 * Joins a base path with a child name using the separator present in the base.
 *
 * @param basePath - Absolute base directory path.
 * @param childName - File or folder name to append.
 * @returns Combined absolute path to the child entry.
 */
export function joinPathSegments(basePath: string, childName: string): string {
  const separator = getPathSeparator(basePath);
  const normalizedBase = basePath.endsWith(separator) ? basePath : `${basePath}${separator}`;

  return `${normalizedBase}${childName}`;
}

/**
 * Resolves the parent directory of a provided path string.
 *
 * @param targetPath - Absolute path to resolve.
 * @returns Parent directory path or null when it cannot be determined.
 */
export function getParentPath(targetPath: string): string | null {
  const separator = getPathSeparator(targetPath);
  const normalizedPath = targetPath.endsWith(separator) ? targetPath.slice(0, -1) : targetPath;
  const segments = normalizedPath.split(separator);

  if (segments.length <= 1) {
    return null;
  }

  segments.pop();
  const parent = segments.join(separator);

  return parent || null;
}

/**
 * Checks whether the provided name includes path separators.
 *
 * @param name - File system entry name to validate.
 * @returns True when a forward or backslash is present.
 */
export function containsPathSeparator(name: string): boolean {
  return /[\\/]/.test(name);
}

/**
 * Determines whether a target path is nested within a potential ancestor path.
 *
 * @param targetPath - Path that may be contained within the ancestor path.
 * @param ancestorPath - Path that could be an ancestor of the target.
 * @returns True when the target path exists within the ancestor path.
 */
export function isDescendantPath(targetPath: string, ancestorPath: string): boolean {
  const separator = getPathSeparator(ancestorPath);
  const normalizedAncestor = ancestorPath.endsWith(separator) ? ancestorPath : `${ancestorPath}${separator}`;
  const normalizedTarget = targetPath.endsWith(separator) ? targetPath : `${targetPath}${separator}`;

  if (normalizedAncestor === normalizedTarget) {
    return false;
  }

  return normalizedTarget.startsWith(normalizedAncestor);
}
