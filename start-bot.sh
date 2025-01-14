#!/bin/bash

# Function to cleanup and exit
cleanup() {
    if [ -f "bot.pid" ]; then
        echo "Stopping bot process..."
        pkill -F bot.pid
        rm bot.pid
    fi
    
    # Clean up any stale lock files
    if [ -d ".wwebjs_auth" ]; then
        echo "Cleaning up lock files..."
        find .wwebjs_auth -name "SingletonLock" -delete
    fi
    
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Create backup of current session if it exists
if [ -d ".wwebjs_auth" ]; then
    echo "Creating backup of current session..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p backups
    cp -r .wwebjs_auth "backups/.wwebjs_auth_backup_$timestamp"
fi

# Kill any existing bot process
if [ -f "bot.pid" ]; then
    echo "Stopping existing bot process..."
    pkill -F bot.pid
    rm bot.pid
fi

# Clean up any stale lock files
find .wwebjs_auth -name "SingletonLock" -delete

# Ensure auth directory exists
mkdir -p .wwebjs_auth

# Start the bot with debug mode if specified
if [ "$1" == "--debug" ]; then
    echo "Starting bot in debug mode..."
    DEBUG=whatsapp-web* node index.js &
else
    echo "Starting bot..."
    node index.js &
fi

# Save the process ID
echo $! > bot.pid
echo "Bot started! Watch terminal for QR code..."

# Monitor the process
while kill -0 $! 2>/dev/null; do
    sleep 1
done

# If process dies unexpectedly
if [ $? -ne 0 ]; then
    echo "Bot process terminated unexpectedly. Restarting in 5 seconds..."
    sleep 5
    exec $0 $@
fi
