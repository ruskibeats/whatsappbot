const natural = require('natural');
const fs = require('fs').promises;
const path = require('path');
const ResponseTemplateService = require('../services/ResponseTemplateService');
const ResponsePatternService = require('../services/ResponsePatternService');
const ToneAnalysisService = require('../services/ToneAnalysisService');
const RelationshipContextService = require('../services/RelationshipContextService');

class SmartResponseGenerator {
    constructor(config) {
        this.intentClassifier = config.intentClassifier;
        this.messageTracker = config.messageTracker;
        this.relationshipTracker = config.relationshipTracker;
        this.sentimentAnalyzer = config.sentimentAnalyzer;
        this.aiGenerator = config.aiGenerator;
        this.roleplayService = config.roleplayService;

        this.patternService = new ResponsePatternService();
        this.toneService = new ToneAnalysisService();
        this.relationshipService = new RelationshipContextService();
    }

    async generateResponse(message, conversationHistory) {
        if (message.fromMe) {
            return null;
        }

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        // Build response context with historical data
        const context = await this._buildResponseContext(message, conversationHistory, twoWeeksAgo);
        
        // Check for missing critical data
        if (context.missingData && context.missingData.length > 0) {
            console.log(`Critical data missing for ${message.from}. Response may be limited.`);
            await this._storeQuestionsForContact(message.from, context.missingData);
            
            // Add note about missing context to response
            const baseResponse = await this._generateBaseResponse(message, context);
            return {
                text: baseResponse + "\n\nNote: Some context is missing. I'll ask for clarification to improve future responses.",
                timing: await this._suggestResponseTiming(context),
                priority: await this._calculateResponsePriority(context),
                context,
                missingData: context.missingData
            };
        }

        // Normal response generation
        if (this.roleplayService && await this.roleplayService.isRoleplayEnabled(message.from)) {
            const roleplayResponse = await this.roleplayService.generateRoleplayResponse(message, context);
            if (roleplayResponse) {
                return {
                    text: roleplayResponse,
                    source: 'roleplay',
                    model: (await this.roleplayService.getRoleplayConfig(message.from))?.model
                };
            }
        }

        if (!message.body.startsWith('!')) {
            return null;
        }

        const aiResponse = await this._generateAIResponse(message, context);
        const timing = await this._suggestResponseTiming(context);
        const priority = await this._calculateResponsePriority(context);

        return {
            text: aiResponse,
            timing,
            priority,
            context,
            source: 'ai',
            model: 'default'
        };
    }

    async _buildResponseContext(message, conversationHistory, startDate) {
        const historicalMessages = await this.messageTracker.getMessagesSince(message.from, startDate);
        
        // Get enriched contact data
        let enrichedData = {};
        try {
            const enrichedPath = path.join(process.cwd(), 'data', 'enriched', `${message.from}_enriched.json`);
            enrichedData = JSON.parse(await fs.readFile(enrichedPath, 'utf8'));
        } catch (error) {
            console.log('No enriched data found for contact');
        }

        const [intent, conversationContext, patterns, relationship, sentiment] = await Promise.all([
            this.intentClassifier.classifyIntent(message),
            this.intentClassifier.analyzeConversationContext(conversationHistory),
            this.patternService.analyzePatterns(conversationHistory),
            this.relationshipTracker.getRelationshipSummary(message.from),
            this.sentimentAnalyzer.analyzeSentiment(message.body)
        ]);

        // Analyze historical context
        const historicalAnalysis = await this._analyzeHistoricalContext(historicalMessages);

        // Check for missing critical data
        const missingData = await this._checkMissingCriticalData(message.from, {
            intent,
            conversationContext,
            patterns,
            relationship,
            sentiment,
            historicalAnalysis,
            enrichedData
        });

        // Determine response priority based on enriched data
        const priority = this._determineResponsePriority(enrichedData, intent);

        // Determine response timing based on preferences
        const timing = this._determineResponseTiming(enrichedData, intent);

        return {
            intent,
            conversationContext,
            patterns,
            relationship,
            sentiment,
            historicalAnalysis,
            enrichedData,
            missingData,
            priority,
            timing
        };
    }

