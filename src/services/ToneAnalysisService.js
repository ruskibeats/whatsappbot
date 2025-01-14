/**
 * Service for analyzing and adjusting message tone and style
 */
class ToneAnalysisService {
    constructor() {
        this.tonePatterns = {
            warm: {
                contractions: true,
                exclamations: true,
                personalPronouns: true,
                emoticons: true
            },
            professional: {
                contractions: false,
                exclamations: false,
                personalPronouns: true,
                emoticons: false
            },
            attentive: {
                contractions: true,
                exclamations: true,
                personalPronouns: true,
                emoticons: false
            },
            empathetic: {
                contractions: true,
                exclamations: false,
                personalPronouns: true,
                emoticons: false,
                understanding: true
            },
            neutral: {
                contractions: false,
                exclamations: false,
                personalPronouns: true,
                emoticons: false
            }
        };
    }

    /**
     * Determine appropriate tone based on relationship and sentiment
     * @param {Object} relationship - Relationship metrics and status
     * @param {string} sentiment - Message sentiment analysis result
     * @returns {string} Appropriate tone for response
     */
    determineTone(relationship, sentiment) {
        if (!relationship) return 'neutral';

        const status = relationship.status;
        const flags = relationship.flags || [];
        const metrics = relationship.metrics || {};

        // Handle special relationship cases first
        if (status === 'needs_attention' || flags.includes('declining_engagement')) {
            return 'attentive';
        }

        if (flags.includes('negative_sentiment_trend') || sentiment === 'NEGATIVE') {
            return 'empathetic';
        }

        // Handle standard relationship statuses
        switch (status) {
            case 'strong':
                return sentiment === 'POSITIVE' ? 'warm' : 'professional';
            case 'growing':
                return metrics.sentiment?.trend === 'improving' ? 'warm' : 'professional';
            case 'weak':
                return 'attentive';
            default:
                return 'neutral';
        }
    }

    /**
     * Adjust response style based on determined tone
     * @param {string} response - Original response text
     * @param {string} tone - Determined tone
     * @returns {string} Style-adjusted response
     */
    adjustStyle(response, tone) {
        const patterns = this.tonePatterns[tone] || this.tonePatterns.neutral;
        let adjusted = response;

        // Apply tone-specific adjustments
        if (!patterns.contractions) {
            adjusted = this._expandContractions(adjusted);
        }

        if (patterns.contractions) {
            adjusted = this._applyContractions(adjusted);
        }

        if (patterns.exclamations && !adjusted.includes('!')) {
            adjusted = adjusted.replace(/\.$/, '!');
        }

        if (patterns.understanding) {
            adjusted = this._addUnderstandingPhrases(adjusted);
        }

        // Ensure proper sentence structure
        adjusted = this._ensureProperSentenceStructure(adjusted);

        return adjusted;
    }

    /**
     * Expand common contractions
     * @private
     */
    _expandContractions(text) {
        const expansions = {
            "I'll": "I will",
            "I'm": "I am",
            "I've": "I have",
            "I'd": "I would",
            "you'll": "you will",
            "you're": "you are",
            "you've": "you have",
            "we'll": "we will",
            "we're": "we are",
            "we've": "we have",
            "that's": "that is",
            "there's": "there is",
            "here's": "here is",
            "won't": "will not",
            "can't": "cannot",
            "don't": "do not"
        };

        return Object.entries(expansions).reduce(
            (result, [contraction, expansion]) => 
                result.replace(new RegExp(contraction, 'g'), expansion),
            text
        );
    }

    /**
     * Apply common contractions
     * @private
     */
    _applyContractions(text) {
        const contractions = {
            "I will": "I'll",
            "I am": "I'm",
            "I have": "I've",
            "I would": "I'd",
            "you will": "you'll",
            "you are": "you're",
            "you have": "you've",
            "we will": "we'll",
            "we are": "we're",
            "we have": "we've",
            "that is": "that's",
            "there is": "there's",
            "here is": "here's",
            "will not": "won't",
            "cannot": "can't",
            "do not": "don't"
        };

        return Object.entries(contractions).reduce(
            (result, [expanded, contraction]) => 
                result.replace(new RegExp(expanded, 'g'), contraction),
            text
        );
    }

    /**
     * Add understanding phrases for empathetic tone
     * @private
     */
    _addUnderstandingPhrases(text) {
        // Only add understanding phrase if not already present
        if (!text.includes('understand') && !text.includes('appreciate')) {
            const phrases = [
                " I understand.",
                " I see what you mean.",
                " I appreciate your perspective.",
                " I hear you."
            ];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            return text.replace(/[.!?]$/, '') + randomPhrase;
        }
        return text;
    }

    /**
     * Ensure proper sentence structure and punctuation
     * @private
     */
    _ensureProperSentenceStructure(text) {
        // Ensure proper spacing after punctuation
        let adjusted = text.replace(/([.!?]),/g, '$1 ');
        
        // Ensure sentence ends with proper punctuation
        if (!/[.!?]$/.test(adjusted)) {
            adjusted += '.';
        }

        // Fix multiple punctuation
        adjusted = adjusted.replace(/([.!?])[.!?]+/g, '$1');

        // Fix spacing issues
        adjusted = adjusted.replace(/\s+/g, ' ').trim();

        return adjusted;
    }
}

module.exports = ToneAnalysisService;
