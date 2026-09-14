import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCatalog } from '../../scripts/build-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_PATH = path.resolve(__dirname, '..', 'data', 'catalog.json');

class CatalogService {
  constructor() {
    this.catalog = null;
    this.championsIndex = [];
    this.championsMap = new Map();
    this.loadCatalog();
  }

  loadCatalog() {
    try {
      if (fs.existsSync(CATALOG_PATH)) {
        const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
        this.catalog = JSON.parse(raw);
        this.buildIndexes();
        console.log(`✅ [CatalogService] 成功载入数据: ${this.catalog.stats.totalChampions} 位英雄, 最后更新(北京时间): ${this.catalog.lastUpdatedBeijing}`);
      } else {
        console.warn(`⚠️ [CatalogService] catalog.json 不存在，稍后将自动构建`);
      }
    } catch (err) {
      console.error(`❌ [CatalogService] 载入 catalog.json 失败:`, err);
    }
  }

  buildIndexes() {
    if (!this.catalog?.champions) return;
    this.championsMap.clear();

    // 预备给下拉检索列表返回的轻量级英雄摘要列表
    this.championsIndex = this.catalog.champions.map(c => {
      this.championsMap.set(c.key, c);
      return {
        key: c.key,
        id: c.id,
        name: c.name,
        title: c.title,
        fullName: `${c.title} ${c.name}`,
        avatar: c.avatar,
        aliases: c.aliases || [],
        searchTokens: c.searchTokens || [],
        totalSkins: c.totalSkins,
        totalFiles: c.totalFiles
      };
    });
  }

  getInfo() {
    return {
      version: this.catalog?.version || '1.0.0',
      lastUpdatedBeijing: this.catalog?.lastUpdatedBeijing || '2026-09-10 18:31:44',
      commit: this.catalog?.commit || null,
      stats: this.catalog?.stats || {
        totalChampions: this.championsIndex.length,
        totalSkins: 0,
        totalFiles: 0
      }
    };
  }

  searchChampions(query = '') {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return this.championsIndex;
    }

    // 评分机制
    const scored = [];
    for (const c of this.championsIndex) {
      let score = 0;
      const key = c.key;
      const id = c.id.toLowerCase();
      const name = c.name.toLowerCase();
      const title = c.title.toLowerCase();

      // 1. 精确匹配
      if (key === q) score += 120;
      if (name === q) score += 110;
      if (title === q) score += 90;
      if (id === q) score += 90;

      // 2. 英雄名字（如 亚索）前缀与包含
      if (name.startsWith(q)) score += 60;
      else if (name.includes(q)) score += 35;

      // 3. 称号（如 疾风剑豪）前缀与包含
      if (title.startsWith(q)) score += 40;
      else if (title.includes(q)) score += 20;

      // 4. 英文 ID（如 Yasuo）
      if (id.startsWith(q)) score += 50;
      else if (id.includes(q)) score += 20;

      // 5. 别名/俗称精确匹配（如 盲僧）
      for (const alias of c.aliases) {
        const al = alias.toLowerCase();
        if (al === q) score += 100;
        else if (al.startsWith(q)) score += 50;
        else if (al.includes(q)) score += 30;
      }

      // 6. 拼音匹配：区分英雄本名拼音 与 称号拼音（本名权重大于称号）
      for (const token of c.searchTokens) {
        if (token === q) {
          // 精确命中拼音token
          score += 60;
        } else if (token.startsWith(q)) {
          score += 25;
        }
      }

      // 如果是亚索等核心英雄名字的拼音首字母精确匹配，额外加分
      const nameTokens = c.searchTokens.slice(2, 6); // [titleZh, nameZh, titlePinyinFull, titlePinyinFirst]
      if (c.searchTokens.includes(q)) {
        // 检查是否是本名首字母
        if (c.searchTokens[6] === q || c.searchTokens[7] === q) {
          score += 30;
        }
      }

      if (score > 0) {
        // 附加微小权重：皮肤数多的英雄通常更热门，微量加权以平局破局
        const tieBreaker = (c.totalSkins || 0) * 0.05;
        scored.push({ champion: c, score: score + tieBreaker });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map(item => item.champion);
  }

  getChampionByKey(key) {
    return this.championsMap.get(String(key)) || null;
  }

  async syncCatalog() {
    console.log('🔄 [CatalogService] 触发全量数据同步更新...');
    const newCatalog = await buildCatalog();
    this.catalog = newCatalog;
    this.buildIndexes();
    return this.getInfo();
  }
}

export const catalogService = new CatalogService();
