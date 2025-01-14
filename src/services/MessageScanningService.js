class MessageScanningService {
    constructor() {
        try {
            this.messages = new Map();
            this.lastScanTime = Date.now();  // Initialize with current time
            this.scanStats = {
                totalMessages: 0,
                activeChats: new Set(),
                chatActivity: new Map()
            };
            
            // Create required directories
            const fs = require('fs');
            const path = require('path');
            
            const dirs = ['data/summaries', 'data/unread'];
            dirs.forEach(dir => {
                const fullPath = path.join(process.cwd(), dir);
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
            });
        } catch (error) {
            console.error('Failed to initialize MessageScanningService:', error);
            throw error;
        }
    }

    async handleNewMessage(messageData) {
        try {
            if (!messageData || !messageData.chat || !messageData.chat.id) {
                console.error('Invalid message data received:', messageData);
                return false;
            }

            // Store message
            if (!this.messages.has(messageData.chat.id)) {
                this.messages.set(messageData.chat.id, []);
            }
            this.messages.get(messageData.chat.id).push(messageData);

            // Update stats
            this.scanStats.totalMessages++;
            this.scanStats.activeChats.add(messageData.chat.id);
            
            const chatActivity = this.scanStats.chatActivity.get(messageData.chat.id) || 0;
            this.scanStats.chatActivity.set(messageData.chat.id, chatActivity + 1);

            return true;
        } catch (error) {
            console.error('Error handling new message:', error);
            return false;
        }
    }

    async runPeriodicScan() {
        const now = Date.now();
        if (!this.lastScanTime) {
            this.lastScanTime = now;
            return null;
        }

        // Get messages since last scan
        const newMessages = [];
        for (const [chatId, messages] of this.messages) {
            const recentMessages = messages.filter(msg => 
                msg.timestamp * 1000 > this.lastScanTime
            );
            if (recentMessages.length > 0) {
                newMessages.push(...recentMessages);
            }
        }

        this.lastScanTime = now;

        if (newMessages.length === 0) {
            return null;
        }

        return {
            hasNewMessages: true,
            messages: newMessages,
            scanTime: now
        };
    }

    async generateMidnightSummary() {
        const stats = {
            totalMessages: this.scanStats.totalMessages,
            activeChats: this.scanStats.activeChats.size,
            chatActivity: Array.from(this.scanStats.chatActivity.entries()).map(([chatId, count]) => ({
                name: chatId,
                messageCount: count
            })),
            responseStats: {
                avgResponseTime: 0,
                pendingResponses: 0
            }
        };

        // Reset daily stats
        this.scanStats = {
            totalMessages: 0,
            activeChats: new Set(),
            chatActivity: new Map()
        };

        return stats;
    }
}

module.exports = MessageScanningService; 