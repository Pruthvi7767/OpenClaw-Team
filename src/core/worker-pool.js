const logger = require('../utils/logger');

class WorkerPool {
    constructor() {
        this.maxWorkers = parseInt(process.env.MAX_WORKERS) || 5;
        this.activeWorkers = 0;
        this.queue = [];
        this.locks = new Set(); // orderId level locking
    }

    async execute(orderId, taskFn) {
        // Prevent duplicate execution of the same order
        if (this.locks.has(orderId)) {
            logger.warn(`🔒 WorkerPool: Task for order ${orderId} already in progress. Ignoring duplicate request.`);
            return;
        }

        this.locks.add(orderId);

        if (this.activeWorkers >= this.maxWorkers) {
            logger.info(`⏳ WorkerPool: Max workers (${this.maxWorkers}) reached. Queuing task for order ${orderId}.`);
            return new Promise((resolve) => {
                this.queue.push({ orderId, taskFn, resolve });
            });
        }

        return this.runWorker(orderId, taskFn);
    }

    async runWorker(orderId, taskFn, resolve = null) {
        this.activeWorkers++;
        logger.info(`🚀 WorkerPool: Worker started. [Active: ${this.activeWorkers}/${this.maxWorkers}]`);

        try {
            await taskFn();
        } catch (error) {
            logger.error(`❌ WorkerPool: Task failed for order ${orderId}`, error);
        } finally {
            this.activeWorkers--;
            this.locks.delete(orderId);
            logger.info(`✅ WorkerPool: Worker finished. [Active: ${this.activeWorkers}/${this.maxWorkers}]`);

            if (resolve) resolve();

            // Process next task in queue
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                this.runWorker(next.orderId, next.taskFn, next.resolve);
            }
        }
    }
}

module.exports = new WorkerPool();
