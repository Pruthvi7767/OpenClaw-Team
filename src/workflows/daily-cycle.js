const leadPipeline = require('./lead-pipeline');
const supabase = require('../services/supabase');
const manager = require('../core/manager');
const logger = require('../utils/logger');

class DailyCycle {
    async execute() {
        logger.info('🔄 Daily Cycle: Starting...');

        const results = {
            leads_generated: 0,
            emails_sent: 0,
            replies_received: 0,
            payments_detected: 0,
            reports_sent: 0,
            api_health: 'healthy'
        };

        try {
            // Step 1: Check API limits
            const quota = await manager.getDailyQuota();
            logger.info('Quota:', quota);

            // Step 2: Process lead pipeline
            const pipelineResults = await leadPipeline.run(quota);
            Object.assign(results, pipelineResults);

            // Step 3: Save daily report
            await this.saveDailyReport(results);

            logger.info('✅ Daily Cycle: Completed', results);

        } catch (error) {
            logger.error('❌ Daily Cycle: Failed', error);
            results.api_health = 'degraded';
        }

        return results;
    }

    async saveDailyReport(results) {
        const today = new Date().toISOString().split('T')[0];

        await supabase.upsertDailyReport({
            report_date: today,
            ...results,
            created_at: new Date().toISOString()
        });
    }
}

module.exports = new DailyCycle();
