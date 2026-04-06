const logger = require('../utils/logger');
const sora = require('../sora/bot');

class TestMode {
    constructor() {
        this.isActive = false;
        this.ownerEmail = process.env.OWNER_EMAIL || 'owner@verixa.ai';
    }

    enable() {
        this.isActive = true;
        logger.warn('🧪 TEST MODE ENABLED - All emails map to owner');
    }

    disable() {
        this.isActive = false;
        logger.warn('🧪 TEST MODE DISABLED - Resuming production flow');
    }

    // Intercept outbound email to route to owner
    interceptEmail(originalEmail) {
        if (!this.isActive) return originalEmail;
        logger.debug(`🧪 TestMode: Redirecting email from ${originalEmail} to ${this.ownerEmail}`);
        return this.ownerEmail;
    }

    // Intercept payment request to generate a mock payment URL
    interceptPayment(amount, client) {
        if (!this.isActive) return null;
        logger.debug(`🧪 TestMode: Generating mock payment for amount: ${amount}`);
        return `https://verixa.ai/test-payment?client=${client.id || 'mock'}&amount=${amount}`;
    }

    // Intercept final delivery
    interceptDelivery(deliveryPayload) {
        if (!this.isActive) return false;
        logger.debug(`🧪 TestMode: Simulating successful delivery to owner`);
        // We simulate success true, meaning we handled it.
        return true; 
    }

    async simulateFullFlow(builderConfig) {
        logger.info('🧪 TestMode: Simulating Full Workflow...');
        // Simulation steps: Lead -> Email -> Reply -> Payment -> Delivery
        
        await new Promise(res => setTimeout(res, 1000));
        logger.info('🧪 Step 1: Lead Generated (Mock)');
        
        await new Promise(res => setTimeout(res, 1000));
        logger.info(`🧪 Step 2: Email Sent to ${this.ownerEmail}`);
        
        await new Promise(res => setTimeout(res, 1000));
        logger.info('🧪 Step 3: Mock Reply Received');
        
        await new Promise(res => setTimeout(res, 1000));
        logger.info('🧪 Step 4: Mock Payment Verified');

        await new Promise(res => setTimeout(res, 1000));
        logger.info('🧪 Step 5: Mock Delivery Sent');

        // Check if config causes failure
        if (builderConfig && builderConfig.forceFail) {
            logger.error('🧪 TestMode Simulation FAILED due to config triggers.');
            return false;
        }

        logger.info('✅ TestMode Simulation PASSED');
        return true;
    }
}

module.exports = new TestMode();
