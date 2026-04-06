const emailService = require('../services/email');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class InboxMonitor {
    async checkReplies() {
        logger.info('📬 Inbox Monitor: Checking for replies');

        const replies = await emailService.fetchReplies();
        const processed = [];

        for (const reply of replies) {
            try {
                const client = await this.findClient(reply.from);

                if (!client) {
                    logger.warn(`Inbox Monitor: Unknown sender ${reply.from}`);
                    continue;
                }

                const intent = this.detectIntent(reply.body);

                // Update status
                await supabase.client
                    .from('clients')
                    .update({ status: intent.status })
                    .eq('id', client.id);

                // Log reply
                await supabase.client
                    .from('email_campaigns')
                    .update({
                        replied_at: new Date().toISOString(),
                        reply_content: reply.body
                    })
                    .eq('client_id', client.id)
                    .is('replied_at', null);

                // 🔥 SMART FLOW
                if (intent.status === 'interested') {

                    // prevent duplicate preview/payment
                    if (client.payment_status === 'payment_pending') {
                        logger.info(`Already sent payment to ${client.email}`);
                        continue;
                    }

                    // send preview only once
                    if (!client.preview_sent) {
                        await this.sendPreviewEmail(client);

                        await supabase.client
                            .from('clients')
                            .update({ preview_sent: true })
                            .eq('id', client.id);

                        // delay feels human
                        await new Promise(r => setTimeout(r, 2000));
                    }

                    await this.sendPaymentDetails(client);
                }

                if (intent.status === 'closed' && intent.spam) {
                    await this.handleSpam(client);
                }

                processed.push({ client_id: client.id, intent: intent.status });

            } catch (error) {
                logger.error('Inbox Monitor: Failed to process reply', error);
            }
        }

        logger.info(`✅ Inbox Monitor: Processed ${processed.length} replies`);
        return processed;
    }

    async findClient(email) {
        const { data } = await supabase.client
            .from('clients')
            .select('*')
            .eq('email', email)
            .single();

        return data;
    }

    detectIntent(body) {
        const text = body.toLowerCase();

        if (text.match(/yes|interested|sure|send|show|okay|ok|sounds good/)) {
            return { status: 'interested', spam: false };
        }

        if (text.match(/legal|lawyer|sue|report|scam|fraud|spam/)) {
            return { status: 'closed', spam: true };
        }

        if (text.match(/unsubscribe|stop|remove|don't contact/)) {
            return { status: 'closed', spam: false };
        }

        if (text.match(/no|not interested|already have|don't need/)) {
            return { status: 'closed', spam: false };
        }

        return { status: 'interested', spam: false };
    }

    // 🔥 IMPROVED PREVIEW (more real)
    async sendPreviewEmail(client) {
        await emailService.send({
            to: client.email,
            subject: 'Quick finding from your website',
            html: `
            <p>Hi,</p>

            <p>I took a quick look at <strong>${client.website || 'your website'}</strong> and noticed something important.</p>

            <p><strong>Your homepage doesn’t clearly guide users to take action.</strong></p>

            <p>This often leads to visitors leaving without converting into customers.</p>

            <p>In many cases, this can reduce conversions by 30–50%.</p>

            <p>I’ve explained exactly how to fix this in the full report.</p>

            <p>– Markly</p>
            `
        });
    }

    async sendPaymentDetails(client) {
        const baseAmount = parseInt(process.env.UPI_START_AMOUNT) || 301;
        const uniqueAmount = baseAmount + Math.floor(Math.random() * 99);

        await supabase.client
            .from('clients')
            .update({
                unique_amount: uniqueAmount,
                payment_status: 'payment_pending'
            })
            .eq('id', client.id);

        await emailService.send({
            to: client.email,
            subject: 'Access your full report',
            html: this.generatePaymentEmail(uniqueAmount)
        });

        logger.info(`Sent payment details to ${client.email} (₹${uniqueAmount})`);
    }

    generatePaymentEmail(amount) {
        return `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    
    <p>Hi,</p>

    <p>If you'd like access to the full report with all insights and fixes, you can get it below:</p>

    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Payment Details</h3>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>UPI ID:</strong> ${process.env.UPI_ID}</p>
    </div>

    <p>Once payment is received, I’ll send your complete report.</p>

    <p>– Markly</p>

</body>
</html>
        `.trim();
    }

    async handleSpam(client) {
        await supabase.client
            .from('clients')
            .update({
                spam_score: client.spam_score + 5,
                is_blacklisted: client.spam_score >= 3
            })
            .eq('id', client.id);

        if (client.spam_score >= 3) {
            logger.warn(`⚠️ Client blacklisted: ${client.email}`);
        }
    }
}

module.exports = new InboxMonitor();