const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const NGrams = natural.NGrams;

class TextStatistics {
    constructor() {
        this.tfidf = new TfIdf();
        this.commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at']);
    }

    analyzeText(messages) {
        const stats = {
            basic: this.calculateBasicStats(messages),
            vocabulary: this.analyzeVocabulary(messages),
            complexity: this.calculateComplexityMetrics(messages),
            patterns: this.findLanguagePatterns(messages),
            wordFrequency: this.calculateWordFrequency(messages),
            ngrams: this.analyzeNGrams(messages)
        };

        return stats;
    }

    calculateBasicStats(messages) {
        const stats = {
            totalMessages: messages.length,
            totalWords: 0,
            totalCharacters: 0,
            averageMessageLength: 0,
            averageWordLength: 0,
            longestMessage: '',
            shortestMessage: '',
            messagesByLength: {
                short: 0,    // < 5 words
                medium: 0,   // 5-20 words
                long: 0      // > 20 words
            }
        };

        if (messages.length === 0) return stats;

        stats.shortestMessage = messages[0].message_body;
        messages.forEach(msg => {
            const text = msg.message_body;
            const words = tokenizer.tokenize(text);
            const wordCount = words.length;

            stats.totalWords += wordCount;
            stats.totalCharacters += text.length;

            // Update message length categories
            if (wordCount < 5) stats.messagesByLength.short++;
            else if (wordCount <= 20) stats.messagesByLength.medium++;
            else stats.messagesByLength.long++;

            // Track longest/shortest messages
            if (text.length > stats.longestMessage.length) {
                stats.longestMessage = text;
            }
            if (text.length < stats.shortestMessage.length) {
                stats.shortestMessage = text;
            }
        });

        stats.averageMessageLength = stats.totalWords / messages.length;
        stats.averageWordLength = stats.totalCharacters / stats.totalWords;

        return stats;
    }

    analyzeVocabulary(messages) {
        const vocabulary = {
            uniqueWords: new Set(),
            vocabularySize: 0,
            vocabularyDiversity: 0,
            rareWords: new Set(),
            frequentWords: new Map(),
            wordCategories: {
                nouns: new Set(),
                verbs: new Set(),
                adjectives: new Set(),
                other: new Set()
            }
        };

        // Process all messages
        messages.forEach(msg => {
            const words = tokenizer.tokenize(msg.message_body.toLowerCase());
            words.forEach(word => {
                if (!this.commonWords.has(word)) {
                    vocabulary.uniqueWords.add(word);
                    
                    // Track word frequency
                    const freq = vocabulary.frequentWords.get(word) || 0;
                    vocabulary.frequentWords.set(word, freq + 1);
                }
            });
        });

        // Calculate vocabulary metrics
        vocabulary.vocabularySize = vocabulary.uniqueWords.size;
        vocabulary.vocabularyDiversity = vocabulary.vocabularySize / 
            messages.reduce((sum, msg) => sum + tokenizer.tokenize(msg.message_body).length, 0);

        // Identify rare and frequent words
        vocabulary.frequentWords.forEach((freq, word) => {
            if (freq === 1) {
                vocabulary.rareWords.add(word);
            }
        });

        // Convert sets to arrays for easier handling
        vocabulary.uniqueWords = Array.from(vocabulary.uniqueWords);
        vocabulary.rareWords = Array.from(vocabulary.rareWords);
        vocabulary.frequentWords = Array.from(vocabulary.frequentWords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50); // Keep top 50 most frequent words

        return vocabulary;
    }

    calculateComplexityMetrics(messages) {
        const complexity = {
            averageSentenceLength: 0,
            readabilityScore: 0,
            complexSentences: 0,
            simpleSentences: 0,
            sentenceLengthDistribution: {},
            clauseComplexity: 0
        };

        let totalSentences = 0;
        let totalSyllables = 0;

        messages.forEach(msg => {
            const text = msg.message_body;
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            totalSentences += sentences.length;

            sentences.forEach(sentence => {
                const words = tokenizer.tokenize(sentence);
                const length = words.length;

                // Track sentence length distribution
                complexity.sentenceLengthDistribution[length] = 
                    (complexity.sentenceLengthDistribution[length] || 0) + 1;

                // Estimate sentence complexity
                if (length > 20 || sentence.includes(',') || /and|but|or|because|although/.test(sentence)) {
                    complexity.complexSentences++;
                } else {
                    complexity.simpleSentences++;
                }

                // Estimate syllables (very basic approximation)
                totalSyllables += words.reduce((sum, word) => {
                    return sum + word.split(/[aeiou]/i).length - 1;
                }, 0);
            });
        });

        // Calculate averages and scores
        complexity.averageSentenceLength = totalSentences > 0 ? 
            messages.reduce((sum, msg) => sum + tokenizer.tokenize(msg.message_body).length, 0) / totalSentences : 0;

        // Simplified Flesch-Kincaid Grade Level
        complexity.readabilityScore = totalSentences > 0 ? 
            0.39 * (complexity.averageSentenceLength) + 11.8 * (totalSyllables / totalSentences) - 15.59 : 0;

        // Calculate clause complexity (ratio of complex to simple sentences)
        complexity.clauseComplexity = complexity.simpleSentences > 0 ? 
            complexity.complexSentences / complexity.simpleSentences : 0;

        return complexity;
    }

