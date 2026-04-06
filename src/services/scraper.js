const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const supabase = require('../services/supabase');

class ScraperService {
    constructor() {
        this.apifyKeys = [
            process.env.APIFY_API_KEY_1,
            process.env.APIFY_API_KEY_2
        ];
        this.currentApifyIndex = 0;
        
        this.fallbackAPIs = [
            {
                name: 'scrape_do',
                key: process.env.SCRAPE_DO_API_KEY,
                scrape: this.scrapeDo.bind(this),
                cost: 0.01
            },
            {
                name: 'webscraping_ai',
                key: process.env.WEBSCRAPING_AI_KEY,
                scrape: this.webscrapingAI.bind(this),
                cost: 0.01
            }
        ];
    }

    async scrapeWebsite(url) {
        logger.info(`⛏️  Scraping: ${url}`);

        try {
            return await this.apifyScrape(url);
        } catch (error) {
            logger.warn('Apify failed, trying fallback APIs');

            for (const fallback of this.fallbackAPIs) {
                try {
                    const result = await fallback.scrape(url);
                    
                    await supabase.logUsage({
                        service_name: 'Scraper',
                        api_name: fallback.name,
                        model_name: 'Proxy Scrape',
                        tokens_used: 0,
                        estimated_cost: fallback.cost
                    });

                    return result;
                } catch (err) {
                    logger.warn(`${fallback.name} failed`);
                }
            }

            throw new Error('All scraping methods failed');
        }
    }

    async apifyScrape(url) {
        const apiKey = this.apifyKeys[this.currentApifyIndex];

        const response = await axios.post(
            'https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items',
            {
                startUrls: [{ url }],
                maxPagesPerCrawl: 2,
                pageFunction: `
                    async function pageFunction(context) {
                        const $ = context.jQuery;
                        const emails = [];
                        $('a[href^="mailto:"]').each((i, el) => {
                            const email = $(el).attr('href').replace('mailto:', '');
                            emails.push(email);
                        });
                        const bodyText = $('body').text();
                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const foundEmails = bodyText.match(emailRegex) || [];
                        return {
                            url: context.request.url,
                            title: $('title').text(),
                            emails: [...new Set([...emails, ...foundEmails])],
                            hasContactPage: !!$('a[href*="contact"]').length,
                            hasSocialLinks: !!$('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"]').length,
                            hasCTA: !!$('a.btn, button.cta, a[href*="signup"], a[href*="demo"]').length
                        };
                    }
                `
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        const data = response.data[0] || {};
        this.currentApifyIndex = (this.currentApifyIndex + 1) % this.apifyKeys.length;

        // 💰 LOG USAGE
        await supabase.logUsage({
            service_name: 'Scraper',
            api_name: 'Apify',
            model_name: 'Web Scraper Actor',
            tokens_used: 0,
            estimated_cost: 0.05 // Apify actors usually cost approx $0.05 per small run
        });

        return {
            email: data.emails?.[0] || null,
            hasContactPage: data.hasContactPage || false,
            hasSocialLinks: data.hasSocialLinks || false,
            hasCTA: data.hasCTA || false,
            isOldDesign: false,
            noSSL: !url.startsWith('https')
        };
    }

    async scrapeDo(url) {
        const response = await axios.get('https://api.scrape.do', {
            params: { url, token: process.env.SCRAPE_DO_API_KEY },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        return {
            email: this.extractEmail($),
            hasContactPage: !!$('a[href*="contact"]').length,
            hasSocialLinks: !!$('a[href*="facebook"], a[href*="twitter"]').length,
            hasCTA: !!$('a.btn, button').length,
            isOldDesign: false,
            noSSL: !url.startsWith('https')
        };
    }

    async webscrapingAI(url) {
        const response = await axios.get('https://api.webscraping.ai/html', {
            params: { url, api_key: process.env.WEBSCRAPING_AI_KEY },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        return {
            email: this.extractEmail($),
            hasContactPage: !!$('a[href*="contact"]').length,
            hasSocialLinks: !!$('a[href*="social"]').length,
            hasCTA: !!$('button, .cta').length,
            isOldDesign: false,
            noSSL: !url.startsWith('https')
        };
    }

    extractEmail($) {
        const mailtoLinks = $('a[href^="mailto:"]');
        if (mailtoLinks.length > 0) {
            return mailtoLinks.first().attr('href').replace('mailto:', '').trim();
        }
        const bodyText = $('body').text();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = bodyText.match(emailRegex);
        if (emails && emails.length > 0) {
            const filtered = emails.filter(e => !e.includes('example.com') && !e.includes('test@') && !e.includes('@sentry'));
            return filtered[0] || null;
        }
        return null;
    }
}

module.exports = new ScraperService();
