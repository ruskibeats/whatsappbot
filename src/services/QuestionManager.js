const fs = require('fs').promises;
const path = require('path');

class QuestionManager {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data', 'enriched');
    }

    async getQuestionsForContact(contactId) {
        try {
            const filename = path.join(this.dataDir, `${contactId}_questions.json`);
            const data = await fs.readFile(filename, 'utf8');
            return JSON.parse(data).questions;
        } catch (error) {
            return [];
        }
    }

    async markQuestionAnswered(contactId, questionType, answer) {
        try {
            const filename = path.join(this.dataDir, `${contactId}_questions.json`);
            const data = JSON.parse(await fs.readFile(filename, 'utf8'));
            
            // Remove answered question
            data.questions = data.questions.filter(q => q.type !== questionType);
            
            // Save updated questions
            await fs.writeFile(filename, JSON.stringify(data, null, 2));

            // Store answer in relationship data
            await this._updateRelationshipData(contactId, questionType, answer);
            
            return true;
        } catch (error) {
            console.error('Error marking question as answered:', error);
            return false;
        }
    }

    async _updateRelationshipData(contactId, questionType, answer) {
        const relationshipDir = path.join(process.cwd(), 'data', 'relationships');
        await fs.mkdir(relationshipDir, { recursive: true });
        
        const filename = path.join(relationshipDir, `${contactId}.json`);
        let relationshipData;

        try {
            relationshipData = JSON.parse(await fs.readFile(filename, 'utf8'));
        } catch (error) {
            relationshipData = {
                status: 'new',
                preferences: {},
                context: {},
                lastUpdated: Date.now()
            };
        }

        // Update relationship data based on question type
        switch (questionType) {
            case 'relationship_type':
                relationshipData.status = answer.toLowerCase();
                break;
            case 'urgent_preference':
                if (!relationshipData.preferences) relationshipData.preferences = {};
                relationshipData.preferences.urgentResponse = answer;
                break;
            case 'communication_style':
                if (!relationshipData.preferences) relationshipData.preferences = {};
                relationshipData.preferences.communicationStyle = answer;
                break;
            case 'personal_context':
                if (!relationshipData.context) relationshipData.context = {};
                relationshipData.context.personal = answer;
                break;
        }

        relationshipData.lastUpdated = Date.now();
        await fs.writeFile(filename, JSON.stringify(relationshipData, null, 2));
    }

    async getPendingQuestionCount() {
        try {
            const files = await fs.readdir(this.dataDir);
            const questionFiles = files.filter(f => f.endsWith('_questions.json'));
            
            let totalQuestions = 0;
            for (const file of questionFiles) {
                const data = JSON.parse(
                    await fs.readFile(path.join(this.dataDir, file), 'utf8')
                );
                totalQuestions += data.questions.length;
            }
            
            return totalQuestions;
        } catch (error) {
            console.error('Error counting pending questions:', error);
            return 0;
        }
    }

    async getHighPriorityQuestions() {
        try {
            const files = await fs.readdir(this.dataDir);
            const questionFiles = files.filter(f => f.endsWith('_questions.json'));
            
            const highPriorityQuestions = [];
            for (const file of questionFiles) {
                const data = JSON.parse(
                    await fs.readFile(path.join(this.dataDir, file), 'utf8')
                );
                
                const contactId = file.replace('_questions.json', '');
                data.questions
                    .filter(q => q.importance === 'high')
                    .forEach(q => highPriorityQuestions.push({
                        contactId,
                        ...q
                    }));
            }
            
            return highPriorityQuestions;
        } catch (error) {
            console.error('Error getting high priority questions:', error);
            return [];
        }
    }
}

module.exports = QuestionManager;
