const fs = require('fs').promises;
const path = require('path');

class DataEnricher {
    constructor() {
        this.relationships = new Map();
        this.categories = new Map();
        this.userProfiles = new Map();
        this.conversationContexts = new Map();
    }

    async start() {
        try {
            console.log('Starting data enrichment process...');
            
            // Load existing analysis data
            await this.loadAnalysisData();
            
            // Perform enrichment
            await this.enrichRelationships();
            await this.categorizeConversations();
            await this.mapUserConnections();
            
            // Save enriched data
            await this.saveEnrichedData();
            
            console.log('Data enrichment complete!');
        } catch (error) {
            console.error('Error during enrichment:', error);
        }
    }

    async loadAnalysisData() {
        const analysisDir = path.join(process.cwd(), 'data', 'bulk_analysis');
        const files = await fs.readdir(analysisDir);
        
        console.log(`Loading ${files.length} analysis files...`);
        
        for (const file of files) {
            if (file.endsWith('_analysis.json')) {
                const data = JSON.parse(
                    await fs.readFile(path.join(analysisDir, file), 'utf8')
                );
                this.userProfiles.set(data.userId, data);
            }
        }
    }

    async enrichRelationships() {
        console.log('Analyzing relationships between users...');
        
        const relationshipTypes = {
            PROFESSIONAL: 'professional',
            PERSONAL: 'personal',
            GROUP_MEMBER: 'group_member',
            CASUAL: 'casual'
        };

        // Analyze each user's interactions
        for (const [userId, profile] of this.userProfiles.entries()) {
            const relationships = new Map();

            // Determine relationship types based on content analysis
            const isWork = this.hasWorkRelatedContent(profile);
            const isPersonal = this.hasPersonalContent(profile);
            const isGroup = userId.includes('@g.us');

            // Analyze message patterns
            const interactionPatterns = this.analyzeInteractionPatterns(profile);

            // Create relationship profile
            const relationshipProfile = {
                type: this.determineRelationshipType(isWork, isPersonal, isGroup, relationshipTypes),
                strength: this.calculateRelationshipStrength(profile),
                context: this.identifyRelationshipContext(profile),
                interactions: {
                    frequency: interactionPatterns.frequency,
                    quality: interactionPatterns.quality,
                    consistency: profile.interactionMetrics.consistencyScore
                },
                sharedInterests: this.findSharedInterests(profile),
                communicationStyle: this.analyzeCommunicationStyle(profile)
            };

            this.relationships.set(userId, relationshipProfile);
        }
    }

    async categorizeConversations() {
        console.log('Categorizing conversations...');
        
        const categories = {
            WORK: {
                keywords: ['work', 'project', 'meeting', 'deadline', 'client', 'report'],
                contexts: ['office', 'business', 'professional']
            },
            SOCIAL: {
                keywords: ['party', 'dinner', 'drinks', 'fun', 'weekend', 'holiday'],
                contexts: ['personal', 'casual', 'entertainment']
            },
            TECHNICAL: {
                keywords: ['server', 'network', 'system', 'code', 'error', 'update'],
                contexts: ['IT', 'development', 'support']
            },
            LOGISTICS: {
                keywords: ['schedule', 'plan', 'arrange', 'book', 'reservation'],
                contexts: ['planning', 'organization']
            },
            SUPPORT: {
                keywords: ['help', 'issue', 'problem', 'assist', 'resolve'],
                contexts: ['technical support', 'assistance']
            }
        };

        for (const [userId, profile] of this.userProfiles.entries()) {
            const userCategories = new Set();
            
            // Analyze message content for category matching
            const messageContent = profile.contentAnalysis.keywords;
            
            for (const [category, criteria] of Object.entries(categories)) {
                if (this.matchesCategory(messageContent, criteria)) {
                    userCategories.add(category);
                }
            }

            this.categories.set(userId, Array.from(userCategories));
        }
    }

    async mapUserConnections() {
        console.log('Mapping user connections and interaction networks...');
        
        const connections = new Map();
        
        // Analyze group chats to establish connections
        for (const [userId, profile] of this.userProfiles.entries()) {
            if (userId.includes('@g.us')) {
                const groupMembers = this.extractGroupMembers(profile);
                
                // Create connection map for group members
                groupMembers.forEach(member => {
                    if (!connections.has(member)) {
                        connections.set(member, new Set());
                    }
                    
                    // Add connections between all group members
                    groupMembers.forEach(otherMember => {
                        if (member !== otherMember) {
                            connections.get(member).add(otherMember);
                        }
                    });
                });
            }
        }

        // Add connection strength and context
        for (const [userId, connectedUsers] of connections.entries()) {
            const enrichedConnections = new Map();
            
            connectedUsers.forEach(connectedId => {
                enrichedConnections.set(connectedId, {
                    strength: this.calculateConnectionStrength(userId, connectedId),
                    context: this.determineConnectionContext(userId, connectedId),
                    interactions: this.summarizeInteractions(userId, connectedId)
                });
            });

            connections.set(userId, enrichedConnections);
        }

        this.connections = connections;
    }

