const SentimentAnalyzer = require('../services/SentimentAnalyzer');
const { Pool } = require('pg');
require('dotenv').config();

async function analyzeChatSentiment() {
    const analyzer = new SentimentAnalyzer();
    
    try {
        const messages = [
            "Happy Birthday Nikki, for yesterday, I realise now",
            "Happy birthday James 💝. Much love from us all",
            "Thanks Charlotte !!!!",
            "Happy Christmas Batchelor Family. 💜🤶",
            "And to you gorgeous peeps 🎄💝. Wishing you a wonderful",
            "Deffo gorgeous Batchelor fam. Hugs and love to you",
            "Happy New Year Batchelor Family. Have an amazing 2",
            "Thank you we are certainly aiming for that! And to"
        ];

        console.log("Analyzing messages from Charlotte's chat:");
        console.log("----------------------------------------");

        for (const message of messages) {
            const sentiment = analyzer.analyzeSentiment(message);
            console.log(`\nMessage: "${message}"`);
            console.log(`Positive: ${(sentiment.positive * 100).toFixed(1)}%`);
            console.log(`Negative: ${(sentiment.negative * 100).toFixed(1)}%`);
            console.log(`Neutral: ${(sentiment.neutral * 100).toFixed(1)}%`);
            console.log(`Overall Score: ${sentiment.score.toFixed(2)}`);
        }

    } catch (error) {
        console.error('Error analyzing sentiment:', error);
    }
}

analyzeChatSentiment().catch(console.error); 