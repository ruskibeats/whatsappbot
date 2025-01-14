/**
 * Service for managing relationship-aware response modifications
 */
class RelationshipContextService {
    constructor() {
        this.relationships = new Map();
    }

    async updateContext(messageData) {
        if (!this.relationships.has(messageData.from)) {
            this.relationships.set(messageData.from, {
                messageCount: 0,
                lastMessage: null,
                firstSeen: Date.now()
            });
        }

        const context = this.relationships.get(messageData.from);
        context.messageCount++;
        context.lastMessage = {
            timestamp: messageData.timestamp,
            body: messageData.body
        };

        return true;
    }

    getContext(chatId) {
        return this.relationships.get(chatId) || null;
    }
}

module.exports = RelationshipContextService;
