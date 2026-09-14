let cachedVersion = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 缓存 1 小时，避免频繁请求

/**
 * 动态获取 Riot Data Dragon 官方最新版本号
 * 来源: https://ddragon.leagueoflegends.com/api/versions.json
 */
export async function getLatestDdragonVersion() {
  const now = Date.now();
  if (cachedVersion && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return cachedVersion;
  }

  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (res.ok) {
      const versions = await res.json();
      if (Array.isArray(versions) && versions.length > 0) {
        cachedVersion = versions[0];
        lastFetchTime = now;
        console.log(`📡 [DDragon] 动态获取到 Riot Data Dragon 最新版本号: ${cachedVersion}`);
        return cachedVersion;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [DDragon] 获取最新版本号失败: ${err.message}，使用降级策略`);
  }

  return cachedVersion || '16.18.1';
}
