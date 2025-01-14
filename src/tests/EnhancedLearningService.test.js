const assert = require('assert');
const EnhancedLearningService = require('../services/EnhancedLearningService');

describe('EnhancedLearningService', () => {
    let learningService;

    beforeEach(() => {
        learningService = new EnhancedLearningService();
    });

    describe('User Style Learning', () => {
        it('should learn and track response times', async () => {
            const userId = 'user1';
            const message = { body: 'Test message' };
            const context = { lastMessageTimestamp: Date.now() - 5000 }; // 5 seconds ago

            const style = await learningService.learnUserStyle(userId, message, context);
            assert(style.responseTimes.length > 0);
            assert(style.responseTimes[0].time >= 4900); // Allow for small timing differences
            assert(style.responseTimes[0].time <= 5100);
        });

        it('should detect communication medium', async () => {
            const userId = 'user1';
            const message = { 
                body: 'Test message',
                hasMedia: true,
                type: 'image'
            };
            const context = {};

            const style = await learningService.learnUserStyle(userId, message, context);
            assert.strictEqual(style.mediumPreferences.image, 1);
        });

        it('should analyze language patterns', async () => {
            const userId = 'user1';
            const message = { 
                body: 'This is a formal test message with some complexity. It includes multiple sentences and some analysis points.' 
            };
            const context = {};

            const style = await learningService.learnUserStyle(userId, message, context);
            assert(style.languagePatterns.formality !== undefined);
            assert(style.languagePatterns.sentenceLength > 0);
        });

        it('should apply decay factor to historical data', async () => {
            const userId = 'user1';
            const message = { body: 'Test message' };
            const context = {};

            // First learning
            await learningService.learnUserStyle(userId, message, context);
            
            // Simulate time passing
            const originalUpdate = Date.now;
            Date.now = () => originalUpdate() + 24 * 60 * 60 * 1000; // Add 24 hours
            
            // Second learning
            const style = await learningService.learnUserStyle(userId, message, context);
            
            // Restore Date.now
            Date.now = originalUpdate;
            
            assert(style.lastUpdate > originalUpdate());
        });
    });

    describe('Response Analysis', () => {
        it('should analyze differences between original and edited responses', async () => {
            const original = 'This is a test response.';
            const edited = 'This is a more formal and detailed test response with additional information.';
            const context = { messageId: 'msg1' };

            const differences = await learningService.analyzeResponseDifferences(original, edited, context);
            assert(differences.length > 0);
            assert(differences.formality !== undefined);
            assert(differences.complexity !== undefined);
            assert(differences.structuralChanges !== undefined);
        });

        it('should calculate confidence impact', async () => {
            const original = 'Short test.';
            const edited = 'This is a completely different response.';
            const context = { messageId: 'msg1' };

            const differences = await learningService.analyzeResponseDifferences(original, edited, context);
            const history = learningService.responseHistory.get('msg1');
            
            assert(history.confidenceImpact >= 0);
            assert(history.confidenceImpact <= 1);
        });
    });

    describe('Contact Profile Management', () => {
        it('should create and update contact profiles', async () => {
            const contactId = 'contact1';
            const message = { 
                body: 'Hello! How are you doing today?',
                timestamp: Date.now()
            };
            const context = {
                lastMessageTimestamp: Date.now() - 3000,
                chatHistory: ['Previous message 1', 'Previous message 2']
            };

            const profile = await learningService.updateContactProfile(contactId, message, context);
            assert(profile.communicationPreferences !== undefined);
            assert(profile.styleMetrics !== undefined);
            assert(profile.interactionPatterns !== undefined);
        });

        it('should track communication preferences', async () => {
            const contactId = 'contact1';
            const message = { 
                body: 'Test message',
                hasMedia: true,
                type: 'image',
                timestamp: Date.now()
            };
            const context = {
                lastMessageTimestamp: Date.now() - 3000
            };

            const profile = await learningService.updateContactProfile(contactId, message, context);
            assert(profile.communicationPreferences.mediumPreference !== undefined);
            assert(profile.communicationPreferences.responseLatency !== undefined);
        });
    });

    describe('Response Confidence Scoring', () => {
        it('should calculate confidence scores for responses', () => {
            const response = 'This is a test response';
            const context = {
                messageId: 'msg1',
                userStyle: {
                    formality: 0.7,
                    complexity: 0.5
                },
                chatHistory: ['Previous message'],
                topics: ['test']
            };

            const confidence = learningService.calculateResponseConfidence(response, context);
            assert(confidence.overall >= 0);
            assert(confidence.overall <= 1);
            assert(confidence.factors.styleMatch !== undefined);
            assert(confidence.factors.topicRelevance !== undefined);
        });

        it('should store confidence scores with timestamp', () => {
            const response = 'Test response';
            const context = { messageId: 'msg1' };

            learningService.calculateResponseConfidence(response, context);
            const stored = learningService.confidenceScores.get('msg1');
            
            assert(stored.timestamp !== undefined);
            assert(stored.score !== undefined);
            assert(stored.factors !== undefined);
        });
    });

    describe('Visualization Generation', () => {
        it('should generate visualization data for user styles', async () => {
            const userId = 'user1';
            const message = { body: 'Test message' };
            const context = { lastMessageTimestamp: Date.now() - 1000 };

            await learningService.learnUserStyle(userId, message, context);
            const visualization = learningService.styleVisualizations.get(userId);

            assert(visualization !== undefined);
            assert(visualization.metrics.responseTimes !== undefined);
            assert(visualization.metrics.mediumPreferences !== undefined);
            assert(visualization.metrics.languagePatterns !== undefined);
        });

        it('should format time series data correctly', async () => {
            const userId = 'user1';
            const message = { body: 'Test message' };
            const context = { lastMessageTimestamp: Date.now() - 1000 };

            await learningService.learnUserStyle(userId, message, context);
            const visualization = learningService.styleVisualizations.get(userId);
            const timeSeriesData = visualization.metrics.responseTimes;

            assert(Array.isArray(timeSeriesData));
            if (timeSeriesData.length > 0) {
                assert(timeSeriesData[0].x !== undefined); // timestamp
                assert(timeSeriesData[0].y !== undefined); // value
            }
        });
    });
}); 