const { execSync } = require('child_process');

try {
    execSync('npx kill-port 3000', { stdio: 'inherit' });
    console.log('Dev server stopped');
} catch (error) {
    console.log('No server running on port 3000');
}

process.exit(0);