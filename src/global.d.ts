// src/global.d.ts
export {};

interface FileNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  children?: FileNode[];
}

declare global {
  interface Window {
    api: {
      selectProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null>;
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<boolean>;
    };
  }
}
