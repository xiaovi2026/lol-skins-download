import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatToBeijingTime } from '../../scripts/build-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT_DIR, 'cache', 'tools', 'ltk-manager');

fs.mkdirSync(CACHE_DIR, { recursive: true });

class ToolService {
  constructor() {
    this.cachedRelease = null;
    this.lastFetchTime = 0;
    this.cacheDurationMs = 60 * 60 * 1000; // 缓存 1 小时
  }

  /**
   * 获取 LeagueToolkit/ltk-manager 最新发布版本信息
   */
  async getLatestRelease() {
    const now = Date.now();
    if (this.cachedRelease && (now - this.lastFetchTime < this.cacheDurationMs)) {
      return this.cachedRelease;
    }

    try {
      console.log('📡 [ToolService] 正在获取 LeagueToolkit/ltk-manager 最新 Release 信息...');
      const res = await fetch('https://api.github.com/repos/LeagueToolkit/ltk-manager/releases/latest', {
        headers: {
          'User-Agent': 'Fastify-LOL-Skins-ToolService'
        }
      });

      if (!res.ok) {
        throw new Error(`GitHub API HTTP ${res.status}`);
      }

      const data = await res.json();
      const tag = data.tag_name || 'v1.19.3';
      const version = tag.replace(/^v/, '');
      const publishedAt = data.published_at || new Date().toISOString();
      const publishedAtBeijing = formatToBeijingTime(publishedAt);

      const assets = (data.assets || []).map(a => {
        const directUrl = a.browser_download_url || `https://github.com/LeagueToolkit/ltk-manager/releases/download/${tag}/${a.name}`;
        return {
          name: a.name,
          size: a.size,
          formattedSize: this.formatFileSize(a.size),
          downloadUrl: directUrl,
          browserDownloadUrl: directUrl
        };
      });

      // 默认首选安装包（通常为 Windows x64 setup .exe）
      const primaryAsset = assets.find(a => a.name.endsWith('.exe')) || assets[0] || null;

      this.cachedRelease = {
        repo: 'LeagueToolkit/ltk-manager',
        tag,
        version,
        name: data.name || `LTK Manager ${tag}`,
        body: data.body || '',
        publishedAt,
        publishedAtBeijing,
        primaryAsset,
        assets
      };
      this.lastFetchTime = now;

      // 持久化一份元数据
      fs.writeFileSync(path.join(CACHE_DIR, 'latest_release.json'), JSON.stringify(this.cachedRelease, null, 2), 'utf-8');
      console.log(`✅ [ToolService] 成功获取 LTK Manager 最新版本: ${tag} (${publishedAtBeijing})`);
      return this.cachedRelease;
    } catch (err) {
      console.warn(`⚠️ [ToolService] 获取最新 Release 失败: ${err.message}，尝试从本地缓存读取`);
      const diskMetaFile = path.join(CACHE_DIR, 'latest_release.json');
      if (fs.existsSync(diskMetaFile)) {
        try {
          this.cachedRelease = JSON.parse(fs.readFileSync(diskMetaFile, 'utf-8'));
          return this.cachedRelease;
        } catch (e) {}
      }

      // 兜底静态数据 (GitHub 直连下载)
      const fallbackUrl = 'https://github.com/LeagueToolkit/ltk-manager/releases/download/v1.19.3/LTK.Manager_1.19.3_x64-setup.exe';
      return {
        repo: 'LeagueToolkit/ltk-manager',
        tag: 'v1.19.3',
        version: '1.19.3',
        name: 'LTK Manager v1.19.3',
        publishedAtBeijing: '2026-09-14 03:56:29',
        primaryAsset: {
          name: 'LTK.Manager_1.19.3_x64-setup.exe',
          size: 15383016,
          formattedSize: '14.7 MB',
          downloadUrl: fallbackUrl,
          browserDownloadUrl: fallbackUrl
        },
        assets: [
          {
            name: 'LTK.Manager_1.19.3_x64-setup.exe',
            size: 15383016,
            formattedSize: '14.7 MB',
            downloadUrl: fallbackUrl,
            browserDownloadUrl: fallbackUrl
          }
        ]
      };
    }
  }

  formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }
}

export const toolService = new ToolService();
