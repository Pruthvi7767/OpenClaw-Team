const logger = require('../utils/logger');

class EmailRotator {
    constructor() {
        this.domains = [
            { id: 'dom_1', name: 'mail.verixa.ai', status: 'active', daily_sent_count: 0, last_sent_at: 0, limit: 50 },
            { id: 'dom_2', name: 'outreach.verixa.com', status: 'active', daily_sent_count: 0, last_sent_at: 0, limit: 50 },
            { id: 'dom_3', name: 'hi.verixa.org', status: 'active', daily_sent_count: 0, last_sent_at: 0, limit: 50 }
        ];
        
        this.cooldownMs = 15 * 60 * 1000; // 15 mins cooldown per domain
    }

    async getDomain() {
        const now = Date.now();
        
        const available = this.domains.filter(d => {
            const isCooledDown = now - d.last_sent_at >= this.cooldownMs;
            const isUnderLimit = d.daily_sent_count < d.limit;
            const isActive = d.status === 'active';
            
            return isActive && isUnderLimit && isCooledDown;
        });

        if (available.length === 0) {
            logger.warn('⚠️ EmailRotator: All domains are exhausted or cooling down.');
            return null;
        }

        // Select least used domain among available
        const selected = available.sort((a, b) => a.daily_sent_count - b.daily_sent_count)[0];
        
        logger.info(`📧 EmailRotator: Selected domain ${selected.name} [Usage: ${selected.daily_sent_count}/${selected.limit}]`);
        return selected;
    }

    async markSent(domainId) {
        const domain = this.domains.find(d => d.id === domainId);
        if (domain) {
            domain.daily_sent_count += 1;
            domain.last_sent_at = Date.now();
            logger.info(`✅ EmailRotator: Marked sent for ${domain.name}. Next usage possible in 15 mins.`);
        }
    }

    async reportIssue(domainId) {
        const domain = this.domains.find(d => d.id === domainId);
        if (domain) {
            domain.status = 'warning';
            logger.error(`🚨 EmailRotator: Domain ${domain.name} flagged for issues. Status: WARNING`);
        }
    }

    resetDailyCounts() {
        this.domains.forEach(d => d.daily_sent_count = 0);
        logger.info('🔄 EmailRotator: Daily counts reset.');
    }
}

module.exports = new EmailRotator();
