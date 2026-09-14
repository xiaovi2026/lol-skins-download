import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import apiRoutes from './src/routes/api.js';
import { catalogService } from './src/services/catalogService.js';
import { autoUpdater } from './src/services/autoUpdater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const fastify = Fastify({
  logger: true
});

// 允许跨域（方便开发与多端口访问）
await fastify.register(fastifyCors, {
  origin: true
});

// 全局安全响应头
fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// 注册静态文件服务 (自包含的前端页面与样式)
await fastify.register(fastifyStatic, {
  root: PUBLIC_DIR,
  prefix: '/',
  decorateReply: false
});

// 注册 API 路由
await fastify.register(apiRoutes, { prefix: '/api' });

// 启动服务
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  
  // 启动后台定时自动检查更新 (每 1 小时检查一次)
  autoUpdater.start(60 * 60 * 1000);

  const info = catalogService.getInfo();
  console.log(`
======================================================
  ⚔️  英雄联盟皮肤查询与下载 Web 服务已成功启动！
  ----------------------------------------------------
  🌐 本地访问地址: http://localhost:${PORT}
  🌐 局域网访问:   http://127.0.0.1:${PORT}
  🕒 资源更新时间: ${info.lastUpdatedBeijing} (北京时间)
  📊 收录英雄总数: ${info.stats.totalChampions} 位
  🎨 收录皮肤总数: ${info.stats.totalSkins} 款
  📦 下载文件总数: ${info.stats.totalFiles} 个
======================================================
  `);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
