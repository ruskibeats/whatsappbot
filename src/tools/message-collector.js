const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class MessageCollector {
    constructor() {
        this.client = null;
        this.isCollecting = false;
    }

    async checkExistingProcesses() {
        try {
            // Check for existing Chrome/Chromium processes that might be WhatsApp instances
            const { stdout } = await execAsync('ps aux | grep -i chrome | grep -i whatsapp');
            if (stdout.trim()) {
                console.log('\nFound existing WhatsApp processes. Cleaning up...');
                await execAsync('pkill -f "chrome.*whatsapp"');
                // Wait a moment for processes to clean up
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            // If grep finds nothing, it returns error - this is fine
            if (!error.message.includes('no such process')) {
                console.error('Error checking processes:', error);
            }
        }
    }

    async initialize() {
        await this.checkExistingProcesses();

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: '.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--single-process'
                ],
                timeout: 30000
            }
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('\nScan this QR code to start:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', async () => {
            console.log('\nWhatsApp connected! Starting message collection...');
            await this.collectRecentMessages();
            await this.cleanup();
        });

        this.client.on('authenticated', () => {
            console.log('Authenticated successfully!');
        });

        this.client.on('disconnected', async (reason) => {
            console.log('Client was disconnected:', reason);
            await this.cleanup();
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            console.log('\nReceived SIGINT. Cleaning up...');
            await this.cleanup();
        });

        process.on('SIGTERM', async () => {
            console.log('\nReceived SIGTERM. Cleaning up...');
            await this.cleanup();
        });

        // Handle uncaught errors
        process.on('unhandledRejection', async (error) => {
            console.error('Unhandled rejection:', error);
            await this.cleanup();
        });

        process.on('uncaughtException', async (error) => {
            console.error('Uncaught exception:', error);
            await this.cleanup();
        });
    }

    async cleanup() {
        if (this.isCollecting) {
            console.log('Stopping collection...');
            this.isCollecting = false;
        }

        try {
            if (this.client) {
                console.log('Destroying WhatsApp client...');
                await this.client.destroy();
                this.client = null;
                console.log('Client destroyed successfully');
            }

            // Double-check for any remaining processes
            await this.checkExistingProcesses();
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        } finally {
            process.exit(0);
        }
    }

    async start() {
        try {
            console.log('Starting message collector...');
            await this.initialize();
            await this.client.initialize();
        } catch (error) {
            console.error('Failed to start:', error);
            await this.cleanup();
        }
    }

    async collectRecentMessages() {
        if (this.isCollecting) return;
        this.isCollecting = true;

        try {
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            
            console.log(`\nCollecting messages from ${twoWeeksAgo.toLocaleDateString()}`);
            
            const chats = await this.client.getChats();
            console.log(`Found ${chats.length} chats`);

            const recentMessages = [];
            let processedChats = 0;
            let inactiveChats = 0;

            for (const chat of chats) {
                if (!this.isCollecting) break;

                try {
                    processedChats++;
                    console.log(`\nProcessing chat ${processedChats}/${chats.length}: ${chat.name}`);
                    
                    const messages = await chat.fetchMessages({ limit: 25 });
                    if (!messages || !Array.isArray(messages)) {
                        console.log('No messages found - marking for cleanup');
                        inactiveChats++;
                        
                        // Delete chat data from auth store
                        const authPath = path.join(process.cwd(), '.wwebjs_auth', 'session', `${chat.id._serialized}.json`);
                        try {
                            await fs.unlink(authPath);
                            console.log(`Deleted inactive chat data: ${chat.name}`);
                        } catch (err) {
                            // File might not exist, which is fine
                            if (err.code !== 'ENOENT') {
                                console.error(`Error deleting chat data: ${err.message}`);
                            }
                        }
                        continue;
                    }

                    const filteredMessages = messages.filter(msg => {
                        if (!msg || !msg.timestamp) return false;
                        const msgDate = new Date(msg.timestamp * 1000);
                        return msgDate >= twoWeeksAgo;
                    });

                    if (filteredMessages.length === 0) {
                        console.log(`No recent messages - marking for cleanup`);
                        inactiveChats++;
                        
                        // Delete chat data from auth store
                        const authPath = path.join(process.cwd(), '.wwebjs_auth', 'session', `${chat.id._serialized}.json`);
                        try {
                            await fs.unlink(authPath);
                            console.log(`Deleted inactive chat data: ${chat.name}`);
                        } catch (err) {
                            // File might not exist, which is fine
                            if (err.code !== 'ENOENT') {
                                console.error(`Error deleting chat data: ${err.message}`);
                            }
                        }
                        continue;
                    }

                    console.log(`Found ${filteredMessages.length} recent messages`);

                    for (const msg of filteredMessages) {
                        if (!this.isCollecting) break;

                        try {
                            const contact = await msg.getContact();
                            
                            recentMessages.push({
                                chatName: chat.name,
                                chatId: chat.id._serialized,
                                isGroup: chat.isGroup,
                                timestamp: new Date(msg.timestamp * 1000).toISOString(),
                                from: {
                                    id: msg.from,
                                    name: contact.name || contact.pushname || 'Unknown',
                                    number: contact.number,
                                    type: contact.type,
                                    isMe: msg.fromMe
                                },
                                message: {
                                    body: msg.body,
                                    type: msg.type,
                                    hasMedia: msg.hasMedia,
                                    isForwarded: msg.isForwarded
                                }
                            });
                        } catch (contactError) {
                            console.error('Error getting contact details:', contactError.message);
                        }
                    }

                    // Small delay between chats
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (chatError) {
                    console.error(`Error processing chat ${chat.name}:`, chatError.message);
                }
            }

            if (recentMessages.length > 0) {
                // Save the results
                const outputDir = path.join(process.cwd(), 'data', 'recent_messages');
                await fs.mkdir(outputDir, { recursive: true });
                
                const outputFile = path.join(outputDir, `messages_${new Date().toISOString().split('T')[0]}.json`);
                await fs.writeFile(outputFile, JSON.stringify(recentMessages, null, 2));
                
                console.log(`\nCollection complete! Found ${recentMessages.length} messages`);
                console.log(`Cleaned up ${inactiveChats} inactive chats`);
                console.log(`Results saved to: ${outputFile}`);
            } else {
                console.log('\nNo recent messages found');
                console.log(`Cleaned up ${inactiveChats} inactive chats`);
            }

        } catch (error) {
            console.error('Error during collection:', error);
        } finally {
            this.isCollecting = false;
        }
    }
}

// Start the collector
const collector = new MessageCollector();
collector.start(); 