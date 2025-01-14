# WhatsApp Bot Project

This project is a WhatsApp bot built with Node.js and JavaScript, using `whatsapp-web.js` for WhatsApp integration and PostgreSQL for data storage. The bot handles WhatsApp messages efficiently, enriches them with historical context, and applies learning algorithms to improve its functionality over time.

## Services

### EnhancedLearningService

The `EnhancedLearningService` class is responsible for analyzing messages, calculating response confidence, and learning user styles. It uses the `natural` library for tokenization and the `sentiment` library for sentiment analysis.

#### Methods

- **analyzeMessage(messageData)**: Analyzes the content of a message, tokenizing it, performing sentiment analysis, extracting topics, and recognizing the intent. Returns an object containing the original message data along with the analysis results.

- **extractTopics(tokens)**: Extracts topics from the message tokens based on word frequency. Returns the top 3 most frequent words as topics.

- **recognizeIntent(content)**: Recognizes the intent of the message content. Returns 'question', 'request', 'gratitude', or 'statement' based on the content.

- **calculateResponseConfidence(analysis)**: Calculates a confidence score for a response based on the sentiment and intent of the message analysis.

- **learnUserStyle(messageData)**: Learns and stores user styles based on the message content, topics, and intent. This is a placeholder for the actual storage logic.

## Getting Started

To get started with this project, clone the repository and install the dependencies:

```bash
git clone https://github.com/your-repo/whatsapp-bot.git
cd whatsapp-bot
npm install
```

## Running the Bot

To run the bot, use the following command:

```bash
npm start
```

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) before getting started.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
