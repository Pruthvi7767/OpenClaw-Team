module.exports = {
    MAX_DAILY_EMAILS: 50,
    MAX_DAILY_LEADS: 10,
    MAX_DAILY_SCRAPES: 5,
    
    EMAIL_DELAY_MIN: 15, // seconds
    EMAIL_DELAY_MAX: 45,
    
    LEAD_SCORE_THRESHOLD: 2,
    
    SPAM_SCORE_THRESHOLD: 3,
    
    REPORT_PRICE: 299,
    
    STATUS: {
        NEW: 'new',
        CONTACTED: 'contacted',
        INTERESTED: 'interested',
        PAYMENT_PENDING: 'payment_pending',
        PAID: 'paid',
        REPORT_READY: 'report_ready',
        DELIVERED: 'delivered',
        CLOSED: 'closed'
    }
};