    async _analyzeHistoricalContext(messages) {
        if (!messages || messages.length === 0) {
            return {
                topics: [],
                sentiment: 'neutral',
                patterns: {},
                summary: 'No historical context available'
            };
        }

        // Extract topics using natural's TfIdf
        const tfidf = new natural.TfIdf();
        messages.forEach(msg => {
            if (msg.body) {
                tfidf.addDocument(msg.body);
            }
        });

        const topics = [];
        tfidf.listTerms(0).slice(0, 5).forEach(item => {
            topics.push(item.term);
        });

        // Analyze sentiment trends
        const sentiments = messages.map(msg => 
            this.sentimentAnalyzer.analyzeSentiment(msg.body)
        );
        const overallSentiment = this._calculateOverallSentiment(sentiments);

        // Analyze interaction patterns
        const patterns = {
            responseTime: this._calculateAverageResponseTime(messages),
            messageFrequency: messages.length / 
                ((messages[messages.length - 1].timestamp - messages[0].timestamp) / (24 * 60 * 60)),
            timeOfDay: this._analyzeTimeOfDay(messages)
        };

        return {
            topics,
            sentiment: overallSentiment,
            patterns,
            summary: this._generateContextSummary(topics, overallSentiment, patterns)
        };
    }

    _calculateOverallSentiment(sentiments) {
        const counts = sentiments.reduce((acc, sentiment) => {
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    _calculateAverageResponseTime(messages) {
        const responseTimes = [];
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].fromMe !== messages[i-1].fromMe) {
                responseTimes.push(messages[i].timestamp - messages[i-1].timestamp);
            }
        }
        return responseTimes.length > 0 ? 
            Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 
            null;
    }

