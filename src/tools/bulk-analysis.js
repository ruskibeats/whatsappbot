const { Pool } = require('pg');
const SentimentAnalyzer = require('../services/SentimentAnalyzer');
require('dotenv').config();

class BulkAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        this.sentimentAnalyzer = new SentimentAnalyzer();
    }

    async analyzeAllMessages() {
        const client = await this.pool.connect();
        try {
            console.log('Starting bulk analysis...');
            
            // Get all messages that haven't been analyzed
            const { rows: messages } = await client.query(`
                SELECT m.* 
                FROM messages m 
                LEFT JOIN sentiment_analysis sa ON m.message_id = sa.message_id
                WHERE sa.message_id IS NULL
                AND m.message_text IS NOT NULL
                AND m.message_text != ''
                ORDER BY m.timestamp DESC
            `);

            console.log(`Found ${messages.length} messages to analyze`);

            for (const message of messages) {
                await this.analyzeMessage(client, message);
            }

            console.log('Bulk analysis completed');
            
        } catch (error) {
            console.error('Error during bulk analysis:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async analyzeMessage(client, message) {
        try {
            console.log(`Analyzing message: "${message.message_text}"`);
            
            // Perform sentiment analysis
            const sentiment = this.sentimentAnalyzer.analyzeSentiment(message.message_text);
            const emotion = await this.sentimentAnalyzer.analyzeEmotionalTone(message.message_text);
            
            // Store sentiment analysis
            await client.query(`
                INSERT INTO sentiment_analysis (
                    message_id, chat_id, timestamp,
                    positive_score, negative_score, neutral_score,
                    combined_score, afinn_score, keyword_score,
                    analyzed_tokens, sentiment_words
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (message_id) DO UPDATE SET
                    positive_score = EXCLUDED.positive_score,
                    negative_score = EXCLUDED.negative_score,
                    neutral_score = EXCLUDED.neutral_score,
                    combined_score = EXCLUDED.combined_score,
                    afinn_score = EXCLUDED.afinn_score,
                    keyword_score = EXCLUDED.keyword_score,
                    analyzed_tokens = EXCLUDED.analyzed_tokens,
                    sentiment_words = EXCLUDED.sentiment_words
            `, [
                message.message_id,
                message.chat_id,
                message.timestamp,
                sentiment.positive,
                sentiment.negative,
                sentiment.neutral,
                sentiment.score,
                sentiment.details.afinnScore,
                sentiment.details.keywordScore,
                sentiment.details.tokens,
                JSON.stringify(sentiment.details.words)
            ]);

            // Store emotional analysis
            await client.query(`
                INSERT INTO emotional_analysis (
                    message_id, chat_id, timestamp,
                    dominant_emotion, emotion_intensity,
                    is_question, is_excited, has_emoji,
                    emotion_scores
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (message_id) DO UPDATE SET
                    dominant_emotion = EXCLUDED.dominant_emotion,
                    emotion_intensity = EXCLUDED.emotion_intensity,
                    is_question = EXCLUDED.is_question,
                    is_excited = EXCLUDED.is_excited,
                    has_emoji = EXCLUDED.has_emoji,
                    emotion_scores = EXCLUDED.emotion_scores
            `, [
                message.message_id,
                message.chat_id,
                message.timestamp,
                emotion.emotion,
                emotion.intensity,
                emotion.analysis.isQuestion,
                emotion.analysis.isExcited,
                emotion.analysis.hasEmoji,
                JSON.stringify(emotion.analysis.emotions)
            ]);

            console.log('Analysis stored successfully');

        } catch (error) {
            console.error(`Error analyzing message: ${error}`);
            throw error;
        }
    }
}

// Run the analyzer
const analyzer = new BulkAnalyzer();
analyzer.analyzeAllMessages().catch(console.error);