    async saveEnrichedData() {
        const enrichedDir = path.join(process.cwd(), 'data', 'enriched');
        await fs.mkdir(enrichedDir, { recursive: true });

        // Save relationships
        await fs.writeFile(
            path.join(enrichedDir, 'relationships.json'),
            JSON.stringify(Object.fromEntries(this.relationships), null, 2)
        );

        // Save categories
        await fs.writeFile(
            path.join(enrichedDir, 'categories.json'),
            JSON.stringify(Object.fromEntries(this.categories), null, 2)
        );

        // Save connection network
        await fs.writeFile(
            path.join(enrichedDir, 'connections.json'),
            JSON.stringify(Object.fromEntries(this.connections), null, 2)
        );

        console.log('Enriched data saved to data/enriched/');
    }

    // Helper methods
    hasWorkRelatedContent(profile) {
        const workKeywords = ['work', 'project', 'meeting', 'client', 'deadline', 'report'];
        return this.hasKeywords(profile.contentAnalysis.keywords, workKeywords);
    }

    hasPersonalContent(profile) {
        const personalKeywords = ['friend', 'family', 'home', 'personal', 'holiday', 'weekend'];
        return this.hasKeywords(profile.contentAnalysis.keywords, personalKeywords);
    }

    hasKeywords(content, keywords) {
        return keywords.some(keyword => content[keyword] > 0);
    }

    determineRelationshipType(isWork, isPersonal, isGroup, types) {
        if (isWork && !isPersonal) return types.PROFESSIONAL;
        if (isPersonal && !isWork) return types.PERSONAL;
        if (isGroup) return types.GROUP_MEMBER;
        return types.CASUAL;
    }

    calculateRelationshipStrength(profile) {
        const factors = {
            messageCount: profile.messageCount / 1000, // Normalized by 1000 messages
            responseRate: profile.interactionMetrics.responseRate,
            sentiment: this.calculateSentimentScore(profile.contentAnalysis.sentiment)
        };
        
        return (factors.messageCount * 0.3 + 
                factors.responseRate * 0.4 + 
                factors.sentiment * 0.3);
    }

    calculateSentimentScore(sentiment) {
        const total = sentiment.positive + sentiment.neutral + sentiment.negative;
        return (sentiment.positive - sentiment.negative) / total;
    }

    identifyRelationshipContext(profile) {
        const contexts = new Set();
        
        if (profile.contentAnalysis.topics.work) contexts.add('Professional');
        if (profile.contentAnalysis.topics.family) contexts.add('Personal');
        if (profile.contentAnalysis.topics.technology) contexts.add('Technical');
        
        return Array.from(contexts);
    }

    analyzeInteractionPatterns(profile) {
        return {
            frequency: this.calculateInteractionFrequency(profile),
            quality: this.calculateInteractionQuality(profile)
        };
    }

    calculateInteractionFrequency(profile) {
        const timespan = profile.timespan.end - profile.timespan.start;
        const daysActive = timespan / (24 * 60 * 60);
        return profile.messageCount / daysActive;
    }

    calculateInteractionQuality(profile) {
        return {
            mediaShare: profile.messageStats.mediaCount / profile.messageCount,
            engagement: profile.interactionMetrics.responseRate,
            sentiment: this.calculateSentimentScore(profile.contentAnalysis.sentiment)
        };
    }

    findSharedInterests(profile) {
        return Object.entries(profile.contentAnalysis.topics)
            .filter(([_, count]) => count > 0)
            .map(([topic]) => topic);
    }

    analyzeCommunicationStyle(profile) {
        return {
            formality: this.calculateFormality(profile),
            verbosity: profile.messageStats.averageLength,
            mediaUsage: profile.messageStats.mediaCount / profile.messageCount,
            responsiveness: profile.interactionMetrics.responseRate
        };
    }

    calculateFormality(profile) {
        const formalKeywords = ['please', 'thank', 'would', 'could', 'regards'];
        const informalKeywords = ['hey', 'mate', 'cool', 'yeah', 'gonna'];
        
        const formalCount = this.countKeywords(profile.contentAnalysis.keywords, formalKeywords);
        const informalCount = this.countKeywords(profile.contentAnalysis.keywords, informalKeywords);
        
        const total = formalCount + informalCount;
        return total > 0 ? formalCount / total : 0.5;
    }

    countKeywords(content, keywords) {
        return keywords.reduce((sum, keyword) => sum + (content[keyword] || 0), 0);
    }

    matchesCategory(content, criteria) {
        const keywordMatches = criteria.keywords.some(keyword => content[keyword] > 0);
        return keywordMatches;
    }

    extractGroupMembers(profile) {
        // In a real implementation, this would parse group chat metadata
        // For now, return an empty array as we don't have group member data
        return [];
    }

    calculateConnectionStrength(user1, user2) {
        // Calculate connection strength based on shared groups and interaction patterns
        return 0.5; // Placeholder value
    }

    determineConnectionContext(user1, user2) {
        const contexts = new Set();
        
        // Add contexts based on user categories
        if (this.categories.has(user1)) {
            this.categories.get(user1).forEach(category => contexts.add(category));
        }
        if (this.categories.has(user2)) {
            this.categories.get(user2).forEach(category => contexts.add(category));
        }
        
        return Array.from(contexts);
    }

    summarizeInteractions(user1, user2) {
        return {
            frequency: 'medium', // Placeholder - would calculate from actual interaction data
            quality: 'good',     // Placeholder - would calculate from sentiment and response patterns
            lastInteraction: Date.now() // Placeholder - would use actual last interaction timestamp
        };
    }
}

// Start the enrichment process
const enricher = new DataEnricher();
enricher.start().catch(console.error);
