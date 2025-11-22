// src/global.d.ts
import type {FileNode} from './types/files';

export {};

declare global {
  interface Window {
    api: {
      selectProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null>;
      readFile(path: string): Promise<string>;
      readBinaryFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<boolean>;
      loadSettings(): Promise<{ path: string; content: string }>;
      saveSettings(content: string): Promise<{ path: string; content: string }>;
    };
  }
}
