const MessageHandler = require('./src/services/MessageHandler');

async function main() {
    const messageHandler = new MessageHandler();

    const messageData = {
        chatId: '1234567890',
        content: 'Test message',
        timestamp: new Date().toISOString(),
    };

    try {
        const enrichedMessage = await messageHandler.handleMessage(messageData);
        console.log('Message handled successfully:', enrichedMessage);
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

main();
