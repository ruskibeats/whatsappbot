const natural = require('natural');

/**
 * Service for managing and selecting response templates
 */
class ResponseTemplateService {
    constructor() {
        this.templates = {};
    }

    /**
     * Set response templates
     * @param {Object} templates - Template definitions by intent and urgency
     */
    setTemplates(templates) {
        this.templates = templates;
    }

    /**
     * Select appropriate template based on intent and context
     * @param {Object} intent - Message intent classification
     * @param {string} urgencyLevel - Determined urgency level
     * @param {Object} patterns - Historical interaction patterns
     * @returns {string} Selected response template
     */
    selectTemplate(intent, urgencyLevel, patterns) {
        const intentType = intent?.primary || 'social';
        const templates = this.templates[intentType] || this.templates.social;
        
        // Get appropriate templates based on urgency
        const appropriateTemplates = templates[urgencyLevel] || templates.general || [
            "I'll get back to you soon",
            "Thanks for your message",
            "Message received"
        ];

        return this._selectBestTemplate(appropriateTemplates, patterns);
    }

    /**
     * Select best template based on historical patterns
     * @private
     */
    _selectBestTemplate(templates, patterns) {
        // If we have pattern data, select based on successful past responses
        if (patterns?.successfulResponses?.length > 0) {
            const mostSimilarTemplate = templates.reduce((best, current) => {
                const similarity = this._calculateSimilarity(current, patterns.successfulResponses[0]);
                if (similarity > best.similarity) {
                    return { template: current, similarity: similarity };
                }
                return best;
            }, { template: templates[0], similarity: 0 });

            return mostSimilarTemplate.template;
        }

        // Otherwise, select randomly
        return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * Calculate similarity between two text strings
     * @private
     */
    _calculateSimilarity(text1, text2) {
        return natural.LevenshteinDistance(text1, text2, {
            insertion_cost: 1,
            deletion_cost: 1,
            substitution_cost: 1
        });
    }
}

module.exports = ResponseTemplateService;
