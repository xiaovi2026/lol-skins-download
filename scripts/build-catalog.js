import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pinyin } from 'pinyin-pro';
import { getLatestDdragonVersion } from '../src/services/ddragon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'catalog.json');

// 常见英雄中文别名/俗称映射表
const CHAMPION_ALIASES = {
  '1': ['火女'],
  '4': ['卡牌', '卡牌大师'],
  '7': ['妖姬', '诡术妖姬'],
  '11': ['剑圣', '易大师'],
  '12': ['牛头', '老牛'],
  '14': ['老司机', '塞恩'],
  '15': ['轮子妈'],
  '16': ['奶妈', '星妈'],
  '17': ['蘑菇', '提莫队长'],
  '18': ['小炮'],
  '20': ['雪人', '努努'],
  '21': ['女枪', '好运姐'],
  '22': ['寒冰', '艾希'],
  '23': ['蛮王', '蛮子'],
  '24': ['武器', '武器大师'],
  '29': ['老鼠'],
  '31': ['大虫子', '科加斯'],
  '32': ['木乃伊', '阿木木'],
  '33': ['龙龟'],
  '34': ['冰鸟', '凤凰'],
  '36': ['蒙多'],
  '37': ['琴女'],
  '38': ['卡萨丁'],
  '39': ['刀妹', '刀锋意志'],
  '40': ['风女'],
  '41': ['船长'],
  '43': ['扇子妈'],
  '45': ['小法', '邪恶小法师'],
  '48': ['巨魔'],
  '50': ['乌鸦'],
  '51': ['女警', '皮城女警'],
  '53': ['机器人', '布里茨'],
  '54': ['石头人', '熔岩巨兽'],
  '58': ['鳄鱼'],
  '59': ['皇子', '嘉文'],
  '62': ['猴子', '齐天大圣'],
  '64': ['盲僧', '李青', '瞎子'],
  '67': ['vn', '薇恩'],
  '75': ['狗头'],
  '78': ['波比'],
  '80': ['潘森'],
  '81': ['ez', '小黄毛', '探险家'],
  '82': ['铁男', '莫德凯撒'],
  '83': ['掘墓', '牧魂人'],
  '85': ['电耗子', '凯南'],
  '86': ['大盖伦', '盖伦'],
  '91': ['男刀'],
  '92': ['锐雯', '瑞雯'],
  '96': ['大嘴'],
  '99': ['光辉', '拉克丝'],
  '102': ['龙女'],
  '103': ['狐狸', '九尾妖狐', '阿狸'],
  '104': ['男枪'],
  '105': ['小鱼人', '菲兹'],
  '106': ['狗熊', '沃利贝尔'],
  '107': ['狮子狗'],
  '110': ['韦鲁斯'],
  '114': ['剑姬'],
  '119': ['德莱文'],
  '120': ['人马', '赫卡里姆'],
  '121': ['螳螂', '卡兹克'],
  '122': ['诺手', '德莱厄斯'],
  '126': ['杰斯'],
  '131': ['皎月'],
  '134': ['辛德拉', '球女'],
  '136': ['龙王'],
  '141': ['凯隐'],
  '142': ['佐伊'],
  '143': ['婕拉'],
  '145': ['卡莎'],
  '150': ['纳尔'],
  '154': ['扎克'],
  '157': ['亚索', '快乐风男', '风男'],
  '164': ['青钢影', '卡蜜尔'],
  '201': ['布隆'],
  '202': ['烬'],
  '203': ['千珏'],
  '222': ['金克丝', '萝莉'],
  '223': ['蛤蟆', '塔姆'],
  '234': ['佛耶戈', '破败之王'],
  '236': ['奥巴马', '卢锡安'],
  '238': ['劫', '儿童劫'],
  '245': ['艾克'],
  '246': ['奇亚娜'],
  '254': ['蔚'],
  '266': ['剑魔', '暗裔剑魔'],
  '412': ['锤石'],
  '420': ['触手妈', '俄洛伊'],
  '421': ['挖掘机', '雷克塞'],
  '429': ['滑板鞋', '卡莉丝塔'],
  '432': ['巴德'],
  '497': ['洛'],
  '498': ['霞'],
  '516': ['奥恩'],
  '517': ['塞拉斯'],
  '518': ['妮蔻'],
  '523': ['厄斐琉斯'],
  '555': ['派克'],
  '711': ['薇古丝'],
  '777': ['永恩'],
  '875': ['腕豪', '瑟提', '劲夫'],
  '876': ['莉莉娅'],
  '887': ['格温'],
  '897': ['奎桑提'],
  '901': ['斯莫德', '小火龙'],
  '799': ['狼母', '安蓓萨']
};

