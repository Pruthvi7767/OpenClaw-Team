const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');

class WSAdapter {
    constructor() {
        this.wss = null;
        this.clients = new Set();
    }

    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            logger.info('🔌 Mission Control UI connected via WebSocket');
            this.clients.add(ws);

            ws.on('close', () => {
                logger.debug('🔌 Mission Control UI disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (err) => {
                logger.error('WebSocket Error', err);
            });
        });

        logger.info('✅ WebSocket Adapter initialized');
    }

    emit(event, payload) {
        const message = JSON.stringify({ event, payload, timestamp: Date.now() });
        this.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        });
    }

    // Sugar methods
    emitAgentUpdate(data) { this.emit('agent_update', data); }
    emitTaskUpdate(data) { this.emit('task_update', data); }
    emitLogEvent(data) { this.emit('log_event', data); }
    emitErrorEvent(data) { this.emit('error_event', data); }
}

module.exports = new WSAdapter();
