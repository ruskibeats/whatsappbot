const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

class ConversationAnalyzer {
    constructor() {
        this.conversationPatterns = {
            questionAnswer: /\?.*?[.!]/g,
            agreement: /\b(yes|yeah|agree|correct|right|ok|okay|sure)\b/i,
            disagreement: /\b(no|nah|disagree|incorrect|wrong|nope)\b/i,
            continuation: /\b(and|also|moreover|furthermore|additionally)\b/i,
            turnTaking: /\b(what about|how about|your turn|over to you)\b/i
        };
    }

    analyzeConversationFlow(messages) {
        const flow = {
            patterns: this.detectConversationPatterns(messages),
            metrics: this.calculateConversationMetrics(messages),
            dynamics: this.analyzeGroupDynamics(messages),
            timing: this.analyzeMessageTiming(messages),
            threads: this.identifyConversationThreads(messages)
        };

        return flow;
    }

    detectConversationPatterns(messages) {
        const patterns = {
            questionAnswerPairs: 0,
            agreements: 0,
            disagreements: 0,
            continuations: 0,
            turnTaking: 0,
            responseRates: {},
            topicChanges: []
        };

        for (let i = 0; i < messages.length - 1; i++) {
            const currentMsg = messages[i];
            const nextMsg = messages[i + 1];

            // Detect question-answer pairs
            if (currentMsg.message_body.includes('?') && 
                this.isAnswer(nextMsg.message_body)) {
                patterns.questionAnswerPairs++;
            }

            // Track agreements/disagreements
            if (this.conversationPatterns.agreement.test(currentMsg.message_body)) {
                patterns.agreements++;
            }
            if (this.conversationPatterns.disagreement.test(currentMsg.message_body)) {
                patterns.disagreements++;
            }

            // Analyze response times between messages
            const responseTime = this.calculateResponseTime(currentMsg, nextMsg);
            const sender = currentMsg.sender_id;
            if (!patterns.responseRates[sender]) {
                patterns.responseRates[sender] = [];
            }
            patterns.responseRates[sender].push(responseTime);

            // Detect topic changes
            if (this.isTopicChange(currentMsg.message_body, nextMsg.message_body)) {
                patterns.topicChanges.push({
                    timestamp: nextMsg.timestamp,
                    from: this.extractMainTopic(currentMsg.message_body),
                    to: this.extractMainTopic(nextMsg.message_body)
                });
            }
        }

        return patterns;
    }

