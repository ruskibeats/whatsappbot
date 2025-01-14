const { Pool } = require('pg');

async function testDatabaseSave() {
    const pool = new Pool({
        user: 'russbee',
        password: 'skimmer69',
        host: 'localhost',
        database: 'beehive',
        port: 5432
    });

    // Sample payload matching the exact structure provided
    const testPayload = {
        timestamp: "2024-03-19T10:00:00Z",
        type: "chat_analysis",
        data: {
            chatId: "1234567890@g.us",
            chatJid: "1234567890-1234567890@g.us",
            chatName: "Flex clan",
            metadata: {
                created_at: "2023-01-15T00:00:00Z",
                participant_count: 25,
                is_group: true,
                description: "Team collaboration group",
                tags: ["team", "project", "active"]
            },
            analytics: {
                messageCount: 989,
                activeParticipants: 18,
                lastActivity: "2024-03-19T09:55:00Z",
                activityHeatmap: {
                    peak_hours: ["10:00", "15:00"],
                    quiet_hours: ["23:00", "04:00"]
                },
                engagement_metrics: {
                    daily_messages_avg: 45,
                    response_rate: 0.85,
                    response_time_avg: 300
                }
            },
            llmAnalysis: {
                sentiment: {
                    positive: 41,
                    negative: 4,
                    neutral: 55,
                    trending: "improving",
                    key_emotions: ["enthusiasm", "satisfaction"]
                },
                conversation_dynamics: {
                    dominant_speakers: 3,
                    participation_distribution: "balanced",
                    thread_depth_avg: 4.2,
                    conversation_continuity: 0.8
                },
                topic_analysis: {
                    current_topics: ["project launch", "timeline", "resource allocation"],
                    recurring_themes: ["deadlines", "team coordination", "technical issues"],
                    topic_sentiment: {
                        "project launch": "very positive",
                        "timeline": "neutral",
                        "resource allocation": "slightly concerned"
                    }
                },
                suggested_responses: [{
                    context: "Positive update",
                    tone: "enthusiastic",
                    template: "Great progress on {topic}! The team has really stepped up with {achievement}.",
                    variables: ["project launch", "meeting deadlines"],
                    best_time_to_respond: "within 2 hours"
                }],
                communication_style: {
                    formality: "semi-formal",
                    preferred_tone: "collaborative",
                    response_patterns: {
                        quick_replies: true,
                        detailed_messages: false,
                        emoji_usage: "moderate"
                    },
                    group_dynamics: {
                        decision_making: "consensus-based",
                        conflict_resolution: "collaborative"
                    }
                },
                action_items: {
                    immediate: [{
                        priority: "high",
                        task: "Follow up on resource allocation",
                        context: "Team expressed concerns"
                    }]
                },
                risk_assessment: {
                    attention_needed: ["resource constraints", "timeline pressure"],
                    positive_indicators: ["team morale", "project progress"]
                }
            }
        }
    };

    try {
        const client = await pool.connect();
        console.log('Connected to database');

        try {
            await client.query('BEGIN');

            // 1. Store chat metadata
            console.log('Storing chat metadata...');
            await client.query(
                `INSERT INTO chat_metadata 
                (chat_id, chat_jid, chat_name, created_at, participant_count, is_group, description, tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (chat_id) DO UPDATE SET
                chat_name = EXCLUDED.chat_name,
                participant_count = EXCLUDED.participant_count,
                description = EXCLUDED.description,
                tags = EXCLUDED.tags,
                last_updated = CURRENT_TIMESTAMP`,
                [
                    testPayload.data.chatId,
                    testPayload.data.chatJid,
                    testPayload.data.chatName,
                    testPayload.data.metadata.created_at,
                    testPayload.data.metadata.participant_count,
                    testPayload.data.metadata.is_group,
                    testPayload.data.metadata.description,
                    testPayload.data.metadata.tags
                ]
            );

            // 2. Store analytics
            console.log('Storing analytics...');
            await client.query(
                `INSERT INTO chat_analytics
                (chat_id, timestamp, message_count, active_participants, last_activity,
                daily_messages_avg, response_rate, response_time_avg, peak_hours, quiet_hours)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    testPayload.data.chatId,
                    new Date(testPayload.timestamp),
                    testPayload.data.analytics.messageCount,
                    testPayload.data.analytics.activeParticipants,
                    new Date(testPayload.data.analytics.lastActivity),
                    testPayload.data.analytics.engagement_metrics.daily_messages_avg,
                    testPayload.data.analytics.engagement_metrics.response_rate,
                    testPayload.data.analytics.engagement_metrics.response_time_avg,
                    testPayload.data.analytics.activityHeatmap.peak_hours,
                    testPayload.data.analytics.activityHeatmap.quiet_hours
                ]
            );

            // 3. Store LLM analysis
            console.log('Storing LLM analysis...');
            await client.query(
                `INSERT INTO chat_llm_analysis
                (chat_id, timestamp, sentiment, conversation_dynamics, topic_analysis, communication_style, group_dynamics)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    testPayload.data.chatId,
                    new Date(testPayload.timestamp),
                    JSON.stringify(testPayload.data.llmAnalysis.sentiment),
                    JSON.stringify(testPayload.data.llmAnalysis.conversation_dynamics),
                    JSON.stringify(testPayload.data.llmAnalysis.topic_analysis),
                    JSON.stringify(testPayload.data.llmAnalysis.communication_style),
                    JSON.stringify(testPayload.data.llmAnalysis.communication_style.group_dynamics)
                ]
            );

            // 4. Store suggested responses
            console.log('Storing suggested responses...');
            for (const response of testPayload.data.llmAnalysis.suggested_responses) {
                await client.query(
                    `INSERT INTO suggested_responses
                    (chat_id, timestamp, context, tone, template, variables, best_time_to_respond)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        testPayload.data.chatId,
                        new Date(testPayload.timestamp),
                        response.context,
                        response.tone,
                        response.template,
                        response.variables,
                        response.best_time_to_respond
                    ]
                );
            }

            // 5. Store action items
            console.log('Storing action items...');
            for (const item of testPayload.data.llmAnalysis.action_items.immediate) {
                await client.query(
                    `INSERT INTO action_items
                    (chat_id, timestamp, timeframe, priority, task, context)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        testPayload.data.chatId,
                        new Date(testPayload.timestamp),
                        'immediate',
                        item.priority,
                        item.task,
                        item.context
                    ]
                );
            }

            // 6. Store risk assessment
            console.log('Storing risk assessment...');
            for (const risk of testPayload.data.llmAnalysis.risk_assessment.attention_needed) {
                await client.query(
                    `INSERT INTO risk_assessment
                    (chat_id, timestamp, category, item)
                    VALUES ($1, $2, $3, $4)`,
                    [
                        testPayload.data.chatId,
                        new Date(testPayload.timestamp),
                        'attention_needed',
                        risk
                    ]
                );
            }
            for (const risk of testPayload.data.llmAnalysis.risk_assessment.positive_indicators) {
                await client.query(
                    `INSERT INTO risk_assessment
                    (chat_id, timestamp, category, item)
                    VALUES ($1, $2, $3, $4)`,
                    [
                        testPayload.data.chatId,
                        new Date(testPayload.timestamp),
                        'positive_indicators',
                        risk
                    ]
                );
            }

            await client.query('COMMIT');
            console.log('Successfully stored all data!');

            // Verify the data
            console.log('\nVerifying stored data...');
            const verifyQueries = [
                'SELECT * FROM chat_metadata WHERE chat_id = $1',
                'SELECT * FROM chat_analytics WHERE chat_id = $1',
                'SELECT * FROM chat_llm_analysis WHERE chat_id = $1',
                'SELECT * FROM suggested_responses WHERE chat_id = $1',
                'SELECT * FROM action_items WHERE chat_id = $1',
                'SELECT * FROM risk_assessment WHERE chat_id = $1'
            ];

            for (const query of verifyQueries) {
                const result = await client.query(query, [testPayload.data.chatId]);
                console.log(`\n${query.split(' ')[1]} has ${result.rows.length} rows`);
                if (result.rows.length > 0) {
                    console.log('Sample data:', JSON.stringify(result.rows[0], null, 2));
                }
            }

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
console.log('Starting database save test...');
testDatabaseSave(); 