const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configure logging
const logFile = fs.createWriteStream('bot.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    logFile.write(logMessage);
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let bot = null;
let shuttingDown = false;

// Start the bot process
function startBot() {
    if (shuttingDown) return;
    
    log('Starting WhatsApp bot...');
    
    bot = spawn('node', ['index.js'], {
        stdio: 'pipe',
        env: process.env
    });

    bot.stdout.on('data', (data) => {
        log(`[BOT] ${data.toString().trim()}`);
    });

    bot.stderr.on('data', (data) => {
        log(`[ERROR] ${data.toString().trim()}`);
    });

    bot.on('close', (code) => {
        log(`Bot process exited with code ${code}`);
        if (!shuttingDown && code !== 0) {
            log('Restarting bot in 10 seconds...');
            setTimeout(startBot, 10000);
        }
    });
}

// Handle process signals
function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    
    log('Shutting down gracefully...');
    if (bot) {
        bot.kill('SIGTERM');
        // Give the bot some time to clean up
        setTimeout(() => {
            if (bot) {
                log('Force killing bot process...');
                bot.kill('SIGKILL');
            }
            process.exit(0);
        }, 5000);
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.message}`);
    log(error.stack);
    shutdown();
});

// Start the bot
startBot(); 