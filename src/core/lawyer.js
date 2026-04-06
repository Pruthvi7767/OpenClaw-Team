const logger = require('../utils/logger');
const llm = require('../services/llm'); // Note: uses LLM to judge

class AILawyer {
    constructor() {
        // We will default to a fallback model override via LLM if needed
    }

    async evaluateOutput(outputContent) {
        logger.debug('⚖️ AI Lawyer evaluating output...');
        
        // Simulated logic or actual prompt:
        /*
        const prompt = `Analyze this text for risks, scams, illegal content, or severe brand damage.
        Respond ONLY with a JSON consisting of: {"status": "SAFE" | "MINOR" | "RISK", "reason": "...", "fixed_text": "..."}`;
        */
        
        // We simulate a basic keyword check for now to ensure we don't spam API during init
        const badWords = ['scam', 'illegal', 'hack'];
        let status = 'SAFE';
        let fixedContent = outputContent;

        const isRisk = badWords.some(w => outputContent.toLowerCase().includes(w));
        const isMinor = outputContent.includes('guarantee');

        if (isRisk) {
            status = 'RISK';
        } else if (isMinor) {
            status = 'MINOR';
            fixedContent = outputContent.replace(/guarantee/g, 'aim to provide');
        }

        return {
            status,
            original: outputContent,
            fixed: fixedContent
        };
    }

    async enforceSafety(outputContent) {
        const evaluation = await this.evaluateOutput(outputContent);

        switch (evaluation.status) {
            case 'SAFE':
                return { allow: true, content: evaluation.fixed };
            case 'MINOR':
                logger.warn('⚖️ Lawyer auto-fixed a MINOR policy issue in output');
                return { allow: true, content: evaluation.fixed };
            case 'RISK':
                logger.error('⚖️ Lawyer BLOCKED output due to RISK criteria');
                return { allow: false, content: null };
            default:
                return { allow: false, content: null };
        }
    }
}

module.exports = new AILawyer();
