const { Pool } = require('pg');
const natural = require('natural');

class RelationshipAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: 'russbee',
            password: 'skimmer69',
            host: '192.168.0.169',
            database: 'beehive',
            port: 5432
        });

        // Known family names for pattern matching
        this.familyNames = ['Batchelor', 'Watson'];
        
        // Known friend names
        this.knownFriends = ['Tom Brown', 'Jamal', 'Ben Righton'];
        
        // Common work-related terms
        this.workTerms = ['meeting', 'project', 'deadline', 'client', 'report', 'office', 'work', 'team', 'boss', 'colleague'];
        
        // Common friend-related terms
        this.friendTerms = ['mate', 'pub', 'drink', 'game', 'party', 'cheers', 'thanks', 'weekend', 'holiday', 'bro', 'bruv'];
    }

    async analyzeUncategorizedChats() {
        try {
            // Get chats without relationship type or specific names we want to reanalyze
            const chatsToAnalyze = await this.pool.query(`
                SELECT chat_id, chat_name 
                FROM chat_metadata 
                WHERE (relationship_type IS NULL OR 
                      chat_name ILIKE '%brown%' OR 
                      chat_name ILIKE '%jamal%' OR 
                      chat_name ILIKE '%righton%')
                AND chat_id NOT LIKE '%@g.us'`);

            for (const chat of chatsToAnalyze.rows) {
                const analysis = await this.analyzeSingleChat(chat);
                if (analysis.confidence > 0.7) {
                    await this.updateRelationship(chat.chat_id, analysis);
                }
            }
        } catch (error) {
            console.error('Error analyzing relationships:', error);
        }
    }

    async analyzeSingleChat(chat) {
        const messages = await this.getRecentMessages(chat.chat_id);
        const metrics = await this.getAnalytics(chat.chat_id);
        
        // Initialize scores
        let relationshipScores = {
            family: this.analyzeForFamily(chat, messages),
            friend: this.analyzeForFriend(chat, messages),
            work: this.analyzeForWork(messages)
        };

        // Check for known friends
        if (this.knownFriends.some(name => 
            chat.chat_name.toLowerCase().includes(name.toLowerCase()))) {
            relationshipScores.friend += 0.8;  // High confidence boost for known friends
        }

        // Factor in communication patterns
        if (metrics.rows[0]) {
            const patterns = metrics.rows[0];
            // Frequent evening/weekend messages suggest family/friends
            if (patterns.peak_hours && patterns.peak_hours.some(hour => hour >= 18)) {
                relationshipScores.family *= 1.2;
                relationshipScores.friend *= 1.2;
            }
            // High response rate suggests closer relationship
            if (patterns.response_rate > 0.8) {
                relationshipScores.family *= 1.3;
                relationshipScores.friend *= 1.2;
            }
        }

        // Determine highest confidence relationship
        const topRelationship = Object.entries(relationshipScores)
            .reduce((max, [type, score]) => score > max.score ? {type, score} : max, 
                   {type: null, score: 0});

        return {
            type: topRelationship.type,
            confidence: topRelationship.score,
            context: await this.generateContext(chat, messages, topRelationship.type)
        };
    }

    analyzeForFamily(chat, messages) {
        let score = 0;
        
        // Check surname matches
        if (this.familyNames.some(name => chat.chat_name.includes(name))) {
            score += 0.4;
        }

        // Check for family-related terms
        const familyTerms = ['mum', 'dad', 'brother', 'sister', 'cousin', 'aunt', 'uncle'];
        messages.rows.forEach(msg => {
            if (familyTerms.some(term => msg.message_body.toLowerCase().includes(term))) {
                score += 0.2;
            }
        });

        return score;
    }

    analyzeForFriend(chat, messages) {
        let score = 0;
        messages.rows.forEach(msg => {
            this.friendTerms.forEach(term => {
                if (msg.message_body.toLowerCase().includes(term)) {
                    score += 0.1;
                }
            });
            // Check for emojis and casual language
            if (msg.message_body.includes('😊') || msg.message_body.includes('😂')) {
                score += 0.05;
            }
        });
        return score;
    }

    analyzeForWork(messages) {
        let score = 0;
        messages.rows.forEach(msg => {
            this.workTerms.forEach(term => {
                if (msg.message_body.toLowerCase().includes(term)) {
                    score += 0.1;
                }
            });
        });
        return score;
    }

    async getRecentMessages(chatId) {
        return await this.pool.query(`
            SELECT message_body, timestamp 
            FROM messages 
            WHERE chat_id = $1 
            ORDER BY timestamp DESC 
            LIMIT 50`, [chatId]);
    }

    async getAnalytics(chatId) {
        return await this.pool.query(`
            SELECT response_rate, peak_hours, daily_messages_avg 
            FROM chat_analytics 
            WHERE chat_id = $1`, [chatId]);
    }

    async generateContext(chat, messages, type) {
        const context = {};
        
        switch(type) {
            case 'family':
                context.family_relation = 'unknown';
                break;
                
            case 'friend':
                // Set friendship level based on known friends
                if (this.knownFriends.some(name => 
                    chat.chat_name.toLowerCase().includes(name.toLowerCase()))) {
                    context.friendship_level = 'close';
                } else {
                    context.friendship_level = 'casual';
                }
                
                // Extract potential interests from messages
                const interests = new Set();
                messages.rows.forEach(msg => {
                    this.friendTerms.forEach(term => {
                        if (msg.message_body.toLowerCase().includes(term)) {
                            interests.add(term);
                        }
                    });
                });
                context.interests = Array.from(interests);
                break;
                
            case 'work':
                context.work_relationship = 'colleague';
                const workContext = new Set();
                messages.rows.forEach(msg => {
                    this.workTerms.forEach(term => {
                        if (msg.message_body.toLowerCase().includes(term)) {
                            workContext.add(term);
                        }
                    });
                });
                context.work_context = Array.from(workContext);
                break;
        }
        
        return context;
    }

    async updateRelationship(chatId, analysis) {
        await this.pool.query(`
            UPDATE chat_metadata 
            SET relationship_type = $1, 
                relationship_context = $2 
            WHERE chat_id = $3`,
            [analysis.type, analysis.context, chatId]
        );
        console.log(`Updated relationship for ${chatId}: ${analysis.type} (confidence: ${analysis.confidence})`);
    }
}

// Run the analyzer
const analyzer = new RelationshipAnalyzer();
analyzer.analyzeUncategorizedChats()
    .then(() => console.log('Relationship analysis complete'))
    .catch(console.error); 