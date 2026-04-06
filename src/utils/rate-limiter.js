const logger = require('./logger');

class RateLimiter {
    constructor() {
        this.emailHistory = [];
        this.apiCooldowns = new Map(); // serviceName -> lastTimestamp
        this.emailHourlyLimit = 50;
        this.emailWindowMs = 60 * 60 * 1000; // 1 hour
    }

    async wait(type, serviceName = 'generic') {
        if (type === 'email') {
            await this.handleEmailLimit();
            await this.handleEmailStagger();
        } else if (type === 'api') {
            await this.handleAPICooldown(serviceName);
        }
    }

    async handleEmailLimit() {
        const now = Date.now();
        // Remove emails older than 1 hour
        this.emailHistory = this.emailHistory.filter(ts => now - ts < this.emailWindowMs);

        if (this.emailHistory.length >= this.emailHourlyLimit) {
            const oldest = this.emailHistory[0];
            const waitTime = this.emailWindowMs - (now - oldest);
            logger.warn(`⏳ RateLimiter: Email hourly limit reached. Waiting for ${Math.ceil(waitTime / 60000)} minutes.`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.handleEmailLimit(); // Re-check after waiting
        }

        this.emailHistory.push(now);
    }

    async handleEmailStagger() {
        // Random 10-20 sec delay between emails (Anti-Spam)
        const delay = Math.floor(Math.random() * (20000 - 10000 + 1) + 10000);
        logger.info(`✨ RateLimiter: Staggering email dispatch. Delay: ${delay / 1000}s`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async handleAPICooldown(serviceName) {
        const now = Date.now();
        const lastTs = this.apiCooldowns.get(serviceName) || 0;
        const cooldown = 1000; // Default 1 sec cooldown for APIs

        if (now - lastTs < cooldown) {
            const waitTime = cooldown - (now - lastTs);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.apiCooldowns.set(serviceName, Date.now());
    }
}

module.exports = new RateLimiter();
