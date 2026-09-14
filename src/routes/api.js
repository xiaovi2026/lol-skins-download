import { catalogService } from '../services/catalogService.js';
import { proxyService } from '../services/proxyService.js';
import { autoUpdater } from '../services/autoUpdater.js';
import { toolService } from '../services/toolService.js';

export default async function apiRoutes(fastify, options) {
  // 1. 获取基本信息与北京时间更新时间
  fastify.get('/info', async (request, reply) => {
    return catalogService.getInfo(autoUpdater.getStatus());
  });

  // 2. 搜索或获取英雄列表 (用于输入框下拉联想)
  fastify.get('/champions', async (request, reply) => {
    const { q } = request.query || {};
    const results = catalogService.searchChampions(q);
    return {
      total: results.length,
      champions: results
    };
  });

  // 3. 获取指定英雄的全部皮肤及下载链接
  fastify.get('/champions/:key', async (request, reply) => {
    const { key } = request.params;
    const champ = catalogService.getChampionByKey(key);
    if (!champ) {
      reply.status(404);
      return { error: `未找到英雄编号为 ${key} 的数据` };
    }
    return champ;
  });

  // 4. 皮肤文件代理下载
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
      reply.status(500);
      return { error: err.message || '文件下载失败' };
    }
  });

  // 5. 代理英雄头像
  fastify.get('/proxy/champion-icon/:key', async (request, reply) => {
    const { key } = request.params;
    try {
      const icon = await proxyService.getChampionIcon(key);
      reply.header('Content-Type', icon.contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(icon.stream);
    } catch (err) {
      reply.status(404);
      return { error: err.message };
    }
  });

  // 6. 代理皮肤预览立绘
  fastify.get('/proxy/skin-image/:key/:skinId', async (request, reply) => {
    const { key, skinId } = request.params;
    try {
      const img = await proxyService.getSkinImage(key, skinId);
      reply.header('Content-Type', img.contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(img.stream);
    } catch (err) {
      reply.status(404);
      return { error: err.message };
    }
  });
  fastify.get('/tools/ltk-manager', async (request, reply) => {
    try {
      const release = await toolService.getLatestRelease();
      return release;
    } catch (err) {
      reply.status(500);
      return { error: err.message || '获取 LTK Manager 版本失败' };
    }
  });

  // 8. 代理下载 LTK Manager 安装包/资产文件
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
      reply.status(500);
      return { error: err.message || '下载 LTK Manager 失败' };
    }
  });
}
