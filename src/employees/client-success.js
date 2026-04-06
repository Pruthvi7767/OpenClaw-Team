const supabase = require('../services/supabase');
const emailService = require('../services/email');
const logger = require('../utils/logger');

class ClientSuccess {
    async checkReengagement() {
        logger.info('🔄 Client Success: Checking for re-engagement opportunities');

        // Find clients who got reports 7+ days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: clients } = await supabase.client
            .from('clients')
            .select('*')
            .eq('status', 'delivered')
            .lt('report_sent_at', sevenDaysAgo.toISOString())
            .eq('total_reports_purchased', 1);

        if (!clients || clients.length === 0) {
            return 0;
        }

        let engaged = 0;

        for (const client of clients) {
            try {
                await this.sendFollowup(client);
                engaged++;
            } catch (error) {
                logger.error('Client Success: Failed to send followup', error);
            }
        }

        logger.info(`✅ Client Success: Sent ${engaged} followup emails`);
        return engaged;
    }

    async sendFollowup(client) {
        await emailService.send({
            to: client.email,
            subject: `How's it going with ${client.company_name}?`,
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Hi there,</p>
    
    <p>Just following up on the business report we sent for ${client.company_name}.</p>
    
    <p>If you found it useful and want an updated analysis or a deeper dive into specific areas, we'd be happy to help!</p>
    
    <p>Just reply to this email and let us know.</p>
    
    <p>Best,<br>VERIXA Team</p>
</body>
</html>
            `.trim()
        });

        await supabase.client
            .from('clients')
            .update({
                status: 'followup_sent',
                last_contact_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', client.id);
    }
}

module.exports = new ClientSuccess();
