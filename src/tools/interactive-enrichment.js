const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class InteractiveEnricher {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.dataDir = path.join(process.cwd(), 'data');
    }

    async start() {
        try {
            console.log('Starting interactive enrichment process...');
            
            // Get recent messages
            const recentMessages = await this.getRecentMessages();
            
            if (recentMessages.length === 0) {
                console.log('No recent messages found to analyze.');
                this.rl.close();
                return;
            }

            // Group messages by contact
            const messagesByContact = this.groupMessagesByContact(recentMessages);
            
            // Process each contact's messages
            for (const [contactId, messages] of messagesByContact.entries()) {
                // Show contact context
                console.log('\n----------------------------------------');
                
                // Try to get contact info from biography
                let contactInfo = '';
                let contactName = 'Unknown Contact';
                try {
                    const bioPath = path.join(this.dataDir, 'biographies', `${contactId}.json`);
                    const bioData = JSON.parse(await fs.readFile(bioPath, 'utf8'));
                    
                    // Get contact name from a mapping or use a friendly format
                    contactName = this._getContactName(contactId);
                    
                    // Build contact info string
                    const location = bioData.personal_info?.location ? ` (${bioData.personal_info.location})` : '';
                    const interests = bioData.interests?.length ? 
                        `\nInterests: ${bioData.interests.join(', ')}` : '';
                    const style = bioData.conversation_style?.formality ?
                        `\nStyle: ${bioData.conversation_style.formality}, Response time: ${bioData.conversation_style.typical_response_time}` : '';
                    
                    contactInfo = `${location}${interests}${style}`;
                } catch (error) {
                    // No biography found
                }
                
                console.log(`Contact: ${contactName}${contactInfo}`);
                console.log('\nRecent Activity:');
                // Show recent activity summary
                console.log('\nRecent Activity Summary:');
                
                // Get message timestamps and sort them
                const timestamps = messages.map(msg => msg.messageStats?.peakActivityPeriods?.[0] || 0);
                const sortedTimestamps = timestamps.sort((a, b) => b - a);
                const mostRecentTime = new Date(sortedTimestamps[0] * 3600000).getHours();
                
                console.log(`Last Active: ${mostRecentTime}:00`);
                console.log(`Messages in Last 3 Days: ${messages.length}`);
                
                // Show interaction patterns
                const messagesByHour = new Array(24).fill(0);
                messages.forEach(msg => {
                    const hour = msg.messageStats?.peakActivityPeriods?.[0] || 0;
                    if (hour >= 0 && hour < 24) {
                        messagesByHour[hour]++;
                    }
                });
                
                const peakHour = messagesByHour.indexOf(Math.max(...messagesByHour));
                console.log(`Peak Activity: ${peakHour}:00`);
                
                // Show content summary
                const uniqueKeywords = new Set();
                messages.forEach(msg => {
                    if (msg.contentAnalysis?.keywords) {
                        Object.keys(msg.contentAnalysis.keywords)
                            .filter(k => !k.match(/\d+/) && k.length > 3) // Filter out numbers and short words
                            .forEach(k => uniqueKeywords.add(k));
                    }
                });
                
                if (uniqueKeywords.size > 0) {
                    const relevantKeywords = Array.from(uniqueKeywords)
                        .filter(k => !['message', 'your', 'there', 'error', 'processing'].includes(k))
                        .slice(0, 5);
                    if (relevantKeywords.length > 0) {
                        console.log('Key Topics:', relevantKeywords.join(', '));
                    }
                }
                
                // Show sentiment trend
                const sentiments = messages.map(msg => {
                    const counts = msg.contentAnalysis?.sentiments || {};
                    return Object.entries(counts).find(([_, v]) => v > 0)?.[0] || 'NEUTRAL';
                });
                
                const recentSentiment = sentiments[0] || 'NEUTRAL';
                console.log('Current Mood:', recentSentiment.toLowerCase());
                console.log('----------------------------------------\n');
                
                const proceed = await this.askQuestion(
                    'Would you like to provide information about this contact? (y/n):'
                );
                
                if (proceed.toLowerCase() === 'y') {
                    await this.enrichContactData(contactId, messages);
                } else {
                    console.log('Skipping this contact...');
                }
            }

            console.log('\nEnrichment process complete!');
            this.rl.close();
        } catch (error) {
            console.error('Error during enrichment:', error);
            this.rl.close();
        }
    }

    async getRecentMessages() {
        // Get messages from the last 3 days
        const analyticsDir = path.join(this.dataDir, 'analytics');
        const files = await fs.readdir(analyticsDir);
        const recentFiles = files.filter(f => {
            const timestamp = parseInt(f.split('_')[1].replace('.json', ''));
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
            return timestamp > threeDaysAgo;
        });

        const messages = [];
        for (const file of recentFiles) {
            const contactId = file.split('_')[0]; // Extract contact ID from filename
            const data = JSON.parse(
                await fs.readFile(path.join(analyticsDir, file), 'utf8')
            );
            messages.push({
                ...data,
                contactId // Add contact ID to the message data
            });
        }

        return messages;
    }

    groupMessagesByContact(messages) {
        const grouped = new Map();
        messages.forEach(msg => {
            const contactId = msg.contactId || msg.userId;
            if (!grouped.has(contactId)) {
                grouped.set(contactId, []);
            }
            grouped.get(contactId).push(msg);
        });
        return grouped;
    }

    async askQuestion(question) {
        return new Promise(resolve => {
            this.rl.question(question + ' ', answer => {
                resolve(answer.trim());
            });
        });
    }

    async enrichContactData(contactId, messages) {
        // Get existing biography data
        let bioData = {};
        try {
            const bioPath = path.join(this.dataDir, 'biographies', `${contactId}.json`);
            bioData = JSON.parse(await fs.readFile(bioPath, 'utf8'));
        } catch (error) {
            // No biography found
        }

        const enrichedData = {
            contactId,
            contactName: contactId === '447881795908@c.us' ? 'Russell Batchelor' : 'Unknown Contact',
            timestamp: Date.now(),
            biography: {
                location: bioData.personal_info?.location || '',
                interests: bioData.interests || [],
                conversationStyle: bioData.conversation_style || {}
            },
            relationship: {},
            context: {},
            preferences: {},
            activity: {
                lastActive: new Date().toISOString(),
                messageCount: messages.length,
                averageResponseTime: this._calculateAverageResponseTime(messages),
                commonTopics: this._extractCommonTopics(messages)
            }
        };

        // Basic relationship questions
        console.log(`\nEnriching data for ${enrichedData.contactName}:`);
        
        const relationshipType = await this.askQuestion(
            'How would you categorize your relationship with this contact?\n' +
            '1. Professional\n' +
            '2. Personal\n' +
            '3. Both\n' +
            '4. Other\n' +
            'Enter number:'
        );

        const interactionFrequency = await this.askQuestion(
            'How often do you typically interact with this contact?\n' +
            '1. Daily\n' +
            '2. Weekly\n' +
            '3. Monthly\n' +
            '4. Occasionally\n' +
            'Enter number:'
        );

        // Build relationship data
        const relationship = {
            type: this._mapRelationshipType(relationshipType),
            frequency: this._mapInteractionFrequency(interactionFrequency),
            lastUpdated: new Date().toISOString()
        };

        // Build context data
        const context = {};
        if (messages.some(m => m.contentAnalysis?.topics?.work)) {
            context.professional = await this.askQuestion(
                'I notice work-related messages. What is your professional relationship with this contact?'
            );
        }

        if (messages.some(m => m.contentAnalysis?.keywords?.help || m.contentAnalysis?.keywords?.support)) {
            const supportResponse = await this.askQuestion(
                'These messages involve support or assistance. Is this a regular pattern in your relationship? (y/n)'
            );
            context.supportPattern = supportResponse.toLowerCase() === 'y';
        }

        // Build preferences data
        const responseTimeChoice = await this.askQuestion(
            'What is your preferred response time for this contact?\n' +
            '1. ASAP\n' +
            '2. Within few hours\n' +
            '3. Within a day\n' +
            '4. When convenient\n' +
            'Enter number:'
        );

        const priorityChoice = await this.askQuestion(
            'How would you prioritize messages from this contact?\n' +
            '1. High priority\n' +
            '2. Medium priority\n' +
            '3. Low priority\n' +
            'Enter number:'
        );

        const preferences = {
            responseTime: this._mapResponseTime(responseTimeChoice),
            priority: this._mapPriority(priorityChoice),
            lastUpdated: new Date().toISOString()
        };

        // Update enriched data with mapped values
        enrichedData.relationship = relationship;
        enrichedData.context = context;
        enrichedData.preferences = preferences;

        // Save enriched data
        await this.saveEnrichedData(contactId, enrichedData);
        console.log(`Enriched data saved for ${enrichedData.contactName}`);
    }

    async saveEnrichedData(contactId, data) {
        const enrichedDir = path.join(this.dataDir, 'enriched');
        await fs.mkdir(enrichedDir, { recursive: true });
        
        const filename = path.join(enrichedDir, `${contactId}_enriched.json`);
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
    }

    _calculateAverageResponseTime(messages) {
        const responseTimes = [];
        for (let i = 1; i < messages.length; i++) {
            const current = messages[i];
            const previous = messages[i-1];
            if (current.messageStats && previous.messageStats) {
                const responseTime = current.messageStats.peakActivityPeriods?.[0] - 
                                   previous.messageStats.peakActivityPeriods?.[0];
                if (responseTime > 0) {
                    responseTimes.push(responseTime);
                }
            }
        }
        return responseTimes.length > 0 ? 
            Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 
            null;
    }

    _extractCommonTopics(messages) {
        const topicCounts = new Map();
        messages.forEach(msg => {
            if (msg.contentAnalysis?.keywords) {
                Object.keys(msg.contentAnalysis.keywords)
                    .filter(k => !k.match(/\d+/) && k.length > 3)
                    .filter(k => !['message', 'your', 'there', 'error', 'processing'].includes(k))
                    .forEach(topic => {
                        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
                    });
            }
        });

        return Array.from(topicCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);
    }

    _mapRelationshipType(choice) {
        const types = {
            '1': 'Professional',
            '2': 'Personal',
            '3': 'Both Professional and Personal',
            '4': 'Other'
        };
        return types[choice] || 'Unknown';
    }

    _mapInteractionFrequency(choice) {
        const frequencies = {
            '1': 'Daily',
            '2': 'Weekly',
            '3': 'Monthly',
            '4': 'Occasional'
        };
        return frequencies[choice] || 'Unknown';
    }

    _mapResponseTime(choice) {
        const times = {
            '1': 'ASAP',
            '2': 'Within few hours',
            '3': 'Within a day',
            '4': 'When convenient'
        };
        return times[choice] || 'Unknown';
    }

    _mapPriority(choice) {
        const priorities = {
            '1': 'High',
            '2': 'Medium',
            '3': 'Low'
        };
        return priorities[choice] || 'Unknown';
    }
    
    _getContactName(contactId) {
        // Known contact mappings
        const contactNames = {
            '447881795908@c.us': 'Russell Batchelor',
            '447732847173@c.us': 'Support Contact',
            // Add more contacts here as they're identified
        };

        // Return mapped name or format the ID nicely
        return contactNames[contactId] || `Contact ${contactId.split('@')[0]}`;
    }
}

// Start the interactive enrichment process if run directly
if (require.main === module) {
    const enricher = new InteractiveEnricher();
    enricher.start().catch(console.error);
}

module.exports = InteractiveEnricher;
