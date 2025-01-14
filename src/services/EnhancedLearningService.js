const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

class EnhancedLearningService {
    constructor() {
        this.userStyles = new Map(); // userId -> style metrics
        this.contactProfiles = new Map(); // contactId -> communication profile
        this.responseHistory = new Map(); // messageId -> response data
        this.confidenceScores = new Map(); // messageId -> confidence score
        
        // Initialize decay factors
        this.STYLE_DECAY_FACTOR = 0.95; // Decay factor for style metrics
        this.RESPONSE_DECAY_FACTOR = 0.9; // Decay factor for response history
        this.UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Initialize visualization data
        this.styleVisualizations = new Map(); // userId -> visualization data
        
        this._initializeMetrics();
    }

    _initializeMetrics() {
        this.metricDefinitions = {
            responseTime: {
                ranges: [0, 60, 300, 900, 3600], // in seconds
                weights: [1.0, 0.8, 0.6, 0.4, 0.2]
            },
            communicationMediums: {
                types: ['text', 'voice', 'image', 'document', 'link'],
                weights: [1.0, 0.8, 0.7, 0.6, 0.5]
            },
            languagePatterns: {
                features: ['formality', 'emoji_usage', 'sentence_length', 'vocabulary_complexity'],
                weights: [0.4, 0.2, 0.2, 0.2]
            }
        };
    }

    async learnUserStyle(userId, message, context) {
        const userStyle = this.userStyles.get(userId) || this._createNewStyleProfile();
        const timestamp = Date.now();

        // Update response time metrics
        if (context.lastMessageTimestamp) {
            const responseTime = timestamp - context.lastMessageTimestamp;
            this._updateResponseTimeMetrics(userStyle, responseTime);
        }

        // Update communication medium metrics
        const medium = this._detectCommunicationMedium(message);
        this._updateMediumMetrics(userStyle, medium);

        // Update language pattern metrics
        const languageMetrics = await this._analyzeLanguagePatterns(message);
        this._updateLanguageMetrics(userStyle, languageMetrics);

        // Apply decay factor to historical data
        this._applyDecayFactor(userStyle);

        // Update visualization data
        this._updateVisualization(userId, userStyle);

        // Save updated style
        this.userStyles.set(userId, userStyle);

        return userStyle;
    }

    async analyzeResponseDifferences(originalResponse, editedResponse, context) {
        const differences = {
            length: editedResponse.length - originalResponse.length,
            formality: await this._compareFormalityLevels(originalResponse, editedResponse),
            complexity: await this._compareComplexity(originalResponse, editedResponse),
            sentiment: await this._compareSentiment(originalResponse, editedResponse),
            structuralChanges: this._analyzeStructuralChanges(originalResponse, editedResponse)
        };

        // Calculate confidence impact
        const confidenceImpact = this._calculateConfidenceImpact(differences);
        
        // Store analysis results
        const messageId = context.messageId;
        this.responseHistory.set(messageId, {
            original: originalResponse,
            edited: editedResponse,
            differences,
            confidenceImpact,
            timestamp: Date.now()
        });

        return differences;
    }

    async updateContactProfile(contactId, message, context) {
        const profile = this.contactProfiles.get(contactId) || this._createNewContactProfile();
        
        // Update communication preferences
        const preferences = await this._analyzeCommunicationPreferences(message, context);
        this._updatePreferences(profile, preferences);

        // Update style metrics
        const styleMetrics = await this._analyzeContactStyle(message);
        this._updateContactStyle(profile, styleMetrics);

        // Update interaction patterns
        const patterns = this._analyzeInteractionPatterns(context);
        this._updateInteractionPatterns(profile, patterns);

        // Apply decay factor
        this._applyContactProfileDecay(profile);

        // Save updated profile
        this.contactProfiles.set(contactId, profile);

        return profile;
    }

    calculateResponseConfidence(response, context) {
        const factors = {
            styleMatch: this._calculateStyleMatchScore(response, context),
            topicRelevance: this._calculateTopicRelevanceScore(response, context),
            patternAdherence: this._calculatePatternAdherenceScore(response, context),
            historicalAccuracy: this._calculateHistoricalAccuracyScore(response, context)
        };

        const confidenceScore = Object.values(factors).reduce((sum, score) => sum + score, 0) / Object.keys(factors).length;
        
        this.confidenceScores.set(context.messageId, {
            score: confidenceScore,
            factors,
            timestamp: Date.now()
        });

        return {
            overall: confidenceScore,
            factors
        };
    }

