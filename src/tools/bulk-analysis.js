const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');

// Import analysis services
const AIResponseGenerator = require('../services/AIResponseGenerator');
const SentimentAnalyzer = require('../services/SentimentAnalyzer');
const MessageTracker = require('../core/MessageTracker');
const HistoricalGroomingService = require('../services/HistoricalGroomingService');

class BulkAnalyzer {
    constructor() {
        this.initializeClient();
        
        // Initialize services
        this.aiGenerator = new AIResponseGenerator();
        this.sentimentAnalyzer = new SentimentAnalyzer();
        this.messageTracker = new MessageTracker();
        this.historicalService = new HistoricalGroomingService();

        // Message storage
        this.messagesByUser = new Map();
        this.targetMessageCount = 10000;
        this.processedCount = 0;
    }

    initializeClient() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: '.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-extensions'
                ],
                timeout: 60000,
                defaultViewport: {
                    width: 1280,
                    height: 720
                }
            },
            clientId: 'bulk-analyzer',
            restartOnAuthFail: true,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 10000
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('\nScan this QR code to start bulk analysis:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            console.log('\nWhatsApp connected! Starting bulk message collection...');
            this.startCollection().catch(error => {
                console.error('Error in collection:', error);
                this.cleanup();
            });
        });

        this.client.on('authenticated', () => {
            console.log('Authenticated successfully!');
        });

        this.client.on('auth_failure', (msg) => {
            console.error('Authentication failed:', msg);
            this.cleanup();
        });

        this.client.on('disconnected', (reason) => {
            console.log('Client disconnected:', reason);
            this.cleanup();
        });
    }

    async cleanup() {
        console.log('\nStarting cleanup...');
        try {
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            
            if (this.client) {
                await this.client.destroy();
                console.log('Client destroyed successfully');
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        } finally {
            console.log('Cleanup complete');
            process.exit(1);
        }
    }

    async start() {
        console.log('Starting bulk message analysis...');
        try {
            // Create necessary directories
            const dataDir = path.join(process.cwd(), 'data');
            const analysisDir = path.join(dataDir, 'bulk_analysis');
            await fs.mkdir(dataDir, { recursive: true });
            await fs.mkdir(analysisDir, { recursive: true });

            // Initialize client with retry logic
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
                try {
                    await this.client.initialize();
                    break;
                } catch (error) {
                    retries++;
                    console.error(`Client initialization failed (attempt ${retries}/${maxRetries}):`, error);
                    if (retries === maxRetries) {
                        throw new Error('Failed to initialize client after maximum retries');
                    }
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } catch (error) {
            console.error('Fatal error during startup:', error);
            await this.cleanup();
        }
    }

    async startCollection() {
        try {
            console.log(`\nAttempting to collect ${this.targetMessageCount} messages...`);
            
            // Get all chats
            const chats = await this.client.getChats();
            console.log(`Found ${chats.length} chats`);

            let totalMessages = 0;
            let consecutiveErrors = 0;
            const maxConsecutiveErrors = 3;
            
            this.progressInterval = setInterval(() => {
                console.log(`Progress: ${this.processedCount}/${this.targetMessageCount} messages processed`);
            }, 5000);

            for (const chat of chats) {
                if (this.processedCount >= this.targetMessageCount || 
                    consecutiveErrors >= maxConsecutiveErrors) {
                    console.log('Collection stopping...');
                    break;
                }

                console.log(`\nCollecting messages from chat: ${chat.name}`);
                
                try {
                    const messages = await chat.fetchMessages({ limit: 25 });
                    if (!messages || !Array.isArray(messages)) {
                        console.log(`No valid messages retrieved from ${chat.name}`);
                        consecutiveErrors++;
                        continue;
                    }
                    
                    console.log(`Retrieved ${messages.length} messages from ${chat.name}`);
                    consecutiveErrors = 0;

                    for (const msg of messages) {
                        if (this.processedCount >= this.targetMessageCount) break;
                        if (!msg || msg.from === 'status@broadcast' || !msg.from || !msg.body) continue;

                        if (!this.messagesByUser.has(msg.from)) {
                            this.messagesByUser.set(msg.from, []);
                        }
                        this.messagesByUser.get(msg.from).push({
                            body: msg.body || '',
                            timestamp: msg.timestamp || Date.now(),
                            type: msg.type || 'chat',
                            hasMedia: !!msg.hasMedia,
                            isForwarded: !!msg.isForwarded
                        });

                        this.processedCount++;
                    }

                    totalMessages += messages.length;
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                } catch (chatError) {
                    console.error(`Error processing chat ${chat.name}:`, chatError.message);
                    consecutiveErrors++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            if (this.processedCount > 0) {
                console.log(`\nCollection complete! Processing ${this.processedCount} messages...`);
                await this.analyzeCollectedMessages();
                console.log('Analysis complete!');
            }

        } catch (error) {
            console.error('Error during collection:', error);
            throw error; // Propagate error to trigger cleanup
        } finally {
            await this.cleanup();
        }
    }

    async analyzeCollectedMessages() {
        const analysisDir = path.join(process.cwd(), 'data', 'bulk_analysis');
        await fs.mkdir(analysisDir, { recursive: true });

        console.log(`\nAnalyzing messages for ${this.messagesByUser.size} users...`);

        for (const [userId, messages] of this.messagesByUser.entries()) {
            console.log(`\nAnalyzing ${messages.length} messages for user ${userId}`);

            // Perform comprehensive analysis
            const analysis = {
                userId,
                messageCount: messages.length,
                timespan: {
                    start: Math.min(...messages.map(m => m.timestamp)),
                    end: Math.max(...messages.map(m => m.timestamp))
                },
                messageStats: {
                    averageLength: messages.reduce((acc, m) => acc + m.body.length, 0) / messages.length,
                    mediaCount: messages.filter(m => m.hasMedia).length,
                    forwardedCount: messages.filter(m => m.isForwarded).length
                },
                contentAnalysis: {
                    topics: this.analyzeTopics(messages),
                    sentiment: this.analyzeSentiment(messages),
                    keywords: this.extractKeywords(messages)
                },
                temporalPatterns: this.analyzeTemporalPatterns(messages),
                interactionMetrics: this.calculateInteractionMetrics(messages)
            };

            // Save analysis results
            const filename = path.join(analysisDir, `${userId.replace('@c.us', '')}_analysis.json`);
            await fs.writeFile(filename, JSON.stringify(analysis, null, 2));

            // Update user profile
            await this.updateUserProfile(userId, analysis);
        }
    }

    analyzeTopics(messages) {
        const topics = {};
        const commonTopics = [
            'work', 'family', 'food', 'travel', 'health',
            'technology', 'entertainment', 'sports', 'news', 'education'
        ];

        messages.forEach(msg => {
            commonTopics.forEach(topic => {
                if (msg.body.toLowerCase().includes(topic)) {
                    topics[topic] = (topics[topic] || 0) + 1;
                }
            });
        });

        return topics;
    }

    analyzeSentiment(messages) {
        const sentiments = { positive: 0, neutral: 0, negative: 0 };
        
        messages.forEach(msg => {
            try {
                // Default to neutral if analysis fails
                let sentiment = 'neutral';
                try {
                    const result = this.sentimentAnalyzer.analyzeSentiment(msg.body);
                    // Handle both string and object responses
                    sentiment = (typeof result === 'string' ? result : result.sentiment || 'neutral').toLowerCase();
                } catch (error) {
                    console.log('Error analyzing sentiment for message:', error.message);
                }
                
                // Ensure we only count valid sentiment categories
                if (sentiments.hasOwnProperty(sentiment)) {
                    sentiments[sentiment]++;
                } else {
                    sentiments.neutral++;
                }
            } catch (error) {
                console.log('Error processing message for sentiment:', error.message);
                sentiments.neutral++;
            }
        });

        return sentiments;
    }

    extractKeywords(messages) {
        const words = {};
        const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have']);

        messages.forEach(msg => {
            msg.body.toLowerCase()
                .split(/\W+/)
                .filter(word => word.length > 3 && !stopWords.has(word))
                .forEach(word => {
                    words[word] = (words[word] || 0) + 1;
                });
        });

        return Object.entries(words)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 100)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
    }

    analyzeTemporalPatterns(messages) {
        const hourlyDistribution = new Array(24).fill(0);
        const weeklyDistribution = new Array(7).fill(0);

        messages.forEach(msg => {
            const date = new Date(msg.timestamp * 1000);
            hourlyDistribution[date.getHours()]++;
            weeklyDistribution[date.getDay()]++;
        });

        return {
            hourlyDistribution,
            weeklyDistribution,
            peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
            peakDay: weeklyDistribution.indexOf(Math.max(...weeklyDistribution))
        };
    }

    calculateInteractionMetrics(messages) {
        const intervals = [];
        for (let i = 1; i < messages.length; i++) {
            intervals.push(messages[i].timestamp - messages[i-1].timestamp);
        }

        return {
            averageInterval: intervals.length ? 
                intervals.reduce((a, b) => a + b, 0) / intervals.length : 0,
            responseRate: intervals.filter(i => i < 300).length / intervals.length, // 5 min threshold
            consistencyScore: this.calculateConsistencyScore(intervals)
        };
    }

    calculateConsistencyScore(intervals) {
        if (intervals.length === 0) return 0;
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        return Math.min(1, 1 / (1 + Math.sqrt(variance) / mean));
    }

    async updateUserProfile(userId, analysis) {
        const profileDir = path.join(process.cwd(), 'data', 'profiles');
        await fs.mkdir(profileDir, { recursive: true });

        const profile = {
            userId,
            lastUpdated: Date.now(),
            messageStats: analysis.messageStats,
            topTopics: Object.entries(analysis.contentAnalysis.topics)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([topic]) => topic),
            dominantSentiment: Object.entries(analysis.contentAnalysis.sentiment)
                .sort(([,a], [,b]) => b - a)[0][0],
            activityPattern: {
                peakHour: analysis.temporalPatterns.peakHour,
                peakDay: analysis.temporalPatterns.peakDay
            },
            interactionQuality: {
                responseRate: analysis.interactionMetrics.responseRate,
                consistencyScore: analysis.interactionMetrics.consistencyScore
            }
        };

        const filename = path.join(profileDir, `${userId.replace('@c.us', '')}_profile.json`);
        await fs.writeFile(filename, JSON.stringify(profile, null, 2));
    }

    async start() {
        console.log('Starting bulk message analysis...');
        try {
            // Ensure data directories exist
            const dataDir = path.join(process.cwd(), 'data');
            const bulkAnalysisDir = path.join(dataDir, 'bulk_analysis');
            await fs.mkdir(dataDir, { recursive: true });
            await fs.mkdir(bulkAnalysisDir, { recursive: true });
            
            // Initialize client with retry logic
            let retries = 3;
            while (retries > 0) {
                try {
                    await this.client.initialize();
                    break;
                } catch (error) {
                    console.error(`Initialization attempt failed (${retries} retries left):`, error.message);
                    retries--;
                    if (retries > 0) {
                        console.log('Retrying in 5 seconds...');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error('Fatal error during startup:', error);
            process.exit(1);
        }
    }
}

// Start the bulk analysis
const analyzer = new BulkAnalyzer();
analyzer.start().catch(console.error);
