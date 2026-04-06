const logger = require('../utils/logger');

class SkillRegistry {
    constructor() {
        this.skills = new Map();
    }

    register(name, skillImplementation) {
        this.skills.set(name, skillImplementation);
        logger.debug(`🔧 Skill Registered: ${name}`);
    }

    getSkill(name) {
        const skill = this.skills.get(name);
        if (!skill) {
            throw new Error(`Skill ${name} not found in registry`);
        }
        return skill;
    }
}

// Global registry instance
const registry = new SkillRegistry();

// Auto-register available skills
registry.register('scraper', require('./scraper.skill'));
registry.register('email', require('./email.skill'));
registry.register('payment', require('./payment.skill'));
registry.register('llm', require('./llm.skill'));
registry.register('lead-processing', require('./lead-processing.skill'));
registry.register('delivery', require('./delivery.skill'));

module.exports = registry;
