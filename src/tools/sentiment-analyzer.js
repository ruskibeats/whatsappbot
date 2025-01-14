const { Pool } = require('pg');
const natural = require('natural');
const { NlpManager } = require('node-nlp');
const tokenizer = new natural.WordTokenizer();
const sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
const TfIdf = natural.TfIdf;
const NGrams = natural.NGrams;
const wordnet = new natural.WordNet();
const tagger = new natural.BrillPOSTagger();

class SentimentAnalyzer {
    constructor() {
        this.pool = new Pool({
            user: 'russbee',
            password: 'skimmer69',
            host: '192.168.0.169',
            database: 'beehive',
            port: 5432
        });
        
        // Initialize NLP Manager
        this.manager = new NlpManager({ languages: ['en'] });
        this.initializeNLP();
        this.tfidf = new TfIdf();
    }

    async initializeNLP() {
        // Add emotion patterns
        Object.entries(this.getEmotionPatterns()).forEach(([emotion, patterns]) => {
            patterns.keywords.forEach(keyword => {
                this.manager.addDocument('en', keyword, emotion);
            });
            patterns.patterns.forEach(pattern => {
                this.manager.addDocument('en', pattern.source, emotion);
            });
        });

        // Add topic patterns
        Object.entries(this.getTopicPatterns()).forEach(([topic, keywords]) => {
            keywords.forEach(keyword => {
                this.manager.addDocument('en', keyword, `topic_${topic}`);
            });
        });

        // Train the manager
        await this.manager.train();
    }

    async enrichText(text) {
        const enriched = {
            original: text,
            tokens: [],
            pos_tags: {},
            ngrams: {
                bigrams: [],
                trigrams: []
            },
            word_frequencies: {},
            key_phrases: [],
            entities: [],
            statistics: {}
        };

        // Basic tokenization
        enriched.tokens = tokenizer.tokenize(text);

        // POS Tagging
        const taggedWords = await this.tagPartsOfSpeech(enriched.tokens);
        enriched.pos_tags = this.groupByPOS(taggedWords);

        // N-grams
        enriched.ngrams.bigrams = NGrams.bigrams(enriched.tokens);
        enriched.ngrams.trigrams = NGrams.trigrams(enriched.tokens);

        // Word frequencies
        enriched.word_frequencies = this.calculateWordFrequencies(enriched.tokens);

        // Key phrases (based on POS patterns)
        enriched.key_phrases = this.extractKeyPhrases(taggedWords);

        // Named entities (basic)
        enriched.entities = this.extractEntities(taggedWords);

        // Text statistics
        enriched.statistics = this.calculateTextStatistics(text, enriched);

        return enriched;
    }

    async tagPartsOfSpeech(tokens) {
        return new Promise((resolve) => {
            const tagged = tagger.tag(tokens);
            resolve(tagged.taggedWords);
        });
    }

    groupByPOS(taggedWords) {
        const groups = {
            nouns: [],
            verbs: [],
            adjectives: [],
            adverbs: [],
            others: []
        };

        taggedWords.forEach(word => {
            const tag = word.tag;
            if (tag.startsWith('NN')) groups.nouns.push(word.token);
            else if (tag.startsWith('VB')) groups.verbs.push(word.token);
            else if (tag.startsWith('JJ')) groups.adjectives.push(word.token);
            else if (tag.startsWith('RB')) groups.adverbs.push(word.token);
            else groups.others.push(word.token);
        });

        return groups;
    }

    calculateWordFrequencies(tokens) {
        const frequencies = {};
        tokens.forEach(token => {
            frequencies[token] = (frequencies[token] || 0) + 1;
        });
        return frequencies;
    }

    extractKeyPhrases(taggedWords) {
        const phrases = [];
        // Look for patterns like: JJ + NN, NN + NN, etc.
        for (let i = 0; i < taggedWords.length - 1; i++) {
            const current = taggedWords[i];
            const next = taggedWords[i + 1];

            if (
                (current.tag.startsWith('JJ') && next.tag.startsWith('NN')) ||
                (current.tag.startsWith('NN') && next.tag.startsWith('NN')) ||
                (current.tag.startsWith('RB') && next.tag.startsWith('JJ'))
            ) {
                phrases.push(`${current.token} ${next.token}`);
            }
        }
        return phrases;
    }

