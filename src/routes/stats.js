let cachedScript = null;
let scriptFetchTime = 0;
const SCRIPT_CACHE_MS = 60 * 60 * 1000; // 缓存 1 小时

export default async function statsRoutes(fastify, options) {
  // 1. 代理拉取并缓存 Umami 客户端脚本 (同源第一方路由，彻底绕过各类 AdBlock 广告拦截器)
  fastify.get('/script.js', async (request, reply) => {
    const now = Date.now();
    if (!cachedScript || (now - scriptFetchTime > SCRIPT_CACHE_MS)) {
      try {
        const res = await fetch('https://u.xiaovi.de/script.js', {
          headers: {
            'User-Agent': 'Fastify-LOL-Skins-StatsProxy'
          }
        });
        if (res.ok) {
          cachedScript = await res.text();
          scriptFetchTime = now;
        }
      } catch (err) {
        request.log.warn(`获取远程统计脚本失败: ${err.message}`);
      }
    }

    if (!cachedScript) {
      reply.status(502);
      return '/* 统计脚本暂不可用 */';
    }

    reply.header('Content-Type', 'application/javascript; charset=UTF-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(cachedScript);
  });

  // 2. 代理转发打点数据至 u.xiaovi.de/api/send
  fastify.post('/api/send', async (request, reply) => {
    try {
      const clientIp = request.headers['x-forwarded-for'] || request.ip;
      const userAgent = request.headers['user-agent'] || '';

      const res = await fetch('https://u.xiaovi.de/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'X-Forwarded-For': clientIp
        },
        body: JSON.stringify(request.body)
      });

      const data = await res.text();
      reply.status(res.status);
      reply.header('Content-Type', res.headers.get('content-type') || 'application/json');
      return reply.send(data);
    } catch (err) {
      request.log.warn(`转发统计数据失败: ${err.message}`);
      // 避免客户端因统计失败而产生红字报错
      reply.status(200);
      return { ok: false, error: '统计服务暂不可用' };
    }
  });
}
