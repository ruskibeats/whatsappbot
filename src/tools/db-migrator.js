const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DatabaseMigrator {
    constructor() {
        this.pool = new Pool({
            user: 'russbee',
            password: 'skimmer69',
            host: 'localhost',
            database: 'beehive',
            port: 5432
        });
    }

    async migrateData() {
        try {
            console.log('Starting data migration...');
            
            // Read message files
            const messagesDir = path.join(process.cwd(), 'data', 'recent_messages');
            const files = await fs.readdir(messagesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(messagesDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const messages = JSON.parse(content);
                await this.processMessages(messages);
            }

            // Read profile files
            const profilesDir = path.join(process.cwd(), 'data', 'analyzed_profiles');
            const profileFiles = await fs.readdir(profilesDir);
            const profileJsonFiles = profileFiles.filter(file => file.endsWith('.json'));

            for (const file of profileJsonFiles) {
                const filePath = path.join(profilesDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const profiles = JSON.parse(content);
                await this.processProfiles(profiles);
            }

            console.log('Migration completed successfully');
        } catch (error) {
            console.error('Migration failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async processMessages(messages) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const msg of messages) {
                // Insert chat if not exists
                await client.query(`
                    INSERT INTO chats (chat_id, chat_jid, chat_name, created_at, is_group)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (chat_id) DO UPDATE 
                    SET last_updated = CURRENT_TIMESTAMP
                `, [msg.chat.id, msg.chat.jid, msg.chat.name, msg.timestamp, msg.chat.isGroup]);

                // Update analytics
                await client.query(`
                    INSERT INTO chat_analytics (chat_id, timestamp, message_count, active_participants)
                    VALUES ($1, $2, 1, 1)
                    ON CONFLICT (chat_id, timestamp) DO UPDATE 
                    SET message_count = chat_analytics.message_count + 1
                `, [msg.chat.id, msg.timestamp]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processProfiles(profiles) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const profile of profiles) {
                // Insert topic analysis
                if (profile.topics) {
                    for (const [topic, count] of Object.entries(profile.topics)) {
                        await client.query(`
                            INSERT INTO topic_analysis (chat_id, timestamp, topic_type, topic)
                            VALUES ($1, CURRENT_TIMESTAMP, 'current', $2)
                        `, [profile.id, topic]);
                    }
                }

                // Insert activity patterns
                if (profile.activityPatterns?.hourly) {
                    for (const hour of profile.activityPatterns.hourly) {
                        await client.query(`
                            INSERT INTO activity_hours (chat_id, timestamp, hour_type, hour_value)
                            VALUES ($1, CURRENT_TIMESTAMP, 'peak', $2::TIME)
                        `, [profile.id, hour]);
                    }
                }

                // Insert communication style
                if (profile.analysisNotes) {
                    await client.query(`
                        INSERT INTO communication_style (
                            chat_id, timestamp, formality, preferred_tone,
                            quick_replies, detailed_messages, emoji_usage
                        )
                        VALUES ($1, CURRENT_TIMESTAMP, 'semi-formal', $2, true, false, 'moderate')
                    `, [profile.id, profile.analysisNotes.engagementLevel]);
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Run migration
const migrator = new DatabaseMigrator();
migrator.migrateData().catch(console.error); 