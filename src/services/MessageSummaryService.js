const fs = require('fs').promises;
const path = require('path');

class MessageSummaryService {
    constructor(client, unreadService, messageTracker, sentimentAnalyzer) {
        this.client = client;
        this.unreadService = unreadService;
        this.messageTracker = messageTracker;
        this.sentimentAnalyzer = sentimentAnalyzer;
        this.storageDir = path.join(process.cwd(), 'data', 'summaries');
    }

    async initialize() {
        await fs.mkdir(this.storageDir, { recursive: true });
        console.log('MessageSummaryService initialized');
        return true;
    }

    async generateContactSummary(contact) {
        // Get unread messages for this contact
        const unreadMessages = await this.unreadService.getChatUnread(contact.id._serialized);
        
        // Get tracked messages for sentiment and priority analysis
        const trackedMessages = this.messageTracker.messages.get(contact.id._serialized) || [];
        
        // Get the last message
        const lastMessage = unreadMessages[unreadMessages.length - 1] || trackedMessages[trackedMessages.length - 1];
        
        if (!lastMessage) return null;

        // Analyze message patterns
        const messagePatterns = await this._analyzeMessagePatterns(trackedMessages);
        
        // Calculate overall sentiment
        const sentiments = trackedMessages.map(msg => 
            this.sentimentAnalyzer.analyzeSentiment(msg.content || msg.body)
        );
        const overallSentiment = this._calculateOverallSentiment(sentiments);

        // Determine if conversation needs action
        const actionNeeded = await this._determineActionNeeded(
            unreadMessages,
            trackedMessages,
            messagePatterns
        );

        // Generate suggested response if needed
        const suggestedResponse = actionNeeded ? 
            await this._generateSuggestedResponse(lastMessage, messagePatterns) : 
            null;

        return {
            contactName: contact.name || contact.id.user,
            lastMessageDate: new Date(lastMessage.timestamp * 1000).toISOString(),
            sentiment: overallSentiment,
            actionNeeded: actionNeeded,
            suggestedResponse: suggestedResponse,
            unreadCount: unreadMessages.length,
            conversationState: this._determineConversationState(messagePatterns)
        };
    }

    _calculateOverallSentiment(sentiments) {
        const sentimentCounts = sentiments.reduce((acc, sentiment) => {
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(sentimentCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    async _analyzeMessagePatterns(messages) {
        if (!messages.length) return null;

        const timeGaps = [];
        const responseTimes = [];
        let lastMessage = null;

        for (const message of messages) {
            if (lastMessage) {
                const gap = message.timestamp - lastMessage.timestamp;
                timeGaps.push(gap);

                if (message.fromMe !== lastMessage.fromMe) {
                    responseTimes.push(gap);
                }
            }
            lastMessage = message;
        }

        return {
            averageGap: timeGaps.length ? 
                timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length : 0,
            averageResponseTime: responseTimes.length ? 
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
            messageFrequency: messages.length / 
                ((messages[messages.length - 1].timestamp - messages[0].timestamp) / (24 * 60 * 60)),
            lastMessageFromMe: lastMessage?.fromMe || false
        };
    }

    async _determineActionNeeded(unreadMessages, trackedMessages, patterns) {
        if (unreadMessages.length === 0) return false;

        const lastMessage = unreadMessages[unreadMessages.length - 1];
        const priority = await this.messageTracker.getPriority(lastMessage);
        const triggers = this.messageTracker.checkTriggers(lastMessage.body);

        // Check if message is explicitly urgent or high priority
        if (priority === 'high' || triggers.includes('urgent')) {
            return true;
        }

        // Check if it's a question or requires action
        if (lastMessage.body.includes('?') || triggers.includes('action_required')) {
            return true;
        }

        // Check conversation patterns
        if (patterns) {
            // If we typically respond quickly but haven't yet
            const currentGap = Date.now()/1000 - lastMessage.timestamp;
            if (currentGap > patterns.averageResponseTime * 2) {
                return true;
            }

            // If conversation is usually frequent but has stalled
            if (patterns.messageFrequency > 1 && currentGap > 24 * 60 * 60) {
                return true;
            }
        }

        return false;
    }

    _determineConversationState(patterns) {
        if (!patterns) return 'unknown';

        const currentGap = Date.now()/1000 - patterns.lastTimestamp;

        if (currentGap < patterns.averageGap * 1.5) {
            return 'active';
        } else if (currentGap > patterns.averageGap * 5) {
            return 'ended';
        } else {
            return 'stalled';
        }
    }

    async _generateSuggestedResponse(lastMessage, patterns) {
        const priority = await this.messageTracker.getPriority(lastMessage);
        const triggers = this.messageTracker.checkTriggers(lastMessage.body);

        if (priority === 'high' || triggers.includes('urgent')) {
            return 'Urgent response needed';
        }

        if (triggers.includes('action_required')) {
            return 'Action/response required';
        }

        if (patterns && patterns.messageFrequency > 1) {
            return 'Consider maintaining conversation momentum';
        }

        return 'Response optional based on content';
    }

    async generateFullSummary() {
        const chats = await this.client.getChats();
        const summaries = [];

        for (const chat of chats) {
            if (chat.isGroup) continue; // Skip group chats

            const contact = await chat.getContact();
            const summary = await this.generateContactSummary(contact);
            
            if (summary) {
                summaries.push(summary);
            }
        }

        // Sort by action needed first, then unread count
        summaries.sort((a, b) => {
            if (a.actionNeeded !== b.actionNeeded) {
                return b.actionNeeded ? 1 : -1;
            }
            return b.unreadCount - a.unreadCount;
        });

        return this._formatSummary(summaries);
    }

    _formatSummary(summaries) {
        let output = '📱 *WhatsApp Message Summary*\n\n';

        for (const summary of summaries) {
            if (!summary.unreadCount && summary.conversationState === 'ended') continue;

            output += `*${summary.contactName}*\n`;
            output += `Last message: ${new Date(summary.lastMessageDate).toLocaleString()}\n`;
            output += `Sentiment: ${summary.sentiment}\n`;
            
            const action = summary.actionNeeded ? 
                'Action needed: ' + summary.suggestedResponse :
                `No action needed - conversation ${summary.conversationState}`;
            
            output += `Status: ${action}\n\n`;
        }

        return output;
    }
}

module.exports = MessageSummaryService;
