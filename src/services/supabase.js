const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class SupabaseService {
    constructor() {
        this.client = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
    }

    // =============================
    // ORDERS SYSTEM
    // =============================
    async getClientTodaysOrder(clientEmail) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await this.client
            .from('orders')
            .select('*')
            .eq('client_email', clientEmail)
            .eq('scheduled_date', today)
            .limit(1)
            .maybeSingle();
            
        if (error) logger.error('Supabase: getClientTodaysOrder error', error);
        return data;
    }

    async upsertOrder(order) {
        const { error } = await this.client
            .from('orders')
            .upsert(order, { onConflict: 'id' });
            
        if (error) logger.error('Supabase: upsertOrder error', error);
        return !error;
    }

    async getScheduledOrdersToday() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // Fetch both scheduled orders for today AND pending retries whose time has come
        // Prioritize by: priority DESC (VIP first), created_at ASC (Oldest first)
        const { data, error } = await this.client
            .from('orders')
            .select('*')
            .or(`and(status.eq.scheduled,scheduled_date.eq.${today}),and(status.eq.retrying,retry_at.lte.${now})`)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true });
            
        if (error) logger.error('Supabase: getScheduledOrdersToday error', error);
        return data || [];
    }

    async updateRetryInfo(orderId, retryCount, lastError, retryAt) {
        const { error } = await this.client
            .from('orders')
            .update({
                retry_count: retryCount,
                last_error: lastError,
                retry_at: retryAt,
                status: 'retrying'
            })
            .eq('id', orderId);

        if (error) logger.error('Supabase: updateRetryInfo error', error);
        return !error;
    }

    // =============================
    // SYSTEM STATE
    // =============================
    async getSystemState() {
        const { data, error } = await this.client
            .from('system_state')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error('Supabase: Failed to get system state', error);
        }

        return data || { status: 'STOPPED' };
    }

    async upsertSystemState(state) {
        const { error } = await this.client
            .from('system_state')
            .upsert({ id: 1, ...state });

        if (error) {
            logger.error('Supabase: Failed to update system state', error);
        }
    }

    // =============================
    // API CREDITS
    // =============================
    async getAPICredits() {
        const { data } = await this.client
            .from('api_credits')
            .select('*')
            .order('service');

        return data || [];
    }

    async incrementAPIUsage(service, count = 1) {
        const { data: credit } = await this.client
            .from('api_credits')
            .select('*')
            .eq('service', service)
            .maybeSingle();

        if (credit) {
            await this.client
                .from('api_credits')
                .update({
                    daily_used: (credit.daily_used || 0) + count,
                    monthly_used: (credit.monthly_used || 0) + count
                })
                .eq('service', service);
        }
    }

    async switchAPIAccount(service) {
        logger.info(`Switching ${service} to backup account`);
        return true;
    }

    // =============================
    // DAILY USAGE
    // =============================
    async getDailyUsage() {
        const today = new Date().toISOString().split('T')[0];

        const { data } = await this.client
            .from('daily_reports')
            .select('*')
            .eq('report_date', today)
            .maybeSingle();

        return {
            emails: data?.emails_sent || 0,
            leads: data?.leads_generated || 0,
            scrapes: 0,
            maps: 0
        };
    }

    // =============================
    // DAILY REPORTS
    // =============================
    async getDailyReport(date) {
        const { data } = await this.client
            .from('daily_reports')
            .select('*')
            .eq('report_date', date)
            .maybeSingle();

        return data;
    }

    async upsertDailyReport(report) {
        const { error } = await this.client
            .from('daily_reports')
            .upsert(report, { onConflict: 'report_date' });

        if (error) {
            logger.error('Supabase: Failed to save daily report', error);
        }
    }

    // =============================
    // EMPLOYEE LOGS
    // =============================
    async logEmployeeActivity(log) {
        const { error } = await this.client
            .from('employee_logs')
            .insert(log);

        if (error) {
            logger.error('Supabase: Failed to log activity', error);
        }
    }

    async getRecentEmployeeLogs(limit = 10) {
        const { data } = await this.client
            .from('employee_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        return data || [];
    }

    // =============================
    // TELEGRAM CONVERSATIONS
    // =============================
    async saveConversation(conv) {
        const { error } = await this.client
            .from('telegram_conversations')
            .insert(conv);

        if (error) {
            logger.error('Supabase: Failed to save conversation', error);
        }
    }

    async updateConversation(userMessage, response) {
        const { error } = await this.client
            .from('telegram_conversations')
            .update({ sora_response: response })
            .eq('user_message', userMessage)
            .is('sora_response', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            logger.error('Supabase: Failed to update conversation', error);
        }
    }

    async getConversationHistory(userId, limit = 5) {
        const { data } = await this.client
            .from('telegram_conversations')
            .select('user_message, sora_response')
            .eq('user_id', userId)
            .not('sora_response', 'is', null)
            .order('created_at', { ascending: false })
            .limit(limit);

        return data || [];
    }

    // =============================
    // EMAIL TEMPLATE SYSTEM
    // =============================
    async getBestEmailTemplate() {
        const { data, error } = await this.client
            .from('email_templates')
            .select('*')
            .order('performance_score', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error('getBestEmailTemplate error:', error);
            return null;
        }

        return data;
    }

    async saveEmailTemplate(template) {
        const { error } = await this.client
            .from('email_templates')
            .insert(template);

        if (error) {
            logger.error('saveEmailTemplate error:', error);
        }
    }

    // =============================
    // MEMORY SYSTEM
    // =============================
    async getMemory(userId) {
        const { data, error } = await this.client
            .from('memory')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            logger.error('getMemory error:', error);
            return [];
        }

        return data;
    }

    async saveMemory(memory) {
        const { error } = await this.client
            .from('memory')
            .insert(memory);

        if (error) {
            logger.error('saveMemory error:', error);
        }
    }

    // =============================
    // METRICS SYSTEM
    // =============================
    async incrementMetric(key, value = 1) {
        const today = new Date().toISOString().split('T')[0];

        const { data } = await this.client
            .from('daily_metrics')
            .select('*')
            .eq('date', today)
            .maybeSingle();

        if (!data) {
            await this.client.from('daily_metrics').insert({
                date: today,
                [key]: value
            });
        } else {
            await this.client
                .from('daily_metrics')
                .update({
                    [key]: (data[key] || 0) + value
                })
                .eq('date', today);
        }
    }

    // =============================
    // EMAIL RULES SYSTEM (CONTROL)
    // =============================
    async getEmailRules() {
        const { data } = await this.client
            .from('email_rules')
            .select('*')
            .limit(1)
            .maybeSingle();

        return data || {
            rules: 'Keep email under 120 words. Focus on pain. Simple CTA.'
        };
    }

    async saveEmailRules(rules) {
        const { error } = await this.client
            .from('email_rules')
            .upsert({
                id: 1,
                ...rules
            });

        if (error) {
            logger.error('saveEmailRules error:', error);
        }
    }

    // =============================
    // COST & USAGE TRACKING
    // =============================
    async logUsage(usage) {
        // usage: { service_name, api_name, model_name, tokens_used, estimated_cost }
        const { error } = await this.client
            .from('api_usage')
            .insert({
                ...usage,
                created_at: new Date().toISOString()
            });

        if (error) logger.error('Supabase: logUsage error', error);
    }

    async getCostStats() {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await this.client
            .from('api_usage')
            .select('service_name, estimated_cost')
            .gte('created_at', today);

        if (error) {
            logger.error('Supabase: getCostStats error', error);
            return [];
        }

        return data || [];
    }
}

module.exports = new SupabaseService();