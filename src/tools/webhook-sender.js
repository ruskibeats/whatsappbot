const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

class WebhookSender {
    constructor() {
        console.log('Initializing WebhookSender...');
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: "whatsapp-bot" }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            }
        });
        this.webhookUrl = process.env.N8N_WEBHOOK_URL;
        this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
        
        // Available models configuration
        this.models = {
            claude3opus: 'anthropic/claude-3-opus-20240229',
            claude3sonnet: 'anthropic/claude-3-sonnet-20240229',
            gpt4: 'openai/gpt-4-turbo-preview',
            gemini: 'google/gemini-pro',
            mixtral: 'mistralai/mixtral-8x7b-instruct',
            llama2: 'meta-llama/llama-2-70b-chat',
            claude2: 'anthropic/claude-2.1'
        };
        
        // Set default model - can be changed via environment variable
        this.currentModel = process.env.OPENROUTER_MODEL || this.models.claude3opus;
        
        this.setupClient();
    }

    setupClient() {
        console.log('Setting up client event handlers...');
        
        this.client.on('qr', (qr) => {
            console.log('QR Code received. Please scan with WhatsApp to authenticate:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('loading_screen', (percent, message) => {
            console.log('Loading:', percent, '%', message);
        });

        this.client.on('authenticated', () => {
            console.log('Client authenticated');
        });

        this.client.on('auth_failure', (error) => {
            console.error('Authentication failed:', error);
            process.exit(1);
        });

        this.client.on('ready', () => {
            console.log('Client is ready. Starting message collection...');
            this.collectAndAnalyze();
        });

        this.client.on('disconnected', (reason) => {
            console.log('Client disconnected:', reason);
            process.exit(1);
        });
    }

    async sendToWebhook(data) {
        try {
            return await this.sendToWebhookWithRetry(this.webhookUrl, data);
        } catch (error) {
            console.error('Failed to send to webhook:', error);
            throw error;
        }
    }

    async sendToWebhookWithRetry(url, data, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    throw new Error(`Webhook error: ${response.statusText}`);
                }
                
                return await response.json();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    async makeOpenRouterRequest(prompt, customModel = null) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openrouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/yourusername/whatsapp-bot',
                'X-Title': 'WhatsApp Bot'
            },
            body: JSON.stringify({
                model: customModel || this.currentModel,
                messages: [{
                    role: "system",
                    content: "You are a JSON-only response bot. Return ONLY valid JSON objects. Keep responses very concise. No explanations or extra text."
                }, {
                    role: "user",
                    content: prompt
                }],
                temperature: 0.1,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validate API response structure
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Unexpected API response structure:', JSON.stringify(data, null, 2));
            return {
                sentiment: 'neutral',
                engagement: 'medium',
                key_topics: ['conversation'],
                communication_patterns: {
                    description: "Invalid API response"
                },
                areas_needing_attention: []
            };
        }

        try {
            // First try to parse the content as JSON
            return JSON.parse(data.choices[0].message.content);
        } catch (error) {
            console.log('Raw LLM response:', data.choices[0].message.content);
            // If parsing fails, try to extract JSON from the response
            const jsonMatch = data.choices[0].message.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (innerError) {
                    console.error('Failed to parse extracted JSON:', innerError);
                }
            }
            // If no valid JSON found, return a structured format
            return {
                sentiment: 'neutral',
                engagement: 'medium',
                key_topics: ['conversation'],
                communication_patterns: {
                    description: "Failed to parse LLM response"
                },
                areas_needing_attention: []
            };
        }
    }

    basicSentimentAnalysis(messages) {
        // Basic fallback sentiment analysis when LLM fails
        const positiveWords = ['thanks', 'good', 'great', 'awesome', 'excellent', 'happy', 'love', 'wonderful', '👍', '😊', '❤️'];
        const negativeWords = ['bad', 'poor', 'terrible', 'unhappy', 'hate', 'awful', 'disappointed', '👎', '😠', '😢'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        let totalWords = 0;
        let responseTimeTotal = 0;
        let responseCount = 0;

        // Analyze messages
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i].body.toLowerCase();
            const words = message.split(/\s+/);
            
            positiveCount += words.filter(word => positiveWords.includes(word)).length;
            negativeCount += words.filter(word => negativeWords.includes(word)).length;
            totalWords += words.length;

            // Calculate response times
            if (i > 0) {
                const timeDiff = messages[i].timestamp - messages[i-1].timestamp;
                if (timeDiff < 3600000) { // Only count if less than 1 hour
                    responseTimeTotal += timeDiff;
                    responseCount++;
                }
            }
        }

        return {
            sentiment: positiveCount > negativeCount ? 'positive' : 
                      positiveCount < negativeCount ? 'negative' : 'neutral',
            engagement: responseCount > 0 ? 
                       (responseTimeTotal / responseCount < 300000 ? 'high' : 
                        responseTimeTotal / responseCount < 1800000 ? 'medium' : 'low')
                       : 'low',
            key_topics: [],
            communication_patterns: {
                average_response_time: responseCount > 0 ? responseTimeTotal / responseCount : null,
                message_frequency: messages.length
            },
            areas_needing_attention: []
        };
    }

    basicNextSteps(chatAnalysis) {
        // Basic fallback next steps when LLM fails
        return {
            steps: [
                {
                    priority: chatAnalysis.messageCount > 50 ? 'high' : 'medium',
                    action_type: 'follow_up',
                    suggestion: 'Review conversation history and identify any pending items',
                    best_time: 'Next business day',
                    expected_outcome: 'Better conversation continuity'
                }
            ]
        };
    }

    async analyzeSentimentWithLLM(messages) {
        const chunks = this.chunkMessages(messages);
        const analyses = [];
        
        for (const chunk of chunks) {
            try {
                const analysis = await this.makeOpenRouterRequest(
                    this.formatMessagesForSentiment(chunk)
                );
                analyses.push(analysis);
            } catch (error) {
                console.error('Error analyzing chunk:', error);
                analyses.push(this.basicSentimentAnalysis(chunk));
            }
        }
        
        // Combine analyses
        return this.combineAnalyses(analyses);
    }

    combineAnalyses(analyses) {
        if (analyses.length === 0) return this.basicSentimentAnalysis([]);
        if (analyses.length === 1) return analyses[0];
        
        const combined = {
            sentiment: 0,
            engagement: 0,
            keyTopics: new Set(),
            communicationPatterns: {}
        };
        
        for (const analysis of analyses) {
            combined.sentiment += analysis.sentiment / analyses.length;
            combined.engagement += analysis.engagement / analyses.length;
            analysis.keyTopics?.forEach(topic => combined.keyTopics.add(topic));
            Object.assign(combined.communicationPatterns, analysis.communicationPatterns);
        }
        
        combined.keyTopics = Array.from(combined.keyTopics);
        return combined;
    }

    async generateNextStepsWithLLM(chatAnalysis, llmAnalysis) {
        try {
            const context = {
                messageCount: chatAnalysis.messageCount,
                analyzedMessages: Math.min(chatAnalysis.messageCount, 50),
                isGroup: chatAnalysis.isGroup,
                sentiment: llmAnalysis.sentiment,
                engagement: llmAnalysis.engagement
            };

            const prompt = `Based on this context, respond with a SINGLE next step in JSON format. Keep all text fields under 50 characters:
{
    "steps": [{
        "priority": "high/medium/low",
        "action": "brief action description",
        "when": "brief timing",
        "outcome": "brief expected outcome"
    }]
}

Context:
${JSON.stringify(context, null, 2)}

Analysis:
${JSON.stringify(llmAnalysis, null, 2)}`;

            const response = await this.makeOpenRouterRequest(prompt);
            
            // Ensure the response is properly formatted
            if (response && response.steps && Array.isArray(response.steps)) {
                return response;
            }
            
            return {
                steps: [{
                    priority: "medium",
                    action: "Follow up on conversation",
                    when: "Next appropriate time",
                    outcome: "Maintain engagement"
                }]
            };
        } catch (error) {
            console.error('Error generating next steps with LLM:', error);
            return this.basicNextSteps(chatAnalysis);
        }
    }

    // Method to change model at runtime
    setModel(modelKey) {
        if (this.models[modelKey]) {
            this.currentModel = this.models[modelKey];
            console.log(`Model changed to: ${this.currentModel}`);
            return true;
        }
        console.error(`Invalid model key: ${modelKey}`);
        return false;
    }

    // Method to get available models
    getAvailableModels() {
        return this.models;
    }

    // Method to get current model
    getCurrentModel() {
        return this.currentModel;
    }

    async scanChats() {
        console.log('Starting initial chat scan...');
        const chats = await this.client.getChats();
        console.log(`Found ${chats.length} total chats`);

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        console.log(`Filtering for messages after: ${twoWeeksAgo.toISOString()}`);

        const viableChats = [];
        const emptyChats = [];
        let totalChats = 0;
        let skippedNoMessages = 0;
        let skippedOld = 0;

        for (const chat of chats) {
            totalChats++;
            const chatName = chat.name || 'Private Chat';
            console.log(`\nScanning chat ${totalChats}/${chats.length}: ${chatName}`);

            try {
                const messages = await chat.fetchMessages({ limit: 100 });
                if (messages.length === 0) {
                    console.log(`Found empty chat: ${chatName}`);
                    emptyChats.push({
                        chatId: chat.id._serialized,
                        name: chatName,
                        isGroup: chat.isGroup
                    });
                    skippedNoMessages++;
                    continue;
                }

                const recentMessages = messages.filter(msg => msg.timestamp * 1000 > twoWeeksAgo.getTime());
                if (recentMessages.length === 0) {
                    console.log(`Skipping ${chatName} - no recent messages`);
                    skippedOld++;
                    continue;
                }

                viableChats.push({
                    chat: chat,
                    name: chatName,
                    messageCount: recentMessages.length,
                    isGroup: chat.isGroup,
                    lastMessageTime: new Date(recentMessages[recentMessages.length - 1].timestamp * 1000)
                });

                console.log(`Added to viable chats - ${recentMessages.length} recent messages`);
            } catch (error) {
                console.error(`Error scanning chat ${chatName}:`, error);
            }
        }

        // Sort viable chats by recent activity
        viableChats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        // Send empty chats to test webhook
        if (emptyChats.length > 0) {
            const emptyChatsPayload = {
                timestamp: new Date().toISOString(),
                type: 'empty_chats',
                chats: emptyChats
            };

            console.log(`\nSending ${emptyChats.length} empty chats to test webhook...`);
            try {
                const response = await fetch('https://patchteam.xyz/webhook-test/5dfb0180-52df-487f-83f3-c9c69c226c38', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(emptyChatsPayload)
                });

                if (!response.ok) {
                    throw new Error(`Test webhook error: ${response.statusText}`);
                }
                console.log('Empty chats sent to test webhook');
            } catch (error) {
                console.error('Failed to send empty chats to test webhook:', error);
            }
        }

        const scanSummary = {
            timestamp: new Date().toISOString(),
            type: 'scan_complete',
            summary: {
                totalChats,
                viableChats: viableChats.length,
                emptyChats: emptyChats.length,
                skippedOld
            },
            viableChatsPreview: viableChats.map(c => ({
                name: c.name,
                messageCount: c.messageCount,
                isGroup: c.isGroup,
                lastMessageTime: c.lastMessageTime
            }))
        };

        console.log('\nScan Summary:');
        console.log(`- Total chats: ${totalChats}`);
        console.log(`- Viable chats: ${viableChats.length}`);
        console.log(`- Empty chats: ${emptyChats.length}`);
        console.log(`- Skipped (old messages): ${skippedOld}`);

        await this.sendToWebhook(scanSummary);
        return viableChats;
    }

    async processViableChats(viableChats) {
        console.log('\nStarting analysis of viable chats...');
        let processed = 0;
        let successful = 0;

        for (const chatInfo of viableChats) {
            processed++;
            console.log(`\nProcessing viable chat ${processed}/${viableChats.length}: ${chatInfo.name}`);

            try {
                const messages = await chatInfo.chat.fetchMessages({ limit: 100 });
                const recentMessages = messages.slice(-50); // Take last 50 for analysis

                const chatAnalysis = {
                    chatId: chatInfo.chat.id._serialized,
                    chatName: chatInfo.name,
                    isGroup: chatInfo.isGroup,
                    messageCount: chatInfo.messageCount,
                    analyzedMessages: recentMessages.length,
                    messages: recentMessages.map(msg => ({
                        from: {
                            id: msg.from,
                            name: msg._data.notifyName || 'Unknown',
                            isMe: msg.fromMe
                        },
                        timestamp: new Date(msg.timestamp * 1000).toISOString(),
                        type: msg.type,
                        hasMedia: msg.hasMedia
                    }))
                };

                console.log('Performing LLM analysis...');
                const llmAnalysis = await this.analyzeSentimentWithLLM(recentMessages);
                chatAnalysis.llmAnalysis = llmAnalysis;

                console.log('Generating next steps...');
                chatAnalysis.nextSteps = await this.generateNextStepsWithLLM(chatAnalysis, llmAnalysis);

                const payload = {
                    timestamp: new Date().toISOString(),
                    type: 'chat_analysis',
                    progress: {
                        current: processed,
                        total: viableChats.length,
                        successful
                    },
                    data: chatAnalysis
                };

                console.log(`Sending analysis for chat: ${chatInfo.name}`);
                await this.sendToWebhook(payload);
                successful++;

                // Add delay between chats
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error processing chat ${chatInfo.name}:`, error);
            }
        }

        const finalSummary = {
            timestamp: new Date().toISOString(),
            type: 'analysis_complete',
            summary: {
                totalViableChats: viableChats.length,
                successfulAnalyses: successful,
                failedAnalyses: viableChats.length - successful
            }
        };

        console.log('\nAnalysis Complete:');
        console.log(`- Total viable chats: ${finalSummary.summary.totalViableChats}`);
        console.log(`- Successful analyses: ${finalSummary.summary.successfulAnalyses}`);
        console.log(`- Failed analyses: ${finalSummary.summary.failedAnalyses}`);

        await this.sendToWebhook(finalSummary);
    }

    async collectAndAnalyze() {
        try {
            // Phase 1: Scan and filter chats
            const viableChats = await this.scanChats();
            
            if (viableChats.length === 0) {
                console.log('No viable chats found for analysis');
                await this.client.destroy();
                process.exit(0);
                return;
            }

            // Phase 2: Process viable chats
            await this.processViableChats(viableChats);

            console.log('All processing complete');
            await this.client.destroy();
            process.exit(0);
        } catch (error) {
            console.error('Error in collection and analysis:', error);
            await this.client.destroy();
            process.exit(1);
        }
    }

    calculateResponseTime(messages) {
        if (messages.length < 2) return null;
        
        let totalResponseTime = 0;
        let responseCount = 0;
        
        for (let i = 1; i < messages.length; i++) {
            const currentMsg = messages[i];
            const prevMsg = messages[i - 1];
            
            if (currentMsg.from.id !== prevMsg.from.id) {
                const responseTime = new Date(currentMsg.timestamp) - new Date(prevMsg.timestamp);
                totalResponseTime += responseTime;
                responseCount++;
            }
        }
        
        return responseCount > 0 ? totalResponseTime / responseCount : null;
    }

    async run() {
        try {
            console.log('Initializing client...');
            await this.client.initialize();
        } catch (error) {
            console.error('Error initializing client:', error);
            process.exit(1);
        }
    }

    chunkMessages(messages, maxTokens = 150000) {
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;
        
        for (const msg of messages) {
            // Rough estimate: 1 token ≈ 4 characters
            const msgTokens = (msg.body?.length || 0) / 4;
            
            if (currentTokens + msgTokens > maxTokens) {
                chunks.push(currentChunk);
                currentChunk = [msg];
                currentTokens = msgTokens;
            } else {
                currentChunk.push(msg);
                currentTokens += msgTokens;
            }
        }
        
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    formatMessagesForSentiment(messages) {
        // This method should be implemented based on your specific requirements
        // For example, you might want to combine messages into a single prompt
        // or use a different format for sentiment analysis
        // This is a placeholder implementation
        return messages.map(msg => msg.body).join('\n');
    }
}

// Run if called directly
if (require.main === module) {
    const sender = new WebhookSender();
    sender.run();
}

module.exports = { WebhookSender }; 