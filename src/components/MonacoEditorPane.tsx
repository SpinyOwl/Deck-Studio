// src/components/MonacoEditorPane.tsx
import React from 'react';
import Editor from '@monaco-editor/react';

interface Props {
  path?: string;
  value: string;
  onChange: (value: string) => void;
}

function inferLanguage(path?: string): string | undefined {
  if (!path) return 'plaintext';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml';
  return 'plaintext';
}

export const MonacoEditorPane: React.FC<Props> = ({ path, value, onChange }) => {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Editor
        height="100%"
        language={inferLanguage(path)}
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val ?? '')}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true
        }}
      />
    </div>
  );
};
