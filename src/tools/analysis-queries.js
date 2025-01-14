const { Pool } = require('pg');

class ChatAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: 'russbee',
            password: 'skimmer69',
            host: 'localhost',
            database: 'beehive',
            port: 5432
        });
    }

    async getTopActiveChats(limit = 10) {
        const query = `
            SELECT c.chat_name, 
                   SUM(ca.message_count) as total_messages,
                   AVG(ca.active_participants) as avg_active_participants,
                   MAX(ca.last_activity) as last_activity
            FROM chats c
            JOIN chat_analytics ca ON c.chat_id = ca.chat_id
            WHERE ca.timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY c.chat_id, c.chat_name
            ORDER BY total_messages DESC
            LIMIT $1;
        `;
        const result = await this.pool.query(query, [limit]);
        return result.rows;
    }

    async getChatSentimentTrend(chatId) {
        const query = `
            SELECT 
                DATE_TRUNC('day', timestamp) as date,
                AVG(positive_percentage) as avg_positive,
                AVG(negative_percentage) as avg_negative,
                AVG(neutral_percentage) as avg_neutral,
                MODE() WITHIN GROUP (ORDER BY trending) as trending_sentiment
            FROM sentiment_analysis
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', timestamp)
            ORDER BY date;
        `;
        const result = await this.pool.query(query, [chatId]);
        return result.rows;
    }

    async getTopDiscussedTopics(chatId, days = 7) {
        const query = `
            SELECT 
                topic,
                COUNT(*) as mention_count,
                MODE() WITHIN GROUP (ORDER BY sentiment) as common_sentiment
            FROM topic_analysis
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '$2 days'
            GROUP BY topic
            ORDER BY mention_count DESC
            LIMIT 10;
        `;
        const result = await this.pool.query(query, [chatId, days]);
        return result.rows;
    }

    async getActivityHeatmap(chatId) {
        const query = `
            SELECT 
                EXTRACT(HOUR FROM hour_value) as hour,
                COUNT(*) as activity_count,
                hour_type
            FROM activity_hours
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '14 days'
            GROUP BY EXTRACT(HOUR FROM hour_value), hour_type
            ORDER BY hour;
        `;
        const result = await this.pool.query(query, [chatId]);
        return result.rows;
    }

    async getCommunicationStyle(chatId) {
        const query = `
            SELECT 
                formality,
                preferred_tone,
                emoji_usage,
                decision_making,
                conflict_resolution
            FROM communication_style
            WHERE chat_id = $1
            ORDER BY timestamp DESC
            LIMIT 1;
        `;
        const result = await this.pool.query(query, [chatId]);
        return result.rows[0];
    }

    async getActionItems(chatId, priority = 'high') {
        const query = `
            SELECT 
                timeframe,
                task,
                context,
                timestamp
            FROM action_items
            WHERE chat_id = $1
            AND priority = $2
            AND timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC;
        `;
        const result = await this.pool.query(query, [chatId, priority]);
        return result.rows;
    }

    async getRiskAssessment(chatId) {
        const query = `
            SELECT 
                category,
                ARRAY_AGG(item) as items
            FROM risk_assessment
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY category;
        `;
        const result = await this.pool.query(query, [chatId]);
        return result.rows;
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = ChatAnalyzer; 