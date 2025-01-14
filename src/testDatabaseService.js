const DatabaseService = require('./services/DatabaseService');

async function testDatabaseService() {
    const dbService = new DatabaseService();

    try {
        console.log('Starting testDatabaseService...');

        // Test enrichMessage method
        const messageData = {
            chatId: '1234567890',
            content: 'Test message',
            timestamp: new Date().toISOString()
        };

        console.log('Testing enrichMessage method...');
        const enrichedMessage = await dbService.enrichMessage(messageData);
        console.log('Enriched message:', enrichedMessage);

        // Test getChatMetadata method
        console.log('Testing getChatMetadata method...');
        const chatMetadata = await dbService.getChatMetadata(messageData.chatId);
        console.log('Chat metadata:', chatMetadata);

        // Test getRecentMessages method
        console.log('Testing getRecentMessages method...');
        const recentMessages = await dbService.getRecentMessages(messageData.chatId);
        console.log('Recent messages:', recentMessages);

        // Test updateChatMetadata method
        console.log('Testing updateChatMetadata method...');
        await dbService.updateChatMetadata(messageData.chatId, new Date().toISOString());
        console.log('Chat metadata updated');

        // Test insertMessage method
        console.log('Testing insertMessage method...');
        await dbService.insertMessage(messageData);
        console.log('Message inserted');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Close the database connection pool
        console.log('Closing database connection pool...');
        await dbService.pool.end();
        console.log('Database connection pool closed.');
    }
}

testDatabaseService();
