const fs = require('fs').promises;
const path = require('path');

class RelationshipTracker {
    constructor(sentimentAnalyzer) {
        this.sentimentAnalyzer = sentimentAnalyzer;
        this.relationships = new Map();
        this.storageDir = path.join(process.cwd(), 'data', 'relationships');
        this.metricsWeight = {
            responseTime: 0.2,
            interactionFrequency: 0.2,
            sentimentTrend: 0.3,
            engagementLevel: 0.3
        };
    }

    async initialize() {
        await fs.mkdir(this.storageDir, { recursive: true });
        await this._loadRelationships();
        return true;
    }

    async trackInteraction(message, context) {
        const contactId = message.from;
        if (!this.relationships.has(contactId)) {
            this.relationships.set(contactId, this._createNewRelationship());
        }

        const relationship = this.relationships.get(contactId);
        const sentiment = await this.sentimentAnalyzer.analyzeSentiment(message.body);
        
        // Update interaction history
        relationship.interactions.push({
            timestamp: message.timestamp,
            sentiment: sentiment,
            type: context.topIntent || 'general',
            isResponse: message.fromMe,
            engagementScore: this._calculateEngagementScore(message, context)
        });

        // Keep only last 100 interactions
        if (relationship.interactions.length > 100) {
            relationship.interactions = relationship.interactions.slice(-100);
        }

        // Update metrics
        await this._updateMetrics(relationship, message, context);
        
        // Save changes
        await this._saveRelationship(contactId, relationship);
        
        return relationship;
    }

    _createNewRelationship() {
        return {
            interactions: [],
            metrics: {
                responseTime: {
                    average: 0,
                    trend: 'stable'
                },
                interactionFrequency: {
                    daily: 0,
                    weekly: 0,
                    trend: 'stable'
                },
                sentiment: {
                    current: 'NEUTRAL',
                    history: [],
                    trend: 'stable'
                },
                engagement: {
                    score: 0,
                    trend: 'stable'
                }
            },
            relationshipScore: 0,
            lastInteraction: null,
            status: 'new',
            flags: []
        };
    }

    async _updateMetrics(relationship, message, context) {
        const now = Date.now()/1000;
        
        // Update response times
        if (message.fromMe && relationship.lastInteraction) {
            const responseTime = message.timestamp - relationship.lastInteraction.timestamp;
            relationship.metrics.responseTime.average = 
                this._updateMovingAverage(
                    relationship.metrics.responseTime.average,
                    responseTime,
                    10
                );
        }

        // Update interaction frequency
        const recentInteractions = relationship.interactions.filter(i => 
            i.timestamp > now - 7 * 24 * 3600
        );
        relationship.metrics.interactionFrequency = {
            daily: recentInteractions.filter(i => i.timestamp > now - 24 * 3600).length,
            weekly: recentInteractions.length,
            trend: this._calculateTrend(relationship.metrics.interactionFrequency.daily)
        };

        // Update sentiment metrics
        const sentiments = relationship.interactions.slice(-10).map(i => i.sentiment);
        relationship.metrics.sentiment = {
            current: sentiments[sentiments.length - 1],
            history: sentiments,
            trend: this._calculateSentimentTrend(sentiments)
        };

        // Update engagement score
        const recentEngagement = relationship.interactions.slice(-5)
            .map(i => i.engagementScore)
            .reduce((a, b) => a + b, 0) / 5;
        relationship.metrics.engagement = {
            score: recentEngagement,
            trend: this._calculateTrend(recentEngagement)
        };

        // Update overall relationship score
        relationship.relationshipScore = this._calculateRelationshipScore(relationship);

        // Update status
        relationship.status = this._determineRelationshipStatus(relationship);

        // Check for flags
        relationship.flags = this._checkForFlags(relationship);

        relationship.lastInteraction = {
            timestamp: message.timestamp,
            type: context.topIntent
        };
    }

    _calculateEngagementScore(message, context) {
        let score = 0;

        // Length of message (0-2 points)
        score += Math.min(message.body.length / 100, 2);

        // Question or action request (0-2 points)
        if (context.requiresResponse) score += 2;

        // Part of ongoing conversation (0-2 points)
        if (context.isOngoing) score += 2;

        // Response time if this is a response (0-2 points)
        if (message.fromMe && context.previousMessageTimestamp) {
            const responseTime = message.timestamp - context.previousMessageTimestamp;
            score += Math.max(0, 2 - (responseTime / 3600)); // Full points for <1h response
        }

        // Multiple messages in conversation (0-2 points)
        if (context.conversationFlow && context.conversationFlow.length > 1) {
            score += Math.min(context.conversationFlow.length / 2, 2);
        }

        return Math.min(10, score);
    }

