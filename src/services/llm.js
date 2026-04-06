const axios = require('axios');
const logger = require('../utils/logger');
const supabase = require('../services/supabase');

class LLMService {
    constructor() {
        this.providers = {
            openrouter: {
                url: 'https://openrouter.ai/api/v1/chat/completions',
                key: process.env.OPENROUTER_API_KEY,
                model: 'meta-llama/llama-3.1-8b-instruct:free',
                cost_per_1m: 0.15 // $0.15 per 1M tokens
            },
            nvidia: {
                url: 'https://integrate.api.nvidia.com/v1/chat/completions',
                key: process.env.NVIDIA_API_KEY,
                model: 'meta/llama-3.1-8b-instruct',
                cost_per_1m: 0.20 // $0.20 per 1M tokens
            }
        };
        
        this.currentProvider = 'openrouter';
    }

    getRoleModel(role) {
        const override = process.env[`MODEL_${role.toUpperCase()}`];
        return override || null;
    }

    async chat({ system, messages, role = 'execution', forceModel = null }) {
        const providerName = this.currentProvider;
        const provider = this.providers[providerName];
        const targetModel = forceModel || this.getRoleModel(role) || provider.model;

        const payload = {
            model: targetModel,
            messages: [
                { role: 'system', content: system },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 500
        };

        try {
            const response = await axios.post(provider.url, payload, {
                headers: {
                    'Authorization': `Bearer ${provider.key}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://verixa.ai',
                    'X-Title': 'VERIXA'
                }
            });

            const content = response.data.choices[0].message.content;
            const usage = response.data.usage || { total_tokens: 0 };

            // 💰 COST TRACKING
            const cost = (usage.total_tokens / 1000000) * (provider.cost_per_1m || 0.15);
            
            await supabase.logUsage({
                service_name: 'LLM',
                api_name: providerName,
                model_name: targetModel,
                tokens_used: usage.total_tokens,
                estimated_cost: cost
            });

            return content;

        } catch (error) {
            logger.error(`LLM (${this.currentProvider}) failed using model ${targetModel}:`, error.message);

            if (this.currentProvider === 'openrouter') {
                this.currentProvider = 'nvidia';
                const fallbackUsed = this.providers['nvidia'].model;
                
                try {
                    const systemDoctor = require('../core/system-doctor');
                    systemDoctor.reportIssue('model_failure', `LLM (${role})`, targetModel, error.message || 'API Error', fallbackUsed);
                } catch(e) {}

                return await this.chat({ system, messages, role, forceModel: fallbackUsed });
            } else {
                try {
                    const systemDoctor = require('../core/system-doctor');
                    systemDoctor.reportIssue('model_failure', `LLM (${role})`, targetModel, error.message || 'Complete API Exhaustion', 'NONE');
                } catch(e) {}
                
                logger.warn('Returning safe fallback string due to complete LLM failure');
                return "Model processing temporarily unavailable. Proceeding safely.";
            }
        }
    }

    async generate(prompt) {
        return await this.chat({
            system: 'You are a professional business analyst.',
            messages: [{ role: 'user', content: prompt }]
        });
    }
}

module.exports = new LLMService();
