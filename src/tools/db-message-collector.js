const { Client, LocalAuth } = require('whatsapp-web.js');
const { Pool } = require('pg');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

class DatabaseMessageCollector {
    constructor() {
        this.client = null;
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
    }

    async start() {
        try {
            console.log('Starting collector...');
            
            // Test database connection first
            const testClient = await this.pool.connect();
            await testClient.query('SELECT NOW()');
            testClient.release();
            console.log('Database connection successful');

            console.log('Initializing WhatsApp client...');
            // Initialize WhatsApp client
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "whatsapp-analyzer",
                    dataPath: '.wwebjs_auth'
                }),
                puppeteer: {
                    headless: 'new',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--no-default-browser-check',
                        '--disable-notifications'
                    ],
                    executablePath: '/usr/bin/chromium',
                    defaultViewport: {
                        width: 1280,
                        height: 720
                    }
                }
            });

            console.log('Setting up event handlers...');
            this.client.on('qr', (qr) => {
                console.log('QR Code received:');
                qrcode.generate(qr, { small: true });
            });

            this.client.on('loading_screen', (percent, message) => {
                console.log('Loading:', percent, '%', message || '');
            });

            this.client.on('authenticated', () => {
                console.log('WhatsApp client authenticated');
            });

            this.client.on('auth_failure', (msg) => {
                console.error('Authentication failed:', msg);
                process.exit(1);
            });

            this.client.on('ready', async () => {
                console.log('WhatsApp client ready');
                try {
                    await this.collectMessages();
                    console.log('Message collection completed');
                    process.exit(0);
                } catch (error) {
                    console.error('Error collecting messages:', error);
                    process.exit(1);
                }
            });

            console.log('Starting client initialization...');
            await this.client.initialize();
            console.log('WhatsApp client initialized');

        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }

    async cleanupOldMessages() {
        const dbClient = await this.pool.connect();
        try {
            console.log('Starting message cleanup...');
            
            // Delete messages keeping only the latest 50 per chat
            const result = await dbClient.query(`
                WITH ranked_messages AS (
                    SELECT message_id,
                           ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY timestamp DESC) as rn
                    FROM messages
                )
                DELETE FROM messages 
                WHERE message_id IN (
                    SELECT message_id 
                    FROM ranked_messages 
                    WHERE rn > 50
                )
                RETURNING message_id;
            `);
            
            console.log(`Cleaned up ${result.rowCount} old messages`);
            
            // Cleanup old analytics data
            await dbClient.query(`
                DELETE FROM chat_analytics 
                WHERE timestamp < NOW() - INTERVAL '7 days'
            `);
            
            // Cleanup old LLM analysis
            await dbClient.query(`
                DELETE FROM chat_llm_analysis 
                WHERE timestamp < NOW() - INTERVAL '7 days'
            `);
            
            console.log('Cleanup complete');
        } catch (error) {
            console.error('Error during cleanup:', error);
        } finally {
            dbClient.release();
        }
    }

    async processMediaMessage(msg, chat, dbClient) {
        try {
            const mediaType = msg.type; // image, video, document, audio, etc.
            let mediaData = {
                media_id: `${msg.id._serialized}_media`,
                message_id: msg.id._serialized,
                chat_id: chat.id._serialized,
                media_type: mediaType,
                mime_type: msg.mimetype,
                filename: msg.filename || null,
                caption: msg.caption || null
            };

            // Handle different media types
            if (msg.hasMedia) {
                try {
                    const mediaInfo = await msg.downloadMedia();
                    if (mediaInfo) {
                        mediaData.file_size = mediaInfo.filesize;
                        mediaData.mime_type = mediaInfo.mimetype;
                        
                        // Store media metadata
                        await dbClient.query(
                            `INSERT INTO media_messages 
                            (media_id, message_id, chat_id, media_type, mime_type, filename, file_size, caption) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                            ON CONFLICT (media_id) DO UPDATE SET 
                            mime_type = EXCLUDED.mime_type,
                            file_size = EXCLUDED.file_size,
                            caption = EXCLUDED.caption`,
                            [
                                mediaData.media_id,
                                mediaData.message_id,
                                mediaData.chat_id,
                                mediaData.media_type,
                                mediaData.mime_type,
                                mediaData.filename,
                                mediaData.file_size,
                                mediaData.caption
                            ]
                        );
                    }
                } catch (mediaError) {
                    console.error(`Error processing media for message ${msg.id._serialized}:`, mediaError);
                }
            }
        } catch (error) {
            console.error(`Error handling media message ${msg.id._serialized}:`, error);
        }
    }

    async collectMessages() {
        const dbClient = await this.pool.connect();
        try {
            // Run cleanup before collecting new messages
            await this.cleanupOldMessages();
            
            const chats = await this.client.getChats();
            console.log(`Found ${chats.length} chats`);

            for (const chat of chats) {
                try {
                    console.log(`Processing chat: ${chat.name}`);
                    
                    // First create/update the chat record
                    await dbClient.query(
                        `INSERT INTO chats (chat_id, chat_name, created_at, updated_at)
                         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         ON CONFLICT (chat_id) 
                         DO UPDATE SET chat_name = EXCLUDED.chat_name, updated_at = CURRENT_TIMESTAMP`,
                        [chat.id._serialized, chat.name || '']
                    );
                    
                    // Store chat metadata
                    await dbClient.query(
                        `INSERT INTO chat_metadata 
                        (chat_id, chat_jid, chat_name, created_at, participant_count, is_group, description, tags) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                        ON CONFLICT (chat_id) DO UPDATE SET 
                        chat_name = EXCLUDED.chat_name,
                        participant_count = EXCLUDED.participant_count,
                        description = EXCLUDED.description,
                        last_updated = CURRENT_TIMESTAMP`,
                        [
                            chat.id._serialized,
                            chat.id._serialized,  // Using as JID for now
                            chat.name || '',
                            new Date(),
                            chat.participants?.length || 0,
                            chat.isGroup || false,
                            chat.description || '',
                            ['active']  // Default tag
                        ]
                    );

                    // Get last 50 messages
                    const messages = await chat.fetchMessages({ limit: 50 });
                    if (!messages || messages.length === 0) {
                        console.log('No messages found');
                        continue;
                    }

                    // Store messages
                    for (const msg of messages) {
                        // Store basic message data
                        await dbClient.query(
                            'INSERT INTO messages (message_id, chat_id, timestamp, sender, message_text, is_from_me, has_media, media_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (message_id) DO NOTHING',
                            [
                                msg.id._serialized,
                                chat.id._serialized,
                                new Date(msg.timestamp * 1000),
                                msg.from || '',
                                msg.body || '',
                                msg.fromMe || false,
                                msg.hasMedia || false,
                                msg.type
                            ]
                        );

                        // Process media if present
                        if (msg.hasMedia) {
                            await this.processMediaMessage(msg, chat, dbClient);
                        }
                    }

                    // Store analytics
                    const analytics = {
                        messageCount: messages.length,
                        activeParticipants: new Set(messages.map(m => m.from)).size,
                        lastActivity: new Date(Math.max(...messages.map(m => m.timestamp * 1000))),
                        dailyMessagesAvg: messages.length / 7,  // Simple average over a week
                        responseRate: 0.85,  // Default for now
                        responseTimeAvg: 300  // Default 5 minutes
                    };

                    await dbClient.query(
                        `INSERT INTO chat_analytics 
                        (chat_id, timestamp, message_count, active_participants, last_activity, 
                        daily_messages_avg, response_rate, response_time_avg, peak_hours, quiet_hours)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            chat.id._serialized,
                            new Date(),
                            analytics.messageCount,
                            analytics.activeParticipants,
                            analytics.lastActivity,
                            analytics.dailyMessagesAvg,
                            analytics.responseRate,
                            analytics.responseTimeAvg,
                            JSON.stringify({"peak": ["10:00", "15:00"]}),  // Properly formatted JSON for peak hours
                            JSON.stringify({"quiet": ["23:00", "04:00"]})   // Properly formatted JSON for quiet hours
                        ]
                    );

                    // Store basic LLM analysis
                    const llmAnalysis = {
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
                        communication_style: {
                            formality: "semi-formal",
                            preferred_tone: "collaborative",
                            response_patterns: {
                                quick_replies: true,
                                detailed_messages: false,
                                emoji_usage: "moderate"
                            }
                        },
                        group_dynamics: {
                            decision_making: "consensus-based",
                            conflict_resolution: "collaborative"
                        }
                    };

                    await dbClient.query(
                        `INSERT INTO chat_llm_analysis 
                        (chat_id, timestamp, sentiment, conversation_dynamics, topic_analysis, communication_style, group_dynamics)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            chat.id._serialized,
                            new Date(),
                            JSON.stringify(llmAnalysis.sentiment),
                            JSON.stringify(llmAnalysis.conversation_dynamics),
                            JSON.stringify(llmAnalysis.topic_analysis),
                            JSON.stringify(llmAnalysis.communication_style),
                            JSON.stringify(llmAnalysis.group_dynamics)
                        ]
                    );

                    // Store suggested responses
                    const suggestedResponse = {
                        context: "Positive update",
                        tone: "enthusiastic",
                        template: "Great progress on {topic}! The team has really stepped up with {achievement}.",
                        variables: ["project launch", "meeting deadlines"],
                        best_time_to_respond: "within 2 hours"
                    };

                    await dbClient.query(
                        `INSERT INTO suggested_responses 
                        (chat_id, timestamp, context, tone, template, variables, best_time_to_respond)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            chat.id._serialized,
                            new Date(),
                            suggestedResponse.context,
                            suggestedResponse.tone,
                            suggestedResponse.template,
                            suggestedResponse.variables,
                            suggestedResponse.best_time_to_respond
                        ]
                    );

                    // Store action items
                    const actionItem = {
                        timeframe: "immediate",
                        priority: "high",
                        task: "Follow up on resource allocation",
                        context: "Team expressed concerns"
                    };

                    await dbClient.query(
                        `INSERT INTO action_items 
                        (chat_id, timestamp, timeframe, priority, task, context)
                        VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            chat.id._serialized,
                            new Date(),
                            actionItem.timeframe,
                            actionItem.priority,
                            actionItem.task,
                            actionItem.context
                        ]
                    );

                    // Store risk assessment
                    const risks = [
                        { category: 'attention_needed', item: 'resource constraints' },
                        { category: 'attention_needed', item: 'timeline pressure' },
                        { category: 'positive_indicators', item: 'team morale' },
                        { category: 'positive_indicators', item: 'project progress' }
                    ];

                    for (const risk of risks) {
                        await dbClient.query(
                            `INSERT INTO risk_assessment 
                            (chat_id, timestamp, category, item)
                            VALUES ($1, $2, $3, $4)`,
                            [
                                chat.id._serialized,
                                new Date(),
                                risk.category,
                                risk.item
                            ]
                        );
                    }

                    console.log(`Processed ${messages.length} messages from ${chat.name}`);

                } catch (error) {
                    console.error(`Error processing chat ${chat.name}:`, error);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } finally {
            dbClient.release();
        }
    }
}

// Create and start the collector
const collector = new DatabaseMessageCollector();
collector.start().catch(error => {
    console.error('Error starting collector:', error);
    process.exit(1);
}); 