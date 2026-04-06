const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        // Console output
        const emoji = {
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            debug: '🔍'
        };

        console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`, meta);

        // File output
        const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    }

    info(message, meta) {
        this.log('info', message, meta);
    }

    warn(message, meta) {
        this.log('warn', message, meta);
    }

    error(message, meta) {
        this.log('error', message, meta);
    }

    debug(message, meta) {
        this.log('debug', message, meta);
    }
}

module.exports = new Logger();
