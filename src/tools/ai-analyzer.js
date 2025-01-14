const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

class AIAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER || 'russbee',
            password: process.env.DB_PASSWORD || 'skimmer69',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'beehive',
            port: process.env.DB_PORT || 5432
        });

        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-opus-20240229';
        
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY environment variable is missing');
        }
    }

    async analyzeMessage(chatId, message, timestamp) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get message context
            const context = await this.getMessageContext(client, chatId);
            
            // Analyze with AI
            const analysis = await this.performAIAnalysis(message, context);

            // Store sentiment analysis
            await this.storeSentimentAnalysis(client, chatId, timestamp, analysis.sentiment);

            // Store topic analysis
            await this.storeTopicAnalysis(client, chatId, timestamp, analysis.topics);

            // Store action items
            if (analysis.actionItems.length > 0) {
                await this.storeActionItems(client, chatId, timestamp, analysis.actionItems);
            }

            // Store risk assessment
            if (analysis.risks.length > 0) {
                await this.storeRiskAssessment(client, chatId, timestamp, analysis.risks);
            }

            await client.query('COMMIT');
            return analysis;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in AI analysis:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getMessageContext(client, chatId) {
        // Get recent messages for context
        const recentMessages = await client.query(`
            SELECT topic, sentiment
            FROM topic_analysis
            WHERE chat_id = $1
            AND timestamp >= NOW() - INTERVAL '1 hour'
            ORDER BY timestamp DESC
            LIMIT 5
        `, [chatId]);

        // Get chat style
        const chatStyle = await client.query(`
            SELECT formality, preferred_tone
            FROM communication_style
            WHERE chat_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
        `, [chatId]);

        return {
            recentTopics: recentMessages.rows.map(r => r.topic),
            recentSentiments: recentMessages.rows.map(r => r.sentiment),
            communicationStyle: chatStyle.rows[0] || { formality: 'casual', preferred_tone: 'friendly' }
        };
    }

    async performAIAnalysis(message, context) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/yourusername/whatsapp-analyzer',
                'X-Title': 'WhatsApp Message Analyzer'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [{
                    role: "system",
                    content: `You are an expert conversation analyzer. Analyze the following message in the context of a WhatsApp chat.
                    Recent topics: ${context.recentTopics.join(', ')}
                    Recent sentiments: ${context.recentSentiments.join(', ')}
                    Communication style: ${context.communicationStyle.formality}, ${context.communicationStyle.preferred_tone}
                    
                    Provide analysis in the following JSON format:
                    {
                        "sentiment": {"type": "positive|negative|neutral", "confidence": 0.0-1.0},
                        "topics": [{"name": "topic", "relevance": 0.0-1.0}],
                        "actionItems": [{"priority": "high|medium|low", "task": "description", "context": "context"}],
                        "risks": [{"category": "attention_needed|positive_indicator", "item": "description"}]
                    }`
                }, {
                    role: "user",
                    content: message
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${error}`);
        }

        const result = await response.json();
        return JSON.parse(result.choices[0].message.content);
    }

    async storeSentimentAnalysis(client, chatId, timestamp, sentiment) {
        await client.query(`
            INSERT INTO sentiment_analysis (
                chat_id, timestamp, 
                positive_percentage, negative_percentage, neutral_percentage,
                trending
            )
            VALUES (
                $1, $2,
                $3, $4, $5, $6
            )
        `, [
            chatId,
            timestamp,
            sentiment.type === 'positive' ? sentiment.confidence : 0,
            sentiment.type === 'negative' ? sentiment.confidence : 0,
            sentiment.type === 'neutral' ? sentiment.confidence : 0,
            sentiment.type
        ]);
    }

    async storeTopicAnalysis(client, chatId, timestamp, topics) {
        for (const topic of topics) {
            await client.query(`
                INSERT INTO topic_analysis (
                    chat_id, timestamp, topic_type,
                    topic, sentiment
                )
                VALUES ($1, $2, 'ai_detected', $3, $4)
            `, [
                chatId,
                timestamp,
                topic.name,
                topic.relevance > 0.7 ? 'positive' : topic.relevance > 0.3 ? 'neutral' : 'negative'
            ]);
        }
    }

    async storeActionItems(client, chatId, timestamp, actionItems) {
        for (const item of actionItems) {
            await client.query(`
                INSERT INTO action_items (
                    chat_id, timestamp, timeframe,
                    priority, task, context
                )
                VALUES ($1, $2, 'immediate', $3, $4, $5)
            `, [
                chatId,
                timestamp,
                item.priority,
                item.task,
                item.context
            ]);
        }
    }

    async storeRiskAssessment(client, chatId, timestamp, risks) {
        for (const risk of risks) {
            await client.query(`
                INSERT INTO risk_assessment (
                    chat_id, timestamp, category, item
                )
                VALUES ($1, $2, $3, $4)
            `, [
                chatId,
                timestamp,
                risk.category,
                risk.item
            ]);
        }
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

            const prompt = {
                model: "gpt-4-turbo-preview",
                messages: [{
                    role: "system",
                    content: `You are an expert conversation analyzer. Analyze the following chat summary and provide strategic insights.
                    Chat name: ${chatSummary.rows[0].chat_name}
                    Unique topics discussed: ${chatSummary.rows[0].unique_topics}
                    Typical formality: ${chatSummary.rows[0].typical_formality}
                    Typical tone: ${chatSummary.rows[0].typical_tone}
                    Average engagement: ${chatSummary.rows[0].avg_engagement}
                    
                    Provide analysis in the following JSON format:
                    {
                        "chatHealth": {"score": 0.0-1.0, "assessment": "description"},
                        "recommendations": [{"type": "engagement|tone|topics", "suggestion": "description"}],
                        "opportunities": ["description"],
                        "risks": ["description"]
                    }`
                }]
            };

            const completion = await this.openai.chat.completions.create(prompt);
            const analysis = JSON.parse(completion.choices[0].message.content);

            // Store the analysis
            await client.query(`
                INSERT INTO chat_analytics (
                    chat_id, timestamp,
                    engagement_score, response_patterns
                )
                VALUES ($1, NOW(), $2, $3)
            `, [
                chatId,
                analysis.chatHealth.score,
                JSON.stringify({
                    assessment: analysis.chatHealth.assessment,
                    recommendations: analysis.recommendations,
                    opportunities: analysis.opportunities,
                    risks: analysis.risks
                })
            ]);

            return analysis;

        } finally {
            client.release();
        }
    }
}

module.exports = AIAnalyzer; 