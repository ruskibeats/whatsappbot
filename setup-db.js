const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
    const pool = new Pool({
        user: process.env.DB_USER || 'russbee',
        password: process.env.DB_PASSWORD || 'skimmer69',
        host: process.env.DB_HOST || '192.168.0.169',
        database: process.env.DB_NAME || 'beehive',
        port: process.env.DB_PORT || 5432
    });

    try {
        // Drop existing tables
        console.log('Dropping existing tables...');
        await pool.query(`
            DROP TABLE IF EXISTS 
                scan_metadata,
                enrichment_log,
                message_predictions,
                messages,
                contact_profiles
            CASCADE
        `);

        // Create contact_profiles table
        console.log('Creating contact_profiles table...');
        await pool.query(`
            CREATE TABLE contact_profiles (
                id SERIAL PRIMARY KEY,
                contact_id VARCHAR(255) UNIQUE NOT NULL,
                contact_name VARCHAR(255),
                relationship_strength FLOAT DEFAULT 0.5,
                priority_score FLOAT DEFAULT 0.5,
                message_count INTEGER DEFAULT 0,
                message_frequency INTEGER DEFAULT 0,
                response_rate FLOAT DEFAULT 0,
                communication_style JSONB,
                last_enrichment TIMESTAMP,
                last_updated TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create messages table
        console.log('Creating messages table...');
        await pool.query(`
            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(255) UNIQUE NOT NULL,
                chat_id VARCHAR(255) NOT NULL,
                contact_id VARCHAR(255) NOT NULL,
                sender_id VARCHAR(255) NOT NULL,
                body TEXT,
                timestamp TIMESTAMP NOT NULL,
                status VARCHAR(50) DEFAULT 'unactioned',
                message_type VARCHAR(50),
                has_media BOOLEAN DEFAULT FALSE,
                interaction_frequency FLOAT DEFAULT 0,
                sentiment_urgency FLOAT DEFAULT 0,
                actioned_at TIMESTAMP,
                FOREIGN KEY (contact_id) REFERENCES contact_profiles(contact_id)
            )
        `);

        // Create message_predictions table
        console.log('Creating message_predictions table...');
        await pool.query(`
            CREATE TABLE message_predictions (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(255) NOT NULL,
                needs_response BOOLEAN NOT NULL,
                confidence_score FLOAT NOT NULL,
                reasoning TEXT,
                created_at TIMESTAMP NOT NULL,
                validated_at TIMESTAMP,
                was_correct BOOLEAN,
                feedback TEXT,
                FOREIGN KEY (message_id) REFERENCES messages(message_id)
            )
        `);

        // Create enrichment_log table
        console.log('Creating enrichment_log table...');
        await pool.query(`
            CREATE TABLE enrichment_log (
                id SERIAL PRIMARY KEY,
                contact_id VARCHAR(255) NOT NULL,
                enrichment_time TIMESTAMP NOT NULL,
                FOREIGN KEY (contact_id) REFERENCES contact_profiles(contact_id)
            )
        `);

        // Create scan_metadata table
        console.log('Creating scan_metadata table...');
        await pool.query(`
            CREATE TABLE scan_metadata (
                id SERIAL PRIMARY KEY,
                last_scan_time TIMESTAMP NOT NULL,
                scan_type VARCHAR(50),
                messages_processed INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create indexes
        console.log('Creating indexes...');
        await pool.query(`
            CREATE INDEX idx_messages_contact_id ON messages(contact_id);
            CREATE INDEX idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX idx_messages_status ON messages(status);
            CREATE INDEX idx_predictions_message_id ON message_predictions(message_id);
            CREATE INDEX idx_enrichment_contact_id ON enrichment_log(contact_id);
            CREATE INDEX idx_scan_metadata_time ON scan_metadata(last_scan_time);
        `);

        // Insert test data
        console.log('Inserting test data...');
        await pool.query(`
            INSERT INTO contact_profiles (contact_id, contact_name, relationship_strength)
            VALUES 
                ('447123456789@c.us', 'John Project Lead', 0.8),
                ('447987654321@c.us', 'Alice Team Member', 0.6),
                ('447111222333@c.us', 'Bob Vendor', 0.4)
        `);

        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase(); 