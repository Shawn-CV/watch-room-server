import { Server as SocketIOServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from './types.js';
export declare class WatchRoomServer {
    private io;
    private rooms;
    private members;
    private socketToRoom;
    private cleanupInterval;
    private authKey;
    constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>, authKey?: string);
    private setupEventHandlers;
    private handleLeaveRoom;
    private deleteRoom;
    private startCleanupTimer;
    private generateRoomId;
    private generateMessageId;
    destroy(): void;
    getStats(): {
        totalRooms: number;
        totalMembers: number;
        rooms: {
            id: string;
            name: string;
            memberCount: number;
            isPublic: boolean;
            hasPassword: boolean;
            createdAt: number;
        }[];
    };
}
//# sourceMappingURL=watch-room-server.d.ts.map