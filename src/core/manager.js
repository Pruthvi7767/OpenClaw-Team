const supabase = require('../services/supabase');
const logger = require('../utils/logger');
const sora = require('../sora/bot');
const wsAdapter = require('./ws-adapter');

class Manager {
    async assignTask(employeeName, task, serviceName = 'default_service', orderId = null) {
        const serviceRegistry = require('./service-registry');
        const status = serviceRegistry.checkServiceStatus(serviceName);
        if (status !== 'not_found' && status !== 'running') {
            logger.warn(`🛑 Manager: Service ${serviceName} is paused. Ignoring task assignment to ${employeeName}`);
            return;
        }

        logger.info(`📋 Manager: Assigning "${task}" to ${employeeName} ${orderId ? `(Order: ${orderId})` : ''}`);
        
        // Push realtime connection 
        wsAdapter.emitTaskUpdate({ employee: employeeName, task, status: 'assigned', orderId });
        wsAdapter.emitAgentUpdate({ employee: employeeName, status: 'busy' });
        
        // Log assignment
        await supabase.logEmployeeActivity({
            employee_name: employeeName,
            action: task,
            status: 'assigned',
            order_id: orderId
        });
    }

    async reportCompletion(employeeName, task, result, orderId = null) {
        logger.info(`✅ Manager: ${employeeName} completed "${task}" ${result.success ? 'successfully' : 'with failure'}`);
        
        wsAdapter.emitTaskUpdate({ employee: employeeName, task, status: result.success ? 'success' : 'failed', orderId });
        wsAdapter.emitAgentUpdate({ employee: employeeName, status: 'idle' });

        await supabase.logEmployeeActivity({
            employee_name: employeeName,
            action: task,
            status: result.success ? 'success' : 'failed',
            details: result,
            order_id: orderId
        });

        // Connect to Orders System for retries if failure occurred
        if (!result.success && orderId) {
            const orders = require('./orders');
            await orders.handleTaskFailure(orderId, result.error || 'Unknown employee error');
        } else if (result.success && orderId) {
            const metrics = require('./metrics');
            // We can track success metric here if needed or let orders.js handle it on final transition
        }
    }

    async checkAPILimits() {
        const credits = await supabase.getAPICredits();
        const warnings = [];

        for (const api of credits) {
            const usage = (api.daily_used / api.daily_limit) * 100;
            
            if (usage >= 90) {
                warnings.push({
                    service: api.service,
                    usage: `${usage.toFixed(0)}%`,
                    status: 'critical'
                });
            } else if (usage >= 70) {
                warnings.push({
                    service: api.service,
                    usage: `${usage.toFixed(0)}%`,
                    status: 'warning'
                });
            }
        }

        if (warnings.length > 0) {
            await this.notifyAPIWarnings(warnings);
        }

        return credits;
    }

    async notifyAPIWarnings(warnings) {
        const critical = warnings.filter(w => w.status === 'critical');
        
        if (critical.length > 0) {
            const message = `⚠️ *API LIMIT WARNING*\n\n` +
                critical.map(w => `${w.service}: ${w.usage} used`).join('\n');
            
            await sora.sendMessage(message);
        }
    }

    async handleAPIExhaustion(service) {
        logger.warn(`Manager: ${service} exhausted, initiating fallback`);
        
        // Switch to backup account or fallback service
        const switched = await supabase.switchAPIAccount(service);
        
        if (switched) {
            await sora.sendMessage(`🔄 Switched ${service} to backup account`);
        } else {
            await sora.sendMessage(`🚨 *CRITICAL*: ${service} fully exhausted! Manual intervention needed.`);
        }
    }

    async getDailyQuota() {
        const limits = {
            emails: parseInt(process.env.DAILY_EMAIL_LIMIT) || 50,
            leads: parseInt(process.env.DAILY_LEAD_LIMIT) || 10,
            scrapes: 5,
            maps: 3
        };

        const used = await supabase.getDailyUsage();

        return {
            emails: { limit: limits.emails, used: used.emails, remaining: limits.emails - used.emails },
            leads: { limit: limits.leads, used: used.leads, remaining: limits.leads - used.leads },
            scrapes: { limit: limits.scrapes, used: used.scrapes, remaining: limits.scrapes - used.scrapes },
            maps: { limit: limits.maps, used: used.maps, remaining: limits.maps - used.maps }
        };
    }
}

module.exports = new Manager();
