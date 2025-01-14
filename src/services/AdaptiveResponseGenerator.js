const OpenAI = require('openai');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const EnhancedLearningService = require('./EnhancedLearningService');

class AdaptiveResponseGenerator {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.learningService = new EnhancedLearningService();
        this.conversationHistory = new Map(); // userId -> conversation history
        this.userPreferences = new Map(); // userId -> preferences
        this.stylePatterns = new Map(); // userId -> style patterns
        this.topicTracker = new Map(); // userId -> current topics
        
        // Initialize NLP components
        this.classifier = new natural.BayesClassifier();
        this.tfidf = new natural.TfIdf();
        
        this._initializeClassifier();
    }

    async generateResponse(message, context, userId) {
        try {
            // Learn user style
            const userStyle = await this.learningService.learnUserStyle(userId, message, context);
            
            // Update conversation history
            this._updateConversationHistory(userId, message);

            // Analyze context and user preferences
            const userContext = this._analyzeContext(context, userId);
            userContext.userStyle = userStyle;
            
            // Generate base prompt with context
            const prompt = this._generatePrompt(message, userContext);
            
            // Get response from AI
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that adapts to the user\'s style and preferences.' },
                    { role: 'user', content: prompt }
                ],
                temperature: this._calculateTemperature(userContext),
                max_tokens: 150
            });
            
            const response = completion.choices[0].message.content;
            
            // Calculate response confidence
            const confidence = this.learningService.calculateResponseConfidence(response, {
                ...context,
                messageId: Date.now().toString(),
                userStyle
            });
            
            // Adapt response based on user preferences and confidence
            const adaptedResponse = this._adaptResponse(response, userContext, confidence);
            
            // Update learning data
            this._updateLearningData(userId, message, adaptedResponse, context);
            
            // Update contact profile if this is a response to a specific contact
            if (context.contactId) {
                await this.learningService.updateContactProfile(context.contactId, message, {
                    ...context,
                    response: adaptedResponse,
                    confidence
                });
            }
            
            return {
                response: adaptedResponse,
                confidence,
                style: userStyle
            };
        } catch (error) {
            console.error('Error generating adaptive response:', error);
            throw error;
        }
    }

    async handleResponseFeedback(originalResponse, editedResponse, context) {
        try {
            // Analyze differences between original and edited responses
            const differences = await this.learningService.analyzeResponseDifferences(
                originalResponse,
                editedResponse,
                context
            );
            
            // Update learning data based on feedback
            this._updateLearningFromFeedback(differences, context);
            
            return differences;
        } catch (error) {
            console.error('Error handling response feedback:', error);
            throw error;
        }
    }

    _updateLearningFromFeedback(differences, context) {
        // Update style patterns based on differences
        const style = this.stylePatterns.get(context.userId) || {};
        
        if (differences.formality !== 0) {
            style.formality = (style.formality || 0.5) + (differences.formality * 0.1);
        }
        
        if (differences.complexity !== 0) {
            style.complexity = (style.complexity || 0.5) + (differences.complexity * 0.1);
        }
        
        this.stylePatterns.set(context.userId, style);
        
        // Update user preferences based on structural changes
        const preferences = this.userPreferences.get(context.userId) || {};
        
        if (differences.structuralChanges.sentencesAdded > 0) {
            preferences.verbosity = (preferences.verbosity || 0.5) + 0.1;
        } else if (differences.structuralChanges.sentencesAdded < 0) {
            preferences.verbosity = (preferences.verbosity || 0.5) - 0.1;
        }
        
        this.userPreferences.set(context.userId, preferences);
    }

    _adaptResponse(response, context, confidence) {
        // Adjust response based on confidence scores
        if (confidence.overall < 0.5) {
            // Add hedging language for low confidence responses
            response = this._addHedging(response);
        }
        
        // Adjust formality
        response = this._adjustFormality(response, context.formality);
        
        // Match style patterns
        response = this._matchStyle(response, context.style);
        
        // Ensure topic continuity
        response = this._ensureTopicContinuity(response, context.topics);
        
        return response;
    }

    _addHedging(response) {
        const hedges = [
            'I think ',
            'It seems that ',
            'From what I understand, ',
            'Based on the context, '
        ];
        
        const hedge = hedges[Math.floor(Math.random() * hedges.length)];
        return hedge + response.charAt(0).toLowerCase() + response.slice(1);
    }

    _initializeClassifier() {
        // Train classifier with common conversation patterns
        const patterns = [
            { text: 'How are you?', category: 'greeting' },
            { text: 'What time is it?', category: 'time_query' },
            { text: 'Tell me more about', category: 'information_request' },
            { text: 'Can you help me with', category: 'help_request' },
            // Add more patterns as needed
        ];

        patterns.forEach(({ text, category }) => {
            this.classifier.addDocument(text, category);
        });
        
        this.classifier.train();
    }

    _updateConversationHistory(userId, message) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }
        
        const history = this.conversationHistory.get(userId);
        history.push({
            content: message,
            timestamp: new Date(),
            topics: this._extractTopics(message)
        });
        
        // Keep last 10 messages for context
        if (history.length > 10) {
            history.shift();
        }
    }

    _analyzeContext(context, userId) {
        const userStyle = context.userStyle || {};
        const chatHistory = context.chatHistory || [];
        const biography = context.biography || {};
        
        // Analyze user's writing style
        const styleMetrics = this._analyzeStyle(chatHistory);
        this.stylePatterns.set(userId, styleMetrics);
        
        // Track active topics
        const currentTopics = this._trackTopics(chatHistory);
        this.topicTracker.set(userId, currentTopics);
        
        // Update user preferences
        this._updatePreferences(userId, context);
        
        return {
            style: styleMetrics,
            topics: currentTopics,
            preferences: this.userPreferences.get(userId) || {},
            biography: biography,
            formality: userStyle.formality || 0.5
        };
    }

    _generatePrompt(message, context) {
        const { style, topics, preferences, biography } = context;
        
        // Build context-aware prompt
        let prompt = `Given the following context:\n`;
        prompt += `- User's style: ${JSON.stringify(style)}\n`;
        prompt += `- Current topics: ${JSON.stringify(topics)}\n`;
        prompt += `- User preferences: ${JSON.stringify(preferences)}\n`;
        prompt += `- User biography: ${JSON.stringify(biography)}\n\n`;
        prompt += `Generate a response to: "${message}"\n`;
        prompt += `The response should match the user's style and preferences while maintaining context.`;
        
        return prompt;
    }

    _updateLearningData(userId, message, response, context) {
        // Update user preferences
        const preferences = this.userPreferences.get(userId) || {};
        const messageTopics = this._extractTopics(message);
        
        messageTopics.forEach(topic => {
            preferences[topic] = (preferences[topic] || 0) + 1;
        });
        
        this.userPreferences.set(userId, preferences);
        
        // Update style patterns
        const style = this.stylePatterns.get(userId) || {};
        const responseStyle = this._analyzeStyle([response]);
        
        Object.entries(responseStyle).forEach(([key, value]) => {
            style[key] = (style[key] || 0) * 0.9 + value * 0.1; // Exponential moving average
        });
        
        this.stylePatterns.set(userId, style);
    }

    _extractTopics(text) {
        const words = tokenizer.tokenize(text.toLowerCase());
        this.tfidf.addDocument(words);
        
        return this.tfidf.listTerms(0)
            .slice(0, 5)
            .map(term => term.term);
    }

    _analyzeStyle(messages) {
        const style = {
            averageLength: 0,
            questionFrequency: 0,
            emojiUsage: 0,
            formalityScore: 0,
            complexity: 0
        };
        
        if (messages.length === 0) return style;
        
        messages.forEach(msg => {
            const text = typeof msg === 'string' ? msg : msg.content;
            style.averageLength += text.length;
            style.questionFrequency += (text.match(/\?/g) || []).length;
            style.emojiUsage += (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
            style.formalityScore += this._calculateFormality(text);
            style.complexity += this._calculateComplexity(text);
        });
        
        // Normalize scores
        Object.keys(style).forEach(key => {
            style[key] /= messages.length;
        });
        
        return style;
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

    _calculateComplexity(text) {
        const words = tokenizer.tokenize(text);
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        const avgSentenceLength = words.length / sentences.length;
        
        return (avgWordLength * 0.5 + avgSentenceLength * 0.03) / 5; // Normalize to 0-1
    }

    _calculateTemperature(context) {
        // Adjust temperature based on context
        let temperature = 0.7; // Default
        
        if (context.style.complexity > 0.7) temperature -= 0.2;
        if (context.formality > 0.7) temperature -= 0.2;
        if (context.topics.length > 3) temperature += 0.1;
        
        return Math.max(0.1, Math.min(1, temperature));
    }

    _adjustFormality(text, targetFormality) {
        const currentFormality = this._calculateFormality(text);
        
        if (Math.abs(currentFormality - targetFormality) <= 0.2) {
            return text; // Already close enough
        }
        
        // Adjust formality markers
        if (targetFormality > currentFormality) {
            text = text.replace(/\b(hey|hi)\b/gi, 'hello');
            text = text.replace(/\b(gonna|wanna|gotta)\b/gi, match => {
                const replacements = {
                    'gonna': 'going to',
                    'wanna': 'want to',
                    'gotta': 'have to'
                };
                return replacements[match.toLowerCase()] || match;
            });
        } else {
            text = text.replace(/\b(greetings|salutations)\b/gi, 'hi');
            text = text.replace(/\b(please|kindly)\b/gi, '');
        }
        
        return text;
    }

    _matchStyle(text, style) {
        // Adjust sentence length
        if (style.averageLength > 100) {
            text = this._expandResponse(text);
        } else if (style.averageLength < 50) {
            text = this._condenseResponse(text);
        }
        
        // Match question frequency
        if (style.questionFrequency > 0.3 && !text.includes('?')) {
            text += ' What do you think?';
        }
        
        // Match emoji usage
        if (style.emojiUsage > 0.5 && !text.match(/[\u{1F300}-\u{1F9FF}]/gu)) {
            text = this._addEmoji(text);
        }
        
        return text;
    }

    _ensureTopicContinuity(text, currentTopics) {
        const responseTopics = this._extractTopics(text);
        const commonTopics = responseTopics.filter(topic => currentTopics.includes(topic));
        
        if (commonTopics.length === 0 && currentTopics.length > 0) {
            // Add a reference to a current topic
            text += ` This relates to our discussion about ${currentTopics[0]}.`;
        }
        
        return text;
    }

    _expandResponse(text) {
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        return sentences.map(sentence => {
            if (sentence.length < 50) {
                return sentence + ' ' + this._generateElaboration(sentence);
            }
            return sentence;
        }).join('. ') + '.';
    }

    _condenseResponse(text) {
        return text.split(/[.!?]+/)
            .filter(Boolean)
            .map(sentence => sentence.trim())
            .filter((_, i) => i === 0) // Keep only first sentence
            .join('. ') + '.';
    }

    _generateElaboration(sentence) {
        const topics = this._extractTopics(sentence);
        if (topics.length > 0) {
            return `which is particularly relevant when considering ${topics[0]}`;
        }
        return '';
    }

    _addEmoji(text) {
        const emojiMap = {
            'happy': '😊',
            'sad': '😢',
            'love': '❤️',
            'agree': '👍',
            'disagree': '👎',
            'surprise': '😮',
            'think': '🤔',
            'idea': '💡'
        };
        
        Object.entries(emojiMap).forEach(([keyword, emoji]) => {
            if (text.toLowerCase().includes(keyword)) {
                text += ` ${emoji}`;
            }
        });
        
        return text;
    }

    _trackTopics(messages) {
        const topics = new Map();
        
        messages.forEach(msg => {
            const messageTopics = this._extractTopics(typeof msg === 'string' ? msg : msg.content);
            messageTopics.forEach(topic => {
                topics.set(topic, (topics.get(topic) || 0) + 1);
            });
        });
        
        return Array.from(topics.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);
    }

    _updatePreferences(userId, context) {
        const preferences = this.userPreferences.get(userId) || {};
        
        // Update from biography
        if (context.biography && context.biography.interests) {
            context.biography.interests.forEach(interest => {
                preferences[interest] = (preferences[interest] || 0) + 0.5;
            });
        }
        
        // Update from chat history
        if (context.chatHistory) {
            const topics = this._trackTopics(context.chatHistory);
            topics.forEach(topic => {
                preferences[topic] = (preferences[topic] || 0) + 1;
            });
        }
        
        this.userPreferences.set(userId, preferences);
    }
}

module.exports = AdaptiveResponseGenerator; 