    // Private helper methods
    _createNewStyleProfile() {
        return {
            responseTimes: [],
            mediumPreferences: {},
            languagePatterns: {},
            lastUpdate: Date.now()
        };
    }

    _createNewContactProfile() {
        return {
            communicationPreferences: {},
            styleMetrics: {},
            interactionPatterns: {},
            lastUpdate: Date.now()
        };
    }

    _updateResponseTimeMetrics(style, responseTime) {
        style.responseTimes.push({
            time: responseTime,
            timestamp: Date.now()
        });

        // Keep only last 100 response times
        if (style.responseTimes.length > 100) {
            style.responseTimes.shift();
        }
    }

    _detectCommunicationMedium(message) {
        // Implement medium detection logic
        if (message.hasMedia) {
            return message.type;
        }
        return 'text';
    }

    async _analyzeLanguagePatterns(message) {
        const text = message.body || message;
        return {
            formality: await this._calculateFormality(text),
            emojiUsage: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
            sentenceLength: this._calculateAverageSentenceLength(text),
            vocabularyComplexity: await this._calculateVocabularyComplexity(text)
        };
    }

    _applyDecayFactor(style) {
        const now = Date.now();
        const timeDiff = now - style.lastUpdate;
        const decayPower = timeDiff / this.UPDATE_INTERVAL;
        
        // Apply decay to numerical values
        Object.keys(style.languagePatterns).forEach(key => {
            if (typeof style.languagePatterns[key] === 'number') {
                style.languagePatterns[key] *= Math.pow(this.STYLE_DECAY_FACTOR, decayPower);
            }
        });

        style.lastUpdate = now;
    }

    _updateVisualization(userId, style) {
        const visualization = {
            timestamp: Date.now(),
            metrics: {
                responseTimes: this._generateTimeSeriesData(style.responseTimes),
                mediumPreferences: this._generatePieChartData(style.mediumPreferences),
                languagePatterns: this._generateRadarChartData(style.languagePatterns)
            }
        };

        this.styleVisualizations.set(userId, visualization);
    }

    // Visualization helper methods
    _generateTimeSeriesData(responseTimes) {
        return responseTimes.map(rt => ({
            x: rt.timestamp,
            y: rt.time
        }));
    }

    _generatePieChartData(preferences) {
        return Object.entries(preferences).map(([medium, count]) => ({
            label: medium,
            value: count
        }));
    }

    _generateRadarChartData(patterns) {
        return Object.entries(patterns).map(([metric, value]) => ({
            axis: metric,
            value: value
        }));
    }

    // Utility methods for response analysis
    async _compareFormalityLevels(original, edited) {
        const originalFormality = await this._calculateFormality(original);
        const editedFormality = await this._calculateFormality(edited);
        return editedFormality - originalFormality;
    }

    async _compareComplexity(original, edited) {
        const originalComplexity = await this._calculateVocabularyComplexity(original);
        const editedComplexity = await this._calculateVocabularyComplexity(edited);
        return editedComplexity - originalComplexity;
    }

    _analyzeStructuralChanges(original, edited) {
        return {
            sentencesAdded: this._countSentences(edited) - this._countSentences(original),
            paragraphsChanged: this._compareParagraphStructure(original, edited),
            keyPhraseChanges: this._analyzeKeyPhraseChanges(original, edited)
        };
    }

    _calculateConfidenceImpact(differences) {
        let impact = 0;
        
        // Calculate impact based on the magnitude of changes
        impact += Math.abs(differences.formality) * 0.3;
        impact += Math.abs(differences.complexity) * 0.2;
        impact += (Math.abs(differences.structuralChanges.sentencesAdded) / 5) * 0.3;
        impact += (differences.structuralChanges.keyPhraseChanges.length / 10) * 0.2;

        return Math.max(0, 1 - impact);
    }

    // Contact profile analysis methods
    async _analyzeCommunicationPreferences(message, context) {
        return {
            preferredTiming: this._analyzeTimingPreferences(context),
            responseLatency: this._analyzeResponseLatency(context),
            mediumPreference: this._analyzeMediumPreference(message),
            interactionFrequency: this._analyzeInteractionFrequency(context)
        };
    }

    _analyzeContactStyle(message) {
        return {
            formality: this._calculateFormality(message.body),
            verbosity: this._calculateVerbosity(message.body),
            emotionalExpression: this._analyzeEmotionalExpression(message.body),
            interactionStyle: this._analyzeInteractionStyle(message.body)
        };
    }

