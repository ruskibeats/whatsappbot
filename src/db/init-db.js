const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
    const pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Connect to database
        const client = await pool.connect();
        
        try {
            // Execute schema
            await client.query(schema);
            console.log('Database schema initialized successfully');
        } catch (error) {
            console.error('Error executing schema:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => console.log('Database initialization completed'))
        .catch(error => {
            console.error('Failed to initialize database:', error);
            process.exit(1);
        });
}

module.exports = initializeDatabase; 