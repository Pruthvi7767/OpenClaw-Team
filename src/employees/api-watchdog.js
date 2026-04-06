const supabase = require('../services/supabase');
const sora = require('../sora/bot');
const logger = require('../utils/logger');

class APIWatchdog {
    async monitor() {
        logger.info('🔍 API Watchdog: Checking all services');

        const credits = await supabase.getAPICredits();
        const alerts = [];

        for (const api of credits) {
            const usage = (api.daily_used / api.daily_limit) * 100;

            if (usage >= 100) {
                alerts.push({
                    service: api.service,
                    level: 'critical',
                    message: `${api.service} EXHAUSTED! Used ${api.daily_used}/${api.daily_limit}`
                });

                // Try to switch account
                await this.attemptSwitch(api.service);

            } else if (usage >= 90) {
                alerts.push({
                    service: api.service,
                    level: 'warning',
                    message: `${api.service} at ${usage.toFixed(0)}%`
                });
            }
        }

        if (alerts.length > 0) {
            await this.sendAlerts(alerts);
        }

        return alerts;
    }

    async attemptSwitch(service) {
        logger.info(`API Watchdog: Attempting to switch ${service}`);

        const switched = await supabase.switchAPIAccount(service);

        if (switched) {
            await sora.sendMessage(`🔄 *API Switch Successful*\n\nSwitched ${service} to backup account.`);
        } else {
            await sora.sendMessage(`🚨 *CRITICAL ALERT*\n\n${service} is fully exhausted with no backup available!`);
        }
    }

    async sendAlerts(alerts) {
        const critical = alerts.filter(a => a.level === 'critical');
        const warnings = alerts.filter(a => a.level === 'warning');

        if (critical.length > 0) {
            const message = '🚨 *CRITICAL API ALERTS*\n\n' +
                critical.map(a => `• ${a.message}`).join('\n');
            await sora.sendMessage(message);
        }

        if (warnings.length > 0) {
            const message = '⚠️ *API Warnings*\n\n' +
                warnings.map(a => `• ${a.message}`).join('\n');
            await sora.sendMessage(message);
        }
    }
}

module.exports = new APIWatchdog();
