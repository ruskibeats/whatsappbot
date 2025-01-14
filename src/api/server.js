const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

class APIServer {
    constructor(services) {
        this.app = express();
        this.services = services;
        
        // Middleware
        this.app.use(cors());
        this.app.use(bodyParser.json());
        
        // Setup routes
        this.setupRoutes();
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });

        // Send message
        this.app.post('/api/message', async (req, res) => {
            try {
                const { to, message } = req.body;
                if (!to || !message) {
                    return res.status(400).json({ 
                        error: 'Missing required fields: to and message' 
                    });
                }

                const chat = await this.services.client.getChatById(to);
                await chat.sendMessage(message);
                
                res.json({ 
                    success: true, 
                    message: 'Message sent successfully' 
                });
            } catch (error) {
                console.error('Error sending message:', error);
                res.status(500).json({ 
                    error: 'Failed to send message',
                    details: error.message 
                });
            }
        });

        // Get chat history
        this.app.get('/api/chat/:chatId/history', async (req, res) => {
            try {
                const { chatId } = req.params;
                const { limit = 50 } = req.query;
                
                const chat = await this.services.client.getChatById(chatId);
                const messages = await chat.fetchMessages({ limit: parseInt(limit) });
                
                res.json({
                    success: true,
                    messages: messages.map(msg => ({
                        id: msg.id.id,
                        body: msg.body,
                        fromMe: msg.fromMe,
                        timestamp: msg.timestamp,
                        type: msg.type
                    }))
                });
            } catch (error) {
                console.error('Error fetching chat history:', error);
                res.status(500).json({ 
                    error: 'Failed to fetch chat history',
                    details: error.message 
                });
            }
        });

        // Get chat analysis
        this.app.get('/api/chat/:chatId/analysis', async (req, res) => {
            try {
                const { chatId } = req.params;
                
                const analysis = {
                    sentiment: await this.services.sentimentAnalyzer.analyzeSentiment(chatId),
                    relationship: await this.services.relationshipTracker.getRelationshipSummary(chatId),
                    patterns: this.services.messageTracker.getInteractionPatterns(chatId)
                };
                
                res.json({
                    success: true,
                    analysis
                });
            } catch (error) {
                console.error('Error getting chat analysis:', error);
                res.status(500).json({ 
                    error: 'Failed to get chat analysis',
                    details: error.message 
                });
            }
        });

        // Generate AI response
        this.app.post('/api/ai/response', async (req, res) => {
            try {
                const { message, context } = req.body;
                if (!message) {
                    return res.status(400).json({ 
                        error: 'Missing required field: message' 
                    });
                }

                const response = await this.services.aiGenerator.generateResponse(message, context);
                
                res.json({
                    success: true,
                    response
                });
            } catch (error) {
                console.error('Error generating AI response:', error);
                res.status(500).json({ 
                    error: 'Failed to generate AI response',
                    details: error.message 
                });
            }
        });
    }

    start(port = 3000) {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(port, () => {
                    console.log(`API server running on port ${port}`);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = APIServer;
