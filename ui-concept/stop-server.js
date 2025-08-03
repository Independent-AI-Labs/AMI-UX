const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Stopping dev server...');

const pidFile = path.join(__dirname, 'dev-server.pid');
const logFile = path.join(__dirname, 'dev-server.log');
const errorFile = path.join(__dirname, 'dev-server-error.log');

// First try to kill using stored PID
if (fs.existsSync(pidFile)) {
    try {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        console.log(`Found PID ${pid}, attempting to kill...`);
        
        exec(`taskkill /PID "${pid}" /T /F`, (error, stdout, stderr) => {
            if (!error) {
                console.log('✓ Dev server stopped using PID');
                cleanup();
                return;
            }
            
            console.log('PID kill failed:', stderr);
            console.log('Fallback to port-based kill...');
            killByPort();
        });
    } catch (err) {
        console.log('Error reading PID file:', err.message);
        killByPort();
    }
} else {
    console.log('No PID file found, using port-based kill...');
    killByPort();
}

function killByPort() {
    exec('npx kill-port 3000', (error, stdout, stderr) => {
        if (error) {
            console.error('Error stopping server:', error.message);
            if (stderr) console.error('stderr:', stderr);
        } else {
            console.log('✓ Dev server stopped via port kill');
            if (stdout) console.log(stdout);
        }
        cleanup();
    });
}

function cleanup() {
    // Show recent logs for debugging
    if (fs.existsSync(logFile)) {
        console.log('\n--- Recent server logs ---');
        try {
            const logs = fs.readFileSync(logFile, 'utf8');
            console.log(logs.slice(-500)); // Last 500 chars
        } catch (e) {
            console.log('Could not read log file');
        }
    }
    
    if (fs.existsSync(errorFile)) {
        console.log('\n--- Recent server errors ---');
        try {
            const errors = fs.readFileSync(errorFile, 'utf8');
            if (errors.trim()) {
                console.log(errors.slice(-500)); // Last 500 chars
            } else {
                console.log('No errors logged');
            }
        } catch (e) {
            console.log('Could not read error file');
        }
    }
    
    // Clean up files
    [pidFile, logFile, errorFile].forEach(file => {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                console.log(`Could not delete ${file}`);
            }
        }
    });
    
    process.exit(0);
}