    findLanguagePatterns(messages) {
        const patterns = {
            repeatedPhrases: new Map(),
            commonCollocations: [],
            sentenceStarters: new Map(),
            punctuationPatterns: new Map(),
            expressionPatterns: {
                questions: 0,
                exclamations: 0,
                ellipsis: 0,
                emoticons: 0
            }
        };

        messages.forEach(msg => {
            const text = msg.message_body;

            // Track sentence starters
            const firstWord = tokenizer.tokenize(text)[0];
            if (firstWord) {
                patterns.sentenceStarters.set(firstWord.toLowerCase(),
                    (patterns.sentenceStarters.get(firstWord.toLowerCase()) || 0) + 1);
            }

            // Track expression patterns
            if (text.includes('?')) patterns.expressionPatterns.questions++;
            if (text.includes('!')) patterns.expressionPatterns.exclamations++;
            if (text.includes('...')) patterns.expressionPatterns.ellipsis++;
            if (/[:;]-?[()DP]/.test(text)) patterns.expressionPatterns.emoticons++;

            // Find repeated phrases (3-5 words)
            for (let i = 3; i <= 5; i++) {
                const phrases = NGrams.ngrams(tokenizer.tokenize(text), i);
                phrases.forEach(phrase => {
                    const phraseStr = phrase.join(' ');
                    patterns.repeatedPhrases.set(phraseStr,
                        (patterns.repeatedPhrases.get(phraseStr) || 0) + 1);
                });
            }
        });

        // Convert maps to sorted arrays
        patterns.repeatedPhrases = Array.from(patterns.repeatedPhrases)
            .filter(([, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);

        patterns.sentenceStarters = Array.from(patterns.sentenceStarters)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return patterns;
    }

    calculateWordFrequency(messages) {
        const tfidf = new TfIdf();
        
        // Add each message as a document
        messages.forEach(msg => {
            tfidf.addDocument(msg.message_body);
        });

        const wordFrequency = {
            topTerms: [],
            documentFrequency: new Map(),
            termFrequency: new Map()
        };

        // Calculate term frequency across all messages
        messages.forEach((msg, index) => {
            tfidf.listTerms(index).forEach(item => {
                const { term, tfidf: score } = item;
                if (!this.commonWords.has(term)) {
                    wordFrequency.termFrequency.set(term,
                        (wordFrequency.termFrequency.get(term) || 0) + score);
                }
            });
        });

        // Convert to sorted arrays
        wordFrequency.topTerms = Array.from(wordFrequency.termFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50);

        return wordFrequency;
    }

    analyzeNGrams(messages) {
        const ngramAnalysis = {
            bigrams: new Map(),
            trigrams: new Map(),
            fourgrams: new Map(),
            commonPhrases: []
        };

        messages.forEach(msg => {
            const tokens = tokenizer.tokenize(msg.message_body);

            // Analyze different n-gram lengths
            [2, 3, 4].forEach(n => {
                const ngrams = NGrams.ngrams(tokens, n);
                const targetMap = n === 2 ? ngramAnalysis.bigrams :
                                n === 3 ? ngramAnalysis.trigrams :
                                ngramAnalysis.fourgrams;

                ngrams.forEach(ngram => {
                    const phrase = ngram.join(' ');
                    targetMap.set(phrase, (targetMap.get(phrase) || 0) + 1);
                });
            });
        });

        // Convert maps to sorted arrays
        ['bigrams', 'trigrams', 'fourgrams'].forEach(key => {
            ngramAnalysis[key] = Array.from(ngramAnalysis[key])
                .filter(([, count]) => count > 1)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20);
        });

        // Identify common meaningful phrases
        ngramAnalysis.commonPhrases = [...ngramAnalysis.trigrams, ...ngramAnalysis.fourgrams]
            .filter(([phrase, count]) => {
                // Filter out phrases that are likely to be meaningful
                const words = phrase.split(' ');
                const hasCommonWords = words.some(word => this.commonWords.has(word.toLowerCase()));
                return count > 2 && !hasCommonWords;
            })
            .slice(0, 20);

        return ngramAnalysis;
    }
}

module.exports = TextStatistics; 