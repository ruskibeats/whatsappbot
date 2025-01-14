const { Pool } = require('pg');

async function testDatabase() {
    const pool = new Pool({
        user: 'russbee',
        password: 'skimmer69',
        host: 'localhost',
        database: 'beehive',
        port: 5432
    });

    try {
        console.log('Testing database connection...');
        const client = await pool.connect();
        
        console.log('Connected! Testing query...');
        const result = await client.query('SELECT NOW()');
        console.log('Database time:', result.rows[0].now);
        
        console.log('Testing tables...');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Available tables:', tables.rows.map(r => r.table_name));

        client.release();
        await pool.end();
        console.log('All tests passed!');
    } catch (error) {
        console.error('Database test failed:', error);
    }
}

testDatabase(); 