    extractEntities(taggedWords) {
        const entities = {
            names: [],
            organizations: [],
            locations: [],
            dates: []
        };

        let currentEntity = [];
        let currentType = null;

        taggedWords.forEach((word, index) => {
            // Check for proper nouns
            if (word.tag === 'NNP' || word.tag === 'NNPS') {
                if (!currentType) currentType = 'names';
                currentEntity.push(word.token);
            } else {
                if (currentEntity.length > 0) {
                    entities[currentType].push(currentEntity.join(' '));
                    currentEntity = [];
                    currentType = null;
                }
            }

            // Date detection (simple patterns)
            if (word.token.match(/\d{4}/) || 
                word.token.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
                entities.dates.push(word.token);
            }
        });

        return entities;
    }

    calculateTextStatistics(text, enriched) {
        return {
            length: text.length,
            word_count: enriched.tokens.length,
            average_word_length: enriched.tokens.reduce((sum, token) => sum + token.length, 0) / enriched.tokens.length,
            sentence_count: text.split(/[.!?]+/).length,
            unique_words: Object.keys(enriched.word_frequencies).length,
            complexity_score: this.calculateComplexityScore(enriched)
        };
    }

    calculateComplexityScore(enriched) {
        const longWords = enriched.tokens.filter(token => token.length > 6).length;
        const longWordRatio = longWords / enriched.tokens.length;
        const uniqueWordRatio = Object.keys(enriched.word_frequencies).length / enriched.tokens.length;
        return (longWordRatio + uniqueWordRatio) / 2;
    }

    async analyzeSentiment(messages) {
        const results = [];
        for (const msg of messages) {
            // Enrich text first
            const enriched = await this.enrichText(msg.message_body);
            
            // Basic sentiment score
            const sentimentScore = sentiment.getSentiment(enriched.tokens);
            
            // Enhanced analysis using enriched data
            const analysis = {
                sentiment_score: sentimentScore,
                emotion_categories: await this.detectEmotions(msg.message_body, enriched),
                context: await this.extractContext(msg, enriched),
                topics: await this.extractTopics(msg.message_body, enriched),
                contributing_factors: await this.analyzeFactors(msg, enriched),
                enriched_data: enriched
            };

            results.push(analysis);
        }
        return results;
    }

    getEmotionPatterns() {
        return {
            // ... existing emotion patterns ...
        };
    }

    getTopicPatterns() {
        return {
            work: ['meeting', 'project', 'deadline', 'task', 'work', 'client', 'report', 'presentation', 'email', 'manager'],
            social: ['party', 'meet', 'lunch', 'dinner', 'drinks', 'weekend', 'plans', 'friends', 'family', 'celebration'],
            technical: ['error', 'bug', 'code', 'system', 'update', 'software', 'issue', 'server', 'database', 'application'],
            personal: ['family', 'home', 'health', 'feeling', 'life', 'sleep', 'tired', 'sick', 'doctor', 'appointment'],
            urgent: ['asap', 'urgent', 'emergency', 'important', 'critical', 'now', 'immediately', 'priority', 'deadline'],
            scheduling: ['schedule', 'time', 'date', 'tomorrow', 'today', 'next week', 'appointment', 'meeting', 'calendar']
        };
    }

    async detectEmotions(text, nlpResult) {
        const emotions = {
            joy: 0, sadness: 0, anger: 0, fear: 0,
            surprise: 0, love: 0, gratitude: 0,
            excitement: 0, neutral: 0
        };

        // 1. Basic pattern matching (existing code)
        const patternEmotions = await this.detectEmotionsFromPatterns(text);
        
        // 2. NLP classification results
        const nlpEmotions = this.extractEmotionsFromNLP(nlpResult);
        
        // 3. Emoji analysis
        const emojiEmotions = this.analyzeEmojis(text);
        
        // 4. Sentence structure analysis
        const structureEmotions = this.analyzeSentenceStructure(text);

        // Combine all analyses with weights
        Object.keys(emotions).forEach(emotion => {
            emotions[emotion] = (
                (patternEmotions[emotion] * 0.3) +  // Pattern matching
                (nlpEmotions[emotion] * 0.3) +      // NLP classification
                (emojiEmotions[emotion] * 0.2) +    // Emoji analysis
                (structureEmotions[emotion] * 0.2)  // Sentence structure
            );
        });

        return this.normalizeEmotions(emotions);
    }

