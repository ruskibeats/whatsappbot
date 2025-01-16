const SentimentAnalyzer = require('./SentimentAnalyzer');

class AIResponseGenerator {
    constructor() {
        this.sentimentAnalyzer = new SentimentAnalyzer();
    }

    async generateResponse(message, context) {
        // Use local NLP analysis instead of OpenAI
        const sentiment = await this.sentimentAnalyzer.analyzeSentiment(message);
        const emotion = await this.sentimentAnalyzer.analyzeEmotionalTone(message);

        // Generate appropriate response based on analysis
        let response = this._constructResponse(sentiment, emotion, context);
        
        return {
            text: response,
            sentiment: sentiment,
            emotion: emotion
        };
    }

    _constructResponse(sentiment, emotion, context) {
        // Basic response generation based on sentiment and emotion
        if (sentiment.positive > 0.7) {
            return "That's great to hear! 😊";
        } else if (sentiment.negative > 0.7) {
            return "I'm sorry to hear that. Is there anything I can help with? 🤝";
        } else if (emotion.emotion === 'excited') {
            return "That sounds exciting! 🎉";
        } else if (emotion.emotion === 'grateful') {
            return "You're welcome! 🙏";
        } else if (emotion.isQuestion) {
            return "Let me help you with that question...";
        }
        
        return "I understand. Please tell me more...";
    }
}

module.exports = AIResponseGenerator;
