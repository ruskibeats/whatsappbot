// Get tasks and patterns from nodes
const tasks = $items("Filter_Outstanding_Tasks").map(item => ({
    ...item.json,
    docid: item.json.content
}));

// Debug SSML patterns
console.log('SSML_Patterns node type:', typeof $node["SSML_Patterns"]);
console.log('SSML_Patterns node:', JSON.stringify($node["SSML_Patterns"], null, 2));
console.log('SSML_Patterns json:', JSON.stringify($node["SSML_Patterns"].json, null, 2));

// Get SSML patterns directly
const ssmlPatterns = $node["SSML_Patterns"].json;

if (!Array.isArray(tasks) || tasks.length === 0) {
    return [
        {
            text: "No tasks to process",
            stats: {
                total: 0,
                urgent: 0,
                regular: 0
            }
        }
    ];
}

const getSSMLPattern = (task) => {
    const text = `${task.content || ''} ${task.description || ''}`.toLowerCase();
    const daysUntilDue = task.daysUntilDue || 0;
    
    // Get first line only
    const firstLine = task.content.split('\n')[0];
    
    // Find appropriate pattern based on task context
    if (daysUntilDue < -3) {
        return `<amazon:emotion name="disappointed" intensity="medium">${firstLine}</amazon:emotion>`;
    }
    if (text.includes('urgent') || daysUntilDue <= 0) {
        return `<prosody rate="fast" pitch="+2st">${firstLine}</prosody>`;
    }
    if (text.includes('tax') || text.includes('payment')) {
        return `<amazon:emotion name="excited" intensity="high">${firstLine}</amazon:emotion>`;
    }
    if (text.includes('medical') || text.includes('health')) {
        return `<prosody volume="soft">${firstLine}</prosody>`;
    }
    return `<amazon:emotion name="happy" intensity="high">${firstLine}</amazon:emotion>`;
};

const processedTasks = tasks
    .filter(task => task && task.content && task['Due Date'] && !task.is_completed)
    .map(task => {
        const today = new Date();
        const [day, month, year] = task['Due Date'].split('/');
        const dueDateObj = new Date(year, month - 1, day);
        const daysUntilDue = Math.ceil((dueDateObj - today) / (1000 * 60 * 60 * 24));
        
        const contentLines = task.content ? task.content.split('\n').filter(line => line.trim()) : [];
        const firstLine = contentLines[0] || 'Untitled Task';
        const details = contentLines.slice(1).filter(l => l.trim());
        
        let status = 'Low Priority';
        let isUrgent = false;
        
        if (daysUntilDue < -3) {
            status = 'Overdue';
            isUrgent = true;
        } else if (daysUntilDue <= -1) {
            status = 'Critical';
            isUrgent = true;
        } else if (daysUntilDue === 0) {
            status = 'High Priority';
            isUrgent = true;
        } else if (daysUntilDue <= 3) {
            status = 'Medium Priority';
        }

        const text = `${firstLine} ${task.description || ''}`.toLowerCase();
        let type = 'General';
        if (text.includes('tax') || text.includes('vat') || text.includes('payment')) type = 'Financial';
        if (text.includes('car') || text.includes('rover') || text.includes('beetle')) type = 'Vehicle';
        if (text.includes('medical') || text.includes('health') || text.includes('doctor')) type = 'Medical';
        if (text.includes('bulb') || text.includes('garage') || text.includes('house')) type = 'Home';
        if (text.includes('study') || text.includes('paper') || text.includes('file')) type = 'Admin';

        const ssmlPattern = getSSMLPattern({...task, daysUntilDue});
        const ssmlText = ssmlPattern.replace('$TEXT', firstLine);

        return {
            docid: task.content,
            pattern: ssmlText,
            dueDate: task['Due Date'],
            daysUntilDue,
            status,
            isUrgent,
            type,
            details
        };
    })
    .sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) return b.isUrgent - a.isUrgent;
        return a.daysUntilDue - b.daysUntilDue;
    });

const urgentTasks = processedTasks.filter(task => task.isUrgent);
const regularTasks = processedTasks.filter(task => !task.isUrgent);

const formatTasks = (taskList) => taskList
    .map(task => {
        const detailsText = task.details?.length ? 
            `Details:\n${task.details.map(d => `- ${d}`).join('\n')}\n` : '';
        
        return `Task: ${task.docid}
Pattern: ${task.pattern}
Due: ${task.dueDate}${task.daysUntilDue !== null ? ` (${Math.abs(task.daysUntilDue)} days ${task.daysUntilDue < 0 ? 'overdue' : 'remaining'})` : ''}
Status: ${task.status}
Type: ${task.type}
${detailsText}`;
    }).join('\n---\n\n');

const output = `Total Tasks: ${processedTasks.length}
Urgent Tasks: ${urgentTasks.length}
Regular Tasks: ${regularTasks.length}

${urgentTasks.length ? '🚨 URGENT TASKS:\n\n' + formatTasks(urgentTasks) : ''}${regularTasks.length ? '\n📋 REGULAR TASKS:\n\n' + formatTasks(regularTasks) : ''}`;

return [
    {
        text: output,
        stats: {
            total: processedTasks.length,
            urgent: urgentTasks.length,
            regular: regularTasks.length
        }
    }
];