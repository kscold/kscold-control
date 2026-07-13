import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  File,
} from 'lucide-react';
import type { FileTreeNode } from '@/entities/project';

interface FileTreeViewProps {
  tree: FileTreeNode | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTreeView({
  tree,
  selectedPath,
  onSelect,
}: FileTreeViewProps) {
  if (!tree || !tree.children || tree.children.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-gray-500">
        파일이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-0.5 px-2 py-2">
      {tree.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = node.type === 'directory';
  const isSelected = node.path === selectedPath;

  const Icon = useMemo(() => {
    if (isFolder) return open ? FolderOpen : Folder;
    return getFileIcon(node.name);
  }, [isFolder, open, node.name]);

  return (
    <div>
      <div
        onClick={() => {
          if (isFolder) setOpen((v) => !v);
          else onSelect(node.path);
        }}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          isSelected
            ? 'bg-blue-600/20 text-blue-300'
            : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
        }`}
        title={node.path}
      >
        {isFolder ? (
          open ? (
            <ChevronDown size={12} className="shrink-0 text-gray-600" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-gray-600" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon
          size={13}
          className={`shrink-0 ${
            isFolder
              ? 'text-blue-400'
              : isSelected
                ? 'text-blue-300'
                : 'text-gray-500'
          }`}
        />
        <span className="truncate">{node.name}</span>
        {!isFolder && node.size != null && (
          <span className="ml-auto text-[10px] text-gray-600">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>
      {isFolder && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const codeExts = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'vue',
    'svelte',
    'py',
    'java',
    'kt',
    'go',
    'rs',
    'rb',
    'php',
    'swift',
    'c',
    'cpp',
    'h',
    'cs',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'bat',
    'sql',
    'graphql',
    'proto',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'json',
    'yml',
    'yaml',
    'toml',
    'xml',
  ]);
  return codeExts.has(ext) ? FileCode : File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}
