const skillRegistry = require('../skills/skill-registry');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');
const fs = require('fs');

class DeliveryAgent {
    async sendReports(reports) {
        logger.info(`📤 Delivery Agent: Sending ${reports.length} reports`);

        let delivered = 0;
        const emailSkill = skillRegistry.getSkill('email');

        for (const report of reports) {
            try {
                const { data: client } = await supabase.client
                    .from('clients')
                    .select('*')
                    .eq('id', report.client_id)
                    .single();

                if (!client) continue;

                // Send email with attachment via new Skill layer
                await emailSkill.execute({
                    action: 'send',
                    payload: {
                        to: client.email,
                        subject: `Your Business Report - ${client.company_name}`,
                        html: this.generateDeliveryEmail(client),
                        attachments: [{
                            filename: `${client.company_name}_Report.pdf`,
                            path: report.path
                        }]
                    }
                });

                // Update status
                await supabase.client
                    .from('clients')
                    .update({
                        report_sent: true,
                        report_sent_at: new Date().toISOString(),
                        status: 'delivered'
                    })
                    .eq('id', client.id);

                // Update daily report revenue
                await this.updateRevenue(client.unique_amount);

                // Clean up file
                fs.unlinkSync(report.path);

                delivered++;
                logger.info(`✅ Report delivered to ${client.email}`);

            } catch (error) {
                logger.error(`Delivery Agent: Failed to send report`, error);
            }
        }

        logger.info(`✅ Delivery Agent: Delivered ${delivered} reports`);
        return delivered;
    }

    generateDeliveryEmail(client) {
        return `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Hi there,</p>
    
    <p>Thank you for your payment! Your business analysis report for <strong>${client.company_name}</strong> is attached.</p>
    
    <p>The report includes:</p>
    <ul>
        <li>Executive summary of your online presence</li>
        <li>Key weaknesses identified</li>
        <li>Actionable recommendations</li>
        <li>Competitive landscape analysis</li>
    </ul>
    
    <p>If you'd like additional reports or deeper analysis in the future, just reply to this email!</p>
    
    <p>Best regards,<br>
    VERIXA Team</p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="font-size: 12px; color: #888;">
        Questions? Reply to this email or contact us at ${process.env.GMAIL_USER}
    </p>
</body>
</html>
        `.trim();
    }

    async updateRevenue(amount) {
        const today = new Date().toISOString().split('T')[0];

        const { data: report } = await supabase.client
            .from('daily_reports')
            .select('revenue')
            .eq('report_date', today)
            .single();

        const currentRevenue = report ? parseFloat(report.revenue) : 0;

        await supabase.client
            .from('daily_reports')
            .upsert({
                report_date: today,
                revenue: currentRevenue + amount,
                payments_received: supabase.client.rpc('increment', { 
                    row_id: today, 
                    column: 'payments_received' 
                })
            });
    }
}

module.exports = new DeliveryAgent();
