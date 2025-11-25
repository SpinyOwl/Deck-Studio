// src/global.d.ts
import type {FileNode} from './types/files';
import type {LayoutState} from './types/layout';

export {};

declare global {
  interface Window {
    api: {
      selectProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null>;
      readFile(path: string): Promise<string>;
      readBinaryFile(path: string): Promise<string>;
      createFile(path: string, content?: string): Promise<boolean>;
      createDirectory(path: string): Promise<boolean>;
      renamePath(currentPath: string, nextPath: string): Promise<boolean>;
      writeFile(path: string, content: string): Promise<boolean>;
      loadSettings(): Promise<{ path: string; content: string }>;
      saveSettings(content: string): Promise<{ path: string; content: string }>;
      loadLayoutState(): Promise<LayoutState>;
      saveLayoutState(payload: Partial<LayoutState>): Promise<LayoutState>;
      loadProjectFolder(rootPath: string): Promise<{ rootPath: string; tree: FileNode[] } | null>;
      watchProjectFolder(rootPath: string): Promise<boolean>;
      resolveAssetUrl(rootPath: string, relativePath: string): Promise<string | null>;
      onProjectFolderChanged(callback: (rootPath: string) => void): () => void;
    };
  }
}
