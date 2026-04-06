const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class Metrics {
    async getSummary() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dailyReport = await supabase.getDailyReport(today);
            const apiCredits = await supabase.getAPICredits();
            const recentLogs = await supabase.getRecentEmployeeLogs(20);

            const totalOrders = await this.getOrderCount();
            const completedOrders = await this.getOrderCount('completed');
            const failedOrders = await this.getOrderCount('failed');

            const successRate = totalOrders > 0 
                ? ((completedOrders / totalOrders) * 100).toFixed(1) 
                : 0;

            return {
                today: {
                    leads: dailyReport?.leads_generated || 0,
                    emails: dailyReport?.emails_sent || 0,
                    replies: dailyReport?.replies_received || 0,
                    revenue: dailyReport?.revenue || 0
                },
                system: {
                    total_orders: totalOrders,
                    completed_orders: completedOrders,
                    failed_orders: failedOrders,
                    success_rate: `${successRate}%`
                },
                api: apiCredits.map(c => ({
                    service: c.service,
                    usage: `${Math.round((c.daily_used / c.daily_limit) * 100)}%`
                }))
            };
        } catch (error) {
            logger.error('Metrics: Failed to fetch summary', error);
            return null;
        }
    }

    async getOrderCount(status = null) {
        let query = supabase.client
            .from('orders')
            .select('*', { count: 'exact', head: true });
        
        if (status) {
            query = query.eq('status', status);
        }

        const { count, error } = await query;
        if (error) {
            logger.error(`Metrics: getOrderCount error [${status}]`, error);
            return 0;
        }
        return count || 0;
    }
}

module.exports = new Metrics();
