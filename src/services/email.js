const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        this.service = process.env.EMAIL_SERVICE || 'gmail';
        this.transporter = null;
        this.gmail = null;
    }

    async initialize() {
        if (this.service === 'gmail') {
            await this.initializeGmail();
        } else if (this.service === 'resend') {
            await this.initializeResend();
        }
    }

    async initializeGmail() {
        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            'https://developers.google.com/oauthplayground'
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        // Get access token
        const accessToken = await oauth2Client.getAccessToken();

        // Create transporter
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.GMAIL_USER,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                accessToken: accessToken.token
            }
        });

        // Initialize Gmail API for reading
        this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        logger.info('✅ Email Service: Gmail initialized');
    }

    async initializeResend() {
        // Simple SMTP for Resend
        this.transporter = nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 465,
            secure: true,
            auth: {
                user: 'resend',
                pass: process.env.RESEND_API_KEY
            }
        });

        logger.info('✅ Email Service: Resend initialized');
    }

    async send({ to, subject, html, attachments = [] }) {
        if (!this.transporter) {
            await this.initialize();
        }

        const mailOptions = {
            from: `VERIXA Team <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html,
            attachments
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`✅ Email sent to ${to}: ${info.messageId}`);
            return info;
        } catch (error) {
            logger.error(`❌ Failed to send email to ${to}`, error);
            throw error;
        }
    }

    async fetchReplies() {
        if (!this.gmail) {
            await this.initialize();
        }

        try {
            // Get messages from last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const timestamp = Math.floor(yesterday.getTime() / 1000);

            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: `is:unread after:${timestamp}`,
                maxResults: 50
            });

            const messages = response.data.messages || [];
            const replies = [];

            for (const message of messages) {
                const msg = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full'
                });

                const headers = msg.data.payload.headers;
                const from = headers.find(h => h.name === 'From')?.value || '';
                const subject = headers.find(h => h.name === 'Subject')?.value || '';

                // Extract email address
                const emailMatch = from.match(/<(.+?)>/) || from.match(/^(.+?)$/);
                const email = emailMatch ? emailMatch[1] : from;

                // Get body
                let body = '';
                if (msg.data.payload.body.data) {
                    body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
                } else if (msg.data.payload.parts) {
                    const textPart = msg.data.payload.parts.find(p => p.mimeType === 'text/plain');
                    if (textPart && textPart.body.data) {
                        body = Buffer.from(textPart.body.data, 'base64').toString();
                    }
                }

                replies.push({
                    from: email.trim(),
                    subject,
                    body,
                    messageId: message.id
                });

                // Mark as read
                await this.gmail.users.modify({
                    userId: 'me',
                    id: message.id,
                    requestBody: {
                        removeLabelIds: ['UNREAD']
                    }
                });
            }

            logger.info(`📬 Fetched ${replies.length} replies`);
            return replies;

        } catch (error) {
            logger.error('Failed to fetch replies', error);
            return [];
        }
    }

    async fetchPaymentNotifications() {
        if (!this.gmail) {
            await this.initialize();
        }

        try {
            // Search for payment notifications
            const queries = [
                'subject:(received credited payment) newer_than:1d',
                'from:(alerts@paytm.com OR alerts@hdfcbank.com OR sbi.co.in) newer_than:1d'
            ];

            const allMessages = [];

            for (const q of queries) {
                const response = await this.gmail.users.messages.list({
                    userId: 'me',
                    q,
                    maxResults: 20
                });

                if (response.data.messages) {
                    allMessages.push(...response.data.messages);
                }
            }

            const notifications = [];

            for (const message of allMessages) {
                const msg = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full'
                });

                // Get body
                let body = '';
                if (msg.data.payload.body.data) {
                    body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
                } else if (msg.data.payload.parts) {
                    const textPart = msg.data.payload.parts.find(p => p.mimeType === 'text/plain');
                    if (textPart && textPart.body.data) {
                        body = Buffer.from(textPart.body.data, 'base64').toString();
                    }
                }

                notifications.push({
                    body,
                    messageId: message.id
                });
            }

            logger.info(`💰 Fetched ${notifications.length} payment notifications`);
            return notifications;

        } catch (error) {
            logger.error('Failed to fetch payment notifications', error);
            return [];
        }
    }
}

module.exports = new EmailService();
