const { spawn } = require('child_process');

console.log('Starting dev server in background...');

const server = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    detached: true,
    stdio: 'ignore',
    shell: true
});

// Unref so the parent can exit
server.unref();

console.log('✓ Dev server started in background on http://localhost:3000');
console.log('Use "node stop-server.js" to stop it');

// Exit immediately
process.exit(0);