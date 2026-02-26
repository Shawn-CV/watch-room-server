# 单阶段预编译方案：本地先 npm run build，Docker 只装生产依赖
FROM node:18-alpine

WORKDIR /app

# 只安装生产依赖（无 devDependencies，快且省内存）
COPY package*.json ./
RUN npm ci --omit=dev

# 复制本地预编译的构建产物
COPY dist ./dist

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
