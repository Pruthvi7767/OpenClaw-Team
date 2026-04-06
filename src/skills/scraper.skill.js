const scraperService = require('../services/scraper');
const apiRouter = require('../services/api-router');

module.exports = {
    async execute(input) {
        // Wrap the raw service logic, pushing through APIRouter if needed
        // Assuming input is a URL or search term object
        const urlToScrape = input.url || input;
        
        // Pass through the apiRouter to ensure failure catching and load balancing
        return await apiRouter.routeRequest('scraper', async () => {
            return await scraperService.scrapeWebsite(urlToScrape);
        });
    }
};
