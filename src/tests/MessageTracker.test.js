const MessageTracker = require('../core/MessageTracker');
const assert = require('assert');

describe('MessageTracker', () => {
    let tracker;

    beforeEach(() => {
        tracker = new MessageTracker();
    });

    describe('Message Categorization', () => {
        it('should correctly categorize urgent messages', async () => {
            const message = {
                body: 'URGENT: Please respond immediately to this critical issue!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert.strictEqual(result.category, 'urgent');
        });

        it('should correctly categorize work messages', async () => {
            const message = {
                body: 'Meeting scheduled for tomorrow at 2 PM to discuss project updates',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert.strictEqual(result.category, 'work');
        });

        it('should correctly categorize personal messages', async () => {
            const message = {
                body: 'Hey! How are you doing? Let\'s catch up soon!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert.strictEqual(result.category, 'personal');
        });
    });

    describe('Priority Scoring', () => {
        it('should assign high priority to urgent messages', async () => {
            const message = {
                body: 'URGENT: Critical system failure! Need immediate attention!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.priority >= 7);
        });

        it('should assign appropriate priority based on time sensitivity', async () => {
            const message = {
                body: 'Meeting tomorrow morning to discuss project timeline',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.priority >= 3);
        });

        it('should consider multiple factors in priority calculation', async () => {
            const message = {
                body: 'URGENT: Client meeting in 1 hour! Need presentation ASAP!!!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.priority >= 8);
            assert(result.urgency.isUrgent);
        });
    });

    describe('Sentiment Analysis', () => {
        it('should detect positive sentiment', async () => {
            const message = {
                body: 'Great job on the project! Really impressed with the results!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.sentiment.score > 0);
            assert.strictEqual(result.sentiment.polarity, 'positive');
        });

        it('should detect negative sentiment', async () => {
            const message = {
                body: 'Very disappointed with the delay. This is unacceptable.',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.sentiment.score < 0);
            assert.strictEqual(result.sentiment.polarity, 'negative');
        });

        it('should calculate emotional intensity', async () => {
            const message = {
                body: 'ABSOLUTELY AMAZING!!! This is the BEST thing ever!!!',
                from: 'user1'
            };
            
            const result = await tracker.trackMessage(message, 'user1');
            assert(result.sentiment.intensity > 0.5);
        });
    });

    describe('Message Retrieval', () => {
        it('should retrieve messages by category', async () => {
            await tracker.trackMessage({ body: 'URGENT: Critical issue!', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Meeting tomorrow', from: 'user1' }, 'user1');
            
            const urgentMessages = tracker.getMessagesByCategory('urgent', 'user1');
            assert(urgentMessages.length > 0);
            assert(urgentMessages[0].category === 'urgent');
        });

        it('should retrieve messages by priority', async () => {
            await tracker.trackMessage({ body: 'URGENT: Critical issue!', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Regular update', from: 'user1' }, 'user1');
            
            const highPriorityMessages = tracker.getMessagesByPriority(7, 'user1');
            assert(highPriorityMessages.length > 0);
            assert(highPriorityMessages[0].priority >= 7);
        });
    });

    describe('Summary Generation', () => {
        it('should generate daily summary', async () => {
            await tracker.trackMessage({ body: 'URGENT: Critical issue!', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Meeting tomorrow', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Great work!', from: 'user1' }, 'user1');
            
            const summary = await tracker.generateSummary('daily', 'user1');
            
            assert(summary.totalMessages === 3);
            assert(summary.categories.length > 0);
            assert(summary.averageSentiment !== undefined);
        });

        it('should track urgent messages in summary', async () => {
            await tracker.trackMessage({ body: 'URGENT: Critical issue!', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Another urgent matter!!!', from: 'user1' }, 'user1');
            
            const summary = await tracker.generateSummary('daily', 'user1');
            
            assert(summary.urgentMessages.length > 0);
            assert(summary.urgentMessages[0].priority >= 8);
        });

        it('should calculate category statistics', async () => {
            await tracker.trackMessage({ body: 'URGENT: Critical issue!', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'Meeting tomorrow', from: 'user1' }, 'user1');
            await tracker.trackMessage({ body: 'How are you?', from: 'user1' }, 'user1');
            
            const summary = await tracker.generateSummary('daily', 'user1');
            
            assert(summary.categories.some(cat => cat.category === 'urgent'));
            assert(summary.categories.some(cat => cat.category === 'work'));
            assert(summary.categories.some(cat => cat.category === 'personal'));
        });
    });
}); 