const ceo = require('../core/ceo');
const supabase = require('../services/supabase');
const llm = require('../services/llm');
const personality = require('./personality');
const serviceRegistry = require('../core/service-registry');
const builder = require('../core/builder');
const systemDoctor = require('../core/system-doctor');
const metrics = require('../core/metrics');
const logger = require('../utils/logger');

class Commands {
    async handleStart(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        await bot.sendMessage(personality.getAffirmation());
        await ceo.start();
    }

    async handleStop(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        await bot.sendMessage('Stopping all operations...');
        await ceo.stop();
    }

    async handleStatus(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        const status = await ceo.getSystemStatus();
        
        const message = `
🤖 *System Status*

Status: ${status.status}
Running: ${status.running ? 'Yes' : 'No'}
${status.uptime ? `Uptime: ${status.uptime} minutes` : ''}

💳 *API Credits*
${this.formatAPICredits(status.api_credits)}

Use /report for today's metrics
        `.trim();

        await bot.sendMessage(message);
    }

    async handleReport(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        const today = new Date().toISOString().split('T')[0];
        const report = await supabase.getDailyReport(today);

        if (!report) {
            await bot.sendMessage('No data available yet for today. Check back later!');
            return;
        }

        const message = `
📊 *Today's Report*

🎯 Leads Generated: ${report.leads_generated}
📧 Emails Sent: ${report.emails_sent}
💬 Replies: ${report.replies_received}
💰 Payments: ${report.payments_received}
💵 Revenue: ₹${report.revenue}
        `.trim();

        await bot.sendMessage(message);
    }

    async handleEmployees(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        const logs = await supabase.getRecentEmployeeLogs(10);

        let message = '👥 *Recent Employee Activity*\n\n';
        logs.forEach(log => {
            const emoji = log.status === 'success' ? '✅' : '❌';
            const time = new Date(log.created_at).toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            message += `${emoji} ${log.employee_name} - ${log.action} (${time})\n`;
        });

        await bot.sendMessage(message);
    }

    async handleCredits(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        const credits = await supabase.getAPICredits();

        let message = '💳 *API Credits*\n\n';
        credits.forEach(c => {
            const percentage = Math.round((c.daily_used / c.daily_limit) * 100);
            const bar = this.createProgressBar(percentage);
            message += `*${c.service}*\n${bar} ${percentage}%\n${c.daily_used}/${c.daily_limit} used\n\n`;
        });

        await bot.sendMessage(message);
    }

    async handleServicesList(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;
        const services = serviceRegistry.getAllServices();
        if (services.length === 0) {
            return bot.sendMessage('No services registered yet.');
        }
        let txt = '📦 *Registered Services*\n\n';
        services.forEach(s => {
            txt += `- *${s.name}* [${s.status.toUpperCase()}]\n`;
        });
        await bot.sendMessage(txt);
    }

    async handleHelp(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;

        const helpText = `
🤖 *Available Commands*

System Control:
/start - Start all operations
/stop - Stop all operations
/status - System health check

Service Control (Type in chat):
"START SERVICE: <name>"
"STOP SERVICE: <name>"
"FIX: <issue> for <service_name>"
/services - List all

Reports:
/report - Today's metrics
/employees - Recent activity
/credits - API usage
        `.trim();

        await bot.sendMessage(helpText);
    }

