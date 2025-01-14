-- Add additional fields to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS number VARCHAR(50);
ALTER TABLE chats ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message_timestamp TIMESTAMP WITH TIME ZONE;

-- Add engagement metrics to chat_analytics
ALTER TABLE chat_analytics ADD COLUMN IF NOT EXISTS engagement_score FLOAT;
ALTER TABLE chat_analytics ADD COLUMN IF NOT EXISTS response_patterns JSONB;
ALTER TABLE chat_analytics ADD COLUMN IF NOT EXISTS inactive_duration INTERVAL;

-- Add topic categorization
CREATE TABLE IF NOT EXISTS topic_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) UNIQUE NOT NULL,
    keywords TEXT[]
);

-- Insert default topic categories
INSERT INTO topic_categories (category_name, keywords) VALUES
    ('work', ARRAY['work', 'job', 'meeting', 'project', 'client', 'boss', 'office']),
    ('family', ARRAY['family', 'kids', 'parents', 'mom', 'dad', 'sister', 'brother']),
    ('social', ARRAY['party', 'drinks', 'dinner', 'lunch', 'coffee', 'hangout']),
    ('health', ARRAY['health', 'doctor', 'sick', 'hospital', 'medicine', 'feeling']),
    ('tech', ARRAY['phone', 'computer', 'laptop', 'internet', 'app', 'software']),
    ('gaming', ARRAY['game', 'play', 'gaming', 'xbox', 'playstation', 'steam', 'discord']),
    ('travel', ARRAY['travel', 'trip', 'vacation', 'flight', 'hotel', 'airport']),
    ('events', ARRAY['event', 'concert', 'show', 'festival', 'wedding', 'birthday'])
ON CONFLICT (category_name) DO UPDATE SET keywords = EXCLUDED.keywords;

-- Add category reference to topic_analysis
ALTER TABLE topic_analysis ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES topic_categories(category_id);

-- Create view for topic trends
CREATE OR REPLACE VIEW topic_trends AS
SELECT 
    c.chat_name,
    tc.category_name,
    COUNT(*) as mention_count,
    DATE_TRUNC('day', ta.timestamp) as date
FROM topic_analysis ta
JOIN chats c ON ta.chat_id = c.chat_id
JOIN topic_categories tc ON ta.category_id = tc.category_id
WHERE ta.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY c.chat_name, tc.category_name, DATE_TRUNC('day', ta.timestamp);

-- Add indices for better performance
CREATE INDEX IF NOT EXISTS idx_topic_analysis_category ON topic_analysis(category_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_engagement ON chat_analytics(engagement_score);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(last_message_timestamp);

-- Add materialized view for daily chat statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_chat_stats AS
SELECT 
    c.chat_id,
    c.chat_name,
    DATE_TRUNC('day', ca.timestamp) as date,
    SUM(ca.message_count) as total_messages,
    AVG(ca.active_participants) as avg_participants,
    MAX(ca.engagement_score) as max_engagement
FROM chats c
JOIN chat_analytics ca ON c.chat_id = ca.chat_id
GROUP BY c.chat_id, c.chat_name, DATE_TRUNC('day', ca.timestamp)
WITH DATA;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_chat_stats ON daily_chat_stats(chat_id, date);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_chat_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_chat_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
DROP TRIGGER IF EXISTS refresh_daily_chat_stats_trigger ON chat_analytics;
CREATE TRIGGER refresh_daily_chat_stats_trigger
AFTER INSERT OR UPDATE ON chat_analytics
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_daily_chat_stats(); 