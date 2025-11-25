import React from 'react';
import {type NamePromptState} from './useProjectTreeContextMenu';

interface Props {
  readonly prompt: NamePromptState;
  readonly nameInput: string;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onNameChange: React.Dispatch<React.SetStateAction<string>>;
  readonly onCancel: () => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}

/**
 * Renders the modal used for creating and renaming file system entries.
 *
 * @param props - Prompt configuration, form state, and handlers.
 * @returns Modal dialog containing the name form.
 */
export const NamePrompt: React.FC<Props> = ({
  prompt,
  nameInput,
  inputRef,
  onNameChange,
  onCancel,
  onSubmit,
}) => (
  <div className="project-tree__prompt" role="dialog" aria-modal="true" aria-labelledby="project-tree__prompt-title">
    <div className="project-tree__prompt-card">
      <div className="project-tree__prompt-header">
        <h3 id="project-tree__prompt-title">
          {prompt.mode === 'rename'
            ? `Rename ${prompt.kind === 'file' ? 'File' : 'Folder'}`
            : prompt.kind === 'file'
              ? 'New File'
              : 'New Folder'}
        </h3>
        <p className="project-tree__prompt-subtitle">{prompt.directoryPath}</p>
      </div>
      <form className="project-tree__prompt-form" onSubmit={onSubmit}>
        <label className="project-tree__prompt-label" htmlFor="project-tree__prompt-input">
          Name
        </label>
        <input
          ref={inputRef}
          id="project-tree__prompt-input"
          className="project-tree__prompt-input"
          value={nameInput}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
        />
        <div className="project-tree__prompt-actions">
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button">
            {prompt.mode === 'rename' ? 'Rename' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
);