    _analyzeInteractionPatterns(context) {
        return {
            timeOfDay: this._analyzeTimeOfDayPattern(context),
            responseSpeed: this._analyzeResponseSpeedPattern(context),
            conversationLength: this._analyzeConversationLengthPattern(context),
            topicContinuity: this._analyzeTopicContinuityPattern(context)
        };
    }

    _updateMediumMetrics(style, medium) {
        if (!style.mediumPreferences[medium]) {
            style.mediumPreferences[medium] = 0;
        }
        style.mediumPreferences[medium]++;
    }

    _updateLanguageMetrics(style, metrics) {
        style.languagePatterns = {
            ...style.languagePatterns,
            ...metrics
        };
    }

    _calculateFormality(text) {
        const formalIndicators = [
            /\b(please|thank you|would you|could you)\b/i,
            /\b(hello|good morning|good afternoon|good evening)\b/i,
            /\b(sincerely|regards|best wishes)\b/i
        ];
        
        const informalIndicators = [
            /\b(hey|hi|sup|yo)\b/i,
            /\b(gonna|wanna|gotta)\b/i,
            /\b(lol|omg|wtf)\b/i
        ];
        
        let score = 0.5; // Start neutral
        
        formalIndicators.forEach(pattern => {
            if (pattern.test(text)) score += 0.1;
        });
        
        informalIndicators.forEach(pattern => {
            if (pattern.test(text)) score -= 0.1;
        });
        
        return Math.max(0, Math.min(1, score));
    }

    _calculateVocabularyComplexity(text) {
        const words = tokenizer.tokenize(text);
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        return Math.min(1, avgWordLength / 10);
    }

    _calculateAverageSentenceLength(text) {
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        const words = tokenizer.tokenize(text);
        return words.length / sentences.length;
    }

    _countSentences(text) {
        return text.split(/[.!?]+/).filter(Boolean).length;
    }

    _compareParagraphStructure(original, edited) {
        const originalParagraphs = original.split('\n\n').length;
        const editedParagraphs = edited.split('\n\n').length;
        return Math.abs(editedParagraphs - originalParagraphs);
    }

    _analyzeKeyPhraseChanges(original, edited) {
        const originalWords = new Set(tokenizer.tokenize(original.toLowerCase()));
        const editedWords = new Set(tokenizer.tokenize(edited.toLowerCase()));
        
        const added = [...editedWords].filter(word => !originalWords.has(word));
        const removed = [...originalWords].filter(word => !editedWords.has(word));
        
        return [...added, ...removed];
    }

    _calculateStyleMatchScore(response, context) {
        if (!context.userStyle) return 0.5;
        
        const responseStyle = this._analyzeLanguagePatterns({ body: response });
        const userStyle = context.userStyle.languagePatterns;
        
        let score = 0;
        let count = 0;
        
        for (const [key, value] of Object.entries(responseStyle)) {
            if (userStyle[key] !== undefined) {
                score += 1 - Math.abs(value - userStyle[key]);
                count++;
            }
        }
        
        return count > 0 ? score / count : 0.5;
    }

    _calculateTopicRelevanceScore(response, context) {
        if (!context.topics || context.topics.length === 0) return 0.5;
        
        const responseWords = new Set(tokenizer.tokenize(response.toLowerCase()));
        const topicWords = new Set(context.topics.flatMap(topic => tokenizer.tokenize(topic.toLowerCase())));
        
        const commonWords = [...responseWords].filter(word => topicWords.has(word));
        return Math.min(1, commonWords.length / Math.sqrt(topicWords.size));
    }

