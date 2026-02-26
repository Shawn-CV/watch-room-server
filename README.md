# Watch Room Server

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) 外部观影室服务器，提供多人同步观影、实时聊天和语音通话功能。

基于 [tgs9915/watch-room-server](https://github.com/tgs9915/watch-room-server) 改进，修复了 server-only 模式下语音不通的问题并优化了部署性能。

## 功能

- 🎬 多人同步观影（播放/暂停/跳转/切集同步）
- 💬 实时聊天
- 🎙️ 语音通话（WebRTC + Server-Only 中转双模式）
- 🏠 房间管理（创建/加入/密码保护）
- 🔄 心跳检测与自动清理

## 快速部署

### 一键 Docker 部署（推荐）

直接从 GitHub 构建并运行，无需 clone 代码：

```bash
# 构建镜像（从 GitHub 拉取，约 15 秒）
docker build -t watch-room-server https://github.com/Shawn-CV/watch-room-server.git#main

# 运行
docker run -d \
  --name watch-room-server \
  --restart unless-stopped \
  -p 3001:3001 \
  -e AUTH_KEY=your-secret-key \
  -e ALLOWED_ORIGINS=* \
  -e NODE_ENV=production \
  watch-room-server
```

### Docker Compose 部署

```bash
git clone https://github.com/Shawn-CV/watch-room-server.git
cd watch-room-server
cp .env.example .env   # 编辑 .env 设置 AUTH_KEY
docker-compose up -d
```

### 验证部署

```bash
curl http://localhost:3001/health
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
| `NEXT_PUBLIC_VOICE_CHAT_STRATEGY` | `server-only` 或 `webrtc-fallback` |

> **注意**：修改环境变量后需重新部署 Vercel 项目。

### 语音策略说明

| 策略 | 说明 |
|------|------|
| `webrtc-fallback` | WebRTC P2P 直连，失败时回退到服务器中转（默认，推荐） |
| `server-only` | 仅服务器中转（适用于无法 P2P 的网络环境） |

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
- **语音不通**：确认 `NEXT_PUBLIC_VOICE_CHAT_STRATEGY` 设置正确，服务器版本包含音频中转修复
- **AUTH_KEY 不匹配**：确保 MoonTVPlus 的 `WATCH_ROOM_EXTERNAL_SERVER_AUTH` 与服务器 `AUTH_KEY` 完全一致
- **房间自动删除**：房主离线 5 分钟后自动清理，这是正常行为

## 许可证

MIT
