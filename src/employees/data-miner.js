const scraper = require('../services/scraper');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class DataMiner {
    async scrapeNewLeads(limit = 5) {
        logger.info(`⛏️  Data Miner: Scraping ${limit} leads`);

        // Get leads without scraped data
        const { data: leads } = await supabase.client
            .from('clients')
            .select('id, website')
            .is('scraped_data', null)
            .eq('status', 'new')
            .limit(limit);

        if (!leads || leads.length === 0) {
            logger.info('Data Miner: No leads to scrape');
            return 0;
        }

        let scraped = 0;

        for (const lead of leads) {
            try {
                logger.info(`Scraping: ${lead.website}`);

                const data = await scraper.scrapeWebsite(lead.website);

                if (data.email) {
                    await supabase.client
                        .from('clients')
                        .update({
                            email: data.email,
                            scraped_data: data,
                            lead_score: this.calculateScore(data)
                        })
                        .eq('id', lead.id);

                    scraped++;
                } else {
                    // Mark as no email found
                    await supabase.client
                        .from('clients')
                        .update({
                            scraped_data: { error: 'No email found' },
                            status: 'closed'
                        })
                        .eq('id', lead.id);
                }

            } catch (error) {
                logger.error(`Data Miner: Failed to scrape ${lead.website}`, error);
            }
        }

        logger.info(`✅ Data Miner: Scraped ${scraped} leads`);
        return scraped;
    }

    calculateScore(data) {
        let score = 0;

        // Weak signals
        if (data.hasContactPage) score += 1;
        if (data.hasSocialLinks) score += 1;
        if (!data.hasCTA) score += 2;
        if (data.isOldDesign) score += 2;
        if (data.noSSL) score += 1;

        return score;
    }
}

module.exports = new DataMiner();
