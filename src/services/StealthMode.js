const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class StealthMode {
    constructor(client) {
        this.isStealthMode = true; // Enabled by default
        this.client = client;
        this.ownerNumber = process.env.OWNER_NUMBER; // Your private number for notifications
        this.encryptionKey = crypto.randomBytes(32);
    }

    async initialize() {
        // Generate unique encryption key for this session
        this.encryptionKey = crypto.randomBytes(32);
        
        // Ensure we have the owner's number
        if (!this.ownerNumber) {
            console.warn('Warning: OWNER_NUMBER not set in environment variables. Notifications will be disabled.');
        }
        
        console.log('Stealth Mode initialized - Active by default');
        return true;
    }

    async toggleStealthMode(enabled) {
        this.isStealthMode = enabled;
        if (!enabled) {
            // Clear any pending notifications when disabling stealth mode
            await this.clearNotifications();
        }
        return this.isStealthMode;
    }

    isActive() {
        return this.isStealthMode;
    }

    // Encrypt sensitive data
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    // Decrypt sensitive data
    decrypt(encryptedData) {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            this.encryptionKey,
            Buffer.from(encryptedData.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }

    async sendNotification(fromUser, type, content) {
        if (!this.isStealthMode || !this.ownerNumber) return false;

        const notification = {
            timestamp: new Date().toLocaleString(),
            from: fromUser,
            type,
            content
        };

        // Format notification message
        const message = `🔒 *Stealth Notification*\n\n` +
            `From: ${notification.from}\n` +
            `Type: ${notification.type}\n` +
            `Time: ${notification.timestamp}\n\n` +
            `${notification.content}`;

        try {
            // Send to owner's private chat
            const chat = await this.client.getChatById(this.ownerNumber);
            await chat.sendMessage(message);
            return true;
        } catch (error) {
            console.error('Error sending stealth notification:', error);
            return false;
        }
    }

    async getNotifications(userId, options = { unreadOnly: false }) {
        if (!this.notificationQueue.has(userId)) {
            return [];
        }

        const notifications = this.notificationQueue.get(userId)
            .map(encrypted => this.decrypt(encrypted))
            .filter(n => !options.unreadOnly || !n.read)
            .sort((a, b) => b.timestamp - a.timestamp);

        return notifications;
    }

    async markNotificationRead(userId, notificationId) {
        if (!this.notificationQueue.has(userId)) return false;

        const notifications = this.notificationQueue.get(userId);
        const index = notifications.findIndex(
            encrypted => this.decrypt(encrypted).id === notificationId
        );

        if (index === -1) return false;

        const notification = this.decrypt(notifications[index]);
        notification.read = true;
        notifications[index] = this.encrypt(notification);

        await this.persistNotifications(userId);
        return true;
    }

    async persistNotifications(userId) {
        if (!this.secureChannel) return;

        const notifications = this.notificationQueue.get(userId) || [];
        await fs.writeFile(
            this.secureChannel,
            JSON.stringify(notifications),
            'utf8'
        );
    }

    async clearNotifications(userId) {
        if (!this.notificationQueue.has(userId)) return;

        this.notificationQueue.delete(userId);
        if (this.secureChannel) {
            await fs.unlink(this.secureChannel).catch(() => {});
        }
    }

    // Handle message in stealth mode
    async handleMessage(msg, analysisResult) {
        if (!this.isStealthMode || msg.fromMe) return false;

        // Get chat info for context
        const chat = await msg.getChat();
        const chatName = chat.name || chat.id.user;
        
        // Build rich context for the notification
        const context = {
            chatName,
            isGroup: chat.isGroup,
            from: msg.from,
            notifyTime: new Date().toLocaleString()
        };

        // Check if this is a family member
        const isFamily = this.isFamilyMember(msg.from);

        // Prepare notification content
        let notificationContent = '';
        let shouldNotify = false;

        // Priority check
        if (analysisResult.priority === 'high') {
            notificationContent += `⚠️ High Priority Message\n`;
            shouldNotify = true;
        }

        // Family message check
        if (isFamily) {
            notificationContent += `👨‍👩‍👧‍👦 Family Message\n`;
            shouldNotify = true;
        }

        // Important triggers check (only if not already notifying)
        if (!shouldNotify && analysisResult.triggers) {
            const importantTriggers = analysisResult.triggers.filter(t => 
                ['urgent', 'immediate', 'action_required'].includes(t)
            );
            if (importantTriggers.length > 0) {
                notificationContent += `🔑 Important Keywords: ${importantTriggers.join(', ')}\n`;
                shouldNotify = true;
            }
        }

        // Negative sentiment check (only for family or if severe)
        if (analysisResult.sentiment === 'negative' && (isFamily || analysisResult.priority === 'high')) {
            notificationContent += `😟 Negative Sentiment Detected\n`;
            shouldNotify = true;
        }

        // Send notification if any conditions were met
        if (shouldNotify) {
            notificationContent += `\nFrom: ${context.chatName}\n`;
            notificationContent += `Time: ${context.notifyTime}\n`;
            notificationContent += `Message: ${msg.body}`;

            await this.sendNotification(
                context.from,
                isFamily ? 'FAMILY' : 'ALERT',
                notificationContent
            );
        }

        return true;
    }

    isFamilyMember(number) {
        // List of family member contact IDs
        const familyMembers = [
            'Mimi Batchelor',
            'Tom Batchelor',
            'Charlotte Batchelor',
            'Mum Batchelor'
        ].map(name => name.toLowerCase());

        // Get contact name from number and check if they're family
        try {
            const contact = this.client.getContactById(number);
            return contact && familyMembers.includes(contact.name.toLowerCase());
        } catch (error) {
            return false;
        }
    }

    // Secure interaction methods
    async createSecureResponse(msg, response) {
        if (!this.isStealthMode) return response;

        // Encrypt response for secure storage
        const encrypted = this.encrypt({
            messageId: msg.id,
            response,
            timestamp: Date.now()
        });

        // Store encrypted response
        await this.storeSecureResponse(msg.from, encrypted);

        // Return notification instead of actual response
        return {
            type: 'secure_response',
            id: encrypted.id,
            notification: 'Response available in secure channel'
        };
    }

    async storeSecureResponse(userId, encryptedResponse) {
        const responsePath = path.join(
            process.cwd(),
            'data',
            'stealth',
            `${userId}_responses.json`
        );

        let responses = [];
        try {
            const existing = await fs.readFile(responsePath, 'utf8');
            responses = JSON.parse(existing);
        } catch (error) {
            // File doesn't exist yet, start with empty array
        }

        responses.push(encryptedResponse);

        // Keep only last 100 responses
        if (responses.length > 100) {
            responses = responses.slice(-100);
        }

        await fs.writeFile(responsePath, JSON.stringify(responses), 'utf8');
    }

    async getSecureResponses(userId) {
        const responsePath = path.join(
            process.cwd(),
            'data',
            'stealth',
            `${userId}_responses.json`
        );

        try {
            const content = await fs.readFile(responsePath, 'utf8');
            const encrypted = JSON.parse(content);
            return encrypted.map(e => this.decrypt(e));
        } catch (error) {
            return [];
        }
    }

    // Command handlers for stealth mode
    async handleStealthCommand(msg) {
        // Only process commands from owner
        if (msg.from !== this.ownerNumber) {
            return null;
        }

        const command = msg.body.toLowerCase();

        switch (command) {
            case '!stealth status':
                return `Stealth mode is ${this.isStealthMode ? 'active' : 'inactive'}\nNotifications are sent to: ${this.ownerNumber}`;

            case '!stealth off':
                if (msg.from === this.ownerNumber) {
                    await this.toggleStealthMode(false);
                    return 'Stealth mode temporarily deactivated';
                }
                return null;

            case '!stealth on':
                await this.toggleStealthMode(true);
                return 'Stealth mode reactivated';

            default:
                return null;
        }
    }

    formatNotifications(notifications) {
        if (notifications.length === 0) {
            return 'No notifications';
        }

        return notifications
            .map(n => `[${new Date(n.timestamp).toLocaleString()}] ${n.type}: ${n.content}`)
            .join('\n');
    }
}

module.exports = StealthMode;
