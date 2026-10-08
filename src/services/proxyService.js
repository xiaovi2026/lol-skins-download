import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { catalogService } from './catalogService.js';
import { getLatestDdragonVersion } from './ddragon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT_DIR, 'cache');
const ICONS_CACHE_DIR = path.join(CACHE_DIR, 'images', 'icons');
const SKINS_IMAGE_CACHE_DIR = path.join(CACHE_DIR, 'images', 'skins');

// 确保图片缓存目录存在
fs.mkdirSync(ICONS_CACHE_DIR, { recursive: true });
fs.mkdirSync(SKINS_IMAGE_CACHE_DIR, { recursive: true });

class ProxyService {
  /**
   * 代理并缓存英雄头像 (带 ddragonVersion 版本号隔离，版本升级自动失效)
   */
  async getChampionIcon(champKey) {
    if (!champKey || !/^\d+$/.test(String(champKey))) {
      const err = new Error('英雄编号格式错误');
      err.statusCode = 400;
      throw err;
    }

    const champ = catalogService.getChampionByKey(champKey);
    if (!champ) {
      const err = new Error(`未找到英雄 #${champKey}`);
      err.statusCode = 404;
      throw err;
    }

    const ddragonVersion = await getLatestDdragonVersion();
    // 采用版本号隔离命名：例如 16.18.1_1.png
    const localFile = path.join(ICONS_CACHE_DIR, `${ddragonVersion}_${champKey}.png`);

    if (fs.existsSync(localFile)) {
      return {
        stream: fs.createReadStream(localFile),
        contentType: 'image/png'
      };
    }

    const remoteUrl = champ.avatar || `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.id}.png`;
    console.log(`📥 [ProxyService] 正在从 DataDragon (${ddragonVersion}) 拉取头像: ${champ.name}`);
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      throw new Error(`获取头像失败: HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localFile, buffer);

    return {
      stream: fs.createReadStream(localFile),
      contentType: 'image/png'
    };
  }

  /**
   * 代理并缓存皮肤预览立绘图/加载图
   */
  async getSkinImage(champKey, skinId) {
    if (!/^\d+$/.test(String(champKey)) || !/^\d+$/.test(String(skinId))) {
      const err = new Error('参数格式错误');
      err.statusCode = 400;
      throw err;
    }

    const champ = catalogService.getChampionByKey(champKey);
    if (!champ) {
      const err = new Error(`未找到英雄 #${champKey}`);
      err.statusCode = 404;
      throw err;
    }

    const skin = champ.skins?.find(s => s.id === String(skinId));
    const enId = champ.id;
    const skinNum = skin ? skin.num : (parseInt(skinId) % 1000);

    // 1. 如果该皮肤在 Alban1911/LeagueSkins 仓库中自带 previewPng，优先使用并校验 SHA
    if (skin?.previewPng) {
      const previewFile = path.join(SKINS_IMAGE_CACHE_DIR, `${champKey}_${skinId}_preview.png`);
      const expectedSha = skin.previewSha;

      if (fs.existsSync(previewFile)) {
        if (expectedSha) {
          try {
            const buf = fs.readFileSync(previewFile);
            const localSha = crypto.createHash('sha1').update(Buffer.from('blob ' + buf.length + '\0')).update(buf).digest('hex');
            if (localSha === expectedSha) {
              return { stream: fs.createReadStream(previewFile), contentType: 'image/png' };
            }
          } catch (e) {}
        } else {
          return { stream: fs.createReadStream(previewFile), contentType: 'image/png' };
        }
      }

      const gitRawUrl = `https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/${skin.previewPng}`;
      try {
        const res = await fetch(gitRawUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(previewFile, buf);
          return { stream: fs.createReadStream(previewFile), contentType: 'image/png' };
        }
      } catch (err) {
        console.warn(`无法从 GitHub 获取 previewPng: ${err.message}`);
      }
    }

    // 常规皮肤 loading 原画缓存
    const localFileJpg = path.join(SKINS_IMAGE_CACHE_DIR, `${champKey}_${skinId}.jpg`);
    if (fs.existsSync(localFileJpg)) {
      return {
        stream: fs.createReadStream(localFileJpg),
        contentType: 'image/jpeg'
      };
    }

    // 2. 尝试从 DataDragon 获取 loading 原画图
    const loadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${enId}_${skinNum}.jpg`;
    try {
      const res = await fetch(loadingUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(localFileJpg, buf);
        return { stream: fs.createReadStream(localFileJpg), contentType: 'image/jpeg' };
      }
    } catch (e) {}

    // 3. 如果是炫彩皮肤（404），尝试使用其母皮肤立绘
    if (skin?.parentSkinId) {
      const parentNum = parseInt(skin.parentSkinId) % 1000;
      const parentLoadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${enId}_${parentNum}.jpg`;
      try {
        const res = await fetch(parentLoadingUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(localFileJpg, buf);
          return { stream: fs.createReadStream(localFileJpg), contentType: 'image/jpeg' };
        }
      } catch (e) {}
    }

    // 4. 回退至英雄基础 loading 默认皮肤图
    const defaultUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${enId}_0.jpg`;
    try {
      const res = await fetch(defaultUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(localFileJpg, buf);
        return { stream: fs.createReadStream(localFileJpg), contentType: 'image/jpeg' };
      }
    } catch (e) {}

    // 5. 终极回退：英雄头像
    return this.getChampionIcon(champKey);
  }
}

export const proxyService = new ProxyService();
