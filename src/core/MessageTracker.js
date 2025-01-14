const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

class MessageTracker {
    constructor() {
        this.messages = new Map(); // userId -> messages
        this.categories = new Map(); // messageId -> category
        this.priorities = new Map(); // messageId -> priority score
        this.summaries = new Map(); // timeframe -> summary
        this.classifier = classifier;
        
        this._initializeClassifier();
    }

    _initializeClassifier() {
        // Train for message categorization with more examples
        const trainingData = [
            // Urgent messages
            { text: 'URGENT: Please respond immediately', category: 'urgent' },
            { text: 'Emergency situation requires attention', category: 'urgent' },
            { text: 'Deadline approaching', category: 'urgent' },
            { text: 'Critical issue needs resolution', category: 'urgent' },
            { text: 'ASAP: Important update required', category: 'urgent' },
            
            // Work messages
            { text: 'Meeting scheduled for tomorrow', category: 'work' },
            { text: 'Project update:', category: 'work' },
            { text: 'Can you review this document', category: 'work' },
            { text: 'Team sync at 2 PM', category: 'work' },
            { text: 'Client presentation ready for review', category: 'work' },
            
            // Personal messages
            { text: 'How are you doing?', category: 'personal' },
            { text: 'Let\'s catch up soon', category: 'personal' },
            { text: 'Happy birthday!', category: 'personal' },
            { text: 'Great to hear from you', category: 'personal' },
            { text: 'Miss talking to you', category: 'personal' }
        ];

        trainingData.forEach(({ text, category }) => {
            this.classifier.addDocument(text, category);
        });
        
        this.classifier.train();
    }

    async trackMessage(message, userId) {
        if (!this.messages.has(userId)) {
            this.messages.set(userId, []);
        }

        const text = message.body || message;
        const category = await this._categorizeMessage(text);
        const priority = await this._calculatePriority(message);
        const urgency = await this._detectUrgency(text);
        const sentiment = await this._analyzeSentiment(text);

        const messageData = {
            id: Date.now().toString(),
            content: text,
            timestamp: new Date(),
            sender: message.from || userId,
            category,
            priority,
            sentiment,
            urgency
        };

        this.messages.get(userId).push(messageData);
        this.categories.set(messageData.id, category);
        this.priorities.set(messageData.id, priority);

        return messageData;
    }

    async _categorizeMessage(text) {
        // First check for urgent indicators
        if (this._containsUrgentIndicators(text)) {
            return 'urgent';
        }
        
        // Check for personal indicators
        if (this._containsPersonalIndicators(text)) {
            return 'personal';
        }
        
        // Check for work indicators
        if (this._containsWorkIndicators(text)) {
            return 'work';
        }
        
        // Use trained classifier as fallback
        return this.classifier.classify(text);
    }

    _containsUrgentIndicators(text) {
        const urgentPatterns = [
            /urgent/i,
            /asap/i,
            /emergency/i,
            /immediate/i,
            /deadline/i,
            /critical/i,
            /!{2,}/
        ];
        
        return urgentPatterns.some(pattern => pattern.test(text));
    }

    _containsPersonalIndicators(text) {
        const personalPatterns = [
            /how are you/i,
            /catch up/i,
            /miss you/i,
            /birthday/i,
            /family/i,
            /friend/i,
            /personal/i,
            /life/i,
            /feeling/i,
            /chat/i
        ];
        
        return personalPatterns.some(pattern => pattern.test(text));
    }

    _containsWorkIndicators(text) {
        const workPatterns = [
            /meeting/i,
            /project/i,
            /client/i,
            /deadline/i,
            /report/i,
            /review/i,
            /team/i,
            /update/i,
            /status/i,
            /work/i
        ];
        
        return workPatterns.some(pattern => pattern.test(text));
    }

    async _calculatePriority(message) {
        let score = 0;
        const text = message.body || message;

        // Content-based priority (0-5 points)
        const urgency = await this._detectUrgency(text);
        score += urgency.score * 2;
        
        // Keyword-based priority (0-3 points)
        if (this._containsUrgentIndicators(text)) {
            score += 3;
        }
        
        // Time sensitivity (0-3 points)
        if (/\b(today|tonight|now)\b/i.test(text)) {
            score += 3;
        } else if (/\b(tomorrow|next day)\b/i.test(text)) {
            score += 2;
        } else if (/\b(this week|soon)\b/i.test(text)) {
            score += 1;
        }
        
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 17) {
            score += 1; // Business hours
        }
        
