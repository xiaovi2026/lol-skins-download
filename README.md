# 英雄联盟皮肤查询与下载 Web 服务 (LOL Skins Hub)

基于 **Fastify** 与原生 Web 技术构建的高性能英雄联盟全量皮肤查询与下载服务。
收录英雄联盟全 173 位英雄、9,200+ 款皮肤及 9,000+ 个模型下载文件。

> 🌐 **在线体验**: [https://lol.xiaovi.de/](https://lol.xiaovi.de/)  
> 📦 **数据源**: [Alban1911/LeagueSkins](https://github.com/Alban1911/LeagueSkins) | **美术原画**: Riot Games Data Dragon

---

## 🌟 核心特性

### 1. 智能拼音与俗称检索
- **多维度检索**：支持输入英雄**中文名**（如“亚索”、“安妮”）、**官方称号**（如“疾风剑豪”、“黑暗之女”）、**英文标识**（如“Yasuo”、“Annie”）。
- **拼音与简拼**：支持拼音全拼（“yasuo”、“anni”）及拼音首字母简拼（“ys”、“hazn”）。
- **玩家俗称映射**：内置常用英雄外号字典，如输入“盲僧”/“瞎子”精准定位李青、“卡牌”定位崔斯特、“剑圣”定位易大师、“快乐风男”定位亚索。
- **键盘极速交互**：联想下拉列表支持键盘上下方向键（`↑` / `↓`）选择与回车（`Enter`）确认。

### 2. 全量皮肤展示与细节标注
- **全量收录**：收录官方原版皮肤、经典旧版（Classic）模型以及海量炫彩（Chroma）皮肤。
- **参数清晰**：每款皮肤卡片均清晰标注**官方编号（Skin ID）、皮肤类型（原画/炫彩）、文件大小**。
- **双层筛选**：支持按「全部 / 常规原版 / 炫彩皮肤」分类切换，并在英雄详情内支持二次关键字即时筛选。
- **直达与分享**：支持 URL 参数直接定位英雄，便于分享：
  - `/?champion=157`
  - `/?champion=yasuo`
  - `/?champion=亚索`

### 3. GitHub 官方直链与多线路加速
- **零服务端中转负担**：皮肤安装包（`.fantome` / `.zip`）与挂载工具直接从 GitHub 官方源（`raw.githubusercontent.com` 及 Releases 分发端点）下载，服务端不代理转发或堆积大文件。
- **多线路随心切换**：页面右上角提供下载线路选择器，支持：
  - **ghfast 加速（推荐）**：`https://ghfast.top/`（国内高速下载）
  - **gh-proxy 加速**：`https://gh-proxy.com/`（备用镜像节点）
  - **GitHub 直连**：官方原始地址（海外或全局代理环境）
- **偏好持久化**：选择线路后即时切换全站所有下载按钮链接，并自动保存至浏览器的 `localStorage`。

### 4. 轻量图片代理与版本隔离缓存
- **立绘/头像高速加载**：英雄方形头像与皮肤加载立绘由服务端代理并进行本地磁盘缓存，即使无法访问官方海外 CDN 也能顺畅展示。
- **Data Dragon 版本感知**：自动探测 Riot 官方最新版本号（如 `16.20.1`），头像按版本隔离存储，游戏大版本更新时平滑衔接。

### 5. 北京时间展示与后台自动同步
- 精确抓取源仓库 GitHub 最后提交时间，格式化为标准**北京时间（UTC+8）**置于顶部展示。
- 服务端后台常驻轻量轮询定时器（每 1 小时检查一次 GitHub Commit SHA），检测到源仓库更新时自动触发增量热同步。

---

## 🎮 皮肤安装与使用教程

本站下载的皮肤文件多为 **`.fantome`** 格式，需配合英雄联盟社区通用挂载器使用：

1. **获取挂载工具**：点击页面右上角 **「皮肤挂载器: LTK Manager」**，一键下载最新版安装程序（支持 Windows）。
2. **下载心仪皮肤**：在本站搜索英雄，找到对应皮肤后点击 **「立即下载 (.fantome)」**。
3. **挂载体验**：
   - 打开并启动 **LTK Manager**；
   - 将下载的 `.fantome` 文件直接拖拽至软件界面内；
   - 勾选该皮肤并点击启用/运行，启动英雄联盟客户端即可体验。

---

## 🚀 快速启动

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装与运行

```bash
# 1. 克隆代码并安装依赖
git clone https://github.com/xiaovi2026/lol-skins-download.git
cd lol-skins-download
npm install

# 2. 启动服务 (默认仅监听 127.0.0.1:3000)
npm start

# 备选：开放局域网访问 (0.0.0.0:3000)
npm run start:lan

# 3. 运行自动化测试套件
npm test
```

### 常用命令行启动参数

服务支持灵活的启动参数配置：

```bash
# 指定端口启动
node server.js --port 8080

# 指定监听地址与端口
node server.js --host 0.0.0.0 --port 3000

# 强制仅限本地访问
node server.js --local
```

也可以通过环境变量指定：`PORT=8080 HOST=0.0.0.0 npm start`。

---

## 📡 API 接口参考

| 端点 | 方法 | 参数 | 说明 |
|---|---|---|---|
| `/api/info` | GET | 无 | 获取收录统计（英雄数/皮肤数/文件数）、北京时间更新时间及自动更新状态 |
| `/api/champions` | GET | `?q=关键词` (可选，最长50字) | 获取英雄摘要列表，支持中英文、拼音及别名模糊匹配 |
| `/api/champions/:key` | GET | `:key` 为纯数字英雄编号 | 获取指定英雄全量皮肤数据、编号及直链下载元数据 |
| `/api/proxy/champion-icon/:key` | GET | `:key` 为纯数字英雄编号 | 代理并本地缓存英雄方形头像（PNG，带有 7 天强缓存头） |
| `/api/proxy/skin-image/:key/:skinId` | GET | `:key`, `:skinId` 为纯数字 | 代理并本地缓存皮肤竖版立绘（JPEG/PNG，优先使用源仓库 preview） |
| `/api/tools/ltk-manager` | GET | 无 | 获取最新版 LTK Manager 发布信息与官方直链 |
| `/stats/script.js` | GET | 无 | 同源代理提供统计脚本（防 AdBlock 误杀） |
| `/stats/api/send` | POST | 打点 JSON 载荷 | 统计数据同源上报端点（透传真实客户端 IP 请求头） |

---

## 📂 项目结构

```text
lol-skins-download/
├── public/                    # 前端单页面资源 (原生 Vanilla JS / CSS)
│   ├── index.html             # 结构布局、顶部线路选择器及内联 SVG 图标
│   ├── style.css              # 原生 Hextech 蓝金设计样式及移动端适配
│   ├── app.js                 # 搜索联想、多维过滤、线路切换与直链触发逻辑
│   ├── favicon.ico            # 站点图标
│   └── logo.webp              # 导航栏 Logo
├── src/
│   ├── data/
│   │   └── catalog.json       # 离线全量英雄与皮肤索引数据 (173 位英雄，9,200+ 皮肤)
│   ├── routes/
│   │   ├── api.js             # Fastify RESTful 核心 API 路由
│   │   └── stats.js           # Umami 同源统计反代路由
│   └── services/
│       ├── catalogService.js  # 内存索引字典构建、拼音权重打分检索
│       ├── proxyService.js    # 英雄头像与皮肤立绘本地磁盘隔离缓存
│       ├── autoUpdater.js     # 后台定时自动检测 GitHub 变更与更新任务
│       ├── toolService.js     # LTK Manager 挂载工具最新发布抓取
│       └── ddragon.js         # Riot Data Dragon 版本号探测与本地缓存
├── scripts/
│   └── build-catalog.js       # 全量解析 GitHub Alban1911/LeagueSkins 仓库构建索引
├── tests/
│   └── verify.js              # 自动化测试套件 (覆盖 16 项关键指标与接口)
├── cache/                     # 本地文件缓存 (仅存放头像、立绘与工具元数据)
├── server.js                  # Fastify 服务端入口与 CLI 参数解析
└── package.json               # 项目配置与 npm 脚本
```

---

## 🛠️ 数据构建与手动更新

如果需要脱机手动更新全部英雄皮肤数据，可以执行以下命令重新拉取 GitHub 仓库与 Riot 官网数据：

```bash
npm run build:data
```

构建脚本将依次：
1. 请求 GitHub API 获取源仓库最新 Commit 信息与北京时间；
2. 获取中文皮肤名称映射表；
3. 解析 Riot Data Dragon 官方最新英雄字典；
4. 解析 GitHub 完整文件树，归纳整理所有 `.fantome` / `.zip` 皮肤包及原画预览；
5. 生成全量 `src/data/catalog.json` 索引文件。

---

## 🛡️ 免责声明

1. 本项目所引用的英雄联盟皮肤资产、官方原画立绘等版权均归拳头游戏（Riot Games）及相应模组创作者所有。
2. 本项目仅供技术研究、学习交流与资源检索使用，严禁用于任何商业牟利目的。
