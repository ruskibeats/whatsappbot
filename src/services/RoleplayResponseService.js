const fetch = require('node-fetch');

/**
 * Service for handling roleplay responses using OpenRouter API
 */
class RoleplayResponseService {
    constructor(config) {
        if (!config.openRouterApiKey) {
            throw new Error('OpenRouter API key is required');
        }
        this.openRouterApiKey = config.openRouterApiKey;
        console.log('[ROLEPLAY] Service initializing...');
        this.roleplayConfigs = new Map();
        
        // Initialize default roleplay configurations
        this._initializeRoleplayConfigs();
        console.log('[ROLEPLAY] Service initialized with configurations:', 
            Array.from(this.roleplayConfigs.entries()).map(([id, config]) => ({
                id,
                name: config.persona.name,
                enabled: config.enabled
            }))
        );
    }

    _initializeRoleplayConfigs() {
        // Test configuration with Russell's number
        this.roleplayConfigs.set("447881795908@c.us", {  // Test number
            enabled: true,
            model: "anthropic/claude-2",  // Using Claude 2 for testing
            persona: {
                name: "James",
                age: 55,
                personality: "mature, sophisticated, and attentive",
                background: "A cultured gentleman who understands the art of romance and emotional connection",
                interests: [
                    "meaningful conversation",
                    "emotional intimacy",
                    "romantic gestures",
                    "shared experiences",
                    "intellectual connection",
                    "subtle flirtation"
                ]
            },
            systemPrompt: `You are James, a sophisticated and cultured 55-year-old gentleman engaging in intimate conversation.

            Core Values:
            - Emotional depth and genuine connection
            - Intellectual stimulation and shared interests
            - Respect and careful attention to boundaries
            - Patience in building trust and intimacy
            - Appreciation for subtle romance and elegance
            - Quality of interaction over quantity

            Conversation Style:
            - Begin with thoughtful, engaging conversation
            - Show genuine interest in shared topics
            - Use sophisticated, well-crafted language
            - Balance intellect with gentle flirtation
            - Maintain proper grammar and politeness
            - Keep responses concise but meaningful
            - Adapt tone based on conversation flow
            - Focus on building emotional rapport

            Intimacy Approach:
            - Start with intellectual and emotional connection
            - Progress naturally through subtle hints
            - Use sophisticated double entendres when appropriate
            - Recognize and respect comfort levels
            - Build anticipation through suggestion
            - Never be crude or explicitly sexual
            - Let the other person set boundaries
            - Focus on emotional intimacy first

            Key Behaviors:
            1. Demonstrate cultural sophistication
            2. Show emotional intelligence
            3. Use subtle romantic implications
            4. Maintain respectful boundaries
            5. Build trust through consistency
            6. Express genuine interest
            7. Be patient and attentive
            8. Guide conversation naturally

            Response Guidelines:
            - Keep messages brief but impactful
            - Use proper punctuation and grammar
            - Mirror formal/casual tone appropriately
            - Focus on quality of interaction
            - Be genuine and consistent
            - Show emotional awareness
            
            Respond as James would in a natural, seductive conversation with Charlotte.`
        });
    }

    async isRoleplayEnabled(contactId) {
        const config = this.roleplayConfigs.get(contactId);
        const enabled = config?.enabled || false;
        console.log('[ROLEPLAY] Checking enabled status:', {
            contactId,
            enabled,
            hasConfig: !!config,
            configDetails: config ? {
                name: config.persona.name,
                model: config.model
            } : null
        });
        return enabled;
    }

