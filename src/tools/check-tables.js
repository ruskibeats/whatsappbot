const { Pool } = require('pg');

async function checkTables() {
    const pool = new Pool({
        user: 'russbee',
        password: 'skimmer69',
        host: 'localhost',
        database: 'beehive',
        port: 5432
    });

    try {
        const client = await pool.connect();
        
        console.log('\nChecking chats table...');
        const chats = await client.query('SELECT COUNT(*) as count FROM chats');
        console.log(`Total chats: ${chats.rows[0].count}`);
        
        console.log('\nChecking messages table...');
        const messages = await client.query('SELECT COUNT(*) as count FROM messages');
        console.log(`Total messages: ${messages.rows[0].count}`);
        
        console.log('\nSample of recent messages:');
        const recentMessages = await client.query(`
            SELECT m.message_body, m.timestamp, c.chat_name 
            FROM messages m 
            JOIN chats c ON m.chat_id = c.chat_id 
            ORDER BY m.timestamp DESC 
            LIMIT 5
        `);
        recentMessages.rows.forEach(msg => {
            console.log(`[${msg.chat_name}] ${msg.timestamp}: ${msg.message_body.substring(0, 50)}...`);
        });

        client.release();
        await pool.end();
    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkTables(); 