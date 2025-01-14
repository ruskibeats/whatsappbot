const DatabaseService = require('./DatabaseService');

class MessageHandler {
    constructor() {
        this.databaseService = new DatabaseService();
    }

    async handleMessage(messageData) {
        console.log('Handling message...');
        try {
            const enrichedMessage = await this.databaseService.enrichMessage(messageData);
            console.log('Enriched message:', enrichedMessage);

            // Further processing of the enriched message
            // ...

            return enrichedMessage;
        } catch (error) {
            console.error('Error handling message:', error);
            throw error;
        }
    }
}

module.exports = MessageHandler;
