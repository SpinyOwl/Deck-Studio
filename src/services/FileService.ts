// src/services/FileService.ts

/**
 * Provides helpers for loading, validating, and persisting files via the Electron API.
 */
export class FileService {
  /**
   * Ensures a file path is present before performing file operations.
   *
   * @param path - Absolute path to validate.
   */
  private validatePath(path: string): void {
    if (!path || !path.trim()) {
      throw new Error('File path is required.');
    }
  }

  /**
   * Reads a text file from disk.
   *
   * @param path - Absolute file system path to read.
   * @returns File contents as a UTF-8 string.
   */
  public async readTextFile(path: string): Promise<string> {
    this.validatePath(path);

    return window.api.readFile(path);
  }

  /**
   * Reads a binary file from disk and returns a base64 string.
   *
   * @param path - Absolute file system path to read.
   * @returns Base64-encoded file content.
   */
  public async readBinaryFile(path: string): Promise<string> {
    this.validatePath(path);

    return window.api.readBinaryFile(path);
  }

  /**
   * Saves text content to a file.
   *
   * @param path - Absolute file system path to write.
   * @param content - UTF-8 content to persist.
   */
  public async saveTextFile(path: string, content: string): Promise<void> {
    this.validatePath(path);

    await window.api.writeFile(path, content);
  }

  /**
   * Creates a new file or replaces an existing file with the provided content.
   *
   * @param path - Absolute file system path to create.
   * @param content - Content to write into the new file. Defaults to an empty string.
   */
  public async createFile(path: string, content = ''): Promise<void> {
    await this.saveTextFile(path, content);
  }
}

export const fileService = new FileService();
