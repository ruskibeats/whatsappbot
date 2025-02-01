# N8N SSML Task Processor

A Node.js script for n8n that processes tasks and applies SSML (Speech Synthesis Markup Language) patterns based on task context, urgency, and type.

## Features

- Processes tasks from n8n workflow nodes
- Applies contextual SSML patterns based on:
  - Task urgency
  - Due date status
  - Task type (Financial, Medical, Vehicle, Admin, etc.)
  - Task content
- Provides task statistics and categorization
- Outputs clean, structured JSON format

## Input Requirements

### Tasks Node (`Filter_Outstanding_Tasks`)
Tasks should have the following structure:
```json
{
    "content": "Task description",
    "Due Date": "DD/MM/YYYY",
    "is_completed": boolean
}
```

### SSML Patterns Node (`SSML_Patterns`)
Predefined SSML patterns are applied based on task context:
- Overdue tasks: disappointed emotion
- Urgent tasks: fast speech rate
- Financial/Tax tasks: excited emotion
- Medical tasks: soft volume
- Default: happy emotion

## Output Format

The script outputs a structured JSON format:
```json
{
    "stats": {
        "total": 12,
        "urgent": 12,
        "regular": 0
    },
    "tasks": [
        {
            "title": "Task title",
            "pattern": "<amazon:emotion name='disappointed' intensity='medium'>Task title</amazon:emotion>",
            "due": "DD/MM/YYYY (X days overdue/remaining)",
            "status": "Overdue|Critical|High Priority|Medium Priority|Low Priority",
            "type": "General|Financial|Vehicle|Medical|Home|Admin",
            "details": [
                "Additional detail 1",
                "Additional detail 2"
            ]
        }
    ]
}
```

### Output Fields
- **stats**: Summary statistics of tasks
  - `total`: Total number of tasks
  - `urgent`: Number of urgent tasks
  - `regular`: Number of regular tasks
- **tasks**: Array of task objects
  - `title`: Main task description
  - `pattern`: SSML pattern applied to the task
  - `due`: Due date with relative time
  - `status`: Task priority status
  - `type`: Categorized task type
  - `details`: Array of additional task details

## Task Processing Logic

1. **Task Filtering**
   - Removes completed tasks
   - Requires content and due date
   - Sorts by urgency and due date

2. **Status Classification**
   - Overdue: > 3 days past due
   - Critical: 1-3 days past due
   - High Priority: Due today
   - Medium Priority: Due within 3 days
   - Low Priority: All others

3. **Type Classification**
Based on content keywords:
   - Financial: tax, vat, payment
   - Vehicle: car, rover, beetle
   - Medical: medical, health, doctor
   - Home: bulb, garage, house
   - Admin: study, paper, file
   - General: default

## Usage in n8n

1. Create a Code node in your n8n workflow
2. Copy the script content into the node
3. Connect the following inputs:
   - Tasks from a node named "Filter_Outstanding_Tasks"
   - SSML patterns from a node named "SSML_Patterns"
4. The output will contain processed tasks with SSML patterns and statistics in JSON format

## Error Handling

- Returns empty stats if no tasks are present:
```json
{
    "stats": {
        "total": 0,
        "urgent": 0,
        "regular": 0
    },
    "tasks": []
}
```
- Filters out invalid tasks (missing content or due date)
- Handles missing task details gracefully

## Dependencies

- Requires n8n environment
- Uses standard JavaScript Date object for date calculations
- No external dependencies
