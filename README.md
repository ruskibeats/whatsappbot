# WhatsApp Message Monitor Bot

A WhatsApp bot that monitors messages and provides notifications for important communications, with advanced analytics and sentiment analysis capabilities.

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
- Relationship context tracking
- Response prediction
- Message scanning optimization
- Advanced sentiment analysis
- Emotional tone detection
- Chat analytics and engagement metrics
- Historical message analysis
- Peak hours and quiet hours tracking
- Media message handling
- Group chat analytics

## Services

The bot is built with a modular service architecture:

- **MessageScanningService**: Handles message tracking and periodic scans
- **ResponsePredictionService**: Analyzes messages to determine if a response is needed
- **RelationshipContextService**: Tracks and updates conversation context
- **SummaryFormatter**: Formats notifications and summaries
- **ScanningOptimizer**: Optimizes message scanning intervals
- **SentimentAnalyzer**: Analyzes message sentiment and emotional tone
- **DatabaseMessageCollector**: Collects and stores historical messages
- **ChatHistoryAnalyzer**: Analyzes chat patterns and engagement
- **BulkAnalyzer**: Processes multiple messages for trend analysis
- **AIAnalyzer**: Provides AI-powered message analysis

## Database Schema

The bot uses a comprehensive PostgreSQL database schema with the following key tables:

- **chats**: Basic chat information
- **messages**: Message content and metadata
- **sentiment_analysis**: Message sentiment scores
- **emotional_analysis**: Emotional tone analysis
- **topic_analysis**: Conversation topic tracking
- **chat_analytics**: Chat engagement metrics
- **chat_metadata**: Extended chat information
- **media_messages**: Media file tracking
- **chat_llm_analysis**: AI-based chat analysis

## Setup

### Prerequisites
- Node.js
- PostgreSQL database
- WhatsApp account
- Chromium (for headless browser)

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

# Initialize database schema
node src/db/init-db.js

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

# Optional AI Configuration
OPENAI_API_KEY=your-key-here    # For enhanced analysis (optional)
```

## Usage

1. Start the bot: `node index.js`
2. Scan the QR code with WhatsApp
3. The bot will:
   - Collect and analyze historical messages
   - Monitor new messages in real-time
   - Generate chat analytics and insights
   - Track sentiment and emotional trends
   - Provide engagement metrics
   - Store media messages
   - Generate periodic reports

### Analytics Features

The bot provides comprehensive analytics:
- Message volume and patterns
- Active participant tracking
- Response rates and times
- Peak activity hours
- Sentiment trends
- Emotional tone analysis
- Topic clustering
- Engagement scoring
- Media usage statistics

### Data Collection

The bot collects:
- Up to 50 recent messages per chat
- Chat metadata and participant info
- Message sentiment and emotions
- Media file references
- Chat activity patterns
- Response behaviors
- Topic trends

## Error Handling

The bot includes comprehensive error handling:
- Automatic reconnection on disconnection
- Service initialization error handling
- Message processing error notifications
- Database connection retry logic
- Global error handlers for uncaught exceptions
- Owner notifications for critical errors
- Media processing error recovery

## Troubleshooting

### Common Issues
- If QR code doesn't scan, delete `.wwebjs_auth/` and try again
- For connection issues, ensure stable internet connection
- Database errors: verify PostgreSQL is running and credentials are correct
- Chrome/Puppeteer issues: ensure Chromium is installed correctly

### Error Recovery
- The bot automatically attempts to reconnect on disconnection
- Clear cache directories (.wwebjs_cache/, .wwebjs_auth/) for fresh start
- Check logs for detailed error messages
- Service initialization errors will be reported on startup
- Database connection issues: check credentials and network
- For schema issues: reinitialize using init-db.js

## Security Notes

- Keep your .env file secure
- Don't share QR codes or session data
- Regularly update dependencies
- Monitor logs for unauthorized access attempts
- Ensure database connection uses secure credentials
- Keep your WhatsApp client updated
- Secure storage of collected messages
- Regular security audits
- Access control for analytics data

## Recent Updates

### Version 2.0
- Added comprehensive database schema
- Implemented message collection service
- Enhanced analytics capabilities
- Added sentiment analysis
- Improved error handling
- Added media message support
- Enhanced security features
- Added chat analytics
- Improved performance
- Better logging and monitoring
