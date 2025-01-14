class ScanningOptimizer {
    constructor() {
        this.chatPatterns = new Map();
        this.defaultInterval = 15 * 60 * 1000; // 15 minutes
        this.minInterval = 5 * 60 * 1000;      // 5 minutes
        this.maxInterval = 60 * 60 * 1000;     // 1 hour
    }

    updatePattern(chatId, messageTimestamp) {
        if (!this.chatPatterns.has(chatId)) {
            this.chatPatterns.set(chatId, {
                lastMessage: messageTimestamp,
                messageCount: 0,
                averageInterval: this.defaultInterval
            });
            return;
        }

        const pattern = this.chatPatterns.get(chatId);
        const interval = messageTimestamp - pattern.lastMessage;
        
        // Update moving average
        pattern.averageInterval = (pattern.averageInterval * pattern.messageCount + interval) / (pattern.messageCount + 1);
        pattern.messageCount++;
        pattern.lastMessage = messageTimestamp;
    }

    getScanInterval(chatId) {
        const pattern = this.chatPatterns.get(chatId);
        if (!pattern) return this.defaultInterval;

        // Adjust interval based on message frequency
        const adjustedInterval = pattern.averageInterval * 0.75; // Scan before next expected message
        
        // Clamp to min/max bounds
        return Math.max(this.minInterval, Math.min(adjustedInterval, this.maxInterval));
    }
}

module.exports = ScanningOptimizer; 