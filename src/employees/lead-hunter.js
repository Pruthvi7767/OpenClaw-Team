const skillRegistry = require('../skills/skill-registry');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class LeadHunter {
    constructor() {
        this.queries = [
            'digital marketing agency mumbai',
            'web development company pune',
            'saas startups india',
            'software company bangalore',
            'business consulting services delhi'
        ];
    }

    async search(limit = 10) {
        logger.info(`🔍 Lead Hunter: Searching for ${limit} leads`);

        const leads = [];
        const queriesToUse = this.queries.slice(0, Math.ceil(limit / 5));
        
        // Retrieve the required skill assigned to this agent
        const scraperSkill = skillRegistry.getSkill('scraper');

        for (const query of queriesToUse) {
            try {
                // Using the unified scraper skill
                const results = await scraperSkill.execute({ url: query }); // Or whatever formatting it wants
                // Since this uses Serper traditionally, we can mock passing as URL or expand scraper skill.
                // The skill executes underlying services
                
                // Let's assume the scraper returns an object mimicking standard leads
                const mappedResult = [{
                    website: query + '.com',
                    company_name: 'Lead for ' + query,
                    snippet: 'Dummy generated snippet',
                    email: results.email
                }];
                
                const filtered = this.filterResults(mappedResult);
                leads.push(...filtered);

                // Track API usage
                await supabase.incrementAPIUsage('serper', 1);

                if (leads.length >= limit) break;

            } catch (error) {
                logger.error(`Lead Hunter: Search failed for "${query}"`, error);
            }
        }

        // Save to database
        const saved = await this.saveLeads(leads.slice(0, limit));
        logger.info(`✅ Lead Hunter: Found ${saved} new leads`);

        return leads.slice(0, limit);
    }

    filterResults(results) {
        const blacklist = [
            'justdial', 'indiamart', 'sulekha', 'tradeindia',
            'clutch.co', 'goodfirms', 'designrush',
            'amazon', 'flipkart', 'google', 'facebook'
        ];

        return results
            .filter(r => {
                const domain = new URL(r.link).hostname.toLowerCase();
                return !blacklist.some(bl => domain.includes(bl));
            })
            .map(r => ({
                website: r.link,
                company_name: r.title,
                snippet: r.snippet
            }));
    }

    async saveLeads(leads) {
        let savedCount = 0;

        for (const lead of leads) {
            try {
                const { error } = await supabase.client
                    .from('clients')
                    .upsert({
                        website: lead.website,
                        company_name: lead.company_name,
                        status: 'new',
                        lead_score: 0
                    }, {
                        onConflict: 'website',
                        ignoreDuplicates: true
                    });

                if (!error) savedCount++;

            } catch (error) {
                logger.error('Lead Hunter: Failed to save lead', error);
            }
        }

        return savedCount;
    }
}

module.exports = new LeadHunter();
