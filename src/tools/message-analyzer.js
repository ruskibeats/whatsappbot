const fs = require('fs').promises;
const path = require('path');

class MessageAnalyzer {
    constructor() {
        this.senderProfiles = new Map();
        this.topicKeywords = new Map([
            ['work', ['work', 'job', 'meeting', 'project', 'client', 'boss', 'office']],
            ['family', ['family', 'kids', 'parents', 'mom', 'dad', 'sister', 'brother']],
            ['social', ['party', 'drinks', 'dinner', 'lunch', 'coffee', 'hangout']],
            ['health', ['health', 'doctor', 'sick', 'hospital', 'medicine', 'feeling']],
            ['tech', ['phone', 'computer', 'laptop', 'internet', 'app', 'software']],
            ['gaming', ['game', 'play', 'gaming', 'xbox', 'playstation', 'steam', 'discord']],
            ['travel', ['travel', 'trip', 'vacation', 'flight', 'hotel', 'airport']],
            ['events', ['event', 'concert', 'show', 'festival', 'wedding', 'birthday']]
        ]);
    }

    async processMessageFiles() {
        try {
            const messagesDir = path.join(process.cwd(), 'data', 'recent_messages');
            const files = await fs.readdir(messagesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            // Process files in chronological order
            const sortedFiles = jsonFiles.sort();
            
            for (const file of sortedFiles) {
                const filePath = path.join(messagesDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const messages = JSON.parse(content);
                this.groupMessagesBySender(messages);
            }

            await this.generateSenderProfiles();
        } catch (error) {
            console.error('Error processing message files:', error);
        }
    }

    groupMessagesBySender(messages) {
        for (const msg of messages) {
            if (!msg.message.body && !msg.message.hasMedia) continue;

            const senderId = msg.from.id;
            if (!this.senderProfiles.has(senderId)) {
                this.senderProfiles.set(senderId, {
                    id: senderId,
                    name: msg.from.name,
                    number: msg.from.number,
                    chats: new Set(),
                    messages: [],
                    firstMessage: new Date(msg.timestamp),
                    lastMessage: new Date(msg.timestamp),
                    messageTypes: new Map(),
                    mediaCount: 0,
                    forwardedCount: 0,
                    chatTypes: {
                        group: new Set(),
                        private: new Set()
                    },
                    topics: new Map(),
                    conversationPartners: new Map(),
                    responsePatterns: {
                        averageResponseTime: 0,
                        responseCount: 0,
                        totalResponseTime: 0
                    },
                    activityPatterns: {
                        hourly: new Array(24).fill(0),
                        weekly: new Array(7).fill(0),
                        monthlyTrends: new Map()
                    }
                });
            }

            const profile = this.senderProfiles.get(senderId);
            profile.chats.add(msg.chatName);
            
            if (msg.isGroup) {
                profile.chatTypes.group.add(msg.chatName);
            } else {
                profile.chatTypes.private.add(msg.chatName);
            }

            // Track conversation partners
            if (msg.chatId) {
                const count = profile.conversationPartners.get(msg.chatId) || 0;
                profile.conversationPartners.set(msg.chatId, count + 1);
            }

            // Analyze message content for topics
            if (msg.message.body) {
                this.analyzeMessageTopics(profile, msg.message.body.toLowerCase());
            }

            // Track activity patterns
            const msgDate = new Date(msg.timestamp);
            profile.activityPatterns.hourly[msgDate.getHours()]++;
            profile.activityPatterns.weekly[msgDate.getDay()]++;
            
            const monthKey = `${msgDate.getFullYear()}-${(msgDate.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthCount = profile.activityPatterns.monthlyTrends.get(monthKey) || 0;
            profile.activityPatterns.monthlyTrends.set(monthKey, monthCount + 1);

            profile.messages.push({
                timestamp: msg.timestamp,
                chatName: msg.chatName,
                content: msg.message.body || '[MEDIA]',
                type: msg.message.type,
                hasMedia: msg.message.hasMedia,
                isForwarded: msg.message.isForwarded,
                isGroup: msg.isGroup
            });

            const currentCount = profile.messageTypes.get(msg.message.type) || 0;
            profile.messageTypes.set(msg.message.type, currentCount + 1);

            if (msg.message.hasMedia) profile.mediaCount++;
            if (msg.message.isForwarded) profile.forwardedCount++;

            const msgDate2 = new Date(msg.timestamp);
            if (msgDate2 < profile.firstMessage) profile.firstMessage = msgDate2;
            if (msgDate2 > profile.lastMessage) profile.lastMessage = msgDate2;
        }
    }

    analyzeMessageTopics(profile, messageText) {
        for (const [topic, keywords] of this.topicKeywords) {
            if (keywords.some(keyword => messageText.includes(keyword))) {
                const count = profile.topics.get(topic) || 0;
                profile.topics.set(topic, count + 1);
            }
        }
    }

    async generateSenderProfiles() {
        const profiles = [];
        
        for (const [_, profile] of this.senderProfiles) {
            // Calculate response patterns
            this.calculateResponsePatterns(profile);
            
            const processedProfile = {
                id: profile.id,
                name: profile.name,
                number: profile.number,
                chats: Array.from(profile.chats),
                messageCount: profile.messages.length,
                firstMessage: profile.firstMessage.toISOString(),
                lastMessage: profile.lastMessage.toISOString(),
                messageTypes: Object.fromEntries(profile.messageTypes),
                mediaCount: profile.mediaCount,
                forwardedCount: profile.forwardedCount,
                chatTypes: {
                    group: Array.from(profile.chatTypes.group),
                    private: Array.from(profile.chatTypes.private)
                },
                topics: Object.fromEntries(profile.topics),
                conversationPartners: Object.fromEntries(profile.conversationPartners),
                activityPatterns: {
                    hourly: profile.activityPatterns.hourly,
                    weekly: profile.activityPatterns.weekly,
                    monthlyTrends: Object.fromEntries(profile.activityPatterns.monthlyTrends)
                },
                responsePatterns: profile.responsePatterns,
                messages: profile.messages.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                ),
                analysisNotes: {
                    activeChats: Array.from(profile.chats).length,
                    messageFrequency: this.calculateMessageFrequency(profile),
                    engagementLevel: this.calculateEngagementLevel(profile),
                    conversationGaps: this.findConversationGaps(profile.messages),
                    suggestedActions: this.generateSuggestedActions(profile),
                    topicInsights: this.generateTopicInsights(profile),
                    communicationStyle: this.analyzeCommunicationStyle(profile)
                }
            };
            
            profiles.push(processedProfile);
        }

        profiles.sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));

        const outputDir = path.join(process.cwd(), 'data', 'analyzed_profiles');
        await fs.mkdir(outputDir, { recursive: true });
        
        const outputFile = path.join(outputDir, `sender_profiles_${new Date().toISOString().split('T')[0]}.json`);
        await fs.writeFile(outputFile, JSON.stringify(profiles, null, 2));
        
        console.log(`\nAnalysis complete!`);
        console.log(`Processed ${profiles.length} unique senders`);
        console.log(`Results saved to: ${outputFile}`);
    }

    calculateResponsePatterns(profile) {
        let lastMessageTime = null;
        let totalResponseTime = 0;
        let responseCount = 0;

        for (const message of profile.messages) {
            const messageTime = new Date(message.timestamp);
            if (lastMessageTime) {
                const timeDiff = messageTime - lastMessageTime;
                if (timeDiff < 24 * 60 * 60 * 1000) { // Only count responses within 24 hours
                    totalResponseTime += timeDiff;
                    responseCount++;
                }
            }
            lastMessageTime = messageTime;
        }

        profile.responsePatterns = {
            averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
            responseCount,
            totalResponseTime
        };
    }

    generateTopicInsights(profile) {
        const insights = [];
        const sortedTopics = [...profile.topics.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        if (sortedTopics.length > 0) {
            insights.push({
                type: 'preferred_topics',
                description: `Most discussed topics: ${sortedTopics.map(([topic, count]) => 
                    `${topic} (${count} messages)`).join(', ')}`,
                topics: sortedTopics
            });
        }

        return insights;
    }

    analyzeCommunicationStyle(profile) {
        const style = {
            primaryStyle: '',
            characteristics: [],
            details: {}
        };

        // Analyze message length
        const textMessages = profile.messages.filter(m => m.content !== '[MEDIA]');
        const avgLength = textMessages.reduce((sum, msg) => 
            sum + msg.content.length, 0) / (textMessages.length || 1);

        style.details.averageMessageLength = avgLength;

        if (avgLength > 100) {
            style.characteristics.push('detailed communicator');
        } else if (avgLength < 20) {
            style.characteristics.push('concise communicator');
        }

        // Analyze media usage
        const mediaRatio = profile.mediaCount / profile.messages.length;
        style.details.mediaUsage = mediaRatio;
        
        if (mediaRatio > 0.3) {
            style.characteristics.push('visual communicator');
        }

        // Analyze response patterns
        if (profile.responsePatterns.averageResponseTime < 5 * 60 * 1000) { // 5 minutes
            style.characteristics.push('quick responder');
        } else if (profile.responsePatterns.averageResponseTime > 60 * 60 * 1000) { // 1 hour
            style.characteristics.push('delayed responder');
        }

        // Set primary style based on most prominent characteristic
        style.primaryStyle = style.characteristics[0] || 'balanced communicator';

        return style;
    }

    calculateMessageFrequency(profile) {
        const daysDiff = (profile.lastMessage - profile.firstMessage) / (1000 * 60 * 60 * 24);
        return {
            messagesPerDay: profile.messages.length / (daysDiff || 1),
            totalDays: Math.round(daysDiff),
            description: this.getFrequencyDescription(profile.messages.length, daysDiff)
        };
    }

    calculateEngagementLevel(profile) {
        const engagement = {
            level: 'unknown',
            factors: [],
            details: {}
        };

        // Consider message frequency
        const frequency = this.calculateMessageFrequency(profile);
        engagement.details.frequency = frequency;

        if (frequency.messagesPerDay >= 5) {
            engagement.level = 'high';
            engagement.factors.push('frequent messaging');
        } else if (frequency.messagesPerDay >= 1) {
            engagement.level = 'medium';
            engagement.factors.push('regular messaging');
        } else {
            engagement.level = 'low';
            engagement.factors.push('infrequent messaging');
        }

        // Consider media sharing
        const mediaRatio = profile.mediaCount / profile.messages.length;
        engagement.details.mediaRatio = mediaRatio;
        if (mediaRatio > 0.3) {
            engagement.factors.push('active media sharing');
        }

        // Consider chat participation
        engagement.details.chatParticipation = {
            total: profile.chats.size,
            group: profile.chatTypes.group.size,
            private: profile.chatTypes.private.size
        };

        if (profile.chatTypes.group.size > 2) {
            engagement.factors.push('active in multiple groups');
        }
        if (profile.chatTypes.private.size > 2) {
            engagement.factors.push('maintains multiple private chats');
        }

        // Consider message consistency
        const gaps = this.findConversationGaps(profile.messages);
        engagement.details.conversationGaps = gaps.length;
        if (gaps.length === 0) {
            engagement.factors.push('consistent communication');
        }

        return engagement;
    }

    findConversationGaps(messages) {
        const gaps = [];
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
        
        for (let i = 1; i < messages.length; i++) {
            const current = new Date(messages[i].timestamp);
            const previous = new Date(messages[i-1].timestamp);
            const gap = previous - current;
            
            if (gap > THREE_DAYS) {
                gaps.push({
                    start: current.toISOString(),
                    end: previous.toISOString(),
                    durationDays: Math.round(gap / (1000 * 60 * 60 * 24)),
                    context: {
                        beforeGap: messages[i-1].content,
                        afterGap: messages[i].content
                    }
                });
            }
        }
        
        return gaps;
    }

    generateSuggestedActions(profile) {
        const suggestions = [];
        const now = new Date();
        const lastMessageAge = (now - profile.lastMessage) / (1000 * 60 * 60 * 24);

        // Check for recent inactivity
        if (lastMessageAge > 7) {
            suggestions.push({
                priority: 'high',
                action: 'reconnect',
                context: `No messages for ${Math.round(lastMessageAge)} days`,
                suggestion: 'Send a friendly check-in message',
                details: {
                    lastMessageDate: profile.lastMessage.toISOString(),
                    daysSinceContact: Math.round(lastMessageAge),
                    lastContext: profile.messages[0]?.content || '',
                    preferredTopics: this.getPreferredTopics(profile)
                }
            });
        }

        // Check engagement pattern
        const engagement = this.calculateEngagementLevel(profile);
        if (engagement.level === 'low') {
            suggestions.push({
                priority: 'medium',
                action: 'increase_engagement',
                context: 'Low engagement pattern detected',
                suggestion: 'Try to increase interaction frequency with engaging content or questions',
                details: {
                    currentEngagementLevel: engagement.level,
                    engagementFactors: engagement.factors,
                    messageFrequency: engagement.details.frequency,
                    bestTimeToMessage: this.findBestTimeToMessage(profile),
                    suggestedTopics: this.getSuggestedTopics(profile)
                }
            });
        }

        // Check conversation gaps
        const gaps = this.findConversationGaps(profile.messages);
        if (gaps.length > 0) {
            suggestions.push({
                priority: 'medium',
                action: 'address_gaps',
                context: `Found ${gaps.length} significant conversation gaps`,
                suggestion: 'Consider maintaining more regular contact',
                details: {
                    gapCount: gaps.length,
                    recentGaps: gaps.slice(0, 3),
                    averageGapDuration: gaps.reduce((sum, gap) => sum + gap.durationDays, 0) / gaps.length,
                    gapPatterns: this.analyzeGapPatterns(gaps)
                }
            });
        }

        // Check chat type balance
        if (profile.chatTypes.private.size === 0 && profile.chatTypes.group.size > 0) {
            suggestions.push({
                priority: 'low',
                action: 'initiate_private_chat',
                context: 'Only participates in group chats',
                suggestion: 'Consider initiating private conversation to build stronger connection',
                details: {
                    currentChats: {
                        group: Array.from(profile.chatTypes.group),
                        private: Array.from(profile.chatTypes.private)
                    },
                    sharedInterests: this.findSharedInterests(profile)
                }
            });
        }

        return suggestions;
    }

    findBestTimeToMessage(profile) {
        // Find the hour with highest response rate
        const hourlyResponses = profile.activityPatterns.hourly;
        const bestHour = hourlyResponses.indexOf(Math.max(...hourlyResponses));
        
        // Find the day with highest activity
        const weeklyActivity = profile.activityPatterns.weekly;
        const bestDay = weeklyActivity.indexOf(Math.max(...weeklyActivity));

        return {
            hour: bestHour,
            day: bestDay,
            confidence: this.calculateTimeConfidence(profile, bestHour, bestDay)
        };
    }

    calculateTimeConfidence(profile, hour, day) {
        const hourlyTotal = profile.activityPatterns.hourly[hour];
        const dayTotal = profile.activityPatterns.weekly[day];
        const messageCount = profile.messages.length;

        return {
            hourly: hourlyTotal / messageCount,
            daily: dayTotal / messageCount,
            description: this.getConfidenceDescription(hourlyTotal / messageCount)
        };
    }

    getConfidenceDescription(ratio) {
        if (ratio > 0.3) return 'very high';
        if (ratio > 0.2) return 'high';
        if (ratio > 0.1) return 'medium';
        return 'low';
    }

    analyzeGapPatterns(gaps) {
        const patterns = {
            weekendGaps: 0,
            workHourGaps: 0,
            longGaps: 0,
            gapReasons: new Map()
        };

        for (const gap of gaps) {
            const startDate = new Date(gap.start);
            const endDate = new Date(gap.end);

            // Check if gap spans weekend
            if (startDate.getDay() === 6 || startDate.getDay() === 0 || 
                endDate.getDay() === 6 || endDate.getDay() === 0) {
                patterns.weekendGaps++;
            }

            // Check if gap is during work hours (9-17)
            if (startDate.getHours() >= 9 && startDate.getHours() <= 17) {
                patterns.workHourGaps++;
            }

            // Track long gaps (> 7 days)
            if (gap.durationDays > 7) {
                patterns.longGaps++;
            }

            // Analyze context for potential reasons
            if (gap.context) {
                const reason = this.inferGapReason(gap.context);
                const count = patterns.gapReasons.get(reason) || 0;
                patterns.gapReasons.set(reason, count + 1);
            }
        }

        return {
            ...patterns,
            gapReasons: Object.fromEntries(patterns.gapReasons)
        };
    }

    inferGapReason(context) {
        const beforeLower = context.beforeGap.toLowerCase();
        const afterLower = context.afterGap.toLowerCase();

        if (beforeLower.includes('busy') || beforeLower.includes('work') || 
            beforeLower.includes('later') || beforeLower.includes('tomorrow')) {
            return 'scheduled_break';
        }

        if (afterLower.includes('sorry') || afterLower.includes('apologize') || 
            afterLower.includes('been away')) {
            return 'unplanned_absence';
        }

        if (beforeLower.includes('bye') || beforeLower.includes('goodnight') || 
            beforeLower.includes('talk later')) {
            return 'natural_conclusion';
        }

        return 'unknown';
    }

    getPreferredTopics(profile) {
        return [...profile.topics.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([topic, count]) => ({
                topic,
                count,
                frequency: count / profile.messages.length,
                lastDiscussed: this.findLastTopicMention(profile, topic)
            }));
    }

    findLastTopicMention(profile, topic) {
        const keywords = this.topicKeywords.get(topic) || [];
        for (const message of profile.messages) {
            if (message.content && keywords.some(keyword => 
                message.content.toLowerCase().includes(keyword))) {
                return message.timestamp;
            }
        }
        return null;
    }

    getSuggestedTopics(profile) {
        const suggestions = [];
        const preferredTopics = this.getPreferredTopics(profile);
        
        // Suggest continuing recent discussions
        if (preferredTopics.length > 0) {
            const mostRecent = preferredTopics[0];
            suggestions.push({
                type: 'continue_discussion',
                topic: mostRecent.topic,
                context: `Recent interest in ${mostRecent.topic}`,
                lastDiscussed: mostRecent.lastDiscussed
            });
        }

        // Suggest new topics based on profile
        const unusedTopics = [...this.topicKeywords.keys()]
            .filter(topic => !profile.topics.has(topic));
        
        if (unusedTopics.length > 0) {
            suggestions.push({
                type: 'explore_new',
                topics: unusedTopics.slice(0, 3),
                reason: 'Expand conversation horizons'
            });
        }

        return suggestions;
    }

    findSharedInterests(profile) {
        const interests = new Map();
        
        // Analyze message content for shared interests
        for (const message of profile.messages) {
            if (!message.content) continue;
            
            const content = message.content.toLowerCase();
            for (const [topic, keywords] of this.topicKeywords) {
                if (keywords.some(keyword => content.includes(keyword))) {
                    const count = interests.get(topic) || 0;
                    interests.set(topic, count + 1);
                }
            }
        }

        return [...interests.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([topic, count]) => ({
                topic,
                count,
                strength: count / profile.messages.length,
                keywords: this.topicKeywords.get(topic)
            }));
    }

    getFrequencyDescription(messageCount, days) {
        const messagesPerDay = messageCount / (days || 1);
        if (messagesPerDay >= 10) return 'Very active';
        if (messagesPerDay >= 5) return 'Active';
        if (messagesPerDay >= 1) return 'Regular';
        if (messagesPerDay >= 0.5) return 'Occasional';
        return 'Infrequent';
    }
}

// Run the analyzer
const analyzer = new MessageAnalyzer();
analyzer.processMessageFiles(); 