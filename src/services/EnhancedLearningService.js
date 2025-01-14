const natural = require('natural');
const sentiment = require('sentiment');

class EnhancedLearningService {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.sentiment = new sentiment();
    }

    async analyzeMessage(messageData) {
        const { content } = messageData;
        const tokens = this.tokenizer.tokenize(content);
        const sentimentResult = this.sentiment.analyze(content);

        const analysis = {
            tokens,
            sentiment: sentimentResult.score,
            topics: this.extractTopics(tokens),
            intent: this.recognizeIntent(content),
        };

        return { ...messageData, analysis };
    }

    extractTopics(tokens) {
        // Simple topic extraction based on word frequency
        const wordFrequency = tokens.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});

        // Return top 3 most frequent words as topics
        return Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([word]) => word);
    }

    recognizeIntent(content) {
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('?')) {
            return 'question';
        } else if (lowerContent.includes('please') || lowerContent.includes('can you')) {
            return 'request';
        } else if (lowerContent.includes('thank')) {
            return 'gratitude';
        } else {
            return 'statement';
        }
    }

    calculateResponseConfidence(analysis) {
        // Simple confidence score calculation based on sentiment and intent
        const { sentiment, intent } = analysis;
        const sentimentWeight = sentiment / 10; // Normalize sentiment score
        const intentWeight = intent === 'question' ? 0.5 : 1; // Higher weight for non-question intents

        return sentimentWeight * intentWeight;
    }

    learnUserStyle(messageData) {
        const { content, analysis } = messageData;
        const { topics, intent } = analysis;

        // Simple user style learning based on topics and intent
        const userStyle = {
            topics: topics,
            intent: intent,
            timestamp: new Date().toISOString(),
        };

        // Store user style in a database or other storage mechanism
        // This is a placeholder for the actual storage logic
        console.log('User style learned:', userStyle);
    }
}

module.exports = EnhancedLearningService;
