const emailRotator = require('../core/email-rotator');

class EmailSpecialist {
    async executeCampaign(lead, orderId = null) {
        try {
            // ⏳ Anti-Spam Wait (Global Rate Limit)
            await rateLimiter.wait('email');

            // 🔄 Select Intelligent Domain
            const domain = await emailRotator.getDomain();
            if (!domain) {
                logger.warn('📧 EmailSpecialist: No healthy domain available. Postponing campaign.');
                return { success: false, error: 'No domains available for rotation' };
            }

            const emailSkill = skillRegistry.getSkill('email');
            
            // 🧠 Varied Content using LLM
            const variation = await this.generateVariation(lead);
            
            const result = await emailSkill.execute({ 
                lead, 
                subject: variation.subject,
                body: variation.body,
                domain: domain.name,
                orderId 
            });

            if (result.success) {
                await emailRotator.markSent(domain.id);
            } else {
                await emailRotator.reportIssue(domain.id);
            }

            return result;
        } catch (error) {
            logger.error('EmailSpecialist: Campaign failed', error);
            return { success: false, error: error.message };
        }
    }

    async generateVariation(lead) {
        const companyName = lead.company_name || 'your business';
        
        try {
            const prompt = `
            You are a creative outreach specialist.
            
            Target Company: ${companyName}
            Lead Info: ${lead.snippet || 'General interest'}
            
            Task:
            Generate a personalized subject line and a short 2-3 sentence email body opening that is different from a standard "I noticed your website" template.
            
            Rules:
            - Keep it casual and professional.
            - Focus on a specific benefit or observation.
            - Return JSON: { "subject": "...", "body_opening": "..." }
            `;

            const response = await llm.generate(prompt);
            const data = JSON.parse(response);

            return {
                subject: data.subject,
                body: `${data.body_opening}\n\nI put together a quick analysis showing where users might be dropping off and simple fixes to improve results.\n\nIf you want, I can share it with you. Just reply "yes".\n\n– Markly`
            };
        } catch (err) {
            logger.warn('EmailSpecialist: LLM variation failed, using fallback.');
            return this.getFallback(lead);
        }
    }

    getFallback(lead) {
        const companyName = lead.company_name || 'your business';
        return {
            subject: `Quick insight about ${companyName}`,
            body: `Hi,\n\nI came across ${companyName} and noticed something that might be affecting your conversions.\n\nI have a quick analysis ready for you. Reply "yes" to see it.\n\n– Markly`
        };
    }
}

module.exports = new EmailSpecialist();