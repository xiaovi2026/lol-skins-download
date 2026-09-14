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
const SKINS_FILE_CACHE_DIR = path.join(CACHE_DIR, 'skins');

// 确保缓存目录存在
fs.mkdirSync(ICONS_CACHE_DIR, { recursive: true });
fs.mkdirSync(SKINS_IMAGE_CACHE_DIR, { recursive: true });
fs.mkdirSync(SKINS_FILE_CACHE_DIR, { recursive: true });

class ProxyService {
  /**
   * 代理并缓存英雄头像 (带 ddragonVersion 版本号隔离，版本升级自动失效)
   */
  async getChampionIcon(champKey) {
    const champ = catalogService.getChampionByKey(champKey);
    if (!champ) {
      throw new Error(`未找到英雄 #${champKey}`);
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
    const champ = catalogService.getChampionByKey(champKey);
    if (!champ) {
      throw new Error(`未找到英雄 #${champKey}`);
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

  /**
   * 代理并下载皮肤 .fantome / .zip 文件 (带 Git Blob SHA 变更精准感知与自动重拉)
   */
  async getSkinFile(repoPath) {
    // 安全校验：禁止跨目录路径穿越
    if (!repoPath || typeof repoPath !== 'string') {
      throw new Error('缺少文件路径参数');
    }
    const cleanPath = path.normalize(repoPath).replace(/^(\.\.[\/\\])+/, '');
    if (!cleanPath.startsWith('skins') && !cleanPath.startsWith('classic')) {
      throw new Error('非法的文件路径');
    }

    const localFilePath = path.join(SKINS_FILE_CACHE_DIR, cleanPath);
    const filename = path.basename(cleanPath);
    const standardPath = cleanPath.replace(/\\/g, '/');

    // 获取 catalog 记录的远端预期 SHA 与文件体积
    const fileMeta = catalogService.getFileMeta(standardPath);
    const expectedSha = fileMeta?.sha;

    if (fs.existsSync(localFilePath)) {
      const stat = fs.statSync(localFilePath);

      // 如果有远端预期 SHA，通过 Git Blob 算法比对本地文件
      if (expectedSha) {
        try {
          const buf = fs.readFileSync(localFilePath);
          // Git Blob SHA 格式: sha1("blob " + size + "\0" + content)
          const localSha = crypto
            .createHash('sha1')
            .update(Buffer.from(`blob ${buf.length}\0`))
            .update(buf)
            .digest('hex');

          if (localSha === expectedSha) {
            // SHA 完全一致，本地缓存未过时，直接返回
            return {
              stream: fs.createReadStream(localFilePath),
              filename,
              size: stat.size,
              cached: true
            };
          } else {
            console.log(`🔄 [ProxyService] 检测到文件在源仓库有更新 (本地SHA: ${localSha.slice(0, 7)} != 远端SHA: ${expectedSha.slice(0, 7)})，清理旧缓存并重新拉取: ${cleanPath}`);
            try {
              fs.unlinkSync(localFilePath);
            } catch (e) {}
          }
        } catch (err) {
          console.warn(`⚠️ [ProxyService] 校验文件 SHA 失败: ${err.message}`);
        }
      } else {
        // 无远端 SHA 记录时，复用现有本地缓存
        return {
          stream: fs.createReadStream(localFilePath),
          filename,
          size: stat.size,
          cached: true
        };
      }
    }

    // 从 GitHub Alban1911/LeagueSkins 下载最新文件
    const rawUrl = `https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/${standardPath}`;
    console.log(`📥 [ProxyService] 正在从 GitHub 拉取最新皮肤文件: ${rawUrl}`);

    const res = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Fastify-LOL-Skins-Proxy'
      }
    });

    if (!res.ok) {
      throw new Error(`从源仓库下载皮肤文件失败: HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // 写入本地持久化缓存
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    fs.writeFileSync(localFilePath, buffer);

    console.log(`💾 [ProxyService] 文件已持久化到磁盘: ${localFilePath} (${buffer.length} bytes)`);

    return {
      stream: fs.createReadStream(localFilePath),
      filename,
      size: buffer.length,
      cached: false
    };
  }
}

export const proxyService = new ProxyService();