    async detectEmotionsFromPatterns(text) {
        // Existing pattern-based emotion detection
        // ... (keep existing implementation) ...
    }

    extractEmotionsFromNLP(nlpResult) {
        const emotions = {
            joy: 0, sadness: 0, anger: 0, fear: 0,
            surprise: 0, love: 0, gratitude: 0,
            excitement: 0, neutral: 0
        };

        nlpResult.classifications.forEach(classification => {
            if (emotions.hasOwnProperty(classification.intent)) {
                emotions[classification.intent] = classification.score;
            }
        });

        return emotions;
    }

    analyzeEmojis(text) {
        const emotions = {
            joy: 0, sadness: 0, anger: 0, fear: 0,
            surprise: 0, love: 0, gratitude: 0,
            excitement: 0, neutral: 0
        };

        const emojiPatterns = this.getEmotionPatterns();
        
        Object.entries(emojiPatterns).forEach(([emotion, patterns]) => {
            const emojiCount = patterns.emojis.reduce((count, emoji) => {
                const regex = new RegExp(emoji, 'g');
                return count + (text.match(regex) || []).length;
            }, 0);
            
            if (emojiCount > 0) {
                emotions[emotion] = emojiCount;
            }
        });

        return emotions;
    }

    analyzeSentenceStructure(text) {
        const emotions = {
            joy: 0, sadness: 0, anger: 0, fear: 0,
            surprise: 0, love: 0, gratitude: 0,
            excitement: 0, neutral: 0
        };

        // Analyze sentence endings
        if (text.match(/!{2,}/)) emotions.excitement += 0.5;
        if (text.match(/\?{2,}/)) emotions.surprise += 0.5;
        if (text.match(/[.]{3,}/)) emotions.sadness += 0.3;

        // Analyze capitalization
        if (text.match(/[A-Z]{3,}/)) emotions.anger += 0.4;

        // Analyze repetition
        if (text.match(/(.)\1{2,}/)) emotions.excitement += 0.3;

        return emotions;
    }

    normalizeEmotions(emotions) {
        const total = Object.values(emotions).reduce((sum, val) => sum + val, 0);
        if (total === 0) {
            emotions.neutral = 1;
            return emotions;
        }

        Object.keys(emotions).forEach(emotion => {
            emotions[emotion] = emotions[emotion] / total;
        });

        return emotions;
    }

    async analyzeUserProfile(userId, messages) {
        const profile = {
            user_id: userId,
            common_topics: await this.extractCommonTopics(messages),
            language_patterns: await this.analyzeLangaugePatterns(messages),
            personality_traits: await this.analyzePersonality(messages),
            interests: await this.extractInterests(messages),
            communication_preferences: await this.analyzeCommunicationStyle(messages)
        };

        return profile;
    }

    async analyzeSentiment(messages) {
        const results = [];
        for (const msg of messages) {
            const tokens = tokenizer.tokenize(msg.message_body);
            const sentimentScore = sentiment.getSentiment(tokens);
            
            const analysis = {
                sentiment_score: sentimentScore,
                emotion_categories: await this.detectEmotions(msg.message_body),
                context: await this.extractContext(msg),
                topics: await this.extractTopics(msg.message_body),
                contributing_factors: await this.analyzeFactors(msg)
            };

            results.push(analysis);
        }
        return results;
    }

