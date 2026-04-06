const logger = require('../utils/logger');

module.exports = {
    async execute(input) {
        // Assume input is raw scraped leads
        const { leads } = input;
        
        logger.debug('🧠 Processing and filtering raw leads...');
        
        const blacklist = ['justdial', 'indiamart', 'amazon', 'facebook', 'example.com'];
        const processedLeads = leads.filter(lead => {
            if (!lead.email) return false;
            
            const domain = lead.email.split('@')[1];
            if (!domain) return false;

            return !blacklist.some(bl => domain.includes(bl));
        }).map(lead => ({
            ...lead,
            processed: true,
            score: lead.hasContactPage ? 10 : 5
        }));

        logger.info(`✅ Lead-processing skill refined ${processedLeads.length} leads.`);
        return processedLeads;
    }
};
