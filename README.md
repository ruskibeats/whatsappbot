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

### MessageHandler

The `MessageHandler` service is responsible for handling incoming messages, enriching them with user and chat data, and processing them for further actions. It integrates with the `DatabaseService` to fetch and enrich message data.

#### Methods

- **handleMessage(message)**: Handles an incoming message by enriching it with user and chat data, and then processing it. This method uses the `enrichMessage` method from the `DatabaseService` to enrich the message.

- **enrichMessage(message)**: Enriches the message with user and chat data fetched from the database. This method is provided by the `DatabaseService`.

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

## Testing

To test the new functions `calculateResponseConfidence` and `learnUserStyle` in the `EnhancedLearningService`, follow these steps:

1. **Start the Bot**: Ensure the bot is running by executing the following command:
   ```bash
   npm start
   ```

2. **Send Test Messages**: Send test messages to the bot via WhatsApp. The bot will process these messages using the `EnhancedLearningService`.

3. **Check Logs**: Monitor the bot's logs to see the output of the `calculateResponseConfidence` and `learnUserStyle` functions. The logs will show the confidence scores and any learned user styles.

4. **Manual Testing**: You can also manually test the functions by modifying the `index.js` file to directly call the `EnhancedLearningService` methods with sample data.

### Testing the MessageHandler Service

To test the `MessageHandler` service and its integration with the `enrichMessage` method, follow these steps:

1. **Start the Bot**: Ensure the bot is running by executing the following command:
   ```bash
   npm start
   ```

2. **Send Test Messages**: Send test messages to the bot via WhatsApp. The bot will process these messages using the `MessageHandler` service.

3. **Check Logs**: Monitor the bot's logs to see the output of the `handleMessage` and `enrichMessage` methods. The logs will show the enriched message data and any further processing steps.

4. **Manual Testing**: You can also manually test the `MessageHandler` service by modifying the `index.js` file to directly call the `handleMessage` method with sample data.

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) before getting started.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