    // 🔥 UPDATED SORA SYSTEM WITH MEMORY USAGE
    async handlePersonalChat(msg, bot) {
        if (!bot.isAuthorized(msg.from.id)) return;
        if (msg.text && msg.text.startsWith('/')) return;

        const text = msg.text;

        // 🧠 Strict Control Mode Intercepts
        if (text.startsWith('START SERVICE:')) {
            const name = text.split('START SERVICE:')[1].trim();
            const res = serviceRegistry.setStatus(name, 'running');
            return bot.sendMessage(msg.chat.id, res ? `✅ Service ${name} started` : `⚠️ Service ${name} not found`);
        }
        
        if (text.startsWith('STOP SERVICE:')) {
            const name = text.split('STOP SERVICE:')[1].trim();
            const res = serviceRegistry.setStatus(name, 'paused');
            return bot.sendMessage(msg.chat.id, res ? `🛑 Service ${name} paused` : `⚠️ Service ${name} not found`);
        }

        if (text.startsWith('RESTART SERVICE:')) {
            const name = text.split('RESTART SERVICE:')[1].trim();
            serviceRegistry.setStatus(name, 'paused'); // Stop first
            const res = serviceRegistry.setStatus(name, 'running');
            return bot.sendMessage(msg.chat.id, res ? `🔄 Service ${name} restarted` : `⚠️ Service ${name} not found`);
        }

        if (text.startsWith('FIX:')) {
            const issueParts = text.split('FIX:')[1].split(' for ');
            const issue = issueParts[0].trim();
            const svcName = issueParts[1] ? issueParts[1].trim() : 'default_service';
            
            await bot.sendMessage(msg.chat.id, `🔧 Auto-Repair initiated for ${svcName}... analyzing logs.`);
            await builder.runAutoRepair(svcName, issue);
            return;
        }

        // 🧠 Intent Detection using Sora Override Model
        async function detectIntent(text) {
            const prompt = `
You are Sora AI.

Message:
"${text}"

Return JSON:

            Return JSON:
            
            SYSTEM_QUERY → { "type": "SYSTEM_QUERY" }
            METRICS_QUERY → { "type": "METRICS_QUERY" }
            COST_QUERY → { "type": "COST_QUERY" }
            CONTROL_COMMAND → { "type": "CONTROL_COMMAND", "action": "", "data": {} }
            PERSONAL_CHAT → { "type": "PERSONAL_CHAT" }
            
            ONLY JSON
            `;

            // Enforce Sora model role
            const res = await llm.chat({ system: 'You are an intent parser.', messages: [{role: 'user', content: prompt}], role: 'sora' });
            try {
                return JSON.parse(res);
            } catch {
                return { type: 'PERSONAL_CHAT' };
            }
        }

        const intent = await detectIntent(text);

        // 🔵 SYSTEM_QUERY
        if (intent.type === 'SYSTEM_QUERY' || text === 'CHECK DOCTOR') {
            const services = serviceRegistry.getAllServices().map(s => `${s.name} [${s.status}]`).join('\n') || 'none';
            const logs = systemDoctor.getLogs();
            const recentErrors = logs.length ? logs.slice(-3).map(l => `[${l.type}] ${l.component}: ${l.reason}`).join('\n') : '0 errors';
            
            // We shouldn't hallucinate. Instead of passing to LLM to talk, we dump actual data.
            const statsDump = `
📊 *SYSTEM STATUS (REAL DATA)*
*Active Services:*
${services}

*System Doctor Health:*
${recentErrors}

*Agent Status:*
Standing by
            `.trim();
            return bot.sendMessage(msg.chat.id, statsDump);
        }

        // 🔵 METRICS_QUERY
        if (intent.type === 'METRICS_QUERY' || text.toLowerCase().includes('how many orders')) {
            const summary = await metrics.getSummary();
            if (!summary) return bot.sendMessage(msg.chat.id, '⚠️ Failed to fetch metrics.');

            const message = `
📊 *SYSTEM PERFORMANCE*

*Orders Overview:*
- Total: ${summary.system.total_orders}
- Completed: ${summary.system.completed_orders}
- Failed: ${summary.system.failed_orders}
- Success Rate: ${summary.system.success_rate}

*Today's Activity:*
- Leads: ${summary.today.leads}
- Emails: ${summary.today.emails}
- Revenue: ₹${summary.today.revenue}

*API Health:*
${summary.api.map(a => `- ${a.service}: ${a.usage}`).join('\n')}
            `.trim();
            return bot.sendMessage(msg.chat.id, message);
        }
        // 🔵 COST_QUERY
        if (intent.type === 'COST_QUERY' || text.toLowerCase().includes('how much cost') || text.toLowerCase().includes('expensive service')) {
            const stats = await supabase.getCostStats();
            if (!stats || stats.length === 0) return bot.sendMessage(msg.chat.id, '🪙 No cost data recorded for today yet.');

            const totalCost = stats.reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
            
            // Find most expensive service
            const serviceCosts = stats.reduce((acc, s) => {
                acc[s.service_name] = (acc[s.service_name] || 0) + (s.estimated_cost || 0);
                return acc;
            }, {});

            const sortedServices = Object.entries(serviceCosts).sort((a, b) => b[1] - a[1]);
            const mostExpensive = sortedServices[0];

            const message = `
💰 *API COST ANALYSIS (TODAY)*

Total Spent: *$${totalCost.toFixed(4)}*
Most Expensive: *${mostExpensive[0]}* ($${mostExpensive[1].toFixed(4)})

*Service Breakdown:*
${sortedServices.map(([svc, cost]) => `- ${svc}: $${cost.toFixed(4)}`).join('\n')}

_All costs are estimated based on token usage and proxy rates._
            `.trim();
            return bot.sendMessage(msg.chat.id, message);
        }
        // 🔵 CONTROL_COMMAND
        if (intent.type === 'CONTROL_COMMAND') {
            if (intent.action === 'start_system') {
                await ceo.start();
                return bot.sendMessage(msg.chat.id, '🚀 System started');
            }

            if (intent.action === 'stop_system') {
                await ceo.stop();
                return bot.sendMessage(msg.chat.id, '🛑 System stopped');
            }

            // ✅ UPDATED WITH MEMORY STRATEGY
            if (intent.action === 'generate_report_admin') {

                const memories = await supabase.getMemory(msg.from.id);
                const strategy = memories?.map(m => m.content).join(' ') || '';

                await ceo.execute({
                    ...intent,
                    strategy
                });

                return bot.sendMessage(msg.chat.id, '✅ Report sent');
            }

            return bot.sendMessage(msg.chat.id, '⚠️ Command not recognized');
        }

        // 🟣 PLAN
        if (intent.type === 'plan') {
            for (const step of intent.steps) {
                await ceo.execute(step);
            }
            return bot.sendMessage(msg.chat.id, '🚀 Plan executed');
        }

        // 🧠 MEMORY STORE
        if (text.toLowerCase().includes('remember')) {
            await supabase.saveMemory({
                user_id: msg.from.id,
                content: text
            });
            return bot.sendMessage(msg.chat.id, '🧠 Noted.');
        }

        // 🟢 NORMAL CHAT WITH MEMORY
        await supabase.saveConversation({
            user_id: msg.from.id,
            message_type: 'personal',
            user_message: text
        });

        const history = await supabase.getConversationHistory(msg.from.id, 5);

        // ✅ MEMORY ADDED HERE
        const memories = await supabase.getMemory(msg.from.id);

        const memoryText = memories && memories.length
            ? memories.map(m => `- ${m.content}`).join('\n')
            : 'No special instructions';

        const response = await llm.chat({
            system: `
You are Sora, an AI business operator.

User instructions:
${memoryText}

You MUST adapt based on these instructions.

Be:
- smart
- direct
- business-focused
`,
            messages: this.formatHistory(history, text)
        });

        await supabase.updateConversation(text, response);

        await bot.sendMessage(response);
    }

    formatAPICredits(credits) {
        return credits.map(c => {
            const percentage = Math.round((c.daily_used / c.daily_limit) * 100);
            return `${c.service}: ${percentage}% (${c.daily_used}/${c.daily_limit})`;
        }).join('\n');
    }

    createProgressBar(percentage) {
        const filled = Math.floor(percentage / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    formatHistory(history, currentMessage) {
        const messages = history.map(h => [
            { role: 'user', content: h.user_message },
            { role: 'assistant', content: h.sora_response }
        ]).flat();

        messages.push({ role: 'user', content: currentMessage });
        return messages;
    }
}

module.exports = new Commands();