export function formatToBeijingTime(dateInput) {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export async function buildCatalog() {
  console.log('🚀 开始构建英雄与皮肤数据索引...');

  // 1. 获取 GitHub 最新 commit 信息
  console.log('📡 [1/4] 获取 Alban1911/LeagueSkins 最新 Commit 信息...');
  let commitInfo = {
    sha: 'f52a534',
    date: '2026-09-10T10:31:44Z',
    message: '26.18',
    dateBeijing: '2026-09-10 18:31:44'
  };
  try {
    const commitRes = await fetch('https://api.github.com/repos/Alban1911/LeagueSkins/commits/main', {
      headers: { 'User-Agent': 'Fastify-LOL-Skins-Portal' }
    });
    if (commitRes.ok) {
      const commitData = await commitRes.json();
      const commitDate = commitData.commit?.committer?.date || commitData.commit?.author?.date;
      commitInfo = {
        sha: (commitData.sha || '').slice(0, 7),
        date: commitDate,
        message: commitData.commit?.message?.trim() || '',
        dateBeijing: formatToBeijingTime(commitDate)
      };
      console.log(`✅ 最新提交: ${commitInfo.sha} | 提交时间(北京时间): ${commitInfo.dateBeijing}`);
    } else {
      console.warn(`⚠️ GitHub Commits API 状态码: ${commitRes.status}，使用默认提交信息`);
    }
  } catch (err) {
    console.warn(`⚠️ 获取 Commit 信息失败: ${err.message}，使用默认提交信息`);
  }

  // 2. 获取中文皮肤名称映射 resources/zh/skin_ids.json
  console.log('📡 [2/4] 获取中文皮肤映射 skin_ids.json...');
  let skinIdsZh = {};
  try {
    const skinRes = await fetch('https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/resources/zh/skin_ids.json');
    if (skinRes.ok) {
      skinIdsZh = await skinRes.json();
      console.log(`✅ 成功获取皮肤中文名映射，共 ${Object.keys(skinIdsZh).length} 条`);
    } else {
      throw new Error(`HTTP ${skinRes.status}`);
    }
  } catch (err) {
    console.error(`❌ 获取 skin_ids.json 失败: ${err.message}`);
    throw err;
  }

  // 3. 动态获取 DataDragon 最新版本与英雄列表
  console.log('📡 [3/4] 动态获取 DataDragon 最新版本号与英雄官方数据...');
  const ddragonVersion = await getLatestDdragonVersion();
  console.log(`📌 当前 DataDragon 最新版本: ${ddragonVersion}`);
  let ddragonData = {};
  try {
    const ddRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/zh_CN/champion.json`);
    if (ddRes.ok) {
      const ddJson = await ddRes.json();
      ddragonData = ddJson.data || {};
      console.log(`✅ 成功获取 DataDragon 英雄数据 (${ddragonVersion})，共 ${Object.keys(ddragonData).length} 位英雄`);
    } else {
      throw new Error(`HTTP ${ddRes.status}`);
    }
  } catch (err) {
    console.error(`❌ 获取 DataDragon 失败: ${err.message}`);
    throw err;
  }

  // 4. 获取 GitHub 仓库全部文件树
  console.log('📡 [4/4] 获取 Alban1911/LeagueSkins 完整仓库文件树...');
  let repoBlobs = [];
  try {
    const treeRes = await fetch('https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1', {
      headers: { 'User-Agent': 'Fastify-LOL-Skins-Portal' }
    });
    if (treeRes.ok) {
      const treeJson = await treeRes.json();
      repoBlobs = (treeJson.tree || []).filter(item => item.type === 'blob');
      console.log(`✅ 成功解析文件树，包含 ${repoBlobs.length} 个 Blob 节点`);
    } else {
      throw new Error(`HTTP ${treeRes.status}`);
    }
  } catch (err) {
    console.error(`❌ 获取仓库文件树失败: ${err.message}`);
    throw err;
  }

  // 5. 组织解析皮肤文件
  // 分类归档: by championKey -> by skinId -> files & previews
  const champSkinFiles = new Map(); // champKey -> Map(skinId -> { files: [], previewPng: null, parentSkinId: null })
  
  for (const blob of repoBlobs) {
    const p = blob.path;
    if (!p.startsWith('skins/') && !p.startsWith('classic/')) continue;
    
    const parts = p.split('/');
    const category = parts[0]; // 'skins' or 'classic'
    const champKey = parts[1];
    
    if (!champSkinFiles.has(champKey)) {
      champSkinFiles.set(champKey, new Map());
    }
    const skinMap = champSkinFiles.get(champKey);

    if (parts.length === 4) {
      // 基础皮肤: skins/{champKey}/{skinId}/{filename}
      const skinId = parts[2];
      const filename = parts[3];
      if (!skinMap.has(skinId)) {
        skinMap.set(skinId, { files: [], previewPng: null, parentSkinId: null });
      }
      const item = skinMap.get(skinId);
      if (filename.endsWith('.png')) {
        item.previewPng = p;
        item.previewSha = blob.sha;
      } else if (filename.endsWith('.fantome') || filename.endsWith('.zip')) {
        item.files.push({
          path: p,
          filename,
          size: blob.size,
          sha: blob.sha,
          category
        });
      }
    } else if (parts.length === 5) {
      // 炫彩皮肤: skins/{champKey}/{parentSkinId}/{skinId}/{filename}
      const parentSkinId = parts[2];
      const skinId = parts[3];
      const filename = parts[4];
      if (!skinMap.has(skinId)) {
        skinMap.set(skinId, { files: [], previewPng: null, previewSha: null, parentSkinId });
      }
      const item = skinMap.get(skinId);
      item.parentSkinId = parentSkinId;
      if (filename.endsWith('.png')) {
        item.previewPng = p;
        item.previewSha = blob.sha;
      } else if (filename.endsWith('.fantome') || filename.endsWith('.zip')) {
        item.files.push({
          path: p,
          filename,
          size: blob.size,
          sha: blob.sha,
          category
        });
      }
    }
  }

  // 6. 整合构建英雄字典
  const champions = [];
  let totalSkinsAll = 0;
  let totalFilesAll = 0;

  for (const ddChamp of Object.values(ddragonData)) {
    const key = ddChamp.key;
    const enId = ddChamp.id;
    const titleZh = ddChamp.name; // e.g. "黑暗之女"
    const nameZh = ddChamp.title; // e.g. "安妮"
    const aliases = CHAMPION_ALIASES[key] || [];

    // 计算拼音搜索关键字
    const titlePinyinFull = pinyin(titleZh, { toneType: 'none', type: 'array' }).join('');
    const titlePinyinFirst = pinyin(titleZh, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
    const namePinyinFull = pinyin(nameZh, { toneType: 'none', type: 'array' }).join('');
    const namePinyinFirst = pinyin(nameZh, { pattern: 'first', toneType: 'none', type: 'array' }).join('');

    // 搜索综合文本 (用于极速检索)
    const searchTokens = [
      key,
      enId.toLowerCase(),
      titleZh.toLowerCase(),
      nameZh.toLowerCase(),
      titlePinyinFull.toLowerCase(),
      titlePinyinFirst.toLowerCase(),
      namePinyinFull.toLowerCase(),
      namePinyinFirst.toLowerCase(),
      ...aliases.map(a => a.toLowerCase())
    ];

    // 该英雄的所有皮肤
    const skinMap = champSkinFiles.get(key) || new Map();
    const skins = [];

    // 从 skin_ids.json 与 champSkinFiles 结合
    // 该英雄的基础 skinId 前缀是 key * 1000
    const champBasePrefix = parseInt(key) * 1000;
    
    // 找出所有属于该英雄的 skinId (要么在 skinMap 中，要么在 skinIdsZh 匹配)
    const allSkinIds = new Set([
      ...skinMap.keys(),
      ...Object.keys(skinIdsZh).filter(id => {
        const num = parseInt(id);
        return Math.floor(num / 1000) === parseInt(key);
      })
    ]);

    for (const skinId of allSkinIds) {
      const fileData = skinMap.get(skinId) || { files: [], previewPng: null, parentSkinId: null };
      const skinName = skinIdsZh[skinId] || (skinId.endsWith('000') ? `${nameZh} 原皮` : `未知皮肤 #${skinId}`);
      const isBase = skinId.endsWith('000');
      const isChroma = Boolean(fileData.parentSkinId) || (!isBase && (skinName.includes(' ') && skinName.split(' ').length > 2));
      
      const skinItem = {
        id: skinId,
        num: parseInt(skinId) % 1000,
        name: skinName,
        isBase,
        isChroma,
        parentSkinId: fileData.parentSkinId || null,
        previewPng: fileData.previewPng || null,
        previewSha: fileData.previewSha || null,
        files: fileData.files
      };

      skins.push(skinItem);
      totalFilesAll += fileData.files.length;
    }

    // 排序：原皮居首，常规皮肤按编号升序，炫彩跟在对应母皮肤后面
    skins.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    totalSkinsAll += skins.length;

    champions.push({
      key,
      id: enId,
      name: nameZh, // 英雄名（如 安妮）
      title: titleZh, // 称号（如 黑暗之女）
      fullName: `${titleZh} ${nameZh}`,
      aliases,
      avatar: ddChamp.image?.full ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${ddChamp.image.full}` : '',
      searchTokens: Array.from(new Set(searchTokens)),
      totalSkins: skins.length,
      totalFiles: skins.reduce((sum, s) => sum + s.files.length, 0),
      skins
    });
  }

  // 英雄按称号/中文名排序
  champions.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  const catalog = {
    version: '1.0.0',
    ddragonVersion,
    generatedAt: new Date().toISOString(),
    lastUpdatedBeijing: commitInfo.dateBeijing,
    commit: commitInfo,
    stats: {
      totalChampions: champions.length,
      totalSkins: totalSkinsAll,
      totalFiles: totalFilesAll
    },
    champions
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`🎉 数据构建完成！共收录 ${champions.length} 位英雄, ${totalSkinsAll} 款皮肤, ${totalFilesAll} 个下载文件。已写入: ${OUTPUT_FILE}`);
  return catalog;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildCatalog().catch(err => {
    console.error('构建失败:', err);
    process.exit(1);
  });
}
