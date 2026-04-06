const axios = require('axios');
const logger = require('../utils/logger');

class PaymentService {
    constructor() {
        this.razorpayEnabled = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    }

    async createPaymentLink(client, amount) {
        if (!this.razorpayEnabled) {
            logger.warn('Razorpay not configured, using UPI only');
            return null;
        }

        try {
            const response = await axios.post(
                'https://api.razorpay.com/v1/payment_links',
                {
                    amount: amount * 100, // Convert to paise
                    currency: 'INR',
                    description: `Business Report - ${client.company_name}`,
                    customer: {
                        email: client.email,
                        name: client.company_name
                    },
                    notify: {
                        email: true
                    },
                    callback_url: `https://verixa.ai/payment-success?client_id=${client.id}`,
                    callback_method: 'get'
                },
                {
                    auth: {
                        username: process.env.RAZORPAY_KEY_ID,
                        password: process.env.RAZORPAY_KEY_SECRET
                    }
                }
            );

            logger.info(`✅ Payment link created for ${client.email}`);
            return response.data.short_url;

        } catch (error) {
            logger.error('Failed to create payment link', error);
            
            // Call System Doctor safely
            try {
                const systemDoctor = require('../core/system-doctor');
                systemDoctor.reportIssue('payment_failure', 'createPaymentLink', 'Razorpay', error.message || 'Request failed');
            } catch(e) {}

            return null;
        }
    }

    async verifyPayment(paymentPayload, expectedAmount, expectedSenderEmail) {
        logger.info(`💳 Verifying payment: ${paymentPayload.payment_id}`);
        // 1. Check duplicate
        if (this.verifiedPayments && this.verifiedPayments.has(paymentPayload.payment_id)) {
            logger.error('🚨 Duplicate payment detected!');
            try {
                const systemDoctor = require('../core/system-doctor');
                systemDoctor.reportIssue('payment_failure', 'verifyPayment', 'Razorpay', 'Duplicate payment detected');
            } catch(e) {}
            return false;
        }

        // 2. Verify amount
        const payloadAmount = (paymentPayload.amount / 100);
        if (payloadAmount !== expectedAmount) {
            logger.error(`🚨 Amount mismatch: Expected ${expectedAmount}, Got ${payloadAmount}`);
            return false;
        }

        // 3. Verify sender (if available in payload)
        if (paymentPayload.customer_email && paymentPayload.customer_email !== expectedSenderEmail) {
            logger.warn(`⚠️ Sender email mismatch: expected ${expectedSenderEmail}, Got ${paymentPayload.customer_email}`);
            // Could strictly fail or just flag it
        }

        if (!this.verifiedPayments) this.verifiedPayments = new Set();
        this.verifiedPayments.add(paymentPayload.payment_id);
        
        logger.info('✅ Payment verified successfully');
        return true;
    }

    generateUPIString(amount) {
        const upiId = process.env.UPI_ID;
        const name = 'VERIXA';
        
        return `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
    }
}

module.exports = new PaymentService();
