const { Pool } = require('pg');

async function setupDatabase() {
    const pool = new Pool({
        user: 'russbee',
        password: 'skimmer69',
        host: 'localhost',
        database: 'beehive',
        port: 5432
    });

    try {
        console.log('Setting up database...');
        const client = await pool.connect();
        
        // Drop existing tables
        console.log('Dropping existing tables...');
        await client.query(`
            DROP TABLE IF EXISTS messages CASCADE;
            DROP TABLE IF EXISTS chat_metadata CASCADE;
            DROP TABLE IF EXISTS chat_analytics CASCADE;
            DROP TABLE IF EXISTS chat_llm_analysis CASCADE;
            DROP TABLE IF EXISTS suggested_responses CASCADE;
            DROP TABLE IF EXISTS action_items CASCADE;
            DROP TABLE IF EXISTS risk_assessment CASCADE;
        `);
        
        // Create tables with updated schema
        console.log('Creating tables...');
        await client.query(`
            -- Base chat metadata
            CREATE TABLE chat_metadata (
                chat_id TEXT PRIMARY KEY,
                chat_jid TEXT UNIQUE,
                chat_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE,
                participant_count INTEGER,
                is_group BOOLEAN,
                description TEXT,
                tags TEXT[],
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Message storage
            CREATE TABLE messages (
                message_id TEXT PRIMARY KEY,
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                sender_id TEXT,
                message_body TEXT,
                is_from_me BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Analytics data
            CREATE TABLE chat_analytics (
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                message_count INTEGER,
                active_participants INTEGER,
                last_activity TIMESTAMP WITH TIME ZONE,
                daily_messages_avg FLOAT,
                response_rate FLOAT,
                response_time_avg INTEGER,
                peak_hours TEXT[],
                quiet_hours TEXT[],
                PRIMARY KEY (chat_id, timestamp)
            );

            -- LLM Analysis results with complete topic analysis
            CREATE TABLE chat_llm_analysis (
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                sentiment JSONB,
                conversation_dynamics JSONB,
                topic_analysis JSONB,  -- Includes current_topics, recurring_themes, and topic_sentiment
                communication_style JSONB,
                group_dynamics JSONB,  -- Added for decision_making and conflict_resolution
                PRIMARY KEY (chat_id, timestamp)
            );

            -- Suggested responses
            CREATE TABLE suggested_responses (
                id SERIAL PRIMARY KEY,
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                context TEXT,
                tone TEXT,
                template TEXT,
                variables TEXT[],
                best_time_to_respond TEXT
            );

            -- Action items with timeframe support
            CREATE TABLE action_items (
                id SERIAL PRIMARY KEY,
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                timeframe TEXT,  -- 'immediate' or 'short_term'
                priority TEXT,
                task TEXT,
                context TEXT
            );

            -- Risk assessment with categorization
            CREATE TABLE risk_assessment (
                id SERIAL PRIMARY KEY,
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                category TEXT,  -- 'attention_needed' or 'positive_indicators'
                item TEXT,
                type TEXT
            );

            -- Create indexes
            CREATE INDEX idx_messages_chat_id ON messages(chat_id);
            CREATE INDEX idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX idx_chat_analytics_timestamp ON chat_analytics(timestamp);
            CREATE INDEX idx_chat_llm_timestamp ON chat_llm_analysis(timestamp);

            -- User Profiles table
            CREATE TABLE user_profiles (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                first_seen TIMESTAMP WITH TIME ZONE,
                last_active TIMESTAMP WITH TIME ZONE,
                interaction_count INTEGER DEFAULT 0,
                common_topics TEXT[],
                preferred_response_style JSONB,
                language_patterns JSONB,
                active_hours TEXT[],
                personality_traits JSONB,
                interests TEXT[],
                communication_preferences JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Sentiment History table
            CREATE TABLE sentiment_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES user_profiles(user_id),
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                timestamp TIMESTAMP WITH TIME ZONE,
                sentiment_score FLOAT,
                emotion_categories JSONB,
                context TEXT,
                topics TEXT[],
                contributing_factors JSONB
            );

            -- Interaction Patterns table
            CREATE TABLE interaction_patterns (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES user_profiles(user_id),
                pattern_type TEXT,
                pattern_value JSONB,
                frequency INTEGER,
                context TEXT[],
                last_observed TIMESTAMP WITH TIME ZONE,
                confidence_score FLOAT
            );

            -- Response Templates table
            CREATE TABLE response_templates (
                id SERIAL PRIMARY KEY,
                template_name TEXT,
                content_template TEXT,
                suitable_contexts TEXT[],
                required_sentiment TEXT[],
                user_preferences JSONB,
                variables JSONB,
                success_rate FLOAT DEFAULT 0.0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes for new tables
            CREATE INDEX idx_sentiment_history_user ON sentiment_history(user_id);
            CREATE INDEX idx_sentiment_history_timestamp ON sentiment_history(timestamp);
            CREATE INDEX idx_interaction_patterns_user ON interaction_patterns(user_id);
            CREATE INDEX idx_interaction_patterns_type ON interaction_patterns(pattern_type);

            -- Add media support to messages table
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS has_media BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS media_type TEXT;

            -- Create media_messages table
            CREATE TABLE IF NOT EXISTS media_messages (
                media_id TEXT PRIMARY KEY,
                message_id TEXT REFERENCES messages(message_id),
                chat_id TEXT REFERENCES chat_metadata(chat_id),
                media_type TEXT NOT NULL,
                mime_type TEXT,
                filename TEXT,
                file_size BIGINT,
                media_url TEXT,
                thumbnail_url TEXT,
                caption TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                downloaded BOOLEAN DEFAULT FALSE,
                local_path TEXT
            );

            -- Create index for faster media queries
            CREATE INDEX IF NOT EXISTS idx_media_messages_message_id ON media_messages(message_id);
            CREATE INDEX IF NOT EXISTS idx_media_messages_chat_id ON media_messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_media_messages_type ON media_messages(media_type);
        `);

        console.log('Database setup complete!');
        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

setupDatabase(); 