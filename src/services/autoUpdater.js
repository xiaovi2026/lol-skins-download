import { catalogService } from './catalogService.js';
import { formatToBeijingTime } from '../../scripts/build-catalog.js';

class AutoUpdater {
  constructor() {
    this.timer = null;
    this.intervalMs = 60 * 60 * 1000; // 默认每 1 小时 (3600000 ms)
    this.isUpdating = false;
    this.lastCheckedBeijing = null;
    this.lastCheckStatus = '未检查';
  }

  /**
   * 启动后台定时检查任务
   */
  start(intervalMs = 60 * 60 * 1000) {
    this.intervalMs = intervalMs;
    const intervalHours = (this.intervalMs / (60 * 60 * 1000)).toFixed(1);
    console.log(`⏱️  [AutoUpdater] 后台自动更新定时器已启动，每 ${intervalHours} 小时自动检查一次 GitHub 变更`);

    // 延迟 10 秒后执行首次轻量检查，避免与服务启动竞争资源
    setTimeout(() => {
      this.checkNow();
    }, 10 * 1000);

    // 循环定时任务
    this.timer = setInterval(() => {
      this.checkNow();
    }, this.intervalMs);

    if (this.timer.unref) {
      this.timer.unref(); // 允许进程在无其他活跃 handle 时正常退出
    }
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`⏹️  [AutoUpdater] 定时任务已停止`);
    }
  }

  /**
   * 立即执行一次轻量检查
   */
  async checkNow() {
    if (this.isUpdating) {
      console.log(`⏳ [AutoUpdater] 更新任务已在执行中，本次检查跳过`);
      return;
    }

    this.isUpdating = true;
    this.lastCheckedBeijing = formatToBeijingTime(new Date());

    try {
      console.log(`🔍 [AutoUpdater] (${this.lastCheckedBeijing}) 正在检查 GitHub 源仓库 Alban1911/LeagueSkins 最新 Commit...`);
      
      const res = await fetch('https://api.github.com/repos/Alban1911/LeagueSkins/commits/main', {
        headers: {
          'User-Agent': 'Fastify-LOL-Skins-AutoUpdater'
        }
      });

      if (!res.ok) {
        throw new Error(`GitHub API HTTP ${res.status}`);
      }

      const data = await res.json();
      const remoteSha = (data.sha || '').slice(0, 7);
      const localSha = catalogService.catalog?.commit?.sha || '';

      if (remoteSha && remoteSha === localSha) {
        this.lastCheckStatus = `已是最新版本 (${remoteSha})`;
        console.log(`✨ [AutoUpdater] 检查完成：本地数据已是最新 (Commit: ${remoteSha})，无需更新。`);
      } else {
        console.log(`🚀 [AutoUpdater] 检测到新版本！本地: [${localSha || '无'}] -> 远程: [${remoteSha}]，开始全量增量更新...`);
        const info = await catalogService.syncCatalog();
        this.lastCheckStatus = `更新成功至 ${remoteSha} (${info.lastUpdatedBeijing})`;
        console.log(`🎉 [AutoUpdater] 自动同步完成！收录 ${info.stats.totalChampions} 位英雄，更新时间: ${info.lastUpdatedBeijing}`);
      }
    } catch (err) {
      this.lastCheckStatus = `检查跳过 (${err.message})`;
      console.warn(`⚠️ [AutoUpdater] 自动检查更新失败（将在下周期重试，不影响现有服务）: ${err.message}`);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 获取自动更新当前运行状态
   */
  getStatus() {
    return {
      enabled: Boolean(this.timer),
      intervalMinutes: Math.round(this.intervalMs / 60000),
      lastCheckedBeijing: this.lastCheckedBeijing,
      lastCheckStatus: this.lastCheckStatus
    };
  }
}

export const autoUpdater = new AutoUpdater();
