const { OpenAI } = require('openai');
require('dotenv').config();

class AIResponseGenerator {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/yourusername/whatsapp-bot',
                'X-Title': 'WhatsApp Bot'
            },
            defaultQuery: { 'route': 'openai' }
        });
    }

    async generateResponse(message, context = {}) {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openrouter_api_key_here') {
            return "AI responses are currently disabled. Please configure the OpenRouter API key.";
        }

        try {
            // Format user style information
            const styleInfo = this._formatUserStyle(context.userStyle);
            
            // Format biographical information
            const bioInfo = this._formatBiography(context.biography);
            
            // Format chat history with analysis
            const historyInfo = this._formatChatHistory(context.chatHistory);

            // Create a detailed system prompt
            const systemPrompt = `You are a WhatsApp assistant that adapts to each user's unique communication style.

User Profile:
${bioInfo}

Communication Style:
${styleInfo}

Recent Interaction History:
${historyInfo}

Guidelines:
1. Match the user's formality level and communication patterns
2. Reference relevant past interactions when appropriate
3. Show understanding of user's interests and preferences
4. Maintain conversation flow based on interaction history
5. Keep responses concise and focused
6. Use emojis if the user frequently uses them
7. Mirror the user's typical message length
8. Acknowledge shared context from previous conversations

Remember to maintain a natural, conversational tone while adapting to the user's style.`;

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'openai/gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 150
            });

            // Post-process the response to match user style
            return this._adaptResponseStyle(
                response.choices[0].message.content,
                context.userStyle
            );
        } catch (error) {
            console.error('Error generating AI response:', error);
            return "I'm having trouble processing that right now. Could you try again?";
        }
    }

    _formatUserStyle(style = {}) {
        if (!style || Object.keys(style).length === 0) {
            return "Style information not available";
        }

        return `- Formality Level: ${style.formality > 0.6 ? 'Formal' : 'Casual'}
- Emoji Usage: ${style.emoji_usage > 0.5 ? 'Frequent' : 'Rare'}
- Typical Message Length: ${style.avg_message_length} characters
- Common Response Time: ${style.typical_response_time || 'Not available'}
- Writing Style: ${this._describeWritingStyle(style)}`;
    }

    _formatBiography(bio = {}) {
        if (!bio || Object.keys(bio).length === 0) {
            return "Biographical information not available";
        }

        const interests = Array.from(bio.interests || []).join(', ');
        const personalInfo = Object.entries(bio.personal_info || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        return `Personal Information:
${personalInfo || 'No personal information available'}

Interests: ${interests || 'No interests identified'}

Relationship Context:
- Trust Level: ${bio.relationship_context?.trust_level || 'Not established'}
- Interaction Quality: ${bio.relationship_context?.interaction_quality || 'Not measured'}
- Conversation Depth: ${bio.relationship_context?.conversation_depth || 'Not analyzed'}`;
    }

    _formatChatHistory(history = []) {
        if (!history || history.length === 0) {
            return "No recent chat history available";
        }

        // If history is a string, split it into lines
        const messages = typeof history === 'string' ? history.split('\n') : history;
        
        // Format recent messages with analysis
        return messages
            .map(msg => `Message: ${msg}`)
            .join('\n');
    }

    _describeWritingStyle(style) {
        const traits = [];
        
        if (style.formality > 0.7) traits.push('very formal');
        else if (style.formality < 0.3) traits.push('very casual');
        
        if (style.emoji_usage > 0.7) traits.push('emoji-rich');
        if (style.avg_message_length > 100) traits.push('detailed');
        else if (style.avg_message_length < 20) traits.push('concise');
        
        return traits.join(', ') || 'balanced';
    }

    _adaptResponseStyle(response, userStyle = {}) {
        if (!userStyle || Object.keys(userStyle).length === 0) {
            return response;
        }

        let adaptedResponse = response;

        // Adjust formality
        if (userStyle.formality < 0.4) {
            // Make more casual
            adaptedResponse = adaptedResponse
                .replace(/\b(hello|greetings)\b/gi, 'hi')
                .replace(/\b(would you like|would you prefer)\b/gi, 'want')
                .replace(/\b(assist you)\b/gi, 'help');
        }

        // Add emojis if user frequently uses them
        if (userStyle.emoji_usage > 0.5) {
            const commonEmojis = ['😊', '👍', '✨', '🎉'];
            if (!adaptedResponse.includes('emoji')) {
                adaptedResponse += ' ' + commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
            }
        }

        // Adjust message length to match user's style
        const targetLength = userStyle.avg_message_length || 50;
        if (adaptedResponse.length > targetLength * 1.5) {
            adaptedResponse = adaptedResponse
                .split(/[.!?]+\s+/)
                .slice(0, 2)
                .join('. ') + '.';
        }

        return adaptedResponse;
    }
}

module.exports = AIResponseGenerator;
