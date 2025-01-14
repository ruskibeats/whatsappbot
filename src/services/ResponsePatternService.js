/**
 * Service for analyzing conversation patterns and response history
 */
class ResponsePatternService {
    /**
     * Analyze conversation patterns from history
     * @param {Array} conversationHistory - Array of previous messages
     * @returns {Object} Analysis of conversation patterns
     */
    async analyzePatterns(conversationHistory) {
        const patterns = {
            averageResponseTime: 0,
            successfulResponses: [],
            commonPhrases: new Map(),
            timeOfDay: new Map(),
            engagementMetrics: {
                responseRate: 0,
                averageMessageLength: 0,
                questionFrequency: 0
            }
        };

        if (!conversationHistory?.length) return patterns;

        let totalResponseTime = 0;
        let responseCount = 0;
        let totalLength = 0;
        let questionCount = 0;

        // Analyze response patterns
        for (let i = 1; i < conversationHistory.length; i++) {
            const current = conversationHistory[i];
            const previous = conversationHistory[i-1];

            // Track message metrics
            totalLength += current.body.length;
            if (current.body.includes('?')) questionCount++;

            if (current.fromMe && !previous.fromMe) {
                // Calculate response time
                const responseTime = current.timestamp - previous.timestamp;
                totalResponseTime += responseTime;
                responseCount++;

                // Track successful responses
                if (i < conversationHistory.length - 1) {
                    const next = conversationHistory[i+1];
                    if (!next.body.includes('?') && !this._isFollowUp(next.body)) {
                        patterns.successfulResponses.push(current.body);
                    }
                }

                // Track time of day patterns
                const hour = new Date(current.timestamp * 1000).getHours();
                patterns.timeOfDay.set(hour, (patterns.timeOfDay.get(hour) || 0) + 1);

                // Extract and track common phrases
                this._trackCommonPhrases(current.body, patterns.commonPhrases);
            }
        }

        // Calculate averages and rates
        if (responseCount > 0) {
            patterns.averageResponseTime = totalResponseTime / responseCount;
        }

        patterns.engagementMetrics = {
            responseRate: responseCount / conversationHistory.length,
            averageMessageLength: totalLength / conversationHistory.length,
            questionFrequency: questionCount / conversationHistory.length
        };

        return patterns;
    }

    /**
     * Check if message is a follow-up request
     * @private
     */
    _isFollowUp(message) {
        const followUpPatterns = [
            /following up/i,
            /checking in/i,
            /any update/i,
            /haven't heard back/i,
            /still waiting/i,
            /reminder/i,
            /status update/i
        ];
        return followUpPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Extract and track common phrases from messages
     * @private
     */
    _trackCommonPhrases(message, phraseMap) {
        // Split into potential phrases (3-5 words)
        const words = message.split(/\s+/);
        for (let size = 3; size <= 5; size++) {
            for (let i = 0; i <= words.length - size; i++) {
                const phrase = words.slice(i, i + size).join(' ');
                phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
            }
        }

        // Keep only frequently used phrases (used more than once)
        for (const [phrase, count] of phraseMap) {
            if (count <= 1) phraseMap.delete(phrase);
        }
    }

    /**
     * Get preferred response times based on historical patterns
     * @returns {Object} Preferred response time windows
     */
    getPreferredResponseTimes(patterns) {
        const timeOfDay = patterns.timeOfDay;
        if (!timeOfDay.size) return null;

        // Find peak response hours
        let maxResponses = 0;
        let peakHours = [];
        
        for (const [hour, count] of timeOfDay) {
            if (count > maxResponses) {
                maxResponses = count;
                peakHours = [hour];
            } else if (count === maxResponses) {
                peakHours.push(hour);
            }
        }

        return {
            peakHours,
            averageResponseTime: patterns.averageResponseTime,
            recommendedWindow: this._calculateResponseWindow(peakHours)
        };
    }

    /**
     * Calculate optimal response time window
     * @private
     */
    _calculateResponseWindow(peakHours) {
        if (!peakHours.length) return null;

        // Sort hours
        peakHours.sort((a, b) => a - b);

        // Find the largest continuous window
        let maxWindow = {
            start: peakHours[0],
            end: peakHours[0],
            duration: 1
        };

        let currentWindow = {
            start: peakHours[0],
            end: peakHours[0],
            duration: 1
        };

        for (let i = 1; i < peakHours.length; i++) {
            if (peakHours[i] === peakHours[i-1] + 1) {
                // Continue current window
                currentWindow.end = peakHours[i];
                currentWindow.duration++;
            } else {
                // Start new window
                if (currentWindow.duration > maxWindow.duration) {
                    maxWindow = {...currentWindow};
                }
                currentWindow = {
                    start: peakHours[i],
                    end: peakHours[i],
                    duration: 1
                };
            }
        }

        // Check final window
        if (currentWindow.duration > maxWindow.duration) {
            maxWindow = currentWindow;
        }

        return maxWindow;
    }
}

module.exports = ResponsePatternService;
