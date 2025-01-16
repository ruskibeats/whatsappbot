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

    async analyzeHistoricalData() {
        console.log('Starting historical analysis...');
        const client = await this.pool.connect();
        
        try {
            // First, ensure we have a chat record for the owner
            await this.ensureOwnerChat(client);

            // Get all messages that haven't been analyzed
            const messages = await client.query(`
                SELECT m.* 
                FROM messages m
                LEFT JOIN sentiment_analysis sa ON m.message_id = sa.message_id
                WHERE sa.id IS NULL
                ORDER BY m.timestamp DESC
                LIMIT 100
            `);

            for (const message of messages.rows) {
                await this.analyzeMessage(client, message);
            }

            // Update chat analytics
            await this.updateChatAnalytics(client);

            console.log('Historical analysis completed successfully');
        } catch (error) {
            console.error('Error in historical analysis:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async ensureOwnerChat(client) {
        const ownerNumber = process.env.OWNER_NUMBER;
        if (!ownerNumber) {
            console.log('No owner number configured, skipping chat creation');
            return;
        }

        try {
            // Check if chat exists
            const existingChat = await client.query(
                'SELECT chat_id FROM chats WHERE chat_id = $1',
                [ownerNumber]
            );

            if (existingChat.rows.length === 0) {
                // Create chat record
                await client.query(
                    'INSERT INTO chats (chat_id, chat_name) VALUES ($1, $2)',
                    [ownerNumber, 'Owner Chat']
                );
                console.log('Created owner chat record');
            }
        } catch (error) {
            console.error('Error ensuring owner chat exists:', error);
            throw error;
        }
    }

    async analyzeMessage(client, message) {
        try {
            // Ensure chat exists
            await client.query(
                'INSERT INTO chats (chat_id, chat_name) VALUES ($1, $2) ON CONFLICT (chat_id) DO NOTHING',
                [message.chat_id, `Chat ${message.chat_id}`]
            );

            // Perform sentiment analysis
            const sentiment = await this.sentimentAnalyzer.analyzeSentiment(message.message_text);
            const emotion = await this.sentimentAnalyzer.analyzeEmotionalTone(message.message_text);

            // Store sentiment analysis
            await client.query(`
                INSERT INTO sentiment_analysis (
                    message_id, chat_id, timestamp,
                    positive_score, negative_score, neutral_score,
                    combined_score, afinn_score, keyword_score,
                    analyzed_tokens, sentiment_words
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

        } catch (error) {
            console.error(`Error analyzing message ${message.message_id}:`, error);
            throw error;
        }
    }

    async updateChatAnalytics(client) {
        try {
            // Get all chats
            const chats = await client.query('SELECT chat_id FROM chats');

            for (const chat of chats.rows) {
                // Calculate engagement score
                const engagement = await this.calculateEngagement(client, chat.chat_id);
                
                // Get sentiment trends
                const sentimentTrends = await this.getSentimentTrends(client, chat.chat_id);
                
                // Get emotion distribution
                const emotionDist = await this.getEmotionDistribution(client, chat.chat_id);

                // Update chat analytics
                await client.query(`
                    INSERT INTO chat_analytics (
                        chat_id, timestamp,
                        engagement_score, sentiment_trends,
                        emotion_distribution
                    ) VALUES ($1, NOW(), $2, $3, $4)
                    ON CONFLICT (chat_id) DO UPDATE
                    SET timestamp = NOW(),
                        engagement_score = $2,
                        sentiment_trends = $3,
                        emotion_distribution = $4
                `, [
                    chat.chat_id,
                    engagement,
                    JSON.stringify(sentimentTrends),
                    JSON.stringify(emotionDist)
                ]);
            }
        } catch (error) {
            console.error('Error updating chat analytics:', error);
            throw error;
        }
    }

    async calculateEngagement(client, chatId) {
        const result = await client.query(`
            SELECT 
                COUNT(DISTINCT sender) as unique_senders,
                COUNT(*) as total_messages,
                MAX(timestamp) - MIN(timestamp) as time_span
            FROM messages
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '24 hours'
        `, [chatId]);

        const stats = result.rows[0];
        if (!stats.total_messages) return 0;

        // Calculate engagement score (0-1)
        const messageFrequency = stats.total_messages / (stats.time_span || 1);
        const participationRate = stats.unique_senders / (stats.total_messages || 1);
        
        return (messageFrequency * 0.6 + participationRate * 0.4);
    }

    async getSentimentTrends(client, chatId) {
        const result = await client.query(`
            SELECT 
                date_trunc('hour', timestamp) as hour,
                AVG(positive_score) as avg_positive,
                AVG(negative_score) as avg_negative,
                AVG(neutral_score) as avg_neutral
            FROM sentiment_analysis
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour
        `, [chatId]);

        return result.rows;
    }

    async getEmotionDistribution(client, chatId) {
        const result = await client.query(`
            SELECT 
                dominant_emotion,
                COUNT(*) as count,
                AVG(emotion_intensity) as avg_intensity
            FROM emotional_analysis
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY dominant_emotion
        `, [chatId]);

        return result.rows;
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = BulkAnalyzer;