    calculateConversationMetrics(messages) {
        const metrics = {
            messageFrequency: {},
            participantActivity: {},
            averageMessageLength: 0,
            topicDuration: {},
            responseLatency: {},
            messageDistribution: {}
        };

        // Calculate message frequency by hour
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            metrics.messageFrequency[hour] = (metrics.messageFrequency[hour] || 0) + 1;
        });

        // Track participant activity
        messages.forEach(msg => {
            const sender = msg.sender_id;
            if (!metrics.participantActivity[sender]) {
                metrics.participantActivity[sender] = {
                    messageCount: 0,
                    averageLength: 0,
                    activeHours: new Set()
                };
            }
            metrics.participantActivity[sender].messageCount++;
            metrics.participantActivity[sender].averageLength += msg.message_body.length;
            metrics.participantActivity[sender].activeHours.add(new Date(msg.timestamp).getHours());
        });

        // Calculate averages
        Object.keys(metrics.participantActivity).forEach(sender => {
            const activity = metrics.participantActivity[sender];
            activity.averageLength /= activity.messageCount;
            activity.activeHours = Array.from(activity.activeHours);
        });

        return metrics;
    }

    analyzeGroupDynamics(messages) {
        const dynamics = {
            dominantParticipants: [],
            participationBalance: 0,
            interactionPatterns: {},
            responseNetwork: {},
            influenceScores: {}
        };

        // Build interaction network
        messages.forEach(msg => {
            const sender = msg.sender_id;
            if (!dynamics.responseNetwork[sender]) {
                dynamics.responseNetwork[sender] = {
                    sentTo: {},
                    receivedFrom: {}
                };
            }
        });

        // Analyze message chains
        for (let i = 0; i < messages.length - 1; i++) {
            const currentMsg = messages[i];
            const nextMsg = messages[i + 1];
            const sender = currentMsg.sender_id;
            const responder = nextMsg.sender_id;

            if (sender !== responder) {
                dynamics.responseNetwork[sender].sentTo[responder] = 
                    (dynamics.responseNetwork[sender].sentTo[responder] || 0) + 1;
                dynamics.responseNetwork[responder].receivedFrom[sender] = 
                    (dynamics.responseNetwork[responder].receivedFrom[sender] || 0) + 1;
            }
        }

        // Calculate influence scores
        Object.keys(dynamics.responseNetwork).forEach(participant => {
            const network = dynamics.responseNetwork[participant];
            const responsesReceived = Object.values(network.receivedFrom).reduce((a, b) => a + b, 0);
            const responsesSent = Object.values(network.sentTo).reduce((a, b) => a + b, 0);
            dynamics.influenceScores[participant] = {
                responseRate: responsesSent / (responsesReceived || 1),
                engagement: (responsesSent + responsesReceived) / messages.length,
                centrality: Object.keys(network.sentTo).length / Object.keys(dynamics.responseNetwork).length
            };
        });

        // Identify dominant participants
        dynamics.dominantParticipants = Object.entries(dynamics.influenceScores)
            .sort(([,a], [,b]) => b.engagement - a.engagement)
            .slice(0, 3)
            .map(([participant]) => participant);

        // Calculate participation balance
        const participationCounts = Object.values(dynamics.influenceScores)
            .map(score => score.engagement);
        dynamics.participationBalance = this.calculateGiniCoefficient(participationCounts);

        return dynamics;
    }

    analyzeMessageTiming(messages) {
        const timing = {
            responseTimes: [],
            peakHours: [],
            quietHours: [],
            burstPatterns: [],
            weekdayDistribution: {}
        };

        // Calculate response times and identify bursts
        let currentBurst = [];
        for (let i = 1; i < messages.length; i++) {
            const timeDiff = new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp);
            timing.responseTimes.push(timeDiff);

            // Identify message bursts (messages less than 5 minutes apart)
            if (timeDiff < 300000) { // 5 minutes in milliseconds
                currentBurst.push(messages[i]);
            } else if (currentBurst.length > 2) {
                timing.burstPatterns.push({
                    start: currentBurst[0].timestamp,
                    end: currentBurst[currentBurst.length - 1].timestamp,
                    messageCount: currentBurst.length
                });
                currentBurst = [];
            }
        }

        // Analyze hourly distribution
        const hourCounts = new Array(24).fill(0);
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            hourCounts[hour]++;
        });

        // Identify peak and quiet hours
        const average = hourCounts.reduce((a, b) => a + b) / 24;
        timing.peakHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .filter(({ count }) => count > average * 1.5)
            .map(({ hour }) => hour);

        timing.quietHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .filter(({ count }) => count < average * 0.5)
            .map(({ hour }) => hour);

        // Analyze weekday distribution
        messages.forEach(msg => {
            const day = new Date(msg.timestamp).getDay();
            timing.weekdayDistribution[day] = (timing.weekdayDistribution[day] || 0) + 1;
        });

        return timing;
    }

    identifyConversationThreads(messages) {
        const threads = [];
        let currentThread = {
            messages: [],
            topic: null,
            participants: new Set(),
            start: null,
            end: null
        };

        messages.forEach((msg, index) => {
            // Start new thread if:
            // 1. More than 30 minutes since last message
            // 2. New topic detected
            // 3. Different set of participants
            const shouldStartNewThread = this.shouldStartNewThread(currentThread, msg);

            if (shouldStartNewThread && currentThread.messages.length > 0) {
                threads.push({
                    ...currentThread,
                    participants: Array.from(currentThread.participants),
                    end: currentThread.messages[currentThread.messages.length - 1].timestamp
                });
                currentThread = {
                    messages: [],
                    topic: null,
                    participants: new Set(),
                    start: null
                };
            }

            // Add message to current thread
            if (currentThread.messages.length === 0) {
                currentThread.start = msg.timestamp;
                currentThread.topic = this.extractMainTopic(msg.message_body);
            }
            currentThread.messages.push(msg);
            currentThread.participants.add(msg.sender_id);
        });

        // Add final thread
        if (currentThread.messages.length > 0) {
            threads.push({
                ...currentThread,
                participants: Array.from(currentThread.participants),
                end: currentThread.messages[currentThread.messages.length - 1].timestamp
            });
        }

        return threads;
    }

    // Helper methods
    isAnswer(text) {
        // Simple answer detection
        const answerPatterns = [
            /^(yes|no|maybe|i think|probably)/i,
            /^(it('s| is)|that('s| is)|there('s| is))/i,
            /^(the|a|an)/i
        ];
        return answerPatterns.some(pattern => pattern.test(text));
    }

    calculateResponseTime(msg1, msg2) {
        return new Date(msg2.timestamp) - new Date(msg1.timestamp);
    }

    isTopicChange(text1, text2) {
        const topics1 = new Set(this.extractTopics(text1));
        const topics2 = new Set(this.extractTopics(text2));
        const commonTopics = new Set([...topics1].filter(x => topics2.has(x)));
        return commonTopics.size === 0;
    }

    extractMainTopic(text) {
        const topics = this.extractTopics(text);
        return topics[0] || 'general';
    }

    extractTopics(text) {
        // Simple topic extraction based on noun phrases
        const tokens = tokenizer.tokenize(text);
        const topics = [];
        // Implementation depends on your specific needs
        return topics;
    }

    shouldStartNewThread(currentThread, message) {
        if (currentThread.messages.length === 0) return false;

        const lastMessage = currentThread.messages[currentThread.messages.length - 1];
        const timeDiff = new Date(message.timestamp) - new Date(lastMessage.timestamp);
        const isNewTopic = this.isTopicChange(lastMessage.message_body, message.message_body);
        
        return timeDiff > 1800000 || // 30 minutes
               isNewTopic;
    }

    calculateGiniCoefficient(values) {
        if (values.length === 0) return 0;
        
        values.sort((a, b) => a - b);
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += (values.length - i) * values[i];
        }
        
        const gini = (values.length + 1 - (2 * sum / values.reduce((a, b) => a + b, 0))) / values.length;
        return gini;
    }
}

module.exports = ConversationAnalyzer; 