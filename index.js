require('dotenv').config();
const express = require('express');
const ceo = require('./src/core/ceo');
const sora = require('./src/sora/bot');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint (required by Render)
app.post("/validate-token", (req, res) => {
    return res.status(200).json({ valid: true });
});

// Basic API endpoints
app.get('/api/status', async (req, res) => {
    try {
        const status = await ceo.getSystemStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize system
async function initialize() {
    try {
        logger.info('🚀 OpenClaw Team - Starting up...');

        // Start Telegram bot (Sora)
        await sora.initialize();
        logger.info('✅ Sora initialized');

        // Start CEO orchestrator
        await ceo.initialize();
        logger.info('✅ CEO initialized');

        // Start Express server
        const server = app.listen(PORT, () => {
            logger.info(`🌐 Server running on port ${PORT}`);
        });

        // Attach WebSocket
        const wsAdapter = require('./src/core/ws-adapter');
        wsAdapter.initialize(server);

        logger.info('✅ System fully operational');

    } catch (error) {
        logger.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('⏹️  SIGTERM received, shutting down gracefully...');
    await ceo.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('⏹️  SIGINT received, shutting down gracefully...');
    await ceo.shutdown();
    process.exit(0);
});

// Start the application
initialize();
