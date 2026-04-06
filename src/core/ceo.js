const dailyCycle = require('../workflows/daily-cycle');
const supabase = require('../services/supabase');
const sora = require('../sora/bot');
const wsAdapter = require('./ws-adapter');
const logger = require('../utils/logger');
const llm = require('../services/llm'); // 🔥 added

class CEO {
    constructor() {
        this.isRunning = false;
        this.cycleInterval = null;
    }

    async initialize() {
        logger.info('🎯 CEO: Checking system state...');
        
        const state = await this.getSystemState();
        
        if (state.status === 'RUNNING' || process.env.AUTO_START === 'true') {
            await this.start();
        } else {
            logger.info('⏸️ CEO: Standby mode');
            await sora.sendMessage('System ready. Send /start to begin operations.');
        }
    }

    async start() {
        if (this.isRunning) return;

        this.isRunning = true;
        
        await supabase.upsertSystemState({
            status: 'RUNNING',
            last_started_at: new Date().toISOString()
        });

        logger.info('✅ CEO: Started');
        wsAdapter.emitLogEvent({ message: 'CEO: System Started', level: 'info' });
        await sora.sendMessage('🚀 *System STARTED*\n\nCEO managing operations.');

        this.runCycle();
        this.cycleInterval = setInterval(() => this.runCycle(), 6 * 60 * 60 * 1000);
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval);
            this.cycleInterval = null;
        }

        await supabase.upsertSystemState({
            status: 'STOPPED',
            last_stopped_at: new Date().toISOString()
        });

        logger.info('🛑 CEO: Stopped');
        wsAdapter.emitLogEvent({ message: 'CEO: System Stopped', level: 'warn' });
        await sora.sendMessage('🛑 *System STOPPED*');
    }

    // =============================
    // 🔄 MAIN CYCLE
    // =============================
    async runCycle(serviceName = 'default_service') {
        if (!this.isRunning) return;

        // EXECUTION GUARD
        const serviceRegistry = require('./service-registry');
        const status = serviceRegistry.checkServiceStatus(serviceName);
        // By default, if the registry doesn't know it, we allow backward compatibility.
        // But if it definitively exists and isn't running, we halt.
        if (status !== 'not_found' && status !== 'running') {
            logger.warn(`🛑 CEO: Service ${serviceName} is not running. Execution halted.`);
            return;
        }

        logger.info(`🔄 CEO: Running cycle for ${serviceName}`);
        wsAdapter.emitLogEvent({ message: `CEO cycle triggered for ${serviceName}`, level: 'info' });

        try {
            const results = await dailyCycle.execute();

            await this.sendDailySummary(results);

            // 🔥 SELF IMPROVEMENT ADDED
            await this.selfImprove(results);

        } catch (error) {
            logger.error('❌ Cycle failed', error);
            await sora.sendMessage(`⚠️ Error: ${error.message}`);
        }
    }

    // =============================
    // 🔥 SELF IMPROVEMENT SYSTEM
    // =============================
    async selfImprove(results) {
        try {

            const currentTemplate = await supabase.getBestEmailTemplate();

            const prompt = `
You are optimizing cold emails.

Current email:
Subject: ${currentTemplate?.subject || ''}
Body:
${currentTemplate?.body || ''}

Performance:
Emails sent: ${results.emails_sent}
Replies: ${results.replies_received}

Goal:
Improve reply rate.

Return JSON:
{
  "subject": "",
  "body": ""
}
`;

            const response = await llm.generate(prompt);

            let newTemplate;

            try {
                newTemplate = JSON.parse(response);
            } catch {
                logger.warn('Invalid AI response for template');
                return;
            }

            await supabase.saveEmailTemplate({
                subject: newTemplate.subject,
                body: newTemplate.body,
                performance_score: results.replies_received
            });

            await sora.sendMessage(`📈 CEO improved email strategy`);

        } catch (err) {
            logger.error('Self improve error:', err);
        }
    }

    // =============================
    // 📊 SUMMARY
    // =============================
    async sendDailySummary(results) {
        const summary = `
📊 *Daily Report*

🎯 Leads: ${results.leads_generated}
📧 Emails: ${results.emails_sent}
💬 Replies: ${results.replies_received}
💰 Payments: ${results.payments_detected}
📄 Reports: ${results.reports_sent}

⚙️ API: ${results.api_health}
        `.trim();

        await sora.sendMessage(summary);
    }

    // =============================
    // STATUS
    // =============================
    async getSystemState() {
        return await supabase.getSystemState();
    }

    async getSystemStatus() {
        const state = await this.getSystemState();
        const apiCredits = await supabase.getAPICredits();
        
        return {
            status: state.status,
            running: this.isRunning,
            uptime: this.calculateUptime(state),
            api_credits: apiCredits
        };
    }

    calculateUptime(state) {
        if (state.status !== 'RUNNING') return null;
        const start = new Date(state.last_started_at);
        const now = new Date();
        return Math.floor((now - start) / 60000);
    }

    async shutdown() {
        logger.info('CEO shutdown...');
        await this.stop();
    }
}

module.exports = new CEO();