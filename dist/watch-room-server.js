export class WatchRoomServer {
    io;
    rooms = new Map();
    members = new Map();
    socketToRoom = new Map();
    cleanupInterval = null;
    authKey;
    constructor(io, authKey) {
        this.io = io;
        this.authKey = authKey || process.env.AUTH_KEY || '';
        this.setupEventHandlers();
        this.startCleanupTimer();
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`[WatchRoom] Client connected: ${socket.id}`);
            const auth = socket.handshake.auth;
            console.log('[WatchRoom] Auth token from handshake:', auth.token);
            console.log('[WatchRoom] Expected AUTH_KEY:', this.authKey);
            if (!auth.token || auth.token !== this.authKey) {
                console.log('[WatchRoom] ❌ Authentication failed, disconnecting client');
                socket.emit('error', 'Unauthorized');
                socket.disconnect(true);
                return;
            }
            console.log('[WatchRoom] ✅ Authentication successful');
            socket.on('room:create', (data, callback) => {
                try {
                    const roomId = this.generateRoomId();
                    const userId = socket.id;
                    const ownerToken = this.generateRoomId();
                    const room = {
                        id: roomId,
                        name: data.name,
                        description: data.description,
                        password: data.password,
                        isPublic: data.isPublic,
                        ownerId: userId,
                        ownerName: data.userName,
                        ownerToken: ownerToken,
                        memberCount: 1,
                        currentState: null,
                        createdAt: Date.now(),
                        lastOwnerHeartbeat: Date.now(),
                    };
                    const member = {
                        id: userId,
                        name: data.userName,
                        isOwner: true,
                        lastHeartbeat: Date.now(),
                    };
                    this.rooms.set(roomId, room);
                    this.members.set(roomId, new Map([[userId, member]]));
                    this.socketToRoom.set(socket.id, {
                        roomId,
                        userId,
                        userName: data.userName,
                        isOwner: true,
                    });
                    socket.join(roomId);
                    console.log(`[WatchRoom] Room created: ${roomId} by ${data.userName}`);
                    callback({ success: true, room });
                }
                catch (error) {
                    console.error('[WatchRoom] Error creating room:', error);
                    callback({ success: false, error: '创建房间失败' });
                }
            });
            socket.on('room:join', (data, callback) => {
                try {
                    const room = this.rooms.get(data.roomId);
                    if (!room) {
                        return callback({ success: false, error: '房间不存在' });
                    }
                    if (room.password && room.password !== data.password) {
                        return callback({ success: false, error: '密码错误' });
                    }
                    const userId = socket.id;
                    const member = {
                        id: userId,
                        name: data.userName,
                        isOwner: false,
                        lastHeartbeat: Date.now(),
                    };
                    const roomMembers = this.members.get(data.roomId);
                    if (roomMembers) {
                        roomMembers.set(userId, member);
                        room.memberCount = roomMembers.size;
                        this.rooms.set(data.roomId, room);
                    }
                    this.socketToRoom.set(socket.id, {
                        roomId: data.roomId,
                        userId,
                        userName: data.userName,
                        isOwner: false,
                    });
                    socket.join(data.roomId);
                    socket.to(data.roomId).emit('room:member-joined', member);
                    console.log(`[WatchRoom] User ${data.userName} joined room ${data.roomId}`);
                    const members = Array.from(roomMembers?.values() || []);
                    callback({ success: true, room, members });
                }
                catch (error) {
                    console.error('[WatchRoom] Error joining room:', error);
                    callback({ success: false, error: '加入房间失败' });
                }
            });
            socket.on('room:leave', () => {
                this.handleLeaveRoom(socket);
            });
            socket.on('room:list', (callback) => {
                const publicRooms = Array.from(this.rooms.values()).filter((room) => room.isPublic);
                callback(publicRooms);
            });
            socket.on('play:update', (state) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo || !roomInfo.isOwner)
                    return;
                const room = this.rooms.get(roomInfo.roomId);
                if (room) {
                    room.currentState = state;
                    this.rooms.set(roomInfo.roomId, room);
                    socket.to(roomInfo.roomId).emit('play:update', state);
                }
            });
            socket.on('play:seek', (currentTime) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                socket.to(roomInfo.roomId).emit('play:seek', currentTime);
            });
            socket.on('play:play', () => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                socket.to(roomInfo.roomId).emit('play:play');
            });
            socket.on('play:pause', () => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                socket.to(roomInfo.roomId).emit('play:pause');
            });
            socket.on('play:change', (state) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo || !roomInfo.isOwner)
                    return;
                const room = this.rooms.get(roomInfo.roomId);
                if (room) {
                    room.currentState = state;
                    this.rooms.set(roomInfo.roomId, room);
                    socket.to(roomInfo.roomId).emit('play:change', state);
                }
            });
            socket.on('live:change', (state) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo || !roomInfo.isOwner)
                    return;
                const room = this.rooms.get(roomInfo.roomId);
                if (room) {
                    room.currentState = state;
                    this.rooms.set(roomInfo.roomId, room);
                    socket.to(roomInfo.roomId).emit('live:change', state);
                }
            });
            socket.on('chat:message', (data) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                const message = {
                    id: this.generateMessageId(),
                    userId: roomInfo.userId,
                    userName: roomInfo.userName,
                    content: data.content,
                    type: data.type,
                    timestamp: Date.now(),
                };
                this.io.to(roomInfo.roomId).emit('chat:message', message);
            });
            socket.on('voice:offer', (data) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                this.io.to(data.targetUserId).emit('voice:offer', {
                    userId: socket.id,
                    offer: data.offer,
                });
            });
            socket.on('voice:answer', (data) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                this.io.to(data.targetUserId).emit('voice:answer', {
                    userId: socket.id,
                    answer: data.answer,
                });
            });
            socket.on('voice:ice', (data) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                this.io.to(data.targetUserId).emit('voice:ice', {
                    userId: socket.id,
                    candidate: data.candidate,
                });
            });
            socket.on('voice:mic-enabled', () => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                socket.to(roomInfo.roomId).emit('voice:mic-enabled', {
                    userId: socket.id,
                });
            });
            socket.on('voice:audio-chunk', (data) => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                socket.to(roomInfo.roomId).emit('voice:audio-chunk', {
                    userId: socket.id,
                    audioData: data.audioData,
                    sampleRate: data.sampleRate,
                });
            });
            socket.on('state:clear', (callback) => {
                console.log('[WatchRoom] Received state:clear from', socket.id);
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo) {
                    console.log('[WatchRoom] No room info found for socket');
                    if (callback)
                        callback({ success: false, error: 'Not in a room' });
                    return;
                }
                if (!roomInfo.isOwner) {
                    console.log('[WatchRoom] User is not owner');
                    if (callback)
                        callback({ success: false, error: 'Not owner' });
                    return;
                }
                const room = this.rooms.get(roomInfo.roomId);
                if (room) {
                    console.log(`[WatchRoom] Clearing room state for ${roomInfo.roomId}`);
                    room.currentState = null;
                    this.rooms.set(roomInfo.roomId, room);
                    socket.to(roomInfo.roomId).emit('state:cleared');
                    if (callback)
                        callback({ success: true });
                }
                else {
                    console.log('[WatchRoom] Room not found');
                    if (callback)
                        callback({ success: false, error: 'Room not found' });
                }
            });
            socket.on('heartbeat', () => {
                const roomInfo = this.socketToRoom.get(socket.id);
                if (!roomInfo)
                    return;
                const roomMembers = this.members.get(roomInfo.roomId);
                const member = roomMembers?.get(roomInfo.userId);
                if (member) {
                    member.lastHeartbeat = Date.now();
                    roomMembers?.set(roomInfo.userId, member);
                }
                if (roomInfo.isOwner) {
                    const room = this.rooms.get(roomInfo.roomId);
                    if (room) {
                        room.lastOwnerHeartbeat = Date.now();
                        this.rooms.set(roomInfo.roomId, room);
                    }
                }
                socket.emit('heartbeat:pong', { timestamp: Date.now() });
            });
            socket.on('disconnect', () => {
                console.log(`[WatchRoom] Client disconnected: ${socket.id}`);
                this.handleLeaveRoom(socket);
            });
        });
    }
    handleLeaveRoom(socket) {
        const roomInfo = this.socketToRoom.get(socket.id);
        if (!roomInfo)
            return;
        const { roomId, userId, isOwner } = roomInfo;
        const roomMembers = this.members.get(roomId);
        if (roomMembers) {
            roomMembers.delete(userId);
            const room = this.rooms.get(roomId);
            if (room) {
                room.memberCount = roomMembers.size;
                this.rooms.set(roomId, room);
            }
            socket.to(roomId).emit('room:member-left', userId);
            if (isOwner) {
                console.log(`[WatchRoom] Owner left room ${roomId}, will auto-delete after 5 minutes`);
            }
            if (roomMembers.size === 0) {
                this.deleteRoom(roomId);
            }
        }
        socket.leave(roomId);
        this.socketToRoom.delete(socket.id);
    }
    deleteRoom(roomId) {
        console.log(`[WatchRoom] Deleting room ${roomId}`);
        this.io.to(roomId).emit('room:deleted');
        this.rooms.delete(roomId);
        this.members.delete(roomId);
    }
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const deleteTimeout = 5 * 60 * 1000;
            const clearStateTimeout = 30 * 1000;
            this.rooms.forEach((room, roomId) => {
                const timeSinceHeartbeat = now - room.lastOwnerHeartbeat;
                if (timeSinceHeartbeat > clearStateTimeout && room.currentState !== null) {
                    console.log(`[WatchRoom] Room ${roomId} owner inactive for 30s, clearing play state`);
                    room.currentState = null;
                    this.rooms.set(roomId, room);
                    this.io.to(roomId).emit('state:cleared');
                }
                if (timeSinceHeartbeat > deleteTimeout) {
                    console.log(`[WatchRoom] Room ${roomId} owner timeout, deleting...`);
                    this.deleteRoom(roomId);
                }
            });
        }, 10000);
    }
    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    generateMessageId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
    getStats() {
        return {
            totalRooms: this.rooms.size,
            totalMembers: Array.from(this.members.values()).reduce((sum, m) => sum + m.size, 0),
            rooms: Array.from(this.rooms.values()).map((room) => ({
                id: room.id,
                name: room.name,
                memberCount: room.memberCount,
                isPublic: room.isPublic,
                hasPassword: !!room.password,
                createdAt: room.createdAt,
            })),
        };
    }
}
//# sourceMappingURL=watch-room-server.js.map