const pty = require('node-pty');

console.log('Testing node-pty...');
console.log('Shell:', process.env.SHELL);
console.log('Home:', process.env.HOME);

try {
  const shell = pty.spawn(process.env.SHELL || '/bin/zsh', ['-l'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  console.log('✓ PTY created successfully');
  console.log('PID:', shell.pid);

  shell.onData((data) => {
    process.stdout.write(data);
  });

  shell.onExit(({ exitCode, signal }) => {
    console.log('\n[EXIT]', { exitCode, signal });
    process.exit(0);
  });

  setTimeout(() => {
    console.log('\nSending test command...');
    shell.write('echo "Hello from PTY"\r');
  }, 500);

  setTimeout(() => {
    console.log('\nClosing PTY...');
    shell.kill();
  }, 2000);

} catch (error) {
  console.error('✗ PTY creation failed:', error);
  process.exit(1);
}
