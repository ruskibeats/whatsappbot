const { Pool } = require('pg');
const ConversationAnalyzer = require('./conversation-analyzer');
const TextStatistics = require('./text-statistics');

class ChatHistoryAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: 'russbee',
            password: 'skimmer69',
            host: '192.168.0.169',
            database: 'beehive',
            port: 5432
        });
        this.conversationAnalyzer = new ConversationAnalyzer();
        this.textStats = new TextStatistics();
    }

    async analyzeHistory() {
        try {
            console.log('Starting historical analysis...');

            // Get all unique users
            const users = await this.getUniqueUsers();
            console.log(`Found ${users.length} unique users to analyze`);

            for (const user of users) {
                // Get user's messages
                const messages = await this.getUserMessages(user);
                console.log(`Analyzing ${messages.length} messages for user ${user}`);

                if (messages.length === 0) continue;

                // Perform analysis
                const analysis = {
                    userId: user,
                    timestamp: new Date(),
                    conversationMetrics: this.conversationAnalyzer.analyzeConversationFlow(messages),
                    textMetrics: this.textStats.analyzeText(messages)
                };

                // Store analysis results
                await this.storeAnalysisResults(analysis);
            }

            console.log('Historical analysis complete');
        } catch (error) {
            console.error('Error during analysis:', error);
        } finally {
            await this.pool.end();
        }
    }

    async getUniqueUsers() {
        const result = await this.pool.query(
            'SELECT DISTINCT sender_id FROM messages'
        );
        return result.rows.map(row => row.sender_id);
    }

    async getUserMessages(userId) {
        const result = await this.pool.query(
            'SELECT * FROM messages WHERE sender_id = $1 ORDER BY timestamp DESC',
            [userId]
        );
        return result.rows;
    }

    async storeAnalysisResults(analysis) {
        // Store conversation metrics
        await this.pool.query(
            `INSERT INTO chat_analytics 
            (user_id, timestamp, message_count, active_hours, response_rate, 
             conversation_patterns, interaction_metrics)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                analysis.userId,
                analysis.timestamp,
                analysis.textMetrics.basic.totalMessages,
                JSON.stringify(analysis.conversationMetrics.timing.peakHours),
                analysis.conversationMetrics.patterns.responseRates[analysis.userId] || 0,
                JSON.stringify(analysis.conversationMetrics.patterns),
                JSON.stringify(analysis.conversationMetrics.metrics)
            ]
        );

        // Store text analysis results
        await this.pool.query(
            `INSERT INTO chat_llm_analysis
            (user_id, timestamp, sentiment_scores, topic_analysis, 
             language_patterns, vocabulary_metrics)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                analysis.userId,
                analysis.timestamp,
                JSON.stringify({}), // Placeholder for sentiment scores
                JSON.stringify({
                    commonPhrases: analysis.textMetrics.ngrams.commonPhrases,
                    topTerms: analysis.textMetrics.wordFrequency.topTerms
                }),
                JSON.stringify(analysis.textMetrics.patterns),
                JSON.stringify({
                    vocabularySize: analysis.textMetrics.vocabulary.vocabularySize,
                    vocabularyDiversity: analysis.textMetrics.vocabulary.vocabularyDiversity,
                    complexityScore: analysis.textMetrics.complexity.readabilityScore
                })
            ]
        );

        console.log(`Stored analysis results for user ${analysis.userId}`);
    }
}

// Run the analysis
const analyzer = new ChatHistoryAnalyzer();
analyzer.analyzeHistory(); 