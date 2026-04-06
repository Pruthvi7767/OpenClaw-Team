const emailService = require('../services/email');

module.exports = {
    async execute(input) {
        const { action, payload } = input;
        
        if (action === 'send') {
            const { to, subject, html, attachments } = payload;
            return await emailService.send({ to, subject, html, attachments });
        } else if (action === 'fetch_payments') {
            return await emailService.fetchPaymentNotifications();
        } else if (action === 'lead_campaign') {
            const { lead, customInstructions } = payload;
            const template = emailService.generateEmail(lead);
            const success = await emailService.sendEmail(lead.email, template.subject, template.body);
            return { success, sent_to: lead.email };
        }
        
        throw new Error(`Unsupported email skill action: ${action}`);
    }
};