    async detectEmotions(text) {
        const emotions = {
            joy: 0,
            sadness: 0,
            anger: 0,
            fear: 0,
            surprise: 0,
            love: 0,
            gratitude: 0,
            excitement: 0,
            neutral: 0
        };

        const emotionPatterns = {
            joy: {
                keywords: [
                    'happy', 'great', 'excellent', 'good', 'wonderful', 'fantastic', 'awesome', 'delighted',
                    'pleased', 'glad', 'joyful', 'cheerful', 'content', 'satisfied', 'blessed', 'thrilled'
                ],
                emojis: ['😊', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '☺️', '😌', '😍', '🥰', '😘', '😗', '😙', '😚'],
                patterns: [
                    /\bhaha+h?\b/i,
                    /\blol+\b/i,
                    /\bwoo+ho+\b/i,
                    /!{2,}/,
                    /\byay+\b/i
                ],
                intensifiers: ['very', 'really', 'so', 'super', 'extremely']
            },
            sadness: {
                keywords: [
                    'sad', 'sorry', 'unfortunate', 'unhappy', 'disappointed', 'miss', 'regret', 'depressed',
                    'heartbroken', 'grief', 'lonely', 'alone', 'upset', 'hurt', 'painful', 'devastated'
                ],
                emojis: ['😢', '😔', '😞', '😟', '😕', '☹️', '😣', '😖', '😫', '😩', '🥺', '😭', '😪', '😿'],
                patterns: [
                    /\bsigh\b/i,
                    /\b(?:feel|feeling)\s+(?:down|low)\b/i,
                    /\bmiss(?:ing)?\s+you\b/i
                ],
                intensifiers: ['deeply', 'terribly', 'absolutely', 'completely']
            },
            anger: {
                keywords: [
                    'angry', 'mad', 'furious', 'annoyed', 'frustrated', 'upset', 'irritated', 'outraged',
                    'hate', 'despise', 'resent', 'hostile', 'livid', 'enraged', 'bitter', 'disgusted'
                ],
                emojis: ['😠', '😡', '😤', '👿', '💢', '🤬', '💪', '🤯', '😾', '💀'],
                patterns: [
                    /\bwth\b/i,
                    /\bwtf\b/i,
                    /\bugh\b/i,
                    /\bffs\b/i,
                    /\b(?:piss|pissed)\b/i
                ],
                intensifiers: ['absolutely', 'totally', 'completely', 'utterly']
            },
            fear: {
                keywords: [
                    'afraid', 'scared', 'worried', 'nervous', 'concerned', 'anxious', 'terrified', 'frightened',
                    'panic', 'horror', 'dread', 'alarmed', 'uneasy', 'stressed', 'paranoid', 'fearful'
                ],
                emojis: ['😨', '😰', '😱', '😳', '🥶', '😬', '😖', '😣', '😫', '🙀'],
                patterns: [
                    /\boh\s+no\b/i,
                    /\bhelp\b/i,
                    /\bscary\b/i,
                    /\bworries?\b/i
                ],
                intensifiers: ['really', 'very', 'so', 'extremely', 'deeply']
            },
            surprise: {
                keywords: [
                    'wow', 'omg', 'unexpected', 'surprised', 'amazing', 'unbelievable', 'shocking', 'astonishing',
                    'incredible', 'startled', 'stunned', 'speechless', 'mindblowing', 'extraordinary'
                ],
                emojis: ['😮', '😲', '😯', '😦', '😧', '😨', '🤯', '😱', '😵', '🫢'],
                patterns: [
                    /\bwow+\b/i,
                    /\bomg+\b/i,
                    /\bwhat[?!]+\b/i,
                    /[!?]{3,}/
                ],
                intensifiers: ['absolutely', 'totally', 'completely', 'utterly']
            },
            love: {
                keywords: [
                    'love', 'adore', 'cherish', 'treasure', 'devoted', 'fond', 'affection', 'caring',
                    'beloved', 'darling', 'precious', 'sweetie', 'honey', 'dear', 'sweetheart'
                ],
                emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💗', '💓', '💕', '💖', '💝', '💘', '💌'],
                patterns: [
                    /\blove\s+you\b/i,
                    /\bxo+x+\b/i,
                    /\bmuah\b/i
                ],
                intensifiers: ['deeply', 'truly', 'madly', 'completely']
            },
            gratitude: {
                keywords: [
                    'thanks', 'thank', 'grateful', 'appreciate', 'thankful', 'blessed', 'appreciated',
                    'indebted', 'recognition', 'acknowledgment'
                ],
                emojis: ['🙏', '💐', '🌹', '🎁', '✨', '💫'],
                patterns: [
                    /\bthank\s+you\b/i,
                    /\bthanks?\b/i,
                    /\bty\b/i
                ],
                intensifiers: ['very', 'really', 'so', 'much']
            },
            excitement: {
                keywords: [
                    'excited', 'thrilled', 'eager', 'enthusiastic', 'pumped', 'psyched', 'stoked', 'hyped',
                    'keen', 'looking forward', 'cant wait', 'anticipating'
                ],
                emojis: ['🎉', '🎊', '✨', '💫', '⭐', '🌟', '🔥', '💥', '🚀', '🤩'],
                patterns: [
                    /\bwoo+ho+\b/i,
                    /\byes+\b/i,
                    /\blet'?s\s+go+\b/i
                ],
                intensifiers: ['super', 'really', 'so', 'incredibly']
            }
        };

        const lowercaseText = text.toLowerCase();
        let hasEmotion = false;
        let totalScore = 0;

        // Helper function to count emoji occurrences
        const countEmojis = (text, emojiList) => {
            return emojiList.reduce((count, emoji) => {
                const regex = new RegExp(emoji, 'g');
                return count + (text.match(regex) || []).length;
            }, 0);
        };

        // Analyze each emotion
        for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
            let score = 0;

            // Check keywords
            const keywordMatches = patterns.keywords.filter(keyword => lowercaseText.includes(keyword));
            score += keywordMatches.length;

            // Check emojis
            const emojiCount = countEmojis(text, patterns.emojis);
            score += emojiCount * 1.5; // Emojis weighted more heavily

            // Check patterns
            const patternMatches = patterns.patterns.filter(pattern => pattern.test(text));
            score += patternMatches.length;

            // Check intensifiers
            const intensifierCount = patterns.intensifiers.filter(intensifier => 
                lowercaseText.includes(intensifier)
            ).length;
            score *= (1 + (intensifierCount * 0.5)); // Increase score based on intensifiers

            // Apply additional context-based multipliers
            if (emojiCount > 2) score *= 1.5; // Multiple emojis indicate stronger emotion
            if (text.length < 10 && emojiCount > 0) score *= 1.2; // Short text with emoji is more emphatic
            if (text.match(/!{2,}/)) score *= 1.3; // Multiple exclamation marks increase intensity

            if (score > 0) {
                emotions[emotion] = score;
                hasEmotion = true;
                totalScore += score;
            }
        }

