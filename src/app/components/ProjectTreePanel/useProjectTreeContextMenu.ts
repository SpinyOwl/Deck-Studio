import React, {useEffect, useRef, useState} from 'react';
import {type FileNode} from '../FileTree';
import {getParentDirectory, getTargetLabel, resolveTargetDirectory} from './pathUtils';

interface HookConfig {
  readonly projectRoot?: string;
  readonly onCreateFile: (directoryPath: string, fileName: string) => Promise<void>;
  readonly onCreateFolder: (directoryPath: string, folderName: string) => Promise<void>;
  readonly onRenameEntry: (currentPath: string, nextName: string) => Promise<void>;
}

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly directoryPath: string;
  readonly targetLabel: string;
  readonly targetPath?: string;
  readonly targetType?: FileNode['type'];
  readonly targetName?: string;
}

export interface NamePromptState {
  readonly directoryPath: string;
  readonly kind: 'file' | 'folder';
  readonly mode: 'create' | 'rename';
  readonly targetPath?: string;
}

interface HookResult {
  readonly contextMenu: ContextMenuState | null;
  readonly namePrompt: NamePromptState | null;
  readonly nameInput: string;
  readonly nameInputRef: React.RefObject<HTMLInputElement | null>;
  readonly openContextMenu: (event: React.MouseEvent<HTMLDivElement>, node?: FileNode) => void;
  readonly closeContextMenu: () => void;
  readonly showNamePrompt: (kind: NamePromptState['kind']) => void;
  readonly showRenamePrompt: () => void;
  readonly closeNamePrompt: () => void;
  readonly handleNameSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly setNameInput: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Manages context menu state and related file operations for the project tree.
 *
 * @param config - Configuration and callbacks for file operations.
 * @returns Context menu state along with handlers for prompts and submissions.
 */
export const useProjectTreeContextMenu = ({
  projectRoot,
  onCreateFile,
  onCreateFolder,
  onRenameEntry,
}: HookConfig): HookResult => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  useEffect(() => {
    if (!namePrompt) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNamePrompt(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [namePrompt]);

  useEffect(() => {
    if (!namePrompt) {
      return;
    }

    nameInputRef.current?.focus();
  }, [namePrompt]);

  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>, node?: FileNode): void => {
    event.preventDefault();
    const directoryPath = resolveTargetDirectory(node, projectRoot);
    if (!directoryPath) {
      return;
    }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      directoryPath,
      targetLabel: getTargetLabel(node, directoryPath),
      targetPath: node?.path,
      targetType: node?.type,
      targetName: node?.name,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const showNamePrompt = (kind: NamePromptState['kind']) => {
    if (!contextMenu) {
      return;
    }

    setNameInput('');
    setNamePrompt({
      directoryPath: contextMenu.directoryPath,
      kind,
      mode: 'create',
    });
    setContextMenu(null);
  };

  const showRenamePrompt = () => {
    if (!contextMenu?.targetPath || !contextMenu.targetName || !contextMenu.targetType) {
      return;
    }

    const parentDirectory = getParentDirectory(contextMenu.targetPath);
    if (!parentDirectory) {
      return;
    }

    setNameInput(contextMenu.targetName);
    setNamePrompt({
      directoryPath: parentDirectory,
      kind: contextMenu.targetType === 'dir' ? 'folder' : 'file',
      mode: 'rename',
      targetPath: contextMenu.targetPath,
    });
    setContextMenu(null);
  };

  const closeNamePrompt = () => setNamePrompt(null);

  const handleNameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!namePrompt) {
      return;
    }

    const sanitized = nameInput.trim();
    if (!sanitized) {
      setNamePrompt(null);
      return;
    }

    try {
      if (namePrompt.mode === 'rename' && namePrompt.targetPath) {
        await onRenameEntry(namePrompt.targetPath, sanitized);
      } else if (namePrompt.kind === 'file') {
        await onCreateFile(namePrompt.directoryPath, sanitized);
      } else {
        await onCreateFolder(namePrompt.directoryPath, sanitized);
      }
    } finally {
      setNamePrompt(null);
    }
  };

  return {
    contextMenu,
    namePrompt,
    nameInput,
    nameInputRef,
    openContextMenu,
    closeContextMenu,
    showNamePrompt,
    showRenamePrompt,
    closeNamePrompt,
    handleNameSubmit,
    setNameInput,
  };
};
