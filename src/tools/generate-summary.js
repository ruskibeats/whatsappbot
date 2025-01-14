const { Client } = require('whatsapp-web.js');
const UnreadMessageService = require('../services/UnreadMessageService');
const MessageTracker = require('../core/MessageTracker');
const SentimentAnalyzer = require('../services/SentimentAnalyzer');
const MessageSummaryService = require('../services/MessageSummaryService');

async function generateAndSendSummary(client, ownerNumber) {
    try {
        // Initialize services
        const unreadService = new UnreadMessageService(client);
        const messageTracker = new MessageTracker();
        const sentimentAnalyzer = new SentimentAnalyzer();
        const summaryService = new MessageSummaryService(
            client,
            unreadService,
            messageTracker,
            sentimentAnalyzer
        );

        await unreadService.initialize();
        await summaryService.initialize();

        // Generate summary
        const summary = await summaryService.generateFullSummary();

        if (summary) {
            // Send summary to owner
            const ownerChat = await client.getChatById(ownerNumber);
            if (ownerChat) {
                await ownerChat.sendMessage(summary);
                console.log('Summary sent successfully');
            }
        }

    } catch (error) {
        console.error('Error generating/sending summary:', error);
        throw error;
    }
}

// If running directly (not imported)
if (require.main === module) {
    const client = new Client({
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Get owner number from environment or argument
    const ownerNumber = process.env.OWNER_NUMBER || process.argv[2];
    if (!ownerNumber) {
        console.error('Owner number not provided');
        process.exit(1);
    }

    client.on('ready', async () => {
        console.log('Client is ready, generating summary...');
        try {
            await generateAndSendSummary(client, ownerNumber);
            process.exit(0);
        } catch (error) {
            console.error('Failed to generate summary:', error);
            process.exit(1);
        }
    });

    client.initialize();
}

module.exports = generateAndSendSummary;
