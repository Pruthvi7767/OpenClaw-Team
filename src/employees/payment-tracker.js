const skillRegistry = require('../skills/skill-registry');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class PaymentTracker {
    async detectPayments() {
        logger.info('💰 Payment Tracker: Checking for payments');

        const emailSkill = skillRegistry.getSkill('email');
        const paymentEmails = await emailSkill.execute({ action: 'fetch_payments' });
        const detected = [];

        for (const email of paymentEmails) {
            try {
                const amount = this.extractAmount(email.body);

                if (!amount) continue;

                // Find client by unique amount
                const { data: client } = await supabase.client
                    .from('clients')
                    .select('*')
                    .eq('unique_amount', amount)
                    .eq('payment_status', 'payment_pending')
                    .single();

                if (client) {
                    // Mark as paid
                    await supabase.client
                        .from('clients')
                        .update({
                            payment_status: 'paid',
                            payment_detected_at: new Date().toISOString(),
                            status: 'paid'
                        })
                        .eq('id', client.id);

                    detected.push(client);
                    logger.info(`✅ Payment detected: ₹${amount} from ${client.email}`);
                }

            } catch (error) {
                logger.error('Payment Tracker: Failed to process notification', error);
            }
        }

        logger.info(`✅ Payment Tracker: Detected ${detected.length} payments`);
        return detected;
    }

    extractAmount(text) {
        // Pattern 1: "received ₹301"
        let match = text.match(/received\s*₹?\s*(\d+\.?\d*)/i);
        if (match) return parseFloat(match[1]);

        // Pattern 2: "credited with Rs.301"
        match = text.match(/credited\s*with\s*Rs\.?\s*(\d+\.?\d*)/i);
        if (match) return parseFloat(match[1]);

        // Pattern 3: "Payment of ₹301"
        match = text.match(/payment\s*of\s*₹?\s*(\d+\.?\d*)/i);
        if (match) return parseFloat(match[1]);

        // Pattern 4: "Rs 301.00 received"
        match = text.match(/Rs\.?\s*(\d+\.?\d*)\s*received/i);
        if (match) return parseFloat(match[1]);

        return null;
    }
}

module.exports = new PaymentTracker();
