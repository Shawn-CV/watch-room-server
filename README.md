# Watch Room Server

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) 外部观影室服务器，提供多人同步观影、实时聊天和语音通话功能。

基于 [tgs9915/watch-room-server](https://github.com/tgs9915/watch-room-server) 改进，集成 coturn TURN 服务器实现 WebRTC P2P 语音通话。

## 功能

- 🎬 多人同步观影（播放/暂停/跳转/切集同步）
- 💬 实时聊天
- 🎙️ 语音通话（WebRTC P2P + coturn TURN 中继）
- 🏠 房间管理（创建/加入/密码保护）
- 🔄 心跳检测与自动清理

## 快速部署（Docker Compose）

```bash
git clone https://github.com/Shawn-CV/watch-room-server.git
cd watch-room-server
cp .env.example .env   # 编辑 .env 设置 AUTH_KEY
```

### 配置 coturn TURN 服务器

编辑 `turnserver.conf`，替换以下占位符：

```bash
nano turnserver.conf
```

| 占位符 | 替换为 |
|--------|--------|
| `YOUR_SERVER_IP` | 服务器公网 IP |
| `YOUR_USERNAME` | TURN 认证用户名 |
| `YOUR_PASSWORD` | TURN 认证密码 |

### 启动服务

```bash
docker compose up -d --build
```

这会同时启动 **watch-room-server**（端口 3002）和 **coturn**（端口 3478）。

### 更新部署

```bash
cd /path/to/watch-room-server
git pull origin main
docker compose up -d --build
```

### 验证部署

```bash
curl http://localhost:3002/health
# 返回 {"status":"ok","timestamp":"...","uptime":...}
```

## 配置 MoonTVPlus

在 MoonTVPlus（Vercel）项目设置中添加环境变量：

| 变量 | 值 |
|------|-----|
| `WATCH_ROOM_ENABLED` | `true` |
| `WATCH_ROOM_SERVER_TYPE` | `external` |
| `WATCH_ROOM_EXTERNAL_SERVER_URL` | `wss://your-watch-room-server.com` |
| `WATCH_ROOM_EXTERNAL_SERVER_AUTH` | 与服务器 `AUTH_KEY` 一致 |
| `NEXT_PUBLIC_TURN_URL` | `turn:YOUR_SERVER_IP:3478` |
| `NEXT_PUBLIC_TURN_USERNAME` | 与 `turnserver.conf` 中的用户名一致 |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | 与 `turnserver.conf` 中的密码一致 |

> **注意**：修改环境变量后需重新部署 Vercel 项目。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `AUTH_KEY` | ✅ | - | 认证密钥，需与 MoonTVPlus 一致 |
| `PORT` | ❌ | `3001` | 服务端口 |
| `ALLOWED_ORIGINS` | ❌ | `*` | CORS 允许的域名（逗号分隔） |
| `NODE_ENV` | ❌ | `development` | 运行环境 |

## 本地开发

```bash
npm install
cp .env.example .env   # 编辑 AUTH_KEY
npm run dev             # 开发模式（热重载）
```

生产模式：

```bash
npm run build
npm start
```

## API

| 端点 | 说明 | 认证 |
|------|------|------|
| `GET /health` | 健康检查 | 无 |
| `GET /stats` | 服务器统计 | `Authorization: Bearer AUTH_KEY` |
| `WebSocket /socket.io` | Socket.IO 连接 | `auth.token = AUTH_KEY` |

## 故障排查

- **WebSocket 连接失败**：检查反向代理（Nginx/Cloudflared）是否支持 WebSocket
- **语音不通**：确认 TURN 环境变量已正确配置，`turnserver.conf` 中的 IP 和凭证正确，服务器防火墙已开放 UDP 3478 和 49152-65535 端口
- **AUTH_KEY 不匹配**：确保 MoonTVPlus 的 `WATCH_ROOM_EXTERNAL_SERVER_AUTH` 与服务器 `AUTH_KEY` 完全一致
- **coturn 未启动**：执行 `docker ps` 检查 coturn 容器状态，`docker logs coturn` 查看日志
- **房间自动删除**：房主离线 5 分钟后自动清理，这是正常行为

## 许可证

MIT
