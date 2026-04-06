const logger = require('../utils/logger');
let systemDoctor = null;

class APIRouter {
    constructor() {
        this.apis = {
            scraper: { current: 'primary', fails: 0 },
            miner: { current: 'primary', fails: 0 }
        };
    }

    _getDoctor() {
        if (!systemDoctor) systemDoctor = require('../core/system-doctor');
        return systemDoctor;
    }

    async routeRequest(targetAPI, executionFunc) {
        let route = this.apis[targetAPI];
        if (!route) {
            route = { current: 'primary', fails: 0 };
            this.apis[targetAPI] = route;
        }

        try {
            logger.debug(`🌐 APIRouter: Routing to ${targetAPI} [${route.current}]`);
            const result = await executionFunc(route.current);
            route.fails = 0; // reset on success
            return result;
        } catch (err) {
            route.fails++;
            logger.warn(`⚠️ APIRouter: Route ${targetAPI} [${route.current}] failed`);

            // Auto switch mechanism
            const fallbackMap = { 'primary': 'backup', 'backup': 'tertiary', 'tertiary': 'primary' };
            const fallback = fallbackMap[route.current];
            
            // Notify Doctor
            this._getDoctor().reportIssue(
                'api_failure',
                `Router(${targetAPI})`,
                route.current,
                err.message || 'API exhaust/failure',
                fallback
            );

            logger.info(`🔄 APIRouter: Auto-switching ${targetAPI} to [${fallback}]`);
            route.current = fallback;
            
            // Re-attempt on fallback
            try {
                return await executionFunc(fallback);
            } catch (fallbackErr) {
                // Return null so the system doesn't crash
                logger.error(`🚨 APIRouter: Fallback ${fallback} also failed for ${targetAPI}`);
                return null; 
            }
        }
    }
}

module.exports = new APIRouter();
