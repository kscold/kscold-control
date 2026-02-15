const pty = require('node-pty');

console.log('Testing with minimal config...');

try {
  const shell = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
  });

  console.log('Success! PID:', shell.pid);
  shell.onExit(() => process.exit(0));
  
  setTimeout(() => shell.write('exit\n'), 1000);

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