    async generateRoleplayResponse(message, context) {
        console.log('Attempting to generate roleplay response for:', message.from);
        const config = this.roleplayConfigs.get(message.from);
        if (!config) {
            console.log('No roleplay config found for:', message.from);
            return null;
        }

        try {
            console.log('Generating roleplay response:', {
                message: message.body,
                from: message.from,
                model: config.model,
                persona: config.persona.name
            });
            
            const apiUrl = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openRouterApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/yourusername/whatsapp-bot",
                    "X-Title": "WhatsApp Bot"
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        {
                            role: "system",
                            content: config.systemPrompt
                        },
                        {
                            role: "user",
                            content: this._buildPrompt(message, context, config.persona)
                        }
                    ],
                    temperature: 0.9,  // Higher temperature for more creative responses
                    max_tokens: 150
                })
            });

            const result = await response.json();
            console.log('OpenRouter response:', {
                status: response.status,
                error: result.error,
                content: result.choices?.[0]?.message?.content?.substring(0, 50) + '...'
            });
            if (result.error) {
                throw new Error(`OpenRouter API error: ${result.error.message}`);
            }
            return result.choices[0].message.content;
        } catch (error) {
            console.error('Error generating roleplay response:', error);
            return null;
        }
    }

    _buildPrompt(message, context, persona) {
        const { historicalAnalysis } = context;
        
        // Build context-aware prompt
        let prompt = `Conversation Context:\n`;
        prompt += `- Previous topics: ${historicalAnalysis?.topics?.join(', ') || 'None'}\n`;
        prompt += `- Current sentiment: ${context.sentiment}\n`;
        prompt += `- Time of day: ${new Date().getHours()}:00\n\n`;
        
        // Add interaction guidance
        prompt += `Interaction Guidelines:\n`;
        prompt += `- Focus on intellectual and emotional connection\n`;
        prompt += `- Match the formality level of the conversation\n`;
        prompt += `- Keep responses concise but meaningful\n`;
        prompt += `- Show genuine interest in shared topics\n\n`;
        
        // Add personality context
        prompt += `As ${persona.name}, a ${persona.personality} ${persona.age}-year-old who ${persona.background}, `;
        prompt += `engage naturally with this message: "${message.body}"\n\n`;
        
        // Add response guidance
        prompt += `Remember to:\n`;
        prompt += `- Maintain sophisticated and polite language\n`;
        prompt += `- Focus on building emotional rapport\n`;
        prompt += `- Use subtle implications when appropriate\n`;
        prompt += `- Express genuine interest in the topics discussed\n`;
        prompt += `- Keep the conversation flowing naturally\n\n`;
        
        // Add interests context
        prompt += `Your interests and approach: ${persona.interests.join(', ')}`;
        
        return prompt;
    }

    setRoleplayConfig(contactId, config) {
        this.roleplayConfigs.set(contactId, {
            enabled: true,
            model: config.model || "anthropic/nous-hermes-llama2-70b",
            persona: {
                name: config.name || "James",
                age: config.age || 55,
                personality: config.personality || "mature and seductive",
                background: config.background || "A mature, experienced man who knows how to guide and seduce",
                interests: config.interests || ["intimacy", "sensual connection", "romantic seduction"]
            },
            systemPrompt: config.systemPrompt || this._generateDefaultSystemPrompt(config)
        });
    }

    _generateDefaultSystemPrompt(config) {
        return `You are roleplaying as ${config.name || 'James'}, a ${config.personality || 'mature and seductive'} ${config.age || '55'}-year-old man engaging in intimate conversation.
            Key traits:
            - Mature and seductive
            - Patient but suggestive
            - Experienced and confident
            - Focuses on building desire
            - Provides gentle guidance
            - Knows how to tease and entice

            Guidelines:
            1. Stay in character at all times
            2. Never mention being AI or roleplay
            3. Focus on building sexual tension
            4. Use suggestive but not explicit language
            5. Mix romance with subtle seduction
            6. Be patient with responses
            7. Let the other person set the pace

            Respond as ${config.name || 'James'} would in a natural, seductive conversation.`;
    }

    getRoleplayConfig(contactId) {
        return this.roleplayConfigs.get(contactId);
    }

    disableRoleplay(contactId) {
        const config = this.roleplayConfigs.get(contactId);
        if (config) {
            config.enabled = false;
            this.roleplayConfigs.set(contactId, config);
        }
    }

    enableRoleplay(contactId) {
        const config = this.roleplayConfigs.get(contactId);
        if (config) {
            config.enabled = true;
            this.roleplayConfigs.set(contactId, config);
        }
    }
}

module.exports = RoleplayResponseService;