    _calculatePatternAdherenceScore(response, context) {
        if (!context.userStyle) return 0.5;
        
        const patterns = {
            questionFrequency: (text) => (text.match(/\?/g) || []).length / text.length,
            emojiUsage: (text) => (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length / text.length,
            exclamationFrequency: (text) => (text.match(/!/g) || []).length / text.length
        };
        
        let score = 0;
        let count = 0;
        
        for (const [key, fn] of Object.entries(patterns)) {
            if (context.userStyle[key] !== undefined) {
                const responseValue = fn(response);
                const userValue = context.userStyle[key];
                score += 1 - Math.abs(responseValue - userValue);
                count++;
            }
        }
        
        return count > 0 ? score / count : 0.5;
    }

    _calculateHistoricalAccuracyScore(response, context) {
        return 0.7; // Default score, to be improved with historical data analysis
    }

    _analyzeTimingPreferences(context) {
        if (!context.lastMessageTimestamp) return {};
        
        const hour = new Date(context.lastMessageTimestamp).getHours();
        return {
            timeOfDay: hour,
            isBusinessHours: hour >= 9 && hour <= 17,
            dayOfWeek: new Date(context.lastMessageTimestamp).getDay()
        };
    }

    _analyzeResponseLatency(context) {
        if (!context.lastMessageTimestamp) return {};
        
        const latency = Date.now() - context.lastMessageTimestamp;
        return {
            value: latency,
            category: this._categorizeDuration(latency)
        };
    }

    _analyzeMediumPreference(message) {
        return {
            type: message.hasMedia ? message.type : 'text',
            hasAttachments: message.hasMedia || false
        };
    }

    _analyzeInteractionFrequency(context) {
        if (!context.chatHistory) return {};
        
        return {
            messageCount: context.chatHistory.length,
            averageInterval: this._calculateAverageInterval(context.chatHistory)
        };
    }

    _calculateVerbosity(text) {
        const words = tokenizer.tokenize(text);
        return Math.min(1, words.length / 100);
    }

    _analyzeEmotionalExpression(text) {
        const emotionPatterns = {
            joy: /\b(happy|glad|excited|wonderful|great)\b|😊|😃|😄/gi,
            sadness: /\b(sad|sorry|unfortunate|regret)\b|😢|😔|😞/gi,
            anger: /\b(angry|upset|frustrated|annoyed)\b|😠|😡|😤/gi,
            surprise: /\b(wow|amazing|incredible|unexpected)\b|😮|😲|😱/gi
        };
        
        const results = {};
        for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
            const matches = text.match(pattern) || [];
            results[emotion] = matches.length;
        }
        
        return results;
    }

    _analyzeInteractionStyle(text) {
        return {
            isQuestion: /\?/.test(text),
            isExclamation: /!/.test(text),
            hasEmoji: /[\u{1F300}-\u{1F9FF}]/gu.test(text),
            wordCount: tokenizer.tokenize(text).length
        };
    }

    _analyzeTimeOfDayPattern(context) {
        if (!context.lastMessageTimestamp) return {};
        
        const hour = new Date(context.lastMessageTimestamp).getHours();
        return {
            hour,
            period: this._categorizeDayPeriod(hour),
            isBusinessHours: hour >= 9 && hour <= 17
        };
    }

    _analyzeResponseSpeedPattern(context) {
        if (!context.lastMessageTimestamp) return {};
        
        const latency = Date.now() - context.lastMessageTimestamp;
        return {
            value: latency,
            category: this._categorizeDuration(latency),
            isQuickResponse: latency < 300000 // 5 minutes
        };
    }

    _analyzeConversationLengthPattern(context) {
        if (!context.chatHistory) return {};
        
        return {
            messageCount: context.chatHistory.length,
            averageInterval: this._calculateAverageInterval(context.chatHistory),
            isLongConversation: context.chatHistory.length > 10
        };
    }

    _analyzeTopicContinuityPattern(context) {
        if (!context.chatHistory || context.chatHistory.length < 2) return {};
        
        const topics = context.chatHistory.map(msg => 
            this._extractTopics(typeof msg === 'string' ? msg : msg.body)
        );
        
        return {
            topicCount: new Set(topics.flat()).size,
            hasTopicContinuity: this._checkTopicContinuity(topics)
        };
    }

    _categorizeDuration(ms) {
        if (ms < 60000) return 'immediate'; // < 1 minute
        if (ms < 300000) return 'quick'; // < 5 minutes
        if (ms < 3600000) return 'normal'; // < 1 hour
        return 'delayed';
    }

    _categorizeDayPeriod(hour) {
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        if (hour < 22) return 'evening';
        return 'night';
    }

    _calculateAverageInterval(messages) {
        if (!messages || messages.length < 2) return 0;
        
        let totalInterval = 0;
        for (let i = 1; i < messages.length; i++) {
            const current = messages[i].timestamp || Date.now();
            const previous = messages[i-1].timestamp || Date.now();
            totalInterval += current - previous;
        }
        
        return totalInterval / (messages.length - 1);
    }

    _checkTopicContinuity(topics) {
        if (topics.length < 2) return false;
        
        let continuityCount = 0;
        for (let i = 1; i < topics.length; i++) {
            const commonTopics = topics[i].filter(topic => topics[i-1].includes(topic));
            if (commonTopics.length > 0) continuityCount++;
        }
        
        return continuityCount >= (topics.length - 1) * 0.5;
    }

    _compareSentiment(original, edited) {
        const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
        const originalScore = analyzer.getSentiment(tokenizer.tokenize(original));
        const editedScore = analyzer.getSentiment(tokenizer.tokenize(edited));
        return editedScore - originalScore;
    }
}

module.exports = EnhancedLearningService; 