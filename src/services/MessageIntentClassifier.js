const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

class MessageIntentClassifier {
    constructor() {
        this.classifier = new natural.BayesClassifier();
        this.intentPatterns = {
            question: {
                patterns: [/\?$/, /^(what|who|where|when|why|how)/i],
                keywords: ['help', 'advice', 'question', 'wondering', 'curious']
            },
            action_request: {
                patterns: [/^(please|can you|could you)/i, /\b(need|want)\b.*\b(you to|if you)\b/i],
                keywords: ['send', 'share', 'help', 'do', 'make', 'get', 'update']
            },
            information_sharing: {
                patterns: [/^(fyi|just so you know|heads up)/i],
                keywords: ['update', 'news', 'information', 'status', 'report']
            },
            social: {
                patterns: [/^(hey|hi|hello|how are you)/i],
                keywords: ['thanks', 'thank you', 'appreciate', 'congrats', 'congratulations', 'welcome']
            },
            business: {
                patterns: [/\b(meeting|deadline|project|client|report)\b/i],
                keywords: ['urgent', 'important', 'priority', 'asap', 'review']
            },
            followup: {
                patterns: [/\b(following up|checking in|any update|status)\b/i],
                keywords: ['reminder', 'pending', 'waiting', 'response']
            }
        };

        this._initializeClassifier();
    }

    _initializeClassifier() {
        // Training data for each intent
        const trainingData = {
            question: [
                "What time is the meeting?",
                "How does this work?",
                "Where should I send the files?",
                "Can you explain this to me?",
                "Who is responsible for this?",
                "When do you need this by?"
            ],
            action_request: [
                "Please review this document",
                "Can you send me the files?",
                "Need you to check this",
                "Could you help me with this?",
                "Want you to take a look",
                "Make sure this is done"
            ],
            information_sharing: [
                "Just letting you know the project is complete",
                "FYI - meeting cancelled",
                "Heads up about tomorrow",
                "Wanted to inform you about the changes",
                "Update on the situation",
                "Here's the latest status"
            ],
            social: [
                "Hey, how are you?",
                "Thanks for your help",
                "Great working with you",
                "Hope you're doing well",
                "Have a great weekend",
                "Congratulations on the promotion"
            ],
            business: [
                "The client meeting is scheduled",
                "Project deadline is approaching",
                "Urgent: Report needed",
                "Review required for presentation",
                "Important business update",
                "Meeting agenda attached"
            ],
            followup: [
                "Following up on my last email",
                "Any updates on this?",
                "Checking in about the request",
                "Reminder about the pending items",
                "Still waiting for your response",
                "Status update needed"
            ]
        };

        // Train the classifier
        Object.entries(trainingData).forEach(([intent, examples]) => {
            examples.forEach(example => {
                this.classifier.addDocument(example, intent);
            });
        });

        this.classifier.train();
    }

    async classifyIntent(message) {
        const text = message.body.toLowerCase();
        const classifications = {
            primary: null,
            secondary: [],
            confidence: 0,
            features: {
                hasQuestion: false,
                isUrgent: false,
                requiresAction: false,
                isSocial: false,
                isFollowUp: false
            }
        };

        // Check patterns for each intent
        Object.entries(this.intentPatterns).forEach(([intent, rules]) => {
            // Check regex patterns
            const matchesPattern = rules.patterns.some(pattern => pattern.test(text));
            // Check keywords
            const hasKeywords = rules.keywords.some(keyword => text.includes(keyword));

            if (matchesPattern || hasKeywords) {
                classifications.secondary.push(intent);
            }
        });

        // Use the trained classifier for primary intent
        const result = this.classifier.getClassifications(text);
        classifications.primary = result[0].label;
        classifications.confidence = result[0].value;

        // Additional feature detection
        classifications.features = {
            hasQuestion: text.includes('?') || /^(what|who|where|when|why|how)/i.test(text),
            isUrgent: /\b(urgent|asap|emergency|immediate)\b/i.test(text),
            requiresAction: /\b(need|please|must|should|could you|can you)\b/i.test(text),
            isSocial: /\b(thanks|thank you|hi|hey|hello|bye|goodbye)\b/i.test(text),
            isFollowUp: /\b(following up|checking|reminder|status|update)\b/i.test(text)
        };

        return classifications;
    }

    async analyzeConversationContext(messages) {
        const context = {
            topIntent: null,
            intentDistribution: {},
            conversationFlow: [],
            requiresResponse: false,
            isOngoing: false
        };

        // Analyze last 5 messages for context
        const recentMessages = messages.slice(-5);
        const intents = await Promise.all(
            recentMessages.map(msg => this.classifyIntent(msg))
        );

        // Build intent distribution
        intents.forEach(classification => {
            context.intentDistribution[classification.primary] = 
                (context.intentDistribution[classification.primary] || 0) + 1;
        });

        // Determine top intent
        context.topIntent = Object.entries(context.intentDistribution)
            .sort((a, b) => b[1] - a[1])[0][0];

        // Analyze conversation flow
        context.conversationFlow = intents.map(i => i.primary);

        // Check if conversation requires response
        const lastIntent = intents[intents.length - 1];
        context.requiresResponse = 
            lastIntent.features.hasQuestion || 
            lastIntent.features.requiresAction || 
            lastIntent.features.isUrgent;

        // Check if conversation is ongoing
        const hasRecentActivity = messages[messages.length - 1].timestamp > 
            (Date.now()/1000 - 3600); // Within last hour
        const hasBackAndForth = recentMessages.some((msg, i) => 
            i > 0 && msg.fromMe !== recentMessages[i-1].fromMe
        );
        context.isOngoing = hasRecentActivity && hasBackAndForth;

        return context;
    }
}

module.exports = MessageIntentClassifier;
