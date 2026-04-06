const leadHunter = require('../employees/lead-hunter');
const dataMiner = require('../employees/data-miner');
const emailSpecialist = require('../employees/email-specialist');
const inboxMonitor = require('../employees/inbox-monitor');
const paymentTracker = require('../employees/payment-tracker');
const reportGenerator = require('../employees/report-generator');
const deliveryAgent = require('../employees/delivery-agent');
const manager = require('../core/manager');
const logger = require('../utils/logger');

class LeadPipeline {
    async run(quota) {
        const results = {
            leads_generated: 0,
            emails_sent: 0,
            replies_received: 0,
            payments_detected: 0,
            reports_sent: 0
        };

        try {
            // 1. Generate leads (if quota available)
            if (quota.leads.remaining > 0) {
                await manager.assignTask('Lead Hunter', 'Find new leads');
                const leads = await leadHunter.search(quota.leads.remaining);
                results.leads_generated = leads.length;
                await manager.reportCompletion('Lead Hunter', 'Find new leads', { 
                    success: true, 
                    count: leads.length 
                });
            }

            // 2. Scrape leads without data
            if (quota.scrapes.remaining > 0) {
                await manager.assignTask('Data Miner', 'Scrape new leads');
                const scraped = await dataMiner.scrapeNewLeads(quota.scrapes.remaining);
                await manager.reportCompletion('Data Miner', 'Scrape new leads', { 
                    success: true, 
                    count: scraped 
                });
            }

            // 3. Send outreach emails
            if (quota.emails.remaining > 0) {
                await manager.assignTask('Email Specialist', 'Send outreach');
                const sent = await emailSpecialist.sendOutreach(quota.emails.remaining);
                results.emails_sent = sent;
                await manager.reportCompletion('Email Specialist', 'Send outreach', { 
                    success: true, 
                    count: sent 
                });
            }

            // 4. Check inbox for replies
            await manager.assignTask('Inbox Monitor', 'Check replies');
            const replies = await inboxMonitor.checkReplies();
            results.replies_received = replies.length;
            await manager.reportCompletion('Inbox Monitor', 'Check replies', { 
                success: true, 
                count: replies.length 
            });

            // 5. Detect payments
            await manager.assignTask('Payment Tracker', 'Check payments');
            const payments = await paymentTracker.detectPayments();
            results.payments_detected = payments.length;
            await manager.reportCompletion('Payment Tracker', 'Check payments', { 
                success: true, 
                count: payments.length 
            });

            // 6. Generate reports for paid clients
            if (payments.length > 0) {
                await manager.assignTask('Report Generator', 'Create reports');
                const reports = await reportGenerator.generateForPaid();
                await manager.reportCompletion('Report Generator', 'Create reports', { 
                    success: true, 
                    count: reports.length 
                });

                // 7. Deliver reports
                await manager.assignTask('Delivery Agent', 'Send reports');
                const delivered = await deliveryAgent.sendReports(reports);
                results.reports_sent = delivered;
                await manager.reportCompletion('Delivery Agent', 'Send reports', { 
                    success: true, 
                    count: delivered 
                });
            }

        } catch (error) {
            logger.error('Pipeline error:', error);
        }

        return results;
    }
}

module.exports = new LeadPipeline();
