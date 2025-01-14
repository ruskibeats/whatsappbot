class ResponsePredictionService {
    constructor() {
        this.importantPatterns = [
            /urgent/i,
            /important/i,
            /emergency/i,
            /asap/i,
            /help.*needed/i,
            /please.*help/i,
            /\?$/,  // Questions
            /when|what|how|why|who/i  // Question words
        ];
    }

    async shouldRespond(messageData) {
        // Check for important patterns
        if (this.importantPatterns.some(pattern => pattern.test(messageData.body))) {
            return true;
        }

        // Don't respond to system messages or notifications
        if (messageData.body.startsWith('🤖') || 
            messageData.body.startsWith('📱') || 
            messageData.body.startsWith('📊')) {
            return false;
        }

        return false;
    }
}

module.exports = ResponsePredictionService; 