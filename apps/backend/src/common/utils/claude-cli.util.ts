import { execFileSync } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type ClaudeBinarySource =
  | 'env'
  | 'antigravity-extension'
  | 'vscode-extension'
  | 'vscode-insiders-extension'
  | 'path'
  | 'fallback'
  | 'missing';

interface ClaudeBinaryCandidate {
  binaryPath: string;
  source: ClaudeBinarySource;
}

export interface ClaudeBinaryResolution {
  binaryPath: string | null;
  binaryDir: string | null;
  launchCommand: string;
  shellQuotedBinaryPath: string | null;
  source: ClaudeBinarySource;
}

function isExecutable(targetPath: string): boolean {
  try {
    accessSync(targetPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function readExtensionCandidates(
  directoryPath: string,
  source: ClaudeBinarySource,
): ClaudeBinaryCandidate[] {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name.startsWith('anthropic.claude-code-'))
    .map((entry) => {
      const extensionPath = path.join(
        directoryPath,
        entry.name,
        'resources',
        'native-binary',
        'claude',
      );
      return {
        candidate: extensionPath,
        mtimeMs: existsSync(extensionPath)
          ? statSync(extensionPath).mtimeMs
          : 0,
      };
    })
    .filter((entry) => entry.mtimeMs > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((entry) => ({
      binaryPath: entry.candidate,
      source,
    }));
}

function resolveClaudeFromPath(): string | null {
  try {
    const output = execFileSync('which', ['claude'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

export function getClaudeBinaryCandidates(
  homeDir = process.env.HOME || '/Users/kscold',
): ClaudeBinaryCandidate[] {
  const envPath =
    process.env.CLAUDE_CODE_BIN || process.env.CLAUDE_BINARY_PATH || null;
  const pathResolvedBinary = resolveClaudeFromPath();

  return [
    ...(envPath ? [{ binaryPath: envPath, source: 'env' as const }] : []),
    ...readExtensionCandidates(
      path.join(homeDir, '.antigravity', 'extensions'),
      'antigravity-extension',
    ),
    ...readExtensionCandidates(
      path.join(homeDir, '.vscode', 'extensions'),
      'vscode-extension',
    ),
    ...readExtensionCandidates(
      path.join(homeDir, '.vscode-insiders', 'extensions'),
      'vscode-insiders-extension',
    ),
    ...(pathResolvedBinary
      ? [{ binaryPath: pathResolvedBinary, source: 'path' as const }]
      : []),
    { binaryPath: '/opt/homebrew/bin/claude', source: 'fallback' as const },
  ];
}

export function resolveClaudeBinary(
  homeDir = process.env.HOME || '/Users/kscold',
): ClaudeBinaryResolution {
  const resolvedCandidate = getClaudeBinaryCandidates(homeDir).find(
    (candidate) => isExecutable(candidate.binaryPath),
  );

  if (!resolvedCandidate) {
    return {
      binaryPath: null,
      binaryDir: null,
      launchCommand: 'claude',
      shellQuotedBinaryPath: null,
      source: 'missing',
    };
  }

  return {
    binaryPath: resolvedCandidate.binaryPath,
    binaryDir: path.dirname(resolvedCandidate.binaryPath),
    launchCommand: shellQuote(resolvedCandidate.binaryPath),
    shellQuotedBinaryPath: shellQuote(resolvedCandidate.binaryPath),
    source: resolvedCandidate.source,
  };
}

export function prependClaudeBinaryDir(
  binaryPath: string | null,
  currentPath = process.env.PATH || '',
): string {
  if (!binaryPath) {
    return currentPath;
  }

  const binaryDir = path.dirname(binaryPath);
  const pathSegments = currentPath.split(':').filter(Boolean);
  const withoutBinaryDir = pathSegments.filter((entry) => entry !== binaryDir);
  return [binaryDir, ...withoutBinaryDir].join(':');
}
