const pty = require('node-pty');

// Try with different shell
const shells = ['/bin/sh', '/bin/bash', '/bin/zsh'];

for (const shellPath of shells) {
  console.log(`\nTrying ${shellPath}...`);
  try {
    const shell = pty.spawn(shellPath, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/tmp',
      env: process.env
    });
    console.log(`✓ SUCCESS with ${shellPath}, PID: ${shell.pid}`);
    shell.kill();
    process.exit(0);
  } catch (error) {
    console.error(`✗ FAILED with ${shellPath}:`, error.message);
  }
}

console.log('\n❌ All shells failed');
process.exit(1);
