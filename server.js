import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import apiRoutes from './src/routes/api.js';
import statsRoutes from './src/routes/stats.js';
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

// 注册 API 路由与同源统计代理路由
await fastify.register(apiRoutes, { prefix: '/api' });
await fastify.register(statsRoutes, { prefix: '/stats' });

// 解析命令行参数 (--host, --port, --local)
const args = process.argv.slice(2);
let cliHost = null;
let cliPort = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--local') {
    cliHost = '127.0.0.1';
  } else if (arg === '--host' && args[i + 1]) {
    cliHost = args[++i];
  } else if (arg.startsWith('--host=')) {
    cliHost = arg.split('=')[1];
  } else if (arg === '--port' && args[i + 1]) {
    cliPort = args[++i];
  } else if (arg.startsWith('--port=')) {
    cliPort = arg.split('=')[1];
  }
}

// 启动服务：默认仅绑定 127.0.0.1 本地回环地址，禁止局域网未授权访问
const PORT = parseInt(cliPort || process.env.PORT || '3000', 10);
const HOST = cliHost || process.env.HOST || '127.0.0.1';

try {
  await fastify.listen({ port: PORT, host: HOST });
  
  // 启动后台定时自动检查更新 (每 1 小时检查一次)
  autoUpdater.start(60 * 60 * 1000);

  const info = catalogService.getInfo();
  const isLocalOnly = HOST === '127.0.0.1' || HOST === 'localhost';
  console.log(`
======================================================
  ⚔️  英雄联盟皮肤查询与下载 Web 服务已成功启动！
  ----------------------------------------------------
  🌐 访问地址:     http://${HOST}:${PORT} (${isLocalOnly ? '🔒 仅本机 127.0.0.1 访问' : '🌐 局域网可访问'})
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
