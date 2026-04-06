const supabase = require('../services/supabase');
const emailService = require('../services/email');
const logger = require('../utils/logger');

class LegalGuardian {
    async monitorSpam() {
        logger.info('⚖️  Legal Guardian: Monitoring for spam/abuse');

        const { data: blacklisted } = await supabase.client
            .from('clients')
            .select('*')
            .eq('is_blacklisted', true)
            .gte('spam_score', 5);

        if (blacklisted && blacklisted.length > 0) {
            logger.warn(`⚠️ ${blacklisted.length} clients marked as hostile`);
        }

        return blacklisted || [];
    }

    async handleLegalThreat(client) {
        logger.warn(`⚖️  Legal threat from ${client.email}`);

        // Send professional cease communication
        await emailService.send({
            to: client.email,
            subject: 'Acknowledgment of Your Request',
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Dear ${client.company_name || 'Sir/Madam'},</p>
    
    <p>We acknowledge receipt of your communication and have immediately removed your contact information from our systems.</p>
    
    <p>You will not receive any further communications from us.</p>
    
    <p>If you have any concerns, please contact us at ${process.env.GMAIL_USER}.</p>
    
    <p>Regards,<br>
    VERIXA Legal Team</p>
</body>
</html>
            `.trim()
        });

        // Permanent blacklist
        await supabase.client
            .from('clients')
            .update({
                is_blacklisted: true,
                status: 'closed'
            })
            .eq('id', client.id);
    }
}

module.exports = new LegalGuardian();
