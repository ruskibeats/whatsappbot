const assert = require('assert');
const AdaptiveResponseGenerator = require('../services/AdaptiveResponseGenerator');

describe('AdaptiveResponseGenerator', () => {
    let generator;

    beforeEach(() => {
        process.env.OPENAI_API_KEY = 'test-key';
        generator = new AdaptiveResponseGenerator();
        
        // Mock OpenAI API calls
        generator.openai = {
            chat: {
                completions: {
                    create: async () => ({
                        choices: [{
                            message: {
                                content: 'This is a mocked response for testing purposes.'
                            }
                        }]
                    })
                }
            }
        };
    });

    describe('Style Analysis', () => {
        it('should correctly analyze message style', async () => {
            const message = 'Hello! How are you doing today? 😊';
            const context = {
                lastMessageTimestamp: Date.now() - 5000,
                chatHistory: ['Previous message']
            };
            const userId = 'user1';

            const result = await generator.generateResponse(message, context, userId);
            assert(result.style !== undefined);
            assert(result.style.languagePatterns !== undefined);
            assert(result.confidence !== undefined);
        });

        it('should calculate correct formality scores', async () => {
            const formalMessage = 'Dear Sir, I hope this message finds you well.';
            const casualMessage = 'Hey! What\'s up? 😎';
            const context = { chatHistory: [] };
            const userId = 'user1';

            const formalResult = await generator.generateResponse(formalMessage, context, userId);
            const casualResult = await generator.generateResponse(casualMessage, context, userId);

            assert(formalResult.style.languagePatterns.formality > 
                  casualResult.style.languagePatterns.formality);
        });
    });

    describe('Response Adaptation', () => {
        it('should adapt response based on confidence', async () => {
            const message = 'Test message';
            const context = {
                userStyle: {
                    formality: 0.8,
                    complexity: 0.6
                }
            };
            const userId = 'user1';

            const result = await generator.generateResponse(message, context, userId);
            assert(result.response !== undefined);
            assert(result.confidence.overall >= 0);
            assert(result.confidence.overall <= 1);
        });

        it('should handle response feedback', async () => {
            const original = 'This is a test response.';
            const edited = 'This is a more formal and detailed test response.';
            const context = {
                messageId: 'msg1',
                userId: 'user1'
            };

            const differences = await generator.handleResponseFeedback(original, edited, context);
            assert(differences.formality !== undefined);
            assert(differences.complexity !== undefined);
            assert(differences.structuralChanges !== undefined);
        });
    });

    describe('Contact Profile Management', () => {
        it('should update contact profiles during response generation', async () => {
            const message = 'Test message';
            const context = {
                contactId: 'contact1',
                lastMessageTimestamp: Date.now() - 3000
            };
            const userId = 'user1';

            const result = await generator.generateResponse(message, context, userId);
            assert(result.style !== undefined);
            assert(result.confidence !== undefined);
        });

        it('should adapt responses based on contact profile', async () => {
            const message = 'Test message';
            const context = {
                contactId: 'contact1',
                userStyle: {
                    formality: 0.7,
                    complexity: 0.5
                }
            };
            const userId = 'user1';

            // First message to build profile
            await generator.generateResponse(message, context, userId);

            // Second message should adapt based on profile
            const result = await generator.generateResponse(message, context, userId);
            assert(result.confidence.factors.styleMatch !== undefined);
        });
    });

    describe('Learning System Integration', () => {
        it('should learn from user interactions', async () => {
            const userId = 'user1';
            const messages = [
                'Hello! How are you?',
                'Can you help me with something?',
                'Thank you for your assistance.'
            ];
            const context = { chatHistory: [] };

            for (const message of messages) {
                await generator.generateResponse(message, context, userId);
            }

            // Check if style patterns were learned
            const style = generator.stylePatterns.get(userId);
            assert(style !== undefined);
            assert(style.formality !== undefined);
        });

        it('should apply decay to historical data', async () => {
            const userId = 'user1';
            const message = 'Test message';
            const context = {};

            // First response
            await generator.generateResponse(message, context, userId);
            const initialStyle = generator.stylePatterns.get(userId);

            // Simulate time passing
            const originalNow = Date.now;
            Date.now = () => originalNow() + 24 * 60 * 60 * 1000; // Add 24 hours

            // Second response
            await generator.generateResponse(message, context, userId);
            const updatedStyle = generator.stylePatterns.get(userId);

            // Restore Date.now
            Date.now = originalNow;

            assert(updatedStyle.lastUpdate > initialStyle.lastUpdate);
        });
    });

    describe('Confidence Scoring', () => {
        it('should calculate confidence scores for responses', async () => {
            const message = 'Test message';
            const context = {
                userStyle: {
                    formality: 0.7,
                    complexity: 0.5
                },
                chatHistory: ['Previous message']
            };
            const userId = 'user1';

            const result = await generator.generateResponse(message, context, userId);
            assert(result.confidence.overall >= 0);
            assert(result.confidence.overall <= 1);
            assert(result.confidence.factors.styleMatch !== undefined);
            assert(result.confidence.factors.topicRelevance !== undefined);
        });

        it('should add hedging for low confidence responses', async () => {
            const message = 'Test message';
            const context = {
                userStyle: {
                    formality: 0.7,
                    complexity: 0.5
                }
            };
            const userId = 'user1';

            // Mock confidence calculation to return low score
            const originalCalculate = generator.learningService.calculateResponseConfidence;
            generator.learningService.calculateResponseConfidence = () => ({
                overall: 0.3,
                factors: {}
            });

            const result = await generator.generateResponse(message, context, userId);
            
            // Restore original method
            generator.learningService.calculateResponseConfidence = originalCalculate;

            const hedges = [
                'I think',
                'It seems that',
                'From what I understand',
                'Based on the context'
            ];

            assert(hedges.some(hedge => result.response.toLowerCase().startsWith(hedge.toLowerCase())));
        });
    });
}); 