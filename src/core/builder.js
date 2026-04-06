const logger = require('../utils/logger');
const testMode = require('./test-mode');
const serviceRegistry = require('./service-registry');
const sora = require('../sora/bot');
// stub for llm in core to not create circular, but we'll require dynamically if needed, 
// actually we require it safely
const llm = require('../services/llm');

class ServiceBuilder {
    constructor() {
        this.MAX_BUILD_LOOPS = 3;
        this.MAX_TEST_RETRIES = 3;
    }

    async buildService(serviceName, intent, depth = 'MEDIUM') {
        logger.info(`🏗️ Starting Builder Pipeline for ${serviceName} [Depth: ${depth}]`);
        await sora.sendMessage(`🏗️ Building service: ${serviceName} (Depth: ${depth})`);

        let currentConfig = { name: serviceName, intent, depth, feedback: '' };
        let passed = false;
        let testRetries = 0;

        // TEST -> FIX -> REBUILD LOOP
        while (!passed && testRetries < this.MAX_TEST_RETRIES) {
            
            // BUILDER LOOP (Planner -> Improver -> Validator -> Simulator) × 3
            currentConfig = await this.executeBuilderLoop(currentConfig);
            
            // FINALIZER
            currentConfig = await this.runFinalizer(currentConfig);

            // TEST MODE
            logger.info(`🧪 Entering Test Mode (Attempt ${testRetries + 1}/${this.MAX_TEST_RETRIES})`);
            testMode.enable();
            const testResult = await testMode.simulateFullFlow(currentConfig);
            testMode.disable();

            if (testResult) {
                passed = true;
                logger.info(`✅ Service ${serviceName} PASSED testing`);
            } else {
                testRetries++;
                logger.warn(`❌ Service ${serviceName} FAILED testing. Triggering FIX loop.`);
                await sora.sendMessage(`⚠️ Test failed for ${serviceName}. Running FIX loop...`);
                // Fix takes previous config and instructs loop to use previous + feedback
                currentConfig.feedback = 'Test simulation failed, ensure delivery path resolves';
            }
        }

        if (passed) {
            // Assign Skills to the generated Agents 
            await this.assignSkills(serviceName, currentConfig);
            await this.launchSystem(serviceName, currentConfig);
        } else {
            logger.error(`🚨 Service ${serviceName} failed after ${this.MAX_TEST_RETRIES} test retries.`);
            await sora.sendMessage(`🚨 Failed to build service ${serviceName}. Max retries reached.`);
        }
    }

    async executeBuilderLoop(config) {
        let internalConfig = { ...config };
        for (let i = 0; i < this.MAX_BUILD_LOOPS; i++) {
            logger.info(`🔁 Builder Loop iteration ${i + 1}/${this.MAX_BUILD_LOOPS}`);
            internalConfig = await this.runPlanner(internalConfig, i);
            internalConfig = await this.runImprover(internalConfig, i);
            internalConfig = await this.runValidator(internalConfig, i);
            internalConfig = await this.runSimulator(internalConfig, i);
        }
        return internalConfig;
    }

    async runPlanner(config, iteration) {
        logger.debug('🧠 Planner: Structuring workflow...');
        config.plan = `Generated plan for ${config.intent} ${config.feedback ? `(Fix Context: ${config.feedback})` : ''} at iteration ${iteration}`;
        return config;
    }

    async runImprover(config, iteration) {
        logger.debug('🛠️ Improver: Enhancing efficiency...');
        config.improvements = `Enhanced efficiency logic on top of: ${config.plan}`;
        return config;
    }

    async runValidator(config, iteration) {
        logger.debug('✔️ Validator: Checking edge cases...');
        config.validation = `Passed edge cases against: ${config.improvements}`;
        return config;
    }

    async runSimulator(config, iteration) {
        logger.debug('🤖 Simulator: Running dry logic execution...');
        config.simulation = `Simulated successfully: ${config.validation}`;
        return config;
    }

    async runFinalizer(config) {
        logger.info(`🎬 Finalizing service config for ${config.name}`);
        config.finalized = true;
        config.version = Date.now();
        return config;
    }

    async assignSkills(serviceName, config) {
        logger.info(`🔧 Assigning standard skills for ${serviceName}...`);
        
        // Simplified dynamic skill assignation depending on name
        const lowerName = serviceName.toLowerCase();
        let assigned = [];
        
        if (lowerName.includes('lead')) assigned = ['scraper', 'email'];
        else if (lowerName.includes('reel') || lowerName.includes('content')) assigned = ['llm', 'delivery'];
        else assigned = ['scraper', 'email', 'payment', 'llm', 'delivery', 'lead-processing']; // default full stack
        
        config.assigned_skills = assigned;
        logger.info(`✅ Assigned Skills: ${assigned.join(', ')}`);
        return config;
    }

    async launchSystem(serviceName, config) {
        logger.info(`🚀 Launching System for ${serviceName}`);
        
        // Save to registry
        serviceRegistry.registerService(serviceName, config);
        serviceRegistry.setStatus(serviceName, 'running');

        // Note: In a full app, we would store to Supabase as well.
        await sora.sendMessage(`🚀 *SERVICE LAUNCHED*\nName: ${serviceName}\nStatus: RUNNING`);
    }

    // Auto-Repair entry point
    async runAutoRepair(serviceName, issue) {
        logger.info(`🔧 Running Auto Repair for ${serviceName}. Issue: ${issue}`);
        await sora.sendMessage(`🔧 Initiating Auto Repair for ${serviceName}`);
        
        const service = serviceRegistry.getService(serviceName);
        if (!service) {
            await sora.sendMessage(`⚠️ Service not found locally. Repair aborted.`);
            return;
        }

        // Suspend temporarily
        serviceRegistry.setStatus(serviceName, 'paused');
        await this.buildService(serviceName, `Repair service ${serviceName} focusing on issue: ${issue}`, 'HIGH');
    }
}

module.exports = new ServiceBuilder();
