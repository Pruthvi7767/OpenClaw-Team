const logger = require('../utils/logger');

class ServiceRegistry {
    constructor() {
        // In-memory store for currently loaded services
        this.services = new Map();
    }

    registerService(serviceName, config) {
        if (this.services.has(serviceName)) {
            logger.warn(`ServiceRegistry: Service ${serviceName} is already registered. Overwriting.`);
        }
        
        this.services.set(serviceName, {
            name: serviceName,
            status: 'paused', // default to paused
            config: config,
            registered_at: new Date().toISOString()
        });
        
        logger.info(`✅ ServiceRegistry: Registered service ${serviceName}`);
    }

    getService(serviceName) {
        return this.services.get(serviceName);
    }

    getAllServices() {
        return Array.from(this.services.values());
    }

    setStatus(serviceName, status) {
        const service = this.services.get(serviceName);
        if (service) {
            service.status = status;
            logger.info(`⚙️ ServiceRegistry: Service ${serviceName} status changed to ${status}`);
            return true;
        }
        return false;
    }

    checkServiceStatus(serviceName) {
        const service = this.services.get(serviceName);
        return service ? service.status : 'not_found';
    }

    deleteService(serviceName) {
        if (this.services.has(serviceName)) {
            this.services.delete(serviceName);
            logger.info(`🗑️ ServiceRegistry: Deleted service ${serviceName}`);
            return true;
        }
        return false;
    }
}

module.exports = new ServiceRegistry();
