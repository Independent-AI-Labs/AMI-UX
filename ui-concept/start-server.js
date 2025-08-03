const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting dev server in background...');

// Create log files for debugging
const logFile = path.join(__dirname, 'dev-server.log');
const errorFile = path.join(__dirname, 'dev-server-error.log');
const pidFile = path.join(__dirname, 'dev-server.pid');

// Clear old log files and open file descriptors
fs.writeFileSync(logFile, '');
fs.writeFileSync(errorFile, '');

const logFd = fs.openSync(logFile, 'a');
const errorFd = fs.openSync(errorFile, 'a');

const server = spawn('cmd', ['/c', 'npm run dev'], {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', logFd, errorFd],
    shell: false
});

// Store the PID for later cleanup
fs.writeFileSync(pidFile, server.pid.toString());

// Close file descriptors after spawn
fs.closeSync(logFd);
fs.closeSync(errorFd);

// Unref so the parent can exit
server.unref();

console.log('✓ Dev server started in background on http://localhost:3000');
console.log(`✓ Process PID: ${server.pid} (saved to dev-server.pid)`);
console.log(`✓ Logs: dev-server.log, Errors: dev-server-error.log`);
console.log('Use "node stop-server.js" to stop it');

// Exit immediately
process.exit(0);