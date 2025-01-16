const natural = require('natural');
const sentiment = require('sentiment');
const nlp = require('compromise');

class SentimentAnalyzer {
    constructor() {
        // Initialize NLP tools
        this.tokenizer = new natural.WordTokenizer();
        this.sentimentAnalyzer = new sentiment();
        
        // Keep existing keyword sets as fallback
        this.positiveWords = new Set(['happy', 'great', 'awesome', 'good', 'love', 'thanks', 'thank', '😊', '😃', '👍', 
            'excellent', 'wonderful', 'fantastic', 'perfect', 'brilliant', 'amazing', 'cool', 'nice', 'super']);
        this.negativeWords = new Set(['sad', 'bad', 'awful', 'terrible', 'hate', 'angry', '😢', '😠', '👎',
            'poor', 'horrible', 'worst', 'disappointed', 'upset', 'annoyed', 'frustrated']);
    }

    analyzeSentiment(message) {
        if (!message || typeof message !== 'string') {
            return {
                positive: 0,
                negative: 0,
                neutral: 1,
                score: 0,
                details: {
                    afinnScore: 0,
                    keywordScore: 0,
                    words: [],
                    tokens: 0
                }
            };
        }

        // Use multiple analysis methods for better accuracy
        const results = {
            sentiment: this.sentimentAnalyzer.analyze(message),
            tokens: this.tokenizer.tokenize(message.toLowerCase()),
            doc: nlp(message)
        };

        // Get sentiment scores from different methods
        const afinnScore = results.sentiment.score / 10; // Normalize to -1 to 1
        const keywordScore = this._getKeywordScore(results.tokens);
        
        // Combine scores with weights
        const combinedScore = (afinnScore * 0.6 + keywordScore * 0.4);
        
        // Convert to positive/negative/neutral percentages
        const normalizedScore = (combinedScore + 1) / 2; // Convert -1:1 to 0:1
        
        return {
            positive: Math.max(0, normalizedScore - 0.5) * 2,
            negative: Math.max(0, 0.5 - normalizedScore) * 2,
            neutral: 1 - Math.abs(normalizedScore - 0.5) * 2,
            score: combinedScore,
            details: {
                afinnScore,
                keywordScore,
                words: results.sentiment.words,
                tokens: results.tokens.length
            }
        };
    }

    async analyzeEmotionalTone(message) {
        if (!message || typeof message !== 'string') {
            return {
                emotion: 'neutral',
                intensity: 0,
                analysis: {
                    isQuestion: false,
                    isExcited: false,
                    hasEmoji: false,
                    emotions: {}
                }
            };
        }

        const doc = nlp(message);
        
        // Use compromise for advanced text analysis
        const analysis = {
            isQuestion: doc.questions().length > 0,
            isExcited: message.includes('!'),
            hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(message),
            emotions: this._detectEmotions(doc, message)
        };

        // Determine dominant emotion and intensity
        const dominantEmotion = this._getDominantEmotion(analysis.emotions);
        
        return {
            emotion: dominantEmotion.emotion,
            intensity: dominantEmotion.intensity,
            analysis: analysis
        };
    }

    _getKeywordScore(tokens) {
        let positive = 0;
        let negative = 0;
        
        tokens.forEach(token => {
            if (this.positiveWords.has(token)) positive++;
            if (this.negativeWords.has(token)) negative++;
        });
        
        const total = Math.max(1, positive + negative);
        return (positive - negative) / total;
    }

    _detectEmotions(doc, message) {
        const emotions = {
            happy: {
                score: 0,
                indicators: ['happy', 'joy', 'great', 'awesome', '😊', '😃', '😄']
            },
            sad: {
                score: 0,
                indicators: ['sad', 'unhappy', 'depressed', '😢', '😭', '😔']
            },
            angry: {
                score: 0,
                indicators: ['angry', 'mad', 'furious', '😠', '😡', '🤬']
            },
            excited: {
                score: 0,
                indicators: ['excited', 'wow', 'amazing', '🎉', '🎊', '🤩']
            },
            grateful: {
                score: 0,
                indicators: ['thank', 'thanks', 'grateful', '🙏']
            }
        };

        // Score each emotion based on indicators
        Object.keys(emotions).forEach(emotion => {
            const matches = emotions[emotion].indicators.filter(indicator => 
                message.toLowerCase().includes(indicator)
            );
            emotions[emotion].score = matches.length / emotions[emotion].indicators.length;
        });

        // Add NLP-based analysis
        const terms = doc.text().toLowerCase().split(' ');
        if (terms.includes('love')) emotions.happy.score += 0.5;
        if (terms.includes('hate')) emotions.angry.score += 0.5;
        if (message.includes('!')) {
            emotions.excited.score += 0.3;
            emotions.angry.score += 0.2;
        }

        return emotions;
    }

    _getDominantEmotion(emotions) {
        let maxScore = 0;
        let dominant = 'neutral';
        
        Object.entries(emotions).forEach(([emotion, data]) => {
            if (data.score > maxScore) {
                maxScore = data.score;
                dominant = emotion;
            }
        });
        
        return {
            emotion: dominant,
            intensity: Math.min(1, maxScore + 0.3) // Add base intensity
        };
    }
}

module.exports = SentimentAnalyzer;
