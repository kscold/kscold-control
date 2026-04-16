import { execFileSync, spawn } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ptyModulePath = require.resolve('node-pty', {
  paths: [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../apps/backend'),
  ],
});
const pty = require(ptyModulePath);

function parseArgs(argv) {
  const options = {
    json: false,
    versionTimeoutMs: 15_000,
    interactiveTimeoutMs: 20_000,
  };

  argv.forEach((arg) => {
    if (arg === '--json') {
      options.json = true;
      return;
    }

    if (arg.startsWith('--version-timeout=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0) {
        options.versionTimeoutMs = value;
      }
      return;
    }

    if (arg.startsWith('--interactive-timeout=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0) {
        options.interactiveTimeoutMs = value;
      }
    }
  });

  return options;
}

const options = parseArgs(process.argv.slice(2));
const VERSION_TIMEOUT_MS = options.versionTimeoutMs;
const INTERACTIVE_TIMEOUT_MS = options.interactiveTimeoutMs;

function isExecutable(targetPath) {
  try {
    accessSync(targetPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function readExtensionCandidates(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name.startsWith('anthropic.claude-code-'))
    .map((entry) => {
      const binaryPath = path.join(
        directoryPath,
        entry.name,
        'resources',
        'native-binary',
        'claude',
      );
      return {
        binaryPath,
        mtimeMs: existsSync(binaryPath) ? statSync(binaryPath).mtimeMs : 0,
      };
    })
    .filter((entry) => entry.mtimeMs > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((entry) => entry.binaryPath);
}

function resolveClaudeBinary() {
  const homeDir = process.env.HOME || '/Users/kscold';
  const envBinary =
    process.env.CLAUDE_CODE_BIN || process.env.CLAUDE_BINARY_PATH || null;
  const fromPath = runCommand('which', ['claude']) || null;
  const candidates = [
    envBinary,
    ...readExtensionCandidates(
      path.join(homeDir, '.antigravity', 'extensions'),
    ),
    ...readExtensionCandidates(path.join(homeDir, '.vscode', 'extensions')),
    ...readExtensionCandidates(
      path.join(homeDir, '.vscode-insiders', 'extensions'),
    ),
    fromPath,
    '/opt/homebrew/bin/claude',
  ].filter(Boolean);

  return candidates.find((candidate) => isExecutable(candidate)) || null;
}

function prependBinaryDir(binaryPath) {
  if (!binaryPath) return process.env.PATH;
  const binaryDir = path.dirname(binaryPath);
  const segments = (process.env.PATH || '').split(':').filter(Boolean);
  const withoutBinaryDir = segments.filter((entry) => entry !== binaryDir);
  return [binaryDir, ...withoutBinaryDir].join(':');
}

function runCommand(command, args = []) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stdout = error.stdout?.toString?.() || '';
    const stderr = error.stderr?.toString?.() || '';
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  }
}

function logSection(title, lines) {
  console.log(`\n[${title}]`);
  lines.forEach((line) => console.log(line));
}

function clip(text, maxLength = 180) {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength)}...`;
}

async function smokeVersion(binaryPath) {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, ['--version'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: process.env.HOME,
        PATH: prependBinaryDir(binaryPath),
        CLAUDE_CODE_BIN: binaryPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        ok: false,
        stage: 'version',
        reason: `No output within ${VERSION_TIMEOUT_MS / 1000}s`,
        stdout,
        stderr,
      });
    }, VERSION_TIMEOUT_MS);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', (code, signal) => {
      const combined = `${stdout}\n${stderr}`.trim();
      finish({
        ok: code === 0 && combined.length > 0,
        stage: 'version',
        reason:
          code === 0 && combined.length > 0
            ? null
            : `Exited with code=${code} signal=${signal} and output length=${combined.length}`,
        stdout,
        stderr,
      });
    });
  });
}

async function smokeInteractive(binaryPath) {
  return new Promise((resolve) => {
    const term = pty.spawn(binaryPath, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: process.env.HOME,
        PATH: prependBinaryDir(binaryPath),
        CLAUDE_CODE_BIN: binaryPath,
      },
    });

    let output = '';
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      term.kill();
      finish({
        ok: false,
        stage: 'interactive',
        reason: `No terminal output within ${INTERACTIVE_TIMEOUT_MS / 1000}s`,
        output,
      });
    }, INTERACTIVE_TIMEOUT_MS);

    term.onData((data) => {
      output += data;
      if (data.trim()) {
        term.kill();
        finish({
          ok: true,
          stage: 'interactive',
          reason: null,
          output,
        });
      }
    });

    term.onExit(({ exitCode, signal }) => {
      if (output.trim()) {
        finish({
          ok: true,
          stage: 'interactive',
          reason: null,
          output,
        });
        return;
      }

      finish({
        ok: false,
        stage: 'interactive',
        reason: `Exited before any output (code=${exitCode}, signal=${signal})`,
        output,
      });
    });
  });
}

function buildRecommendation({
  binaryExists,
  versionResult,
  interactiveResult,
  quarantine,
}) {
  if (!binaryExists) {
    return 'Claude CLI를 설치하거나 PATH에 `claude` 바이너리를 추가하세요.';
  }

  if (quarantine && !quarantine.startsWith('xattr:')) {
    return 'macOS quarantine 흔적이 남아 있습니다. `xattr -dr com.apple.quarantine <claude-path>`로 해제 후 다시 확인하세요.';
  }

  if (!versionResult.ok && !interactiveResult.ok) {
    return 'Claude CLI가 시작 전 단계에서 멈추는 상태입니다. Gatekeeper, code signing, Rosetta, shell PATH를 먼저 점검하세요.';
  }

  if (!interactiveResult.ok) {
    return '버전 응답은 되지만 대화형 시작이 멈춥니다. 터미널 권한이나 셸 초기화 스크립트가 Claude 시작을 막는지 확인하세요.';
  }

  if (!versionResult.ok) {
    return '대화형 시작은 되지만 `claude --version`이 정상 종료되지 않습니다. 설치 상태와 PATH를 다시 확인하세요.';
  }

  return null;
}

function buildSummary({
  binaryExists,
  versionResult,
  interactiveResult,
  binaryPath,
}) {
  if (!binaryExists) {
    return 'Claude CLI binary를 PATH에서 찾지 못했습니다.';
  }

  if (versionResult.ok && interactiveResult.ok) {
    return `Claude CLI가 ${binaryPath}에서 버전 확인과 대화형 시작 모두 응답했습니다.`;
  }

  if (!versionResult.ok && !interactiveResult.ok) {
    return 'Claude CLI가 버전 확인과 대화형 시작 모두에서 출력 없이 멈췄습니다.';
  }

  if (!interactiveResult.ok) {
    return 'Claude CLI가 버전 확인은 통과했지만 대화형 시작에서 응답하지 않았습니다.';
  }

  return 'Claude CLI가 대화형 시작은 했지만 버전 확인은 통과하지 못했습니다.';
}

async function main() {
  const resolvedBinaryPath = resolveClaudeBinary();
  const binaryPath = resolvedBinaryPath || '(not found)';
  const binaryExists = Boolean(resolvedBinaryPath);
  const quarantine = binaryExists
    ? runCommand('xattr', ['-p', 'com.apple.quarantine', binaryPath])
    : '(binary not found)';
  const spctl = binaryExists
    ? runCommand('spctl', ['--assess', '-vv', binaryPath])
    : '(binary not found)';

  const [versionResult, interactiveResult] = binaryExists
    ? await Promise.all([
        smokeVersion(resolvedBinaryPath),
        smokeInteractive(resolvedBinaryPath),
      ])
    : [
        {
          ok: false,
          stage: 'version',
          reason: 'Claude binary not found',
          stdout: '',
          stderr: '',
        },
        {
          ok: false,
          stage: 'interactive',
          reason: 'Claude binary not found',
          output: '',
        },
      ];

  const report = {
    ok: versionResult.ok && interactiveResult.ok,
    diagnosedAt: new Date().toISOString(),
    summary: buildSummary({
      binaryExists,
      versionResult,
      interactiveResult,
      binaryPath,
    }),
    recommendation: buildRecommendation({
      binaryExists,
      versionResult,
      interactiveResult,
      quarantine,
    }),
    environment: {
      cwd: process.cwd(),
      binaryPath: binaryExists ? binaryPath : null,
      home: process.env.HOME || null,
    },
    macOsSignals: {
      quarantine: binaryExists ? quarantine || '(none)' : null,
      spctl: binaryExists ? spctl || '(no response)' : null,
    },
    checks: {
      version: {
        ok: versionResult.ok,
        reason: versionResult.reason,
        stdoutLength: versionResult.stdout.length,
        stderrLength: versionResult.stderr.length,
        stdoutPreview: clip(versionResult.stdout),
        stderrPreview: clip(versionResult.stderr),
      },
      interactive: {
        ok: interactiveResult.ok,
        reason: interactiveResult.reason,
        outputLength: interactiveResult.output.length,
        outputPreview: clip(interactiveResult.output),
      },
    },
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  logSection('Environment', [
    `cwd=${report.environment.cwd}`,
    `binary=${report.environment.binaryPath || '(not found)'}`,
    `home=${report.environment.home || '(missing)'}`,
  ]);

  logSection('MacOS Signals', [
    `quarantine=${report.macOsSignals.quarantine || '(n/a)'}`,
    `spctl=${report.macOsSignals.spctl || '(n/a)'}`,
  ]);

  logSection('Version Check', [
    `ok=${report.checks.version.ok}`,
    `reason=${report.checks.version.reason || 'passed'}`,
    `stdout_len=${report.checks.version.stdoutLength}`,
    `stderr_len=${report.checks.version.stderrLength}`,
  ]);

  logSection('Interactive Check', [
    `ok=${report.checks.interactive.ok}`,
    `reason=${report.checks.interactive.reason || 'passed'}`,
    `output_len=${report.checks.interactive.outputLength}`,
  ]);

  if (!report.ok) {
    console.error('\nClaude smoke failed.');
    console.error(report.summary);
    if (report.recommendation) {
      console.error(report.recommendation);
    }
    process.exit(1);
  }

  console.log('\nClaude smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
