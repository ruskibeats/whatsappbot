const fs = require('fs');
const path = require('path');

class HistoricalGroomingService {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.relationships = new Map();
        this.biographies = new Map();
        this.ensureDataDirectory();
        this.loadStoredData();
    }

    ensureDataDirectory() {
        const dirs = ['relationships', 'biographies', 'analytics'];
        dirs.forEach(dir => {
            const fullPath = path.join(this.dataDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    loadStoredData() {
        try {
            const relationshipsDir = path.join(this.dataDir, 'relationships');
            const biographiesDir = path.join(this.dataDir, 'biographies');

            // Initialize empty maps
            this.relationships = new Map();
            this.biographies = new Map();

            // Load relationships if directory exists
            if (fs.existsSync(relationshipsDir)) {
                fs.readdirSync(relationshipsDir).forEach(file => {
                    try {
                        if (file.endsWith('.json')) {
                            const userId = file.replace('.json', '');
                            const data = JSON.parse(fs.readFileSync(path.join(relationshipsDir, file)));
                            if (data) {
                                this.relationships.set(userId, this.deserializeRelationship(data));
                            }
                        }
                    } catch (fileError) {
                        console.error(`Error loading relationship file ${file}:`, fileError.message);
                    }
                });
            }

            // Load biographies if directory exists
            if (fs.existsSync(biographiesDir)) {
                fs.readdirSync(biographiesDir).forEach(file => {
                    try {
                        if (file.endsWith('.json')) {
                            const userId = file.replace('.json', '');
                            const data = JSON.parse(fs.readFileSync(path.join(biographiesDir, file)));
                            if (data) {
                                this.biographies.set(userId, this.deserializeBiography(data));
                            }
                        }
                    } catch (fileError) {
                        console.error(`Error loading biography file ${file}:`, fileError.message);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading stored data:', error);
            // Initialize empty maps on error
            this.relationships = new Map();
            this.biographies = new Map();
        }
    }

    saveUserData(userId) {
        try {
            const relationship = this.relationships.get(userId);
            const biography = this.biographies.get(userId);

            if (relationship) {
                const relationshipPath = path.join(this.dataDir, 'relationships', `${userId}.json`);
                fs.writeFileSync(relationshipPath, JSON.stringify(this.serializeRelationship(relationship), null, 2));
            }

            if (biography) {
                const biographyPath = path.join(this.dataDir, 'biographies', `${userId}.json`);
                fs.writeFileSync(biographyPath, JSON.stringify(this.serializeBiography(biography), null, 2));
            }
        } catch (error) {
            console.error(`Error saving data for user ${userId}:`, error);
        }
    }

    serializeRelationship(relationship) {
        return {
            ...relationship,
            topics_discussed: Array.from(relationship.topics_discussed),
            shared_interests: Array.from(relationship.shared_interests),
            last_interaction: relationship.last_interaction?.toISOString(),
            notable_events: relationship.notable_events.map(event => ({
                ...event,
                timestamp: event.timestamp.toISOString()
            }))
        };
    }

    deserializeRelationship(data) {
        if (!data) {
            return {
                topics_discussed: new Set(),
                shared_interests: new Set(),
                last_interaction: null,
                notable_events: []
            };
        }
        return {
            ...data,
            topics_discussed: new Set(data.topics_discussed || []),
            shared_interests: new Set(data.shared_interests || []),
            last_interaction: data.last_interaction ? new Date(data.last_interaction) : null,
            notable_events: (data.notable_events || []).map(event => ({
                ...event,
                timestamp: new Date(event.timestamp)
            }))
        };
    }

    serializeBiography(biography) {
        return {
            ...biography,
            interests: Array.from(biography.interests),
            last_updated: biography.last_updated.toISOString()
        };
    }

    deserializeBiography(data) {
        return {
            ...data,
            interests: new Set(data.interests),
            last_updated: new Date(data.last_updated)
        };
    }

    async analyzeHistoricalMessages(messages, userId) {
        console.log(`Starting enhanced historical analysis for user ${userId}`);
        this.initializeUser(userId);

        const analytics = {
            messageStats: {
                total: 0,
                byHour: new Array(24).fill(0),
                byDay: new Array(7).fill(0),
                averageLength: 0,
                totalLength: 0
            },
            contentAnalysis: {
                topics: new Map(),
                keywords: new Map(),
                sentiments: { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 },
                emotions: new Map(),
                languages: new Map(),
                mediaTypes: new Map()
            },
            interactionPatterns: {
                responseDelays: [],
                conversationChains: [],
                peakActivityPeriods: [],
                commandUsage: new Map()
            },
            personalInfo: {
                detectedNames: new Set(),
                locations: new Set(),
                occupations: new Set(),
                interests: new Set(),
                relationships: new Set(),
                preferences: {
                    likes: new Set(),
                    dislikes: new Set()
                }
            }
        };

        // Process messages chronologically
        const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
        
        for (const msg of sortedMessages) {
            analytics.messageStats.total++;
            
            // Time-based analysis
            const msgDate = new Date(msg.timestamp);
            analytics.messageStats.byHour[msgDate.getHours()]++;
            analytics.messageStats.byDay[msgDate.getDay()]++;
            
            // Content analysis
            const messageLength = msg.body.length;
            analytics.messageStats.totalLength += messageLength;
            
            // Create interaction object with enhanced analysis
            const interaction = {
                message: msg.body,
                timestamp: msg.timestamp,
                sentiment: this._analyzeSentiment(msg.body),
                emotion: this._detectEmotion(msg.body),
                topics: this.extractTopics(msg.body),
                personalInfo: this.extractPersonalInfo(msg.body),
                preferences: this.extractPreferences(msg.body),
                interests: this.extractInterests(msg.body),
                language: this._detectLanguage(msg.body),
                hasMedia: msg.hasMedia,
                messageType: msg.type
            };

            // Update analytics
            analytics.contentAnalysis.sentiments[interaction.sentiment]++;
            if (interaction.emotion) {
                analytics.contentAnalysis.emotions.set(
                    interaction.emotion.type,
                    (analytics.contentAnalysis.emotions.get(interaction.emotion.type) || 0) + 1
                );
            }

            // Track media types
            analytics.contentAnalysis.mediaTypes.set(
                msg.type,
                (analytics.contentAnalysis.mediaTypes.get(msg.type) || 0) + 1
            );

            // Update relationship and biography
            this.updateRelationship(userId, interaction);
            this.updateBiography(userId, interaction);

            // Collect personal information
            Object.entries(interaction.personalInfo).forEach(([key, value]) => {
                if (key === 'name') analytics.personalInfo.detectedNames.add(value);
                if (key === 'location') analytics.personalInfo.locations.add(value);
                if (key === 'occupation') analytics.personalInfo.occupations.add(value);
            });

            // Track interests and preferences
            interaction.interests.forEach(interest => analytics.personalInfo.interests.add(interest));
            Object.entries(interaction.preferences).forEach(([key, values]) => {
                values.forEach(value => analytics.personalInfo.preferences[key].add(value));
            });

            // Extract and track keywords
            const keywords = this._extractKeywords(msg.body);
            keywords.forEach(keyword => {
                analytics.contentAnalysis.keywords.set(
                    keyword,
                    (analytics.contentAnalysis.keywords.get(keyword) || 0) + 1
                );
            });
        }

        // Calculate averages and finalize analytics
        analytics.messageStats.averageLength = analytics.messageStats.totalLength / analytics.messageStats.total;

        // Find peak activity periods
        analytics.interactionPatterns.peakActivityPeriods = this._findPeakActivityPeriods(analytics.messageStats.byHour);

        // Save analytics to file
        const analyticsPath = path.join(this.dataDir, 'analytics', `${userId}_${Date.now()}.json`);
        const serializedAnalytics = this._serializeAnalytics(analytics);
        fs.writeFileSync(analyticsPath, JSON.stringify(serializedAnalytics, null, 2));

        // Save updated user data
        this.saveUserData(userId);

        // Generate comprehensive summary
        const summary = {
            messagesProcessed: analytics.messageStats.total,
            timespan: {
                start: sortedMessages[0]?.timestamp,
                end: sortedMessages[sortedMessages.length - 1]?.timestamp
            },
            messageStats: {
                total: analytics.messageStats.total,
                averageLength: Math.round(analytics.messageStats.averageLength),
                mostActiveHour: this._findMostActive(analytics.messageStats.byHour),
                mostActiveDay: this._findMostActive(analytics.messageStats.byDay)
            },
            contentAnalysis: {
                sentiments: analytics.contentAnalysis.sentiments,
                topEmotions: Array.from(analytics.contentAnalysis.emotions.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5),
                topKeywords: Array.from(analytics.contentAnalysis.keywords.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
            },
            personalInfo: {
                detectedNames: Array.from(analytics.personalInfo.detectedNames),
                locations: Array.from(analytics.personalInfo.locations),
                occupations: Array.from(analytics.personalInfo.occupations),
                interests: Array.from(analytics.personalInfo.interests),
                preferences: {
                    likes: Array.from(analytics.personalInfo.preferences.likes),
                    dislikes: Array.from(analytics.personalInfo.preferences.dislikes)
                }
            },
            relationship: this.getRelationshipSummary(userId),
            biography: this.getBiographySummary(userId)
        };

        return summary;
    }

    _findMostActive(array) {
        return array.indexOf(Math.max(...array));
    }

    _findPeakActivityPeriods(hourlyData) {
        const threshold = Math.max(...hourlyData) * 0.7; // 70% of max activity
        return hourlyData
            .map((count, hour) => ({ hour, count }))
            .filter(({ count }) => count >= threshold)
            .map(({ hour }) => hour);
    }

    _detectLanguage(text) {
        // Simple language detection based on character patterns
        const patterns = {
            english: /^[a-zA-Z\s.,!?]+$/,
            spanish: /[áéíóúñ¿¡]/i,
            french: /[éèêëàâçîïôûùüÿ]/i,
            // Add more language patterns as needed
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) return lang;
        }
        return 'unknown';
    }

    _extractKeywords(text) {
        // Remove common words and extract significant terms
        const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at']);
        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3 && !commonWords.has(word));
    }

    _serializeAnalytics(analytics) {
        return {
            messageStats: analytics.messageStats,
            contentAnalysis: {
                topics: Object.fromEntries(analytics.contentAnalysis.topics),
                keywords: Object.fromEntries(analytics.contentAnalysis.keywords),
                sentiments: analytics.contentAnalysis.sentiments,
                emotions: Object.fromEntries(analytics.contentAnalysis.emotions),
                languages: Object.fromEntries(analytics.contentAnalysis.languages),
                mediaTypes: Object.fromEntries(analytics.contentAnalysis.mediaTypes)
            },
            interactionPatterns: {
                ...analytics.interactionPatterns,
                commandUsage: Object.fromEntries(analytics.interactionPatterns.commandUsage)
            },
            personalInfo: {
                detectedNames: Array.from(analytics.personalInfo.detectedNames),
                locations: Array.from(analytics.personalInfo.locations),
                occupations: Array.from(analytics.personalInfo.occupations),
                interests: Array.from(analytics.personalInfo.interests),
                relationships: Array.from(analytics.personalInfo.relationships),
                preferences: {
                    likes: Array.from(analytics.personalInfo.preferences.likes),
                    dislikes: Array.from(analytics.personalInfo.preferences.dislikes)
                }
            }
        };
    }

    initializeUser(userId) {
        if (!this.relationships.has(userId)) {
            this.relationships.set(userId, {
                trust_level: 0.5,
                interaction_quality: 0.5,
                conversation_depth: 0.5,
                last_interaction: null,
                topics_discussed: new Set(),
                shared_interests: new Set(),
                notable_events: []
            });
        }

        if (!this.biographies.has(userId)) {
            this.biographies.set(userId, {
                personal_info: {},
                preferences: {},
                interests: new Set(),
                conversation_style: {},
                relationship_context: {},
                last_updated: new Date()
            });
        }
    }

    updateRelationship(userId, interaction) {
        this.initializeUser(userId);
        const relationship = this.relationships.get(userId);

        // Update trust level based on interaction quality and consistency
        if (interaction.sentiment === 'POSITIVE') {
            relationship.trust_level = Math.min(1, relationship.trust_level + 0.05);
        } else if (interaction.sentiment === 'NEGATIVE') {
            relationship.trust_level = Math.max(0, relationship.trust_level - 0.05);
        }

        // Update interaction quality based on emotional tone
        if (interaction.emotion) {
            const positiveEmotions = ['happy', 'excited', 'grateful', 'content'];
            const negativeEmotions = ['angry', 'sad', 'frustrated', 'disappointed'];
            
            if (positiveEmotions.includes(interaction.emotion)) {
                relationship.interaction_quality = Math.min(1, relationship.interaction_quality + 0.1);
            } else if (negativeEmotions.includes(interaction.emotion)) {
                relationship.interaction_quality = Math.max(0, relationship.interaction_quality - 0.1);
            }
        }

        // Update conversation depth based on message complexity and context
        const messageLength = interaction.message.length;
        const hasQuestions = interaction.message.includes('?');
        const hasPersonalContent = /\b(i|me|my|mine|we|our)\b/i.test(interaction.message);
        
        if (messageLength > 100 || hasQuestions || hasPersonalContent) {
            relationship.conversation_depth = Math.min(1, relationship.conversation_depth + 0.05);
        }

        // Track topics and update shared interests
        const topics = this.extractTopics(interaction.message);
        topics.forEach(topic => {
            relationship.topics_discussed.add(topic);
            if (this.isInterestIndicator(interaction.message, topic)) {
                relationship.shared_interests.add(topic);
            }
        });

        // Record notable events
        if (this.isNotableEvent(interaction)) {
            relationship.notable_events.push({
                type: this.getEventType(interaction),
                timestamp: new Date(),
                context: interaction.message
            });

            // Keep only last 10 notable events
            if (relationship.notable_events.length > 10) {
                relationship.notable_events.shift();
            }
        }

        relationship.last_interaction = new Date();
    }

    updateBiography(userId, interaction) {
        this.initializeUser(userId);
        const bio = this.biographies.get(userId);

        // Update personal information if detected
        const personalInfo = this.extractPersonalInfo(interaction.message);
        Object.assign(bio.personal_info, personalInfo);

        // Update preferences
        const preferences = this.extractPreferences(interaction.message);
        Object.assign(bio.preferences, preferences);

        // Update interests
        const interests = this.extractInterests(interaction.message);
        interests.forEach(interest => bio.interests.add(interest));

        // Update conversation style
        bio.conversation_style = {
            ...bio.conversation_style,
            formality: interaction.style?.formality || bio.conversation_style.formality,
            emoji_usage: interaction.style?.emoji_usage || bio.conversation_style.emoji_usage,
            typical_response_time: interaction.style?.avg_response_time || bio.conversation_style.typical_response_time
        };

        // Update relationship context
        const relationship = this.relationships.get(userId);
        bio.relationship_context = {
            trust_level: relationship.trust_level,
            interaction_quality: relationship.interaction_quality,
            conversation_depth: relationship.conversation_depth,
            shared_interests: Array.from(relationship.shared_interests)
        };

        bio.last_updated = new Date();
    }

    extractTopics(message) {
        const topics = new Set();
        const topicCategories = {
            technology: /\b(computer|software|programming|tech|ai|internet)\b/i,
            entertainment: /\b(movie|music|game|book|show|series)\b/i,
            lifestyle: /\b(food|travel|hobby|sport|exercise)\b/i,
            work: /\b(job|work|career|business|project)\b/i,
            education: /\b(school|study|learn|college|university|course)\b/i,
            relationships: /\b(family|friend|partner|relationship|dating)\b/i
        };

        Object.entries(topicCategories).forEach(([category, pattern]) => {
            if (pattern.test(message)) {
                topics.add(category);
            }
        });

        return topics;
    }

    isInterestIndicator(message, topic) {
        const interestPatterns = [
            /\bi (?:like|love|enjoy|prefer)\b/i,
            /\bmy favorite\b/i,
            /\bi'm (?:interested|passionate) about\b/i,
            /\bi (?:work|study)\b/i
        ];

        return interestPatterns.some(pattern => 
            pattern.test(message) && message.toLowerCase().includes(topic)
        );
    }

    isNotableEvent(interaction) {
        return (
            interaction.sentiment === 'POSITIVE' && interaction.emotion?.intensity > 0.8 ||
            interaction.message.length > 200 ||
            interaction.message.includes('thank you') ||
            /\b(birthday|anniversary|congratulations)\b/i.test(interaction.message)
        );
    }

    getEventType(interaction) {
        if (/\b(birthday|anniversary)\b/i.test(interaction.message)) return 'celebration';
        if (/thank you/i.test(interaction.message)) return 'gratitude';
        if (interaction.emotion?.intensity > 0.8) return 'emotional_peak';
        return 'significant_interaction';
    }

    extractPersonalInfo(message) {
        const info = {};
        
        const patterns = {
            name: /\bmy name is (\w+)\b/i,
            age: /\bi(?:'m| am) (\d+)(?: years old)?\b/i,
            location: /\bi(?:'m| am) from ([^,.!?]+)/i,
            occupation: /\bi (?:work as|am) (?:an? )?([^,.!?]+)/i
        };

        Object.entries(patterns).forEach(([key, pattern]) => {
            const match = message.match(pattern);
            if (match && match[1]) {
                info[key] = match[1].trim();
            }
        });

        return info;
    }

    extractPreferences(message) {
        const preferences = {};
        
        const preferencePatterns = {
            likes: /\bi (?:like|love|enjoy) ([^,.!?]+)/i,
            dislikes: /\bi (?:don't like|hate|dislike) ([^,.!?]+)/i,
            preferences: /\bi prefer ([^,.!?]+)/i
        };

        Object.entries(preferencePatterns).forEach(([key, pattern]) => {
            const matches = message.match(pattern);
            if (matches && matches[1]) {
                if (!preferences[key]) preferences[key] = new Set();
                preferences[key].add(matches[1].trim());
            }
        });

        return preferences;
    }

    extractInterests(message) {
        const interests = new Set();
        
        const interestPatterns = [
            /\bi'm interested in ([^,.!?]+)/i,
            /\bi (?:like|love|enjoy) ([^,.!?]+)/i,
            /\bmy hobby is ([^,.!?]+)/i,
            /\bi'm passionate about ([^,.!?]+)/i
        ];

        interestPatterns.forEach(pattern => {
            const matches = message.match(pattern);
            if (matches && matches[1]) {
                interests.add(matches[1].trim());
            }
        });

        return interests;
    }

    getRelationshipSummary(userId) {
        const relationship = this.relationships.get(userId);
        if (!relationship) return null;

        return {
            trust_level: relationship.trust_level,
            interaction_quality: relationship.interaction_quality,
            conversation_depth: relationship.conversation_depth,
            shared_interests: Array.from(relationship.shared_interests),
            last_interaction: relationship.last_interaction,
            notable_events: relationship.notable_events.slice(-5) // Last 5 notable events
        };
    }

    getBiographySummary(userId) {
        const bio = this.biographies.get(userId);
        if (!bio) return null;

        return {
            personal_info: bio.personal_info,
            interests: Array.from(bio.interests),
            conversation_style: bio.conversation_style,
            relationship_context: bio.relationship_context,
            last_updated: bio.last_updated
        };
    }

    _analyzeSentiment(message) {
        // Simple sentiment analysis based on keyword matching
        const positiveWords = ['happy', 'great', 'good', 'love', 'excellent', 'thank', 'thanks', 'awesome'];
        const negativeWords = ['sad', 'bad', 'hate', 'terrible', 'awful', 'sorry', 'upset', 'angry'];

        const words = message.toLowerCase().split(/\W+/);
        let positiveCount = words.filter(word => positiveWords.includes(word)).length;
        let negativeCount = words.filter(word => negativeWords.includes(word)).length;

        if (positiveCount > negativeCount) return 'POSITIVE';
        if (negativeCount > positiveCount) return 'NEGATIVE';
        return 'NEUTRAL';
    }

    _detectEmotion(message) {
        // Simple emotion detection based on keywords and patterns
        const emotionPatterns = {
            happy: /\b(happy|joy|excited|wonderful)\b|😊|😃|😄/i,
            angry: /\b(angry|mad|furious|upset)\b|😠|😡/i,
            sad: /\b(sad|unhappy|depressed|disappointed)\b|😢|😭/i,
            grateful: /\b(thank|grateful|appreciate)\b|🙏/i,
            confused: /\b(confused|unsure|don't understand)\b|😕|🤔/i
        };

        for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
            if (pattern.test(message)) {
                return {
                    type: emotion,
                    intensity: 0.8 // Default high intensity for detected emotions
                };
            }
        }

        return null;
    }
}

module.exports = HistoricalGroomingService;
