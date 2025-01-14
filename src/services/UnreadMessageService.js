const fs = require('fs').promises;
const path = require('path');

class UnreadMessageService {
    constructor(client) {
        this.client = client;
        this.unreadMessages = new Map(); // chatId -> messages[]
        this.familyMembers = new Set([
            'Mimi Batchelor',
            'Tom Batchelor',
            'Charlotte Batchelor',
            'Mum Batchelor'
        ].map(name => name.toLowerCase()));
        
        // Path for persisting unread messages
        this.storageDir = path.join(process.cwd(), 'data', 'unread');
        this.unreadPath = path.join(this.storageDir, 'unread_messages.json');
    }

    async initialize() {
        // Create storage directory if it doesn't exist
        await fs.mkdir(this.storageDir, { recursive: true });
        
        // Load any persisted unread messages
        try {
            const data = await fs.readFile(this.unreadPath, 'utf8');
            const loaded = JSON.parse(data);
            this.unreadMessages = new Map(Object.entries(loaded));
        } catch (error) {
            // File doesn't exist or is corrupt, start fresh
            this.unreadMessages = new Map();
        }

        console.log('UnreadMessageService initialized');
        return true;
    }

    async trackMessage(msg) {
        if (!msg || msg.fromMe) return false;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const isFamily = this.isFamily(contact.name);

        // Only track messages from family or if marked as important
        if (!isFamily && !this.isImportantMessage(msg)) return false;

        const messageData = {
            id: msg.id._serialized,
            from: contact.name || msg.from,
            body: msg.body,
            timestamp: msg.timestamp || Date.now(),
            isFamily,
            chat: {
                id: chat.id._serialized,
                name: chat.name || contact.name
            },
            notified: false
        };

        // Add to unread messages
        if (!this.unreadMessages.has(chat.id._serialized)) {
            this.unreadMessages.set(chat.id._serialized, []);
        }
        this.unreadMessages.get(chat.id._serialized).push(messageData);

        // Persist changes
        await this.saveUnreadMessages();

        return messageData;
    }

    isFamily(name) {
        return this.familyMembers.has(name.toLowerCase());
    }

    isImportantMessage(msg) {
        const importantPatterns = [
            /urgent/i,
            /important/i,
            /emergency/i,
            /asap/i,
            /help.*needed/i,
            /please.*help/i
        ];

        return importantPatterns.some(pattern => pattern.test(msg.body));
    }

    async getUnreadSummary() {
        const summary = {
            total: 0,
            family: 0,
            important: 0,
            byChat: []
        };

        for (const [chatId, messages] of this.unreadMessages) {
            const chatSummary = {
                chatId,
                chatName: messages[0]?.chat.name || 'Unknown Chat',
                count: messages.length,
                familyMessages: messages.filter(m => m.isFamily).length,
                latestMessage: messages[messages.length - 1]
            };

            summary.total += messages.length;
            summary.family += chatSummary.familyMessages;
            summary.byChat.push(chatSummary);
        }

        return summary;
    }

    async formatUnreadNotification(ownerNumber) {
        const summary = await this.getUnreadSummary();
        if (summary.total === 0) return null;

        let notification = `🔔 *Unread Messages Summary*\n\n`;
        
        // Family messages first
        const familyChats = summary.byChat.filter(chat => 
            chat.familyMessages > 0
        );
        
        if (familyChats.length > 0) {
            notification += `👨‍👩‍👧‍👦 *Family Messages*\n`;
            for (const chat of familyChats) {
                notification += `- ${chat.chatName}: ${chat.familyMessages} message(s)\n`;
                if (chat.latestMessage) {
                    notification += `  Latest: ${chat.latestMessage.body.substring(0, 50)}${chat.latestMessage.body.length > 50 ? '...' : ''}\n`;
                }
            }
            notification += '\n';
        }

        // Other important messages
        const otherChats = summary.byChat.filter(chat => 
            chat.familyMessages === 0 && chat.count > 0
        );
        
        if (otherChats.length > 0) {
            notification += `📝 *Other Messages*\n`;
            for (const chat of otherChats) {
                notification += `- ${chat.chatName}: ${chat.count} message(s)\n`;
            }
        }

        return notification;
    }

    async markRead(chatId) {
        if (!this.unreadMessages.has(chatId)) return false;
        
        this.unreadMessages.delete(chatId);
        await this.saveUnreadMessages();
        return true;
    }

    async markAllRead() {
        this.unreadMessages.clear();
        await this.saveUnreadMessages();
        return true;
    }

    async saveUnreadMessages() {
        const data = Object.fromEntries(this.unreadMessages);
        await fs.writeFile(this.unreadPath, JSON.stringify(data, null, 2), 'utf8');
    }

    // Get unread messages for a specific chat
    async getChatUnread(chatId) {
        return this.unreadMessages.get(chatId) || [];
    }

    // Get all unread messages
    async getAllUnread() {
        const allUnread = [];
        for (const messages of this.unreadMessages.values()) {
            allUnread.push(...messages);
        }
        return allUnread.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Get only family unread messages
    async getFamilyUnread() {
        const allUnread = await this.getAllUnread();
        return allUnread.filter(msg => msg.isFamily);
    }

    // Handle read status changes
    async handleReadStatus(msg) {
        if (!msg || !msg.chat) return;
        
        const chat = await msg.getChat();
        if (chat.unreadCount === 0) {
            await this.markRead(chat.id._serialized);
        }
    }
}

module.exports = UnreadMessageService;
