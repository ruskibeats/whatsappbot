const { Client, LocalAuth } = require('whatsapp-web.js');
const MessageTracker = require('../core/MessageTracker');
require('dotenv').config();

class ResponseAnalyzer {
    constructor() {
        this.messageTracker = new MessageTracker();
        
        // Initialize WhatsApp client
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox']
            }
        });

        // ADHD-friendly momentum tracking
        this.momentumThresholds = {
            high: 0.7,    // Very active conversation
            medium: 0.4,  // Regular interaction
            low: 0.2      // Needs attention
        };

        // Task priority levels
        this.taskPriorities = {
            urgent: 4,    // Needs immediate attention
            high: 3,      // Should respond today
            medium: 2,    // Respond within 2-3 days
            low: 1        // Can wait, but don't forget
        };
    }

    async getContactInfo(chatId) {
        try {
            if (chatId.includes('@g.us')) {
                // For group chats
                const chat = await this.client.getChatById(chatId);
                return chat.name || `Group Chat (${chatId.split('-')[0]})`;
            } else {
                // For individual contacts, ensure @c.us suffix
                const contactId = chatId.includes('@c.us') ? chatId : `${chatId}@c.us`;
                try {
                    const chat = await this.client.getChatById(contactId);
                    if (chat.name) return chat.name;
                    
                    const contact = await chat.getContact();
                    return contact.name || contact.pushname || this.formatNumber(chatId);
                } catch (contactError) {
                    // If we can't get contact info, fall back to formatted number
                    return this.formatNumber(chatId);
                }
            }
        } catch (error) {
            // Silently fall back to formatted number
            return this.formatNumber(chatId);
        }
    }

    formatNumber(chatId) {
        const number = chatId.split('@')[0];
        // Format as +XX (XXX) XXX-XXXX
        if (number.length >= 10) {
            const lastFour = number.slice(-4);
            const middle = number.slice(-7, -4);
            const areaCode = number.slice(-10, -7);
            const countryCode = number.slice(0, -10);
            return `+${countryCode} (${areaCode}) ${middle}-${lastFour}`;
        }
        return number;
    }

    async initialize() {
        // Initialize WhatsApp client
        await this.client.initialize();
        
        // Wait for client to be ready
        await new Promise((resolve) => {
            this.client.once('ready', () => {
                console.log('WhatsApp client ready');
                resolve();
            });
        });
    }

    async analyzeMessages() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Read all bulk analysis files
            const bulkAnalysisDir = path.join(process.cwd(), 'data', 'bulk_analysis');
            const files = await fs.readdir(bulkAnalysisDir);
            
            // Get reference timestamp (most recent message)
            let maxTimestamp = 0;
            for (const file of files) {
                if (!file.endsWith('_analysis.json')) continue;
                const content = await fs.readFile(path.join(bulkAnalysisDir, file), 'utf8');
                const analysis = JSON.parse(content);
                if (analysis.timespan && analysis.timespan.end > maxTimestamp) {
                    maxTimestamp = analysis.timespan.end;
                }
            }
            
            // Helper function for date formatting
            const formatDate = (date) => {
                const d = new Date(date);
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
            };
            
            // Calculate cutoff as 14 days before the most recent message
            const cutoffTimestamp = maxTimestamp - (14 * 24 * 60 * 60);
            const referenceDate = new Date(maxTimestamp * 1000);
            const cutoffDate = new Date(cutoffTimestamp * 1000);
            
            console.log('\nAnalyzing messages...');
            console.log('Reference (most recent message):', formatDate(referenceDate));
            console.log('Including messages after:', formatDate(cutoffDate));
            console.log('=' .repeat(50));
            
            let totalChatsWithMessages = 0;
            let chatsNeedingResponse = 0;
            
            // Process each analysis file
            for (const file of files) {
                if (!file.endsWith('_analysis.json')) continue;
                
                const filePath = path.join(bulkAnalysisDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const analysis = JSON.parse(content);
                
                // Filter out system messages and group metadata
                if (analysis.messages) {
                    analysis.messages = analysis.messages.filter(msg => {
                        // Skip system messages
                        if (msg.isSystemMessage) return false;
                        // Skip group metadata messages
                        if (msg.type === 'notification') return false;
                        if (msg.body && msg.body.startsWith('Changed this group')) return false;
                        if (msg.body && msg.body.includes('changed the subject')) return false;
                        if (msg.body && msg.body.includes('added')) return false;
                        if (msg.body && msg.body.includes('removed')) return false;
                        if (msg.body && msg.body.includes('left')) return false;
                        if (msg.body && msg.body.includes('joined')) return false;
                        return true;
                    });
                    
                    // Update message count and timespan
                    analysis.messageCount = analysis.messages.length;
                    if (analysis.messages.length > 0) {
                        analysis.timespan = {
                            start: Math.min(...analysis.messages.map(m => m.timestamp || m.time)),
                            end: Math.max(...analysis.messages.map(m => m.timestamp || m.time))
                        };
                    }
                }
                
                if (analysis.timespan) {
                    const lastMessageDate = new Date(analysis.timespan.end * 1000);
                    const isGroup = file.includes('@g.us');
                    
                    // Get activity summary
                    let activitySummary = '';
                    if (analysis.contentAnalysis) {
                        const sentiment = analysis.contentAnalysis.sentiment || {};
                        const topics = analysis.contentAnalysis.topics || {};
                        
                        // Get top topics
                        const topTopics = Object.entries(topics)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 2)
                            .map(([topic]) => topic)
                            .join(', ');
                            
                        // Calculate sentiment percentages
                        const total = (sentiment.positive || 0) + (sentiment.neutral || 0) + (sentiment.negative || 0);
                        const positivePct = total > 0 ? Math.round((sentiment.positive || 0) / total * 100) : 0;
                        const negativePct = total > 0 ? Math.round((sentiment.negative || 0) / total * 100) : 0;
                        
                        activitySummary = `${analysis.messageCount} messages`;
                        if (topTopics) activitySummary += `, topics: ${topTopics}`;
                        if (total > 0) activitySummary += `, sentiment: ${positivePct}% positive`;
                    }
                    
                    console.log(`\nChat: ${file}`);
                    console.log(`Type: ${isGroup ? 'Group' : 'Private'}`);
                    console.log(`Last message date: ${formatDate(lastMessageDate)}`);
                    console.log(`Recent activity: ${activitySummary}`);
                    console.log(`Is within 2 weeks: ${analysis.timespan.end >= cutoffTimestamp}`);
                }
                
                // Only include chats with messages in the last 14 days
                if (analysis.timespan && analysis.timespan.end >= cutoffTimestamp) {
                    totalChatsWithMessages++;
                    
                    // Analyze if needs response
                    if (this.chatNeedsResponse(analysis)) {
                        const chatId = file.replace('_analysis.json', '');
                        await this.analyzeChat(chatId, analysis);
                        chatsNeedingResponse++;
                    }
                }
            }
            
            console.log('\n' + '='.repeat(50));
            console.log(`Found ${totalChatsWithMessages} active chats in the last 2 weeks`);
            console.log(`${chatsNeedingResponse} chats need responses`);
            
        } catch (error) {
            console.error('Error analyzing messages:', error);
        }
    }
    
    chatNeedsResponse(analysis) {
        // Chat needs response if any of these are true:
        // 1. Has any recent messages (even low count could be important)
        // 2. Has any negative sentiment
        // 3. Has meaningful interaction pattern
        return analysis.messageCount > 0 || 
               (analysis.contentAnalysis?.sentiment?.negative > 0) ||
               (analysis.interactionMetrics?.consistencyScore > 0.3);
    }
    
    async analyzeChat(chatId, analysis) {
        try {
            // Only proceed if we have messages to analyze
            if (!analysis.messageCount) return;
            
            const contactInfo = await this.getContactInfo(chatId);
            const chatType = chatId.includes('@g.us') ? 'Group Chat' : 'Private Chat';
            
            console.log('\n' + '='.repeat(50));
            console.log(`${chatType}: ${contactInfo}`);
            console.log('=' .repeat(50));
            
            // Helper function for date formatting (defined at top level)
            const formatDate = (date) => {
                const d = new Date(date);
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
            };
            
            // Convert Unix timestamps to dates for display
            const displayStartDate = new Date(analysis.timespan.start * 1000);
            const displayEndDate = new Date(analysis.timespan.end * 1000);
            console.log(`Time Period: ${formatDate(displayStartDate)} to ${formatDate(displayEndDate)}`);
            console.log(`Message Count: ${analysis.messageCount}`);

            // Display last message
            if (analysis.messages && analysis.messages.length > 0) {
                const lastMsg = analysis.messages[analysis.messages.length - 1];
                let lastMessageContent = lastMsg.body || '';
                if (lastMessageContent.length > 100) {
                    lastMessageContent = lastMessageContent.substring(0, 97) + '...';
                }
                console.log(`Last Message: "${lastMessageContent}"`);
            }
            
            // Display sentiment analysis
            if (analysis.contentAnalysis && analysis.contentAnalysis.sentiment) {
                const positivePct = Math.round((analysis.contentAnalysis.sentiment.positive || 0) * 100);
                const negativePct = Math.round((analysis.contentAnalysis.sentiment.negative || 0) * 100);
                console.log(`Sentiment: Positive=${positivePct}%, Negative=${negativePct}%`);
            }
            
            // Calculate conversation momentum
            const momentum = this.calculateConversationMomentum(analysis);
            console.log(`Conversation Momentum: ${momentum.score.toFixed(2)} (${momentum.status})`);
            
            // Display topic engagement
            if (analysis.contentAnalysis && analysis.contentAnalysis.topics) {
                const topics = Object.entries(analysis.contentAnalysis.topics)
                    .map(([topic, count]) => ({
                        topic,
                        engagement: Math.round((count / analysis.messageCount) * 100)
                    }))
                    .filter(t => t.engagement > 0)
                    .sort((a, b) => b.engagement - a.engagement);
                
                if (topics.length > 0) {
                    console.log('\nTopic Engagement:');
                    topics.forEach(t => {
                        console.log(`- ${t.topic}: ${t.engagement}% engagement`);
                    });
                }
            }
            
            // Generate tasks based on analysis
            const tasks = this.generateTasks(analysis, momentum);
            if (tasks.length > 0) {
                console.log('\n📋 Suggested Follow-ups:');
                tasks.forEach((task, index) => {
                    console.log(`${index + 1}. [${task.priority}] ${task.description}`);
                    if (task.context) console.log(`   Context: ${task.context}`);
                    if (task.deadline) console.log(`   When: ${task.deadline}`);
                });
            }
            
            // Display ADHD-friendly summary
            console.log('\n🎯 Quick Summary:');
            console.log(this.generateADHDFriendlySummary(analysis, momentum));
            
        } catch (error) {
            console.error(`Error analyzing chat ${chatId}:`, error);
        }
    }

    calculateConversationMomentum(analysis) {
        // Calculate momentum based on message frequency and engagement
        const messageFrequency = analysis.messageCount / 14; // Messages per day
        const hasRecentActivity = (Date.now() / 1000 - analysis.timespan.end) < 86400 * 2; // Activity in last 2 days
        const engagementScore = analysis.interactionMetrics?.responseRate || 0;

        let score = (messageFrequency * 0.4) + (hasRecentActivity ? 0.3 : 0) + (engagementScore * 0.3);
        score = Math.min(1, score); // Normalize to 0-1

        // Determine momentum status
        let status;
        if (score >= this.momentumThresholds.high) status = 'Strong';
        else if (score >= this.momentumThresholds.medium) status = 'Steady';
        else if (score >= this.momentumThresholds.low) status = 'Needs Boost';
        else status = 'At Risk';

        return { score, status };
    }

    analyzeTopicEngagement(analysis) {
        const topics = Object.entries(analysis.contentAnalysis.topics || {}).map(([name, count]) => {
            const engagement = (count / analysis.messageCount) * 100;
            return {
                name,
                engagement: Math.round(engagement),
                count
            };
        });

        return topics.sort((a, b) => b.engagement - a.engagement);
    }

    generateTasks(analysis, momentum) {
        const tasks = [];
        const now = new Date();

        // Check for conversation momentum tasks
        if (momentum.status === 'At Risk' || momentum.status === 'Needs Boost') {
            tasks.push({
                priority: 'high',
                description: 'Reconnect and maintain conversation momentum',
                context: `Conversation has ${momentum.status.toLowerCase()}`,
                deadline: 'Today'
            });
        }

        // Check for negative sentiment follow-ups
        if (analysis.contentAnalysis.sentiment.negative > 0) {
            tasks.push({
                priority: 'urgent',
                description: 'Address concerns or negative sentiment',
                context: 'Negative sentiment detected in recent messages',
                deadline: 'Within 24 hours'
            });
        }

        // Check for unanswered questions or pending responses
        if (analysis.interactionMetrics?.pendingResponses > 0) {
            tasks.push({
                priority: 'high',
                description: 'Respond to pending messages',
                context: `${analysis.interactionMetrics.pendingResponses} messages need response`,
                deadline: 'Today'
            });
        }

        // Generate topic-based follow-ups
        const topics = this.analyzeTopicEngagement(analysis);
        topics.forEach(topic => {
            if (topic.engagement > 30) { // High engagement topics
                tasks.push({
                    priority: 'medium',
                    description: `Follow up on ${topic.name} discussion`,
                    context: `High engagement topic (${topic.engagement}% engagement)`,
                    deadline: 'Within 3 days'
                });
            }
        });

        return tasks;
    }

    generateADHDFriendlySummary(analysis, momentum) {
        let summary = '';

        // Momentum status with emoji
        const momentumEmoji = {
            'Strong': '🚀',
            'Steady': '👍',
            'Needs Boost': '⚡',
            'At Risk': '⚠️'
        };
        summary += `${momentumEmoji[momentum.status]} Momentum: ${momentum.status}\n`;

        // Quick action needed?
        if (analysis.contentAnalysis.sentiment.negative > 0 || momentum.status === 'At Risk') {
            summary += '❗ Needs attention soon\n';
        }

        // Main topics (limit to top 3)
        const topics = this.analyzeTopicEngagement(analysis).slice(0, 3);
        if (topics.length > 0) {
            summary += '💭 Main topics: ' + topics.map(t => t.name).join(', ') + '\n';
        }

        // Next step suggestion
        summary += '\n👉 Next step: ' + this.suggestNextStep(analysis, momentum);

        return summary;
    }

    suggestNextStep(analysis, momentum) {
        if (analysis.contentAnalysis.sentiment.negative > 0) {
            return 'Address any concerns in the conversation';
        } else if (momentum.status === 'At Risk') {
            return 'Send a friendly check-in message';
        } else if (momentum.status === 'Needs Boost') {
            return 'Continue recent conversation topics';
        } else if (momentum.status === 'Strong') {
            return 'Maintain regular engagement';
        }
        return 'Keep the conversation going with a casual check-in';
    }
}

// Run the analyzer
const analyzer = new ResponseAnalyzer();
(async () => {
    try {
        await analyzer.initialize();
        await analyzer.analyzeMessages();
        process.exit(0);
    } catch (error) {
        console.error('Error running analyzer:', error);
        process.exit(1);
    }
})();

module.exports = ResponseAnalyzer;
