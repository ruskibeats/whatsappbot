const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Import services
const MessageScanningService = require('./src/services/MessageScanningService');
const ResponsePredictionService = require('./src/services/ResponsePredictionService');
const RelationshipContextService = require('./src/services/RelationshipContextService');
const SummaryFormatter = require('./src/services/SummaryFormatter');
const ScanningOptimizer = require('./src/services/ScanningOptimizer');

// Initialize services
let scanningService, predictionService, relationshipService, summaryFormatter;
try {
    console.log('Initializing services...');
    
    // Initialize each service with error handling
    try {
        scanningService = new MessageScanningService();
        console.log('Message Scanning Service initialized');
    } catch (error) {
        console.error('Failed to initialize Message Scanning Service:', error);
        throw error;
    }
    
    try {
        predictionService = new ResponsePredictionService();
        console.log('Response Prediction Service initialized');
    } catch (error) {
        console.error('Failed to initialize Response Prediction Service:', error);
        throw error;
    }
    
    try {
        relationshipService = new RelationshipContextService();
        console.log('Relationship Context Service initialized');
    } catch (error) {
        console.error('Failed to initialize Relationship Context Service:', error);
        throw error;
    }

    try {
        summaryFormatter = new SummaryFormatter();
        console.log('Summary Formatter initialized');
    } catch (error) {
        console.error('Failed to initialize Summary Formatter:', error);
        throw error;
    }
    
} catch (error) {
    console.error('Critical error initializing services:', error);
    process.exit(1);
}

// Create WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

// Set up periodic scanning
function setupPeriodicScans() {
    const intervalMs = (process.env.PERIODIC_SCAN_INTERVAL || 15) * 60 * 1000;
    setInterval(async () => {
        try {
            const scanResults = await scanningService.runPeriodicScan();
            if (scanResults && scanResults.hasNewMessages) {
                const summary = summaryFormatter.formatScanSummary(scanResults);
                const ownerChat = await client.getChatById(process.env.OWNER_NUMBER);
                await ownerChat.sendMessage(summary);
            }
        } catch (error) {
            console.error('Error in periodic scan:', error);
        }
    }, intervalMs);
}

// Set up midnight summary
function setupMidnightSummary() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    const msUntilMidnight = midnight - now;
    setTimeout(() => {
        generateAndSendSummary();
        // Schedule subsequent runs
        setInterval(generateAndSendSummary, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}

async function generateAndSendSummary() {
    try {
        const dailyStats = await scanningService.generateMidnightSummary();
        const formattedSummary = summaryFormatter.formatDailySummary(dailyStats);
        const ownerChat = await client.getChatById(process.env.OWNER_NUMBER);
        await ownerChat.sendMessage(formattedSummary);
    } catch (error) {
        console.error('Error generating midnight summary:', error);
    }
}

// Event handlers
client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready!');
    try {
        // Send test message to owner
        const ownerChat = await client.getChatById(process.env.OWNER_NUMBER);
        await ownerChat.sendMessage('🤖 Bot is now active and connected\nOwner number: ' + process.env.OWNER_NUMBER);
        console.log('Sent startup message to owner');
        
        // Setup periodic scans and summaries
        setupPeriodicScans();
        setupMidnightSummary();
    } catch (error) {
        console.error('Error in ready event:', error);
    }
});

client.on('message', async msg => {
    try {
        // Log all incoming messages
        console.log('DEBUG: Incoming message:', {
            from: msg.from,
            body: msg.body,
            fromMe: msg.fromMe,
            hasMedia: msg.hasMedia,
            type: msg.type,
            timestamp: new Date().toISOString()
        });

        // Don't process messages from self
        if (msg.fromMe) {
            console.log('DEBUG: Ignoring message from self');
            return;
        }

        // Process incoming message
        const messageData = {
            id: msg.id._serialized,
            from: msg.from,
            body: msg.body,
            timestamp: msg.timestamp,
            chat: { 
                id: msg.from,
                name: msg.from.split('@')[0]  // Extract number from ID
            }
        };

        // Handle message scanning
        await scanningService.handleNewMessage(messageData);
        console.log('DEBUG: Message tracked by scanning service');

        // Update relationship context
        await relationshipService.updateContext(messageData);
        console.log('DEBUG: Relationship context updated');

        // Always notify owner of new messages
        const ownerChat = await client.getChatById(process.env.OWNER_NUMBER);
        await ownerChat.sendMessage(`📩 New message from ${messageData.chat.name}:\n${messageData.body}`);
        console.log('DEBUG: Owner notified of new message');

        // Check if response is needed
        const shouldRespond = await predictionService.shouldRespond(messageData);
        if (shouldRespond) {
            console.log('DEBUG: Response needed for message');
            const summary = summaryFormatter.formatResponseNeeded(messageData);
            await ownerChat.sendMessage(summary);
            console.log('DEBUG: Response notification sent to owner');
        }
    } catch (error) {
        console.error('Error processing message:', error);
        try {
            const ownerChat = await client.getChatById(process.env.OWNER_NUMBER);
            await ownerChat.sendMessage('⚠️ Error processing message: ' + error.message);
        } catch (notifyError) {
            console.error('Failed to notify owner of error:', notifyError);
        }
    }
});

client.on('disconnected', async (reason) => {
    console.error('Client was disconnected:', reason);
    try {
        await client.destroy();
        console.log('Client destroyed, attempting to reinitialize...');
        client.initialize();
    } catch (error) {
        console.error('Failed to handle disconnection:', error);
        process.exit(1);
    }
});

// Enhanced error handling
process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    try {
        await client.destroy();
    } catch (destroyError) {
        console.error('Error destroying client:', destroyError);
    }
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    try {
        await client.destroy();
    } catch (destroyError) {
        console.error('Error destroying client:', destroyError);
    }
    process.exit(1);
});

// Start the client
client.initialize();
