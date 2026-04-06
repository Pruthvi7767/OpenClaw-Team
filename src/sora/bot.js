const TelegramBot = require('node-telegram-bot-api');
const personality = require('./personality');
const commands = require('./commands');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

class Sora {
    constructor() {
        this.bot = null;
        this.userId = parseInt(process.env.TELEGRAM_USER_ID);
    }

    async initialize() {
        try {
            this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
            
            // Register all commands
            this.registerCommands();
            
            // Send greeting
            await this.sendMessage(personality.getGreeting());
            
            logger.info('✅ Sora: Telegram bot initialized');
        } catch (error) {
            logger.error('❌ Sora: Failed to initialize', error);
            throw error;
        }
    }

    registerCommands() {
        // System control
        this.bot.onText(/\/start/, msg => commands.handleStart(msg, this));
        this.bot.onText(/\/stop/, msg => commands.handleStop(msg, this));
        this.bot.onText(/\/status/, msg => commands.handleStatus(msg, this));
        
        // Reports
        this.bot.onText(/\/report/, msg => commands.handleReport(msg, this));
        this.bot.onText(/\/employees/, msg => commands.handleEmployees(msg, this));
        this.bot.onText(/\/credits/, msg => commands.handleCredits(msg, this));
        
        // Service Control Commands
        this.bot.onText(/\/services/, msg => commands.handleServicesList(msg, this));
        
        // Help
        this.bot.onText(/\/help/, msg => commands.handleHelp(msg, this));
        
        // Personal chat (catch-all) handles control text like FIX:
        this.bot.on('message', msg => commands.handlePersonalChat(msg, this));
    }

    async sendAlert(alertData) {
        const message = `
⚠️ *SYSTEM ALERT*
Type: ${alertData.type}
Component: ${alertData.component}
Model/API: ${alertData.modelOrApi}
Action: ${alertData.fallbackUsed ? `fallback used (${alertData.fallbackUsed})` : 'none'}
Status: running
        `.trim();

        try {
            await this.bot.sendMessage(this.userId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Sora: Failed to send alert', error);
        }
    }

    async sendMessage(text, options = {}) {
        try {
            await this.bot.sendMessage(this.userId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        } catch (error) {
            logger.error('Sora: Failed to send message', error);
        }
    }

    isAuthorized(userId) {
        return userId === this.userId;
    }
}

module.exports = new Sora();
