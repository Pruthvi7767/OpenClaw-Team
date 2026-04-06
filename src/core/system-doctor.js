const logger = require('../utils/logger');
let sora = null; // require dynamically inside to avoid circular dependencies if any

class SystemDoctor {
    constructor() {
        this.errorLogs = [];
        this.recentAlerts = new Map();
    }

    _getSora() {
        if (!sora) sora = require('../sora/bot');
        return sora;
    }

    async reportIssue(type, component, modelOrApi, reason, fallbackUsed = null) {
        const errorHash = `${type}_${component}_${modelOrApi}`;
        
        // Rate matching / Aggregation strategy
        const now = Date.now();
        const lastAlert = this.recentAlerts.get(errorHash);

        // Record the error
        this.errorLogs.push({
            type, component, modelOrApi, reason, fallbackUsed, timestamp: now
        });
        
        logger.error(`🩺 System Doctor [${type}] in ${component}: ${reason} | Fallback: ${fallbackUsed}`);

        // Only alert if we haven't alerted in the last 15 minutes for this exact component
        if (lastAlert && (now - lastAlert) < 900000) {
            logger.debug(`🩺 System Doctor: Suppressing spam alert for ${errorHash}`);
            return;
        }

        this.recentAlerts.set(errorHash, now);

        // Send to Sora
        try {
            const bot = this._getSora();
            if (bot) {
                await bot.sendAlert({
                    type, component, modelOrApi, fallbackUsed
                });
            }
        } catch(e) {
            logger.error('System Doctor failed to contact Sora', e);
        }
        
        // Push to real-time WebSockets
        try {
            const wsAdapter = require('./ws-adapter');
            wsAdapter.emitErrorEvent({ type, component, modelOrApi, reason, fallbackUsed, timestamp: now });
        } catch(e) {
            // silent fail on ws load
        }
    }

    getLogs() {
        return this.errorLogs;
    }
}

module.exports = new SystemDoctor();
