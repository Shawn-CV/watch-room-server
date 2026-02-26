import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { WatchRoomServer } from './watch-room-server.js';
dotenv.config();
const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_KEY = (process.env.AUTH_KEY || '').trim().replace(/^["']|["']$/g, '');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
const NODE_ENV = process.env.NODE_ENV || 'development';
if (!AUTH_KEY) {
    console.error('Error: AUTH_KEY environment variable is required');
    process.exit(1);
}
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
}));
app.use(express.json());
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
app.get('/stats', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_KEY}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const stats = watchRoomServer.getStats();
    return res.json(stats);
});
app.get('/', (_req, res) => {
    res.json({
        name: 'Watch Room Server',
        version: '1.0.0',
        description: 'Standalone watch room server for MoonTVPlus',
        endpoints: {
            health: '/health',
            stats: '/stats (requires auth)',
            socket: '/socket.io',
        },
    });
});
const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
});
const watchRoomServer = new WatchRoomServer(io, AUTH_KEY);
httpServer.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🎬 Watch Room Server Started');
    console.log('='.repeat(60));
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    console.log(`Auth Key Length: ${AUTH_KEY.length}`);
    console.log(`Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('='.repeat(60));
    console.log(`Health Check: http://localhost:${PORT}/health`);
    console.log(`Stats: http://localhost:${PORT}/stats`);
    console.log(`Socket.IO: ws://localhost:${PORT}/socket.io`);
    console.log('='.repeat(60));
});
const shutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    watchRoomServer.destroy();
    httpServer.close(() => {
        console.log('[WatchRoom] HTTP server closed');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('[WatchRoom] Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
    console.error('[WatchRoom] Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[WatchRoom] Unhandled Rejection at:', promise, 'reason:', reason);
});
//# sourceMappingURL=index.js.map