    _analyzeTimeOfDay(messages) {
        const hourCounts = new Array(24).fill(0);
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp * 1000).getHours();
            hourCounts[hour]++;
        });
        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
        return {
            peakHour,
            distribution: hourCounts
        };
    }

    _generateContextSummary(topics, sentiment, patterns) {
        return `Historical context shows ${topics.length > 0 ? 
            `discussion of ${topics.join(', ')}` : 
            'no consistent topics'} with ${sentiment} sentiment overall. ${
            patterns.responseTime ? 
            `Average response time is ${Math.round(patterns.responseTime / 60)} minutes` : 
            'No consistent response pattern'} and peak activity at ${patterns.timeOfDay.peakHour}:00.`;
    }

    _determineResponsePriority(enrichedData, intent) {
        if (!enrichedData?.preferences) {
            return this._calculateResponsePriority(intent);
        }

        // Use enriched preferences
        const priority = {
            level: enrichedData.preferences.priority.toLowerCase(),
            reason: []
        };

        // Add urgency if needed
        if (intent?.features?.isUrgent) {
            priority.level = 'high';
            priority.reason.push('Urgent message');
        }

        // Add relationship context
        if (enrichedData.relationship?.type === 'Professional' || 
            enrichedData.relationship?.type === 'Both Professional and Personal') {
            priority.reason.push('Professional contact');
        }

        // Add support pattern context
        if (enrichedData.context?.supportPattern) {
            priority.reason.push('Regular support pattern');
        }

        return priority;
    }

    _determineResponseTiming(enrichedData, intent) {
        if (!enrichedData?.preferences) {
            return this._suggestResponseTiming(intent);
        }

        const timing = {
            responseTime: enrichedData.preferences.responseTime,
            shouldRespondNow: false,
            reason: []
        };

        // Check if immediate response needed
        if (enrichedData.preferences.responseTime === 'ASAP' || 
            intent?.features?.isUrgent || 
            enrichedData.preferences.priority === 'High') {
            timing.shouldRespondNow = true;
            timing.reason.push('High priority or urgent message');
        }

        // Add context from relationship
        if (enrichedData.relationship?.frequency === 'Daily') {
            timing.reason.push('Daily interaction pattern');
        }

        return timing;
    }

    async _storeQuestionsForContact(contactId, questions) {
        const enrichedDir = path.join(process.cwd(), 'data', 'enriched');
        await fs.mkdir(enrichedDir, { recursive: true });
        
        const filename = path.join(enrichedDir, `${contactId}_questions.json`);
        await fs.writeFile(filename, JSON.stringify({
            contactId,
            timestamp: Date.now(),
            questions: questions.sort((a, b) => 
                a.importance === 'high' ? -1 : b.importance === 'high' ? 1 : 0
            )
        }, null, 2));
    }

    _analyzeMessageStyle(context) {
        const formalIndicators = ['please', 'thank you', 'would you', 'could you'];
        const casualIndicators = ['hey', 'hi', 'thanks', 'cool'];
        
        let formalCount = 0;
        let casualCount = 0;

        const messageText = context.conversationContext?.recentMessages?.join(' ').toLowerCase() || '';
        
        formalIndicators.forEach(indicator => {
            if (messageText.includes(indicator)) formalCount++;
        });
        
        casualIndicators.forEach(indicator => {
            if (messageText.includes(indicator)) casualCount++;
        });

        return {
            formality: formalCount > casualCount ? 'formal' : 
                      casualCount > formalCount ? 'casual' : 'unclear',
            confidence: Math.abs(formalCount - casualCount) / (formalCount + casualCount || 1)
        };
    }

    async _checkMissingCriticalData(contactId, context) {
        const missingData = [];

        // Check relationship context
        if (!context.relationship || !context.relationship.status) {
            missingData.push({
                type: 'relationship_type',
                question: 'How would you categorize your relationship with this contact? (Professional/Personal/Both)',
                importance: 'high'
            });
        }

        // Check response priority for urgent messages
        if (context.intent?.features?.isUrgent && (!context.relationship?.preferences?.urgentResponse)) {
            missingData.push({
                type: 'urgent_preference',
                question: 'How quickly should I respond to urgent messages from this contact?',
                importance: 'high'
            });
        }

        // Check communication style preferences
        if (!context.relationship?.preferences?.communicationStyle) {
            const messageStyle = this._analyzeMessageStyle(context);
            if (messageStyle.formality === 'unclear') {
                missingData.push({
                    type: 'communication_style',
                    question: 'Should I maintain formal or casual communication with this contact?',
                    importance: 'medium'
                });
            }
        }

        // Check personal context if needed
        if (context.intent?.features?.isPersonal && (!context.relationship?.context?.personal)) {
            missingData.push({
                type: 'personal_context',
                question: 'How should I handle personal topics with this contact?',
                importance: 'medium'
            });
        }

        return missingData;
    }

    _calculateResponsePriority(intent) {
        return {
            level: intent?.features?.isUrgent ? 'high' : 'normal',
            reason: intent?.features?.isUrgent ? ['Urgent message'] : []
        };
    }

    _suggestResponseTiming(intent) {
        return {
            responseTime: intent?.features?.isUrgent ? 'ASAP' : 'When convenient',
            shouldRespondNow: intent?.features?.isUrgent,
            reason: intent?.features?.isUrgent ? ['Urgent message'] : []
        };
    }

    async _generateBaseResponse(message, context) {
        return `I'll respond when appropriate based on our conversation history and relationship context.`;
    }

    async _generateAIResponse(message, context) {
        return await this.aiGenerator.generateResponse(message.body, {
            intent: context.intent,
            sentiment: context.sentiment,
            relationship: context.relationship,
            history: context.conversationContext
        });
    }
}

module.exports = SmartResponseGenerator;
