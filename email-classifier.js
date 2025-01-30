const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const natural = require('natural');
const sentiment = require('sentiment');
const keywordExtractor = require('keyword-extractor');

// Load training data from CSV
async function loadTrainingData(filePath) {
    const trainingData = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Extract relevant columns
                const text = row['Email Content'];
                const category = row['Category'];
                const spam = row['Spam'] && row['Spam'].toLowerCase() === 'true'; // Normalize spam value

                // Use only non-spam emails for training
                if (text && category && !spam) {
                    trainingData.push({ text, category });
                }
            })
            .on('end', () => resolve(trainingData))
            .on('error', (error) => reject(error));
    });
}

// Classification function
async function classifyEmail(subject, body, classifier) {
    try {
        const fullText = `${subject} ${body}`;
        console.log('Analyzing email text:', fullText);

        // Initialize tools
        const tokenizer = new natural.WordTokenizer();
        const sentimentAnalyzer = new sentiment();

        // Tokenize and extract features
        const tokens = tokenizer.tokenize(fullText);
        const sentimentResult = sentimentAnalyzer.analyze(fullText);
        const keywords = keywordExtractor.extract(fullText, {
            language: "english",
            remove_digits: true,
            return_changed_case: true,
            remove_duplicates: true
        });

        // Classify the text
        const classifications = classifier.getClassifications(fullText);
        const topClassification = classifications[0];

        const result = {
            category: topClassification.label,
            sentiment: sentimentResult.score,
            keywords: keywords.slice(0, 5), // Top 5 keywords
            tokens: tokens.length,
            classifications
        };

        console.log('Classification Result:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('Error during email classification:', error.message);
        process.exit(1);
    }
}

// Main function
async function main() {
    const csvFilePath = path.join(__dirname, 'emails.csv'); // Ensure absolute path is used
    const subject = process.env.EMAIL_SUBJECT || 'Default Subject';
    const body = process.env.EMAIL_BODY || 'Default Body';

    if (!subject && !body) {
        console.error('No input provided. Please set EMAIL_SUBJECT and EMAIL_BODY.');
        process.exit(1);
    }

    console.log('Loading training data from CSV...');
    const trainingData = await loadTrainingData(csvFilePath);
    console.log(`Loaded ${trainingData.length} training examples.`);

    // Initialize classifier and train
    const classifier = new natural.BayesClassifier();
    console.log('Training classifier...');
    trainingData.forEach((item) => {
        classifier.addDocument(item.text, item.category);
    });
    classifier.train();
    console.log('Classifier trained successfully!');

    // Classify the provided email
    await classifyEmail(subject, body, classifier);
}

// Run the main function
main();