        // Sender priority (0-2 points)
        if (message.from) {
            const senderScore = await this._getSenderPriority(message.from);
            score += senderScore;
        }

        // Normalize to 1-10 scale
        return Math.min(10, Math.max(1, Math.ceil(score)));
    }

    async _getSenderPriority(sender) {
        // Implement sender priority logic
        // For now, return default priority
        return 2;
    }

    async _analyzeSentiment(text) {
        const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
        const tokens = tokenizer.tokenize(text);
        const score = analyzer.getSentiment(tokens);

        return {
            score,
            intensity: Math.abs(score),
            polarity: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
        };
    }

    async _detectUrgency(text) {
        const urgencyIndicators = [
            { pattern: /urgent|emergency|asap|immediate|critical/i, weight: 3 },
            { pattern: /deadline|due|by|until|important/i, weight: 2 },
            { pattern: /!{2,}|\?{2,}|please|need|asap/i, weight: 1 }
        ];

        let urgencyScore = 0;
        urgencyIndicators.forEach(({ pattern, weight }) => {
            if (pattern.test(text)) urgencyScore += weight;
        });

        return {
            score: urgencyScore,
            isUrgent: urgencyScore >= 3
        };
    }

    getMessagesByCategory(category, userId) {
        const userMessages = this.messages.get(userId) || [];
        return userMessages.filter(msg => msg.category === category);
    }

    getMessagesByPriority(minPriority, userId) {
        const userMessages = this.messages.get(userId) || [];
        return userMessages.filter(msg => msg.priority >= minPriority);
    }

    async generateSummary(timeframe = 'daily', userId) {
        const userMessages = this.messages.get(userId) || [];
        const now = new Date();
        let cutoff;

        switch(timeframe) {
            case 'hourly':
                cutoff = new Date(now - 60 * 60 * 1000);
                break;
            case 'daily':
                cutoff = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoff = new Date(now - 24 * 60 * 60 * 1000); // Default to daily
        }

        const relevantMessages = userMessages.filter(msg => msg.timestamp >= cutoff);
        
        // Group messages by category
        const categorized = relevantMessages.reduce((acc, msg) => {
            if (!acc[msg.category]) acc[msg.category] = [];
            acc[msg.category].push(msg);
            return acc;
        }, {});

        // Generate summary
        const summary = {
            timeframe,
            totalMessages: relevantMessages.length,
            categories: Object.keys(categorized).map(category => ({
                category,
                count: categorized[category].length,
                highPriority: categorized[category].filter(msg => msg.priority >= 7).length,
                topMessages: this._summarizeMessages(categorized[category].slice(0, 3))
            })),
            urgentMessages: relevantMessages.filter(msg => msg.priority >= 8),
            averageSentiment: this._calculateAverageSentiment(relevantMessages),
            timestamp: now
        };

        this.summaries.set(timeframe, summary);
        return summary;
    }

    _summarizeMessages(messages) {
        return messages.map(msg => ({
            content: msg.content,
            priority: msg.priority,
            sentiment: msg.sentiment,
            timestamp: msg.timestamp
        }));
    }

    _calculateAverageSentiment(messages) {
        if (messages.length === 0) return 0;
        const sum = messages.reduce((acc, msg) => acc + (msg.sentiment?.score || 0), 0);
        return sum / messages.length;
    }

    getRecentSummary(timeframe = 'daily') {
        return this.summaries.get(timeframe);
    }

    // Get priority level for a message
    async getPriority(msg) {
        const priority = await this._calculatePriority(msg);
        
        if (priority >= 8) return 'high';
        if (priority >= 5) return 'medium';
        return 'low';
    }

    // Get triggers/keywords from a message
    checkTriggers(text) {
        const triggers = [];
        
        // Check for urgent indicators
        if (this._containsUrgentIndicators(text)) {
            triggers.push('urgent');
        }

        // Check for work-related keywords
        if (this._containsWorkIndicators(text)) {
            triggers.push('work');
        }

        // Check for personal indicators
        if (this._containsPersonalIndicators(text)) {
            triggers.push('personal');
        }

        // Check for time-sensitive words
        if (/\b(today|tonight|now)\b/i.test(text)) {
            triggers.push('immediate');
        } else if (/\b(tomorrow|next day)\b/i.test(text)) {
            triggers.push('upcoming');
        }

        // Check for action items
        if (/\b(todo|task|action|review|respond|reply|check|confirm)\b/i.test(text)) {
            triggers.push('action_required');
        }

        return triggers;
    }
}

module.exports = MessageTracker;
