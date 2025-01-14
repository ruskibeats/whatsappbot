const fetch = require('node-fetch');
require('dotenv').config();

async function testWebhook() {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const testData = {
        timestamp: new Date().toISOString(),
        test: true,
        message: "Testing webhook connection",
        data: {
            sample: "test data",
            number: 123
        }
    };

    try {
        console.log('Sending test data to webhook...');
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.statusText}`);
        }

        const responseData = await response.text();
        console.log('Webhook test successful!');
        console.log('Response:', responseData);
    } catch (error) {
        console.error('Failed to send test data:', error);
        process.exit(1);
    }
}

testWebhook(); 