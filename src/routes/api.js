import { catalogService } from '../services/catalogService.js';
import { proxyService } from '../services/proxyService.js';
import { autoUpdater } from '../services/autoUpdater.js';
import { toolService } from '../services/toolService.js';

export default async function apiRoutes(fastify, options) {
  // 1. 获取基本信息与北京时间更新时间
  fastify.get('/info', async (request, reply) => {
    return catalogService.getInfo(autoUpdater.getStatus());
  });

  // 2. 搜索或获取英雄列表 (用于输入框下拉联想，增加查询长度限制防 DoS)
  fastify.get('/champions', async (request, reply) => {
    let { q } = request.query || {};
    if (typeof q === 'string' && q.length > 50) {
      q = q.slice(0, 50);
    }
    const results = catalogService.searchChampions(q);
    return {
      total: results.length,
      champions: results
    };
  });

  // 3. 获取指定英雄的全部皮肤及下载链接 (参数纯数字校验)
  fastify.get('/champions/:key', async (request, reply) => {
    const { key } = request.params;
    if (!/^\d+$/.test(key)) {
      reply.status(400);
      return { error: '英雄编号格式错误' };
    }
    const champ = catalogService.getChampionByKey(key);
    if (!champ) {
      reply.status(404);
      return { error: `未找到英雄编号为 ${key} 的数据` };
    }
    return champ;
  });

  // 4. 皮肤文件代理下载 (严格白名单校验 + 路径安全校验 + 错误脱敏)
  fastify.get('/skins/download', async (request, reply) => {
    const { path: filePath } = request.query;
    if (!filePath) {
      reply.status(400);
      return { error: '缺少 path 参数' };
    }

    try {
      const fileData = await proxyService.getSkinFile(filePath);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.filename)}"`);
      if (fileData.size) {
        reply.header('Content-Length', fileData.size);
      }
      return reply.send(fileData.stream);
    } catch (err) {
      request.log.error(err);
      const status = err.statusCode || 500;
      reply.status(status);
      const safeMsg = status < 500 ? err.message : '皮肤文件下载失败';
      return { error: safeMsg };
    }
  });

  // 5. 代理英雄头像 (参数校验 + 错误脱敏)
  fastify.get('/proxy/champion-icon/:key', async (request, reply) => {
    const { key } = request.params;
    try {
      const icon = await proxyService.getChampionIcon(key);
      reply.header('Content-Type', icon.contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(icon.stream);
    } catch (err) {
      const status = err.statusCode || 404;
      reply.status(status);
      return { error: status < 500 ? err.message : '获取英雄头像失败' };
    }
  });

  // 6. 代理皮肤预览立绘 (参数校验 + 错误脱敏)
  fastify.get('/proxy/skin-image/:key/:skinId', async (request, reply) => {
    const { key, skinId } = request.params;
    try {
      const img = await proxyService.getSkinImage(key, skinId);
      reply.header('Content-Type', img.contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(img.stream);
    } catch (err) {
      const status = err.statusCode || 404;
      reply.status(status);
      return { error: status < 500 ? err.message : '获取皮肤立绘失败' };
    }
  });

  // 7. 获取最新版本 LTK Manager 挂载工具发布信息
  fastify.get('/tools/ltk-manager', async (request, reply) => {
    try {
      const release = await toolService.getLatestRelease();
      return release;
    } catch (err) {
      reply.status(500);
      return { error: '获取 LTK Manager 版本失败' };
    }
  });

  // 8. 代理下载 LTK Manager 安装包/资产文件 (严格资产白名单校验 + 错误脱敏)
  fastify.get('/tools/ltk-manager/download', async (request, reply) => {
    const { filename } = request.query;
    try {
      const asset = await toolService.downloadAsset(filename);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.filename)}"`);
      if (asset.size) {
        reply.header('Content-Length', asset.size);
      }
      return reply.send(asset.stream);
    } catch (err) {
      request.log.error(err);
      const status = err.statusCode || 500;
      reply.status(status);
      const safeMsg = status < 500 ? err.message : '下载 LTK Manager 失败';
      return { error: safeMsg };
    }
  });
}