        // Normalize scores
        if (totalScore > 0) {
            for (const emotion in emotions) {
                if (emotions[emotion] > 0) {
                    emotions[emotion] = emotions[emotion] / totalScore;
                }
            }
        }

        // If no emotions detected, increment neutral
        if (!hasEmotion) {
            emotions.neutral = 1;
        }

        return emotions;
    }

    async extractContext(message) {
        // Extract context from message and surrounding messages
        // This is a placeholder for more sophisticated context extraction
        return "general";
    }

    async extractTopics(text) {
        const commonTopics = {
            work: ['meeting', 'project', 'deadline', 'task', 'work', 'client', 'report'],
            social: ['party', 'meet', 'lunch', 'dinner', 'drinks', 'weekend', 'plans'],
            technical: ['error', 'bug', 'code', 'system', 'update', 'software', 'issue'],
            personal: ['family', 'home', 'health', 'feeling', 'life', 'sleep', 'tired'],
            urgent: ['asap', 'urgent', 'emergency', 'important', 'critical', 'now', 'immediately'],
            scheduling: ['schedule', 'time', 'date', 'tomorrow', 'today', 'next week', 'appointment']
        };

        const topics = new Set();
        const lowercaseText = text.toLowerCase();
        const words = tokenizer.tokenize(lowercaseText);

        // Check for common topics
        for (const [topic, keywords] of Object.entries(commonTopics)) {
            const matches = keywords.filter(keyword => lowercaseText.includes(keyword));
            if (matches.length > 0) {
                topics.add(topic);
            }
        }

        // Extract potential custom topics (capitalized phrases)
        const customTopicRegex = /[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*/g;
        const customTopics = text.match(customTopicRegex) || [];
        customTopics.forEach(topic => topics.add(topic.toLowerCase()));

        return Array.from(topics);
    }

    async analyzeFactors(message) {
        // Analyze contributing factors to sentiment
        return {
            time_of_day: new Date(message.timestamp).getHours(),
            message_length: message.message_body.length,
            response_time: 0, // Calculate from previous message
            conversation_context: "general"
        };
    }

    async extractCommonTopics(messages) {
        // Analyze message history to find common topics
        const topics = new Map();
        
        for (const msg of messages) {
            const messageTopics = await this.extractTopics(msg.message_body);
            for (const topic of messageTopics) {
                topics.set(topic, (topics.get(topic) || 0) + 1);
            }
        }

        return Array.from(topics.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic]) => topic);
    }

    async analyzeLangaugePatterns(messages) {
        return {
            vocabulary_level: "moderate",
            formality: "casual",
            emoji_usage: await this.analyzeEmojiUsage(messages),
            sentence_complexity: "medium",
            common_phrases: await this.extractCommonPhrases(messages)
        };
    }

    async analyzePersonality(messages) {
        return {
            openness: 0.7,
            conscientiousness: 0.8,
            extraversion: 0.6,
            agreeableness: 0.75,
            neuroticism: 0.4,
            traits: ["analytical", "friendly", "professional"]
        };
    }

    async extractInterests(messages) {
        // Extract interests from message content
        const interests = new Set();
        
        for (const msg of messages) {
            // Implement interest extraction logic
            // This is a placeholder for more sophisticated interest detection
        }

        return Array.from(interests);
    }

    async analyzeCommunicationStyle(messages) {
        return {
            preferred_time: await this.analyzePreferredTime(messages),
            response_speed: "prompt",
            message_length: "medium",
            conversation_style: "collaborative",
            formality_level: "semi-formal"
        };
    }

    async analyzeEmojiUsage(messages) {
        // Analyze emoji usage patterns
        return {
            frequency: "moderate",
            common_emojis: [],
            context_appropriate: true
        };
    }

    async extractCommonPhrases(messages) {
        // Extract frequently used phrases
        const phrases = new Map();
        
        // Implement phrase extraction logic
        // This is a placeholder for more sophisticated phrase extraction
        
        return Array.from(phrases.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([phrase]) => phrase);
    }

    async analyzePreferredTime(messages) {
        // Analyze message timestamps to find preferred communication times
        const hourCounts = new Array(24).fill(0);
        
        for (const msg of messages) {
            const hour = new Date(msg.timestamp).getHours();
            hourCounts[hour]++;
        }

        const peakHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(({ hour }) => hour);

        return peakHours;
    }

    async generateResponse(userId, context) {
        const dbClient = await this.pool.connect();
        try {
            // Get user profile
            const { rows: [profile] } = await dbClient.query(
                'SELECT * FROM user_profiles WHERE user_id = $1',
                [userId]
            );

            // Get recent sentiment
            const { rows: [recentSentiment] } = await dbClient.query(
                'SELECT * FROM sentiment_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1',
                [userId]
            );

            // Find suitable response template
            const { rows: [template] } = await dbClient.query(
                `SELECT * FROM response_templates 
                WHERE $1 = ANY(suitable_contexts)
                AND $2 = ANY(required_sentiment)
                ORDER BY success_rate DESC LIMIT 1`,
                [context, recentSentiment.emotion_categories[0]]
            );

            if (!template) {
                return this.generateDefaultResponse(profile);
            }

            // Customize template based on user profile
            return this.customizeTemplate(template, profile);
        } finally {
            dbClient.release();
        }
    }

    generateDefaultResponse(profile) {
        // Generate a safe, generic response based on user profile
        return {
            content: "I understand. Let me help you with that.",
            tone: profile.communication_preferences.formality_level,
            timing: profile.communication_preferences.preferred_time
        };
    }

    async customizeTemplate(template, profile) {
        // Customize response template based on user profile
        let content = template.content_template;

        // Replace variables with user-specific values
        for (const [key, value] of Object.entries(template.variables)) {
            content = content.replace(`{${key}}`, profile[value] || value);
        }

        return {
            content,
            tone: profile.communication_preferences.formality_level,
            timing: profile.communication_preferences.preferred_time
        };
    }
}

module.exports = SentimentAnalyzer; 