    _calculateRelationshipScore(relationship) {
        const weights = this.metricsWeight;
        let score = 0;

        // Response time component (lower is better)
        const responseTimeScore = Math.max(0, 10 - (relationship.metrics.responseTime.average / 3600));
        score += responseTimeScore * weights.responseTime;

        // Interaction frequency component
        const frequencyScore = Math.min(10, (relationship.metrics.interactionFrequency.weekly / 7) * 10);
        score += frequencyScore * weights.interactionFrequency;

        // Sentiment component
        const sentimentScore = relationship.metrics.sentiment.history.reduce((acc, sentiment) => {
            return acc + (sentiment === 'POSITIVE' ? 1 : sentiment === 'NEGATIVE' ? -1 : 0);
        }, 0);
        score += ((sentimentScore + relationship.metrics.sentiment.history.length) / 
                 (relationship.metrics.sentiment.history.length * 2) * 10) * 
                weights.sentimentTrend;

        // Engagement component
        score += relationship.metrics.engagement.score * weights.engagementLevel;

        return Math.min(10, Math.max(0, score));
    }

    _determineRelationshipStatus(relationship) {
        const score = relationship.relationshipScore;
        const trend = this._calculateOverallTrend(relationship);

        if (score >= 8) return 'strong';
        if (score >= 6) return trend === 'improving' ? 'growing' : 'stable';
        if (score >= 4) return trend === 'declining' ? 'needs_attention' : 'moderate';
        return 'weak';
    }

    _checkForFlags(relationship) {
        const flags = [];
        const metrics = relationship.metrics;

        // Response time flags
        if (metrics.responseTime.average > 24 * 3600) {
            flags.push('slow_responses');
        }

        // Engagement flags
        if (metrics.engagement.trend === 'declining') {
            flags.push('declining_engagement');
        }

        // Sentiment flags
        if (metrics.sentiment.trend === 'declining') {
            flags.push('negative_sentiment_trend');
        }

        // Frequency flags
        if (metrics.interactionFrequency.daily === 0 && 
            metrics.interactionFrequency.weekly < 3) {
            flags.push('low_interaction');
        }

        return flags;
    }

    _calculateTrend(currentValue, history = []) {
        if (history.length < 2) return 'stable';
        
        const recentAvg = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const previousAvg = history.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
        
        const changePct = ((recentAvg - previousAvg) / previousAvg) * 100;
        
        if (changePct > 10) return 'improving';
        if (changePct < -10) return 'declining';
        return 'stable';
    }

    _calculateSentimentTrend(sentiments) {
        if (sentiments.length < 3) return 'stable';

        const sentimentScores = sentiments.map(s => 
            s === 'POSITIVE' ? 1 : s === 'NEGATIVE' ? -1 : 0
        );

        const recentAvg = sentimentScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const previousAvg = sentimentScores.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

        if (recentAvg > previousAvg + 0.3) return 'improving';
        if (recentAvg < previousAvg - 0.3) return 'declining';
        return 'stable';
    }

    _calculateOverallTrend(relationship) {
        if (!relationship || !relationship.metrics) return 'stable';

        const metrics = relationship.metrics;
        const trends = [];

        // Only include metrics that exist and have a trend
        if (metrics.responseTime && metrics.responseTime.average) {
            trends.push(this._calculateTrend(metrics.responseTime.average));
        }
        
        if (metrics.interactionFrequency && metrics.interactionFrequency.trend) {
            trends.push(metrics.interactionFrequency.trend);
        }
        
        if (metrics.sentiment && metrics.sentiment.trend) {
            trends.push(metrics.sentiment.trend);
        }
        
        if (metrics.engagement && metrics.engagement.trend) {
            trends.push(metrics.engagement.trend);
        }

        // If no valid trends, return stable
        if (trends.length === 0) return 'stable';

        const improving = trends.filter(t => t === 'improving').length;
        const declining = trends.filter(t => t === 'declining').length;

        if (improving > declining + 1) return 'improving';
        if (declining > improving + 1) return 'declining';
        return 'stable';
    }

    _updateMovingAverage(current, newValue, weight) {
        return (current * (weight - 1) + newValue) / weight;
    }

    async getRelationshipSummary(contactId) {
        const relationship = this.relationships.get(contactId);
        if (!relationship) return null;

        return {
            status: relationship.status,
            score: relationship.relationshipScore,
            metrics: relationship.metrics,
            flags: relationship.flags,
            lastInteraction: relationship.lastInteraction,
            trend: this._calculateOverallTrend(relationship)
        };
    }

    async _loadRelationships() {
        try {
            const files = await fs.readdir(this.storageDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const contactId = file.replace('.json', '');
                    const data = await fs.readFile(
                        path.join(this.storageDir, file),
                        'utf8'
                    );
                    this.relationships.set(contactId, JSON.parse(data));
                }
            }
        } catch (error) {
            console.error('Error loading relationships:', error);
        }
    }

    async _saveRelationship(contactId, relationship) {
        try {
            await fs.writeFile(
                path.join(this.storageDir, `${contactId}.json`),
                JSON.stringify(relationship, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Error saving relationship:', error);
        }
    }
}

module.exports = RelationshipTracker;
