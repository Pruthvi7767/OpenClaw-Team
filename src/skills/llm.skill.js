const llmService = require('../services/llm');

module.exports = {
    async execute(input) {
        // input: { system, messages, role, forceModel }
        
        return await llmService.chat({
            system: input.system || 'You are a helpful assistant.',
            messages: input.messages || [],
            role: input.role || 'execution',
            forceModel: input.forceModel || null
        });
    }
};
