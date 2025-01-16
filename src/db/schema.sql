-- Database schema for WhatsApp Bot

-- Drop existing tables if they exist
DROP TABLE IF EXISTS risk_assessment CASCADE;
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS chat_analysis CASCADE;
DROP TABLE IF EXISTS chat_analytics CASCADE;
DROP TABLE IF EXISTS emotional_analysis CASCADE;
DROP TABLE IF EXISTS sentiment_analysis CASCADE;
DROP TABLE IF EXISTS topic_analysis CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

-- Chats table to store basic chat information
CREATE TABLE IF NOT EXISTS chats (
    chat_id VARCHAR(255) PRIMARY KEY,
    chat_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table to store chat messages
CREATE TABLE IF NOT EXISTS messages (
    message_id VARCHAR(255) PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    sender VARCHAR(255),
    message_text TEXT,
    timestamp TIMESTAMP,
    message_type VARCHAR(50),
    is_forwarded BOOLEAN DEFAULT FALSE,
    is_from_me BOOLEAN DEFAULT FALSE,
    has_media BOOLEAN DEFAULT FALSE,
    media_type VARCHAR(50),
    media_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced sentiment analysis table
CREATE TABLE IF NOT EXISTS sentiment_analysis (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) REFERENCES messages(message_id),
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    positive_score FLOAT,
    negative_score FLOAT,
    neutral_score FLOAT,
    combined_score FLOAT,
    afinn_score FLOAT,
    keyword_score FLOAT,
    analyzed_tokens INTEGER,
    sentiment_words JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emotional analysis table
CREATE TABLE IF NOT EXISTS emotional_analysis (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) REFERENCES messages(message_id),
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    dominant_emotion VARCHAR(50),
    emotion_intensity FLOAT,
    is_question BOOLEAN,
    is_excited BOOLEAN,
    has_emoji BOOLEAN,
    emotion_scores JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topic analysis table
CREATE TABLE IF NOT EXISTS topic_analysis (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    topic_type VARCHAR(50),
    topic VARCHAR(255),
    sentiment VARCHAR(50),
    relevance_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication style table
CREATE TABLE IF NOT EXISTS communication_style (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    formality VARCHAR(50),
    preferred_tone VARCHAR(50),
    language_complexity FLOAT,
    emoji_usage_rate FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat analytics table
CREATE TABLE IF NOT EXISTS chat_analytics (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id) UNIQUE,
    timestamp TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    active_participants INTEGER DEFAULT 0,
    last_activity TIMESTAMP,
    daily_messages_avg FLOAT DEFAULT 0,
    response_rate FLOAT DEFAULT 0,
    response_time_avg INTEGER DEFAULT 0,
    peak_hours JSONB,
    quiet_hours JSONB,
    engagement_score FLOAT DEFAULT 0,
    sentiment_trends JSONB,
    emotion_distribution JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat analysis table
CREATE TABLE IF NOT EXISTS chat_analysis (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    health_score FLOAT,
    assessment TEXT,
    recommendations JSONB,
    opportunities JSONB,
    risks JSONB,
    nlp_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Action items table
CREATE TABLE IF NOT EXISTS action_items (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    timeframe VARCHAR(50),
    priority VARCHAR(50),
    task TEXT,
    context TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk assessment table
CREATE TABLE IF NOT EXISTS risk_assessment (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    category VARCHAR(50),
    item TEXT,
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media messages table
CREATE TABLE IF NOT EXISTS media_messages (
    media_id VARCHAR(255) PRIMARY KEY,
    message_id VARCHAR(255) REFERENCES messages(message_id),
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    media_type VARCHAR(50),
    mime_type VARCHAR(100),
    filename TEXT,
    file_size BIGINT,
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat metadata table
CREATE TABLE IF NOT EXISTS chat_metadata (
    chat_id VARCHAR(255) PRIMARY KEY REFERENCES chats(chat_id),
    chat_jid VARCHAR(255),
    chat_name VARCHAR(255),
    created_at TIMESTAMP,
    participant_count INTEGER,
    is_group BOOLEAN,
    description TEXT,
    tags TEXT[],
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat LLM analysis table
CREATE TABLE IF NOT EXISTS chat_llm_analysis (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    sentiment JSONB,
    conversation_dynamics JSONB,
    topic_analysis JSONB,
    communication_style JSONB,
    group_dynamics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suggested responses table
CREATE TABLE IF NOT EXISTS suggested_responses (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats(chat_id),
    timestamp TIMESTAMP,
    context TEXT,
    tone VARCHAR(50),
    template TEXT,
    variables TEXT[],
    best_time_to_respond TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_message_id ON sentiment_analysis(message_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_chat_id ON sentiment_analysis(chat_id);
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_message_id ON emotional_analysis(message_id);
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_chat_id ON emotional_analysis(chat_id);
CREATE INDEX IF NOT EXISTS idx_topic_analysis_chat_id ON topic_analysis(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_chat_id ON chat_analytics(chat_id);
CREATE INDEX IF NOT EXISTS idx_action_items_chat_id ON action_items(chat_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessment_chat_id ON risk_assessment(chat_id);
CREATE INDEX IF NOT EXISTS idx_media_messages_message_id ON media_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_media_messages_chat_id ON media_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_metadata_chat_jid ON chat_metadata(chat_jid);
CREATE INDEX IF NOT EXISTS idx_chat_llm_analysis_chat_id ON chat_llm_analysis(chat_id);
CREATE INDEX IF NOT EXISTS idx_suggested_responses_chat_id ON suggested_responses(chat_id); 