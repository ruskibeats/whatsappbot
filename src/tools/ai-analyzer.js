const { Pool } = require('pg');
require('dotenv').config();

class AIAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
    }

    async analyzeChat(chatId) {
        const client = await this.pool.connect();
        try {
            // Get chat summary
            const chatSummary = await client.query(`
                SELECT 
                    c.chat_name,
                    COUNT(DISTINCT ta.topic) as unique_topics,
                    MODE() WITHIN GROUP (ORDER BY cs.formality) as typical_formality,
                    MODE() WITHIN GROUP (ORDER BY cs.preferred_tone) as typical_tone,
                    AVG(ca.engagement_score) as avg_engagement
                FROM chats c
                LEFT JOIN topic_analysis ta ON c.chat_id = ta.chat_id
                LEFT JOIN communication_style cs ON c.chat_id = cs.chat_id
                LEFT JOIN chat_analytics ca ON c.chat_id = ca.chat_id
                WHERE c.chat_id = $1
                GROUP BY c.chat_name
            `, [chatId]);

            if (chatSummary.rows.length === 0) {
                throw new Error('Chat not found');
            }

            // Basic analysis without AI
            const analysis = {
                chatHealth: {
                    score: chatSummary.rows[0].avg_engagement || 0.5,
                    assessment: "Based on engagement metrics"
                },
                recommendations: [
                    {
                        type: "engagement",
                        suggestion: "Monitor chat activity regularly"
                    }
                ],
                opportunities: [
                    "Regular communication",
                    "Maintain engagement"
                ],
                risks: [
                    "Potential communication gaps",
                    "Response delays"
                ]
            };

            // Store analysis results
            await this.storeAnalysisResults(client, chatId, analysis);
            
            return analysis;

        } catch (error) {
            console.error('Error analyzing chat:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async storeAnalysisResults(client, chatId, analysis) {
        await client.query(`
            INSERT INTO chat_analysis (
                chat_id,
                timestamp,
                health_score,
                assessment,
                recommendations,
                opportunities,
                risks
            ) VALUES ($1, NOW(), $2, $3, $4, $5, $6)
        `, [
            chatId,
            analysis.chatHealth.score,
            analysis.chatHealth.assessment,
            JSON.stringify(analysis.recommendations),
            JSON.stringify(analysis.opportunities),
            JSON.stringify(analysis.risks)
        ]);
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = AIAnalyzer; 