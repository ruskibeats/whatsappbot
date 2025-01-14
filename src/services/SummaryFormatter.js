class SummaryFormatter {
    constructor() {
        try {
            this.formatters = {
                scan: this.formatScanSummary.bind(this),
                daily: this.formatDailySummary.bind(this),
                response: this.formatResponseNeeded.bind(this)
            };
        } catch (error) {
            console.error('Failed to initialize SummaryFormatter:', error);
            throw error;
        }
    }

    formatScanSummary(scanResults) {
        try {
            if (!scanResults) return '📱 No new messages';

            const summary = ['📱 *Message Scan Summary*'];
            
            if (scanResults.newMessages && scanResults.newMessages.length > 0) {
                summary.push(`\nNew Messages: ${scanResults.newMessages.length}`);
                summary.push('Active Chats:');
                const chatGroups = this.groupMessagesByChat(scanResults.newMessages);
                for (const [chatId, messages] of chatGroups) {
                    summary.push(`- ${chatId}: ${messages.length} messages`);
                }
            } else {
                summary.push('\nNo new messages since last scan');
            }

            return summary.join('\n');
        } catch (error) {
            console.error('Error formatting scan summary:', error);
            return '⚠️ Error generating scan summary';
        }
    }

    formatDailySummary(stats) {
        try {
            if (!stats) return '📊 No activity today';

            const summary = ['📊 *Daily Summary*'];
            summary.push(`\nTotal Messages: ${stats.totalMessages || 0}`);
            summary.push(`Active Chats: ${stats.activeChats?.size || 0}`);

            if (stats.chatActivity?.size > 0) {
                summary.push('\nChat Activity:');
                for (const [chatId, count] of stats.chatActivity) {
                    summary.push(`- ${chatId}: ${count} messages`);
                }
            }

            return summary.join('\n');
        } catch (error) {
            console.error('Error formatting daily summary:', error);
            return '⚠️ Error generating daily summary';
        }
    }

    formatResponseNeeded(messageData) {
        try {
            if (!messageData) return '⚠️ Invalid message data';

            const summary = ['❗ *Response Needed*'];
            summary.push(`\nFrom: ${messageData.chat.name}`);
            summary.push(`Message: ${messageData.body}`);
            summary.push(`Time: ${new Date(messageData.timestamp * 1000).toLocaleString()}`);

            return summary.join('\n');
        } catch (error) {
            console.error('Error formatting response needed:', error);
            return '⚠️ Error generating response notification';
        }
    }

    groupMessagesByChat(messages) {
        const groups = new Map();
        for (const msg of messages) {
            if (!groups.has(msg.chat.id)) {
                groups.set(msg.chat.id, []);
            }
            groups.get(msg.chat.id).push(msg);
        }
        return groups;
    }
}

module.exports = SummaryFormatter; 