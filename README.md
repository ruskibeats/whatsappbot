<<<<<<< HEAD
# WhatsApp Message Monitor Bot

A WhatsApp bot that monitors messages and provides notifications for important communications.

## Features

- Real-time message monitoring
- Instant notifications for all incoming messages
- Priority alerts for:
  - Messages containing "urgent" or "important"
  - Questions (messages ending with ? or containing question words)
  - Emergency requests
  - Help requests
- Periodic message scanning (every 15 minutes)
- Daily summary at midnight
- Stealth mode operation (no automatic responses)

## Setup

### Prerequisites
- Node.js
- PostgreSQL database
- WhatsApp account

### Installation
```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.template .env
# Edit .env with your settings:
# - OWNER_NUMBER (your WhatsApp number with country code, e.g., 1234567890@c.us)
# - Database credentials
# - Scanning intervals

# Start the bot
node index.js
```

## Configuration

### Environment Variables
```env
# Bot Configuration
OWNER_NUMBER=your-number@c.us    # Your WhatsApp number
DEBUG=true                       # Enable debug logging

# Database Configuration
DB_USER=username
DB_PASSWORD=password
DB_HOST=localhost
DB_NAME=database
DB_PORT=5432

# Scanning Intervals (in minutes)
PERIODIC_SCAN_INTERVAL=15        # How often to scan for messages
MIDNIGHT_SUMMARY_TIME=00:00      # When to send daily summary
```

## Usage

1. Start the bot: `node index.js`
2. Scan the QR code with WhatsApp
3. The bot will notify you of:
   - Every new message received
   - Messages requiring attention (urgent/questions)
   - Periodic scan summaries
   - Daily activity summaries

## Troubleshooting

### Common Issues
- If QR code doesn't scan, delete `.wwebjs_auth/` and try again
- For connection issues, ensure stable internet connection
- Database errors: verify PostgreSQL is running and credentials are correct

### Error Recovery
- The bot automatically attempts to reconnect on disconnection
- Clear cache directories (.wwebjs_cache/, .wwebjs_auth/) for fresh start
- Check logs (bot.log) for detailed error messages

## Security Notes

- Keep your .env file secure
- Don't share QR codes or session data
- Regularly update dependencies
- Monitor logs for unauthorized access attempts
=======
# whatsappbot
>>>>>>> 18cd9a8d6a7987d5c996d339dcdd4c5ef1ecd3d2
