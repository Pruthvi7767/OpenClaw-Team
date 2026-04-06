const supabase = require('../services/supabase');
const logger = require('../utils/logger');
const workerPool = require('./worker-pool');

class OrdersSystem {
    constructor() {
        this.consecutiveVipCount = 0;

        // 📅 DAILY JOB SCHEDULER (Processes Queued Orders)
        // Runs every 10 minutes to check for scheduled/retrying orders
        setInterval(() => {
            this.processScheduledOrders();
        }, 1000 * 60 * 10);
    }

    async processScheduledOrders() {
        const today = new Date().toISOString().split('T')[0];
        logger.info(`🔄 Running DB scheduler... Check date: ${today}`);
        
        const pendingOrders = await supabase.getScheduledOrdersToday();

        if (pendingOrders.length > 0) {
            logger.info(`📦 Discovered ${pendingOrders.length} pending/retrying orders to process.`);
            
            const ceo = require('./ceo');

            while (pendingOrders.length > 0) {
                let orderIndex = 0;

                // ⚖️ FAIRNESS LOGIC: 3 VIPs : 1 Normal
                if (this.consecutiveVipCount >= 3) {
                    const firstNormalIndex = pendingOrders.findIndex(o => (o.priority || 0) < 10);
                    if (firstNormalIndex !== -1) {
                        logger.info('⚖️ Fairness: Normal order priority skip (Anti-Starvation).');
                        orderIndex = firstNormalIndex;
                        this.consecutiveVipCount = 0;
                    }
                }

                const order = pendingOrders.splice(orderIndex, 1)[0];
                
                // Update tracker
                if ((order.priority || 0) >= 10) {
                    this.consecutiveVipCount++;
                } else {
                    this.consecutiveVipCount = 0;
                }

                // 🚀 PARALLEL DISPATCH VIA WORKER POOL
                workerPool.execute(order.id, async () => {
                    logger.info(`▶️ Worker starting order ${order.id} [Priority: ${order.priority || 0}]`);
                    
                    order.status = 'processing';
                    await supabase.upsertOrder(order);
                    
                    await ceo.runCycle(order.service_name, order.id);
                    
                    // Cleanup status if not already terminal
                    const { data: latest } = await supabase.client.from('orders').select('status').eq('id', order.id).single();
                    if (latest && latest.status === 'processing') {
                        await this.updateOrderStatus(order.id, 'completed');
                    }
                });
            }
        }
    }

    async handleTaskFailure(orderId, error) {
        logger.warn(`⚠️ OrdersSystem: Task failure reported for order ${orderId}. Evaluating retry...`);

        const { data: order } = await supabase.client
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) return;

        const currentRetries = order.retry_count || 0;
        const maxRetries = 3;

        if (currentRetries < maxRetries) {
            const nextRetryCount = currentRetries + 1;
            const delayMinutes = 5 * nextRetryCount;
            const retryAt = new Date(Date.now() + delayMinutes * 60000).toISOString();

            logger.info(`🔄 Order ${orderId}: Scheduling retry #${nextRetryCount} at ${retryAt}`);
            await supabase.updateRetryInfo(orderId, nextRetryCount, error, retryAt);
        } else {
            logger.error(`🚨 Order ${orderId}: All retries exhausted. Marking as FAILED.`);
            await this.updateOrderStatus(orderId, 'failed');
            await supabase.client.from('orders').update({ last_error: error }).eq('id', orderId);

            const systemDoctor = require('./system-doctor');
            await systemDoctor.reportIssue('ORDER_CRITICAL_FAILURE', 'OrdersSystem', 'pipeline', `Order ${orderId} failed after 3 retries: ${error}`);
        }
    }

    async createOrder(client_email, service_name) {
        const today = new Date().toISOString().split('T')[0];
        const todaysOrder = await supabase.getClientTodaysOrder(client_email);
        
        let scheduledDate = today;
        let initialStatus = 'pending';

        if (todaysOrder) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            scheduledDate = tomorrow.toISOString().split('T')[0];
            initialStatus = 'scheduled';
        }

        // 🔝 VIP CHECK
        const { data: client } = await supabase.client.from('clients').select('is_vip').eq('email', client_email).maybeSingle();
        const priority = client?.is_vip ? 10 : 0;

        const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const order = {
            id: orderId,
            client_email,
            service_name,
            status: initialStatus,
            scheduled_date: scheduledDate,
            created_at: new Date().toISOString(),
            retry_count: 0,
            priority
        };

        await supabase.upsertOrder(order);
        logger.info(`📦 Order created: ${orderId} [Priority: ${priority}]`);
        return order;
    }

    async updateOrderStatus(order_id, status) {
        logger.info(`🔄 Order ${order_id} -> ${status}`);
        const { error } = await supabase.client
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', order_id);
        
        if (status === 'completed' || status === 'failed') {
            const metrics = require('./metrics');
        }

        return !error;
    }
}

module.exports = new OrdersSystem();
