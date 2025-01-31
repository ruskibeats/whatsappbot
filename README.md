# SSML Generator Tool for n8n

## Setup:
1. Add tool definition to n8n AI tools
2. Reference documentation URL in tool configuration
3. Use Function node for SSML generation

## Usage:
1. Input: 
   ```json
   {
     "text": "Your text here",
     "emotion": "happy",
     "rate": "medium"
   }
   ```

2. Output:
   Formatted SSML markup

## Directory Structure
- `/examples` - Implementation examples and use cases
- `/templates` - Reusable SSML templates
- `/docs` - Detailed documentation per platform
- `tool-definition.json` - Tool configuration and quick references

## Quick Start
See `tool-definition.json` for common templates and parameters.
