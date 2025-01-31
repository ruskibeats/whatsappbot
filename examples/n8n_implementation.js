// Example n8n function node
function SSMLGenerator($input) {
    const text = $input.text;
    const emotion = $input.emotion || 'neutral';
    const rate = $input.rate || 'medium';
    const pitch = $input.pitch || 'medium';
    
    return {
        ssml: `
            <speak>
                <prosody rate="${rate}" pitch="${pitch}">
                    <amazon:emotion name="${emotion}" intensity="medium">
                        ${text}
                    </amazon:emotion>
                </prosody>
            </speak>
        `
    };
}
