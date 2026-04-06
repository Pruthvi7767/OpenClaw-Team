const paymentService = require('../services/payment');

module.exports = {
    async execute(input) {
        // input: { action: 'create_link' | 'verify', data: {...} }
        const { action, data } = input;

        if (action === 'create_link') {
            return await paymentService.createPaymentLink(data.client, data.amount);
        } else if (action === 'verify') {
            return await paymentService.verifyPayment(data.payload, data.expectedAmount, data.expectedSenderEmail);
        }

        throw new Error(`Unsupported payment skill action: ${action}`);
    }
};
