const { OpenAI } = require('openai');
require('dotenv').config();

class SentimentAnalyzer {
    constructor() {
        // Using keyword-based analysis for bulk processing
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
                neutral: 1
            };
        }

        const text = message.toLowerCase();
        let positiveCount = 0;
        let negativeCount = 0;

        // Count word occurrences
        text.split(/\s+/).forEach(word => {
            if (this.positiveWords.has(word)) positiveCount++;
            if (this.negativeWords.has(word)) negativeCount++;
        });

        // Check for emojis and common expressions
        this.positiveWords.forEach(word => {
            if (text.includes(word)) positiveCount++;
        });
        this.negativeWords.forEach(word => {
            if (text.includes(word)) negativeCount++;
        });

        // Calculate normalized scores (0 to 1)
        const total = Math.max(1, positiveCount + negativeCount); // Avoid division by zero
        const positive = positiveCount / total;
        const negative = negativeCount / total;
        const neutral = Math.max(0, 1 - (positive + negative));

        return {
            positive,
            negative,
            neutral
        };
    }

    async analyzeEmotionalTone(message) {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openrouter_api_key_here') {
            // Basic emotion analysis using keyword and emoji matching
            const text = message.toLowerCase();
            const emotions = {
                happy: ['happy', 'joy', 'great', 'awesome', '😊', '😃', '😄'],
                sad: ['sad', 'unhappy', 'depressed', '😢', '😭', '😔'],
                angry: ['angry', 'mad', 'furious', '😠', '😡', '🤬'],
                excited: ['excited', 'wow', 'amazing', '🎉', '🎊', '🤩'],
                grateful: ['thank', 'thanks', 'grateful', '🙏'],
                neutral: ['ok', 'okay', 'fine', 'normal']
            };
            
            for (const [emotion, keywords] of Object.entries(emotions)) {
                if (keywords.some(word => text.includes(word))) {
                    return {
                        emotion,
                        intensity: 0.7
                    };
                }
            }
            
            return {
                emotion: 'neutral',
                intensity: 0.5
            };
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'openai/gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Analyze the emotional tone of the message. Return the primary emotion (e.g., happy, sad, angry, excited, etc.) and intensity (0-1). Format: EMOTION|INTENSITY'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            const result = response.choices[0].message.content.trim();
            const [emotion, intensity] = result.split('|');
            
            return {
                emotion: emotion.trim().toLowerCase(),
                intensity: parseFloat(intensity) || 0.5
            };
        } catch (error) {
            console.error('Error analyzing emotional tone:', error);
            return {
                emotion: 'neutral',
                intensity: 0.5
            };
        }
    }
}

module.exports = SentimentAnalyzer;
