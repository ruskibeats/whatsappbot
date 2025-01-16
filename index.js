const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import services
const SentimentAnalyzer = require('./src/services/SentimentAnalyzer');
const BulkAnalyzer = require('./src/tools/bulk-analysis');

// Initialize services
const sentimentAnalyzer = new SentimentAnalyzer();
const bulkAnalyzer = new BulkAnalyzer();

console.log('Creating WhatsApp client...');

// Initialize WhatsApp client
const client = new Client({
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

// Event handlers
client.on('qr', async (qr) => {
    console.log('\n========== WhatsApp QR Code ==========');
    qrcode.generate(qr, { small: true });
    console.log('\nScan this QR code with WhatsApp to log in');
    console.log('The QR code will refresh automatically if not scanned');
    
    // Save QR code to file as backup
    try {
        await fs.writeFile('whatsapp-auth-qr.txt', qr);
        console.log('QR code also saved to whatsapp-auth-qr.txt');
    } catch (error) {
        console.error('Error saving QR code to file:', error);
    }

    // Set timeout warning
    setTimeout(() => {
        console.log('\nStill waiting for QR code scan...');
        console.log('The QR code will refresh automatically if needed');
    }, 30000);
});

client.on('loading_screen', (percent, message) => {
    console.log(`Loading: ${percent}% - ${message}`);
});

client.on('authenticated', async () => {
    console.log('Successfully authenticated!');
    console.log('Session data stored in .wwebjs_auth directory');
    
    // Clean up QR code file
    try {
        await fs.unlink('whatsapp-auth-qr.txt');
    } catch (error) {
        // Ignore if file doesn't exist
    }
});

client.on('auth_failure', (error) => {
    console.error('Authentication failed:', error);
});

client.on('ready', () => {
    console.log('WhatsApp bot is ready!');
    console.log('Connected and listening for messages...');
});

// Message handling
client.on('message', async (message) => {
    try {
        // Analyze message sentiment and emotion
        const sentiment = await sentimentAnalyzer.analyzeSentiment(message.body);
        const emotion = await sentimentAnalyzer.analyzeEmotionalTone(message.body);

        // Log analysis results
        console.log('\nNew message analysis:');
        console.log('Sentiment:', sentiment);
        console.log('Emotion:', emotion);

        // Generate appropriate response based on analysis
        let response = '';
        if (sentiment.positive > 0.7) {
            response = "That's great to hear! 😊";
        } else if (sentiment.negative > 0.7) {
            response = "I'm sorry to hear that. Is there anything I can help with? 🤝";
        } else if (emotion.emotion === 'excited') {
            response = "That sounds exciting! 🎉";
        } else if (emotion.emotion === 'grateful') {
            response = "You're welcome! 🙏";
        } else if (emotion.analysis.isQuestion) {
            response = "Let me help you with that question...";
        } else {
            response = "I understand. Please tell me more...";
        }

        // Send response
        await message.reply(response);

    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Error handling
client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
    process.exit();
});

// Start historical analysis
console.log('Starting historical analysis...');
bulkAnalyzer.analyzeHistoricalData()
    .then(() => {
        console.log('Historical analysis completed');
        // Initialize WhatsApp client
        console.log('Initializing WhatsApp client...');
        return client.initialize().catch(error => {
            console.error('Error initializing client:', error);
            throw error;
        });
    })
    .catch(error => {
        console.error('Error during startup:', error);
        process.exit(1);
    });
