import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 开始运行自动化验证套件...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // 1. 验证静态自包含约束 (无外部资源引入)
  await test('静态文件自包含检查 (无外部字体与CDN样式)', async () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'public', 'index.html'), 'utf-8');
    const css = fs.readFileSync(path.join(ROOT_DIR, 'public', 'style.css'), 'utf-8');
    const js = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf-8');

    // 检查是否有外部 link 引用
    const externalLinkRegex = /<link[^>]+href=["']https?:\/\//i;
    assert.ok(!externalLinkRegex.test(html), 'index.html 中不得包含外部 http/https link 标签');

    // 检查是否有未授权外部 script 标签（除用户显式配置的统计脚本外，禁止引入任何外部第三方库或CDN）
    const scriptSrcMatches = [...html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]);
    const unauthorizedScripts = scriptSrcMatches.filter(url => !url.startsWith('https://u.xiaovi.de/'));
    assert.strictEqual(unauthorizedScripts.length, 0, `不得包含未授权外部脚本: ${unauthorizedScripts.join(', ')}`);
    assert.ok(html.includes('https://u.xiaovi.de/script.js'), '必须包含用户配置的统计脚本');
    assert.ok(html.includes('rel="icon"'), '必须包含网站图标 link');

    // 检查 CSS 中不得有 @import url(http...)
    const externalCssImport = /@import\s+(url\(['"]?https?:|['"]https?:)/i;
    assert.ok(!externalCssImport.test(css), 'style.css 中不得引入外部 @import 样式或字体');

    // 检查 CSS 中不得有外部字体 url(http...)
    const externalFontUrl = /url\(['"]?https?:\/\/[^'")]+\.(woff2?|ttf|otf|eot)/i;
    assert.ok(!externalFontUrl.test(css), 'style.css 中不得引入外部 webfont 字体文件');
  });

  // 2. 验证 API: /api/info
  await test('GET /api/info (北京时间与统计信息)', async () => {
    const res = await fetch(`${BASE_URL}/api/info`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.lastUpdatedBeijing, '必须包含 lastUpdatedBeijing 字段');
    assert.match(data.lastUpdatedBeijing, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '北京时间格式必须为 YYYY-MM-DD HH:mm:ss');
    assert.ok(data.stats.totalChampions >= 173, '收录英雄数必须 >= 173');
    assert.ok(data.stats.totalSkins > 9000, '收录皮肤数必须 > 9000');
    assert.ok(data.stats.totalFiles > 10000, '收录下载文件数必须 > 10000');
    assert.ok(data.autoUpdate?.enabled, '后台自动更新必须已启用');
    assert.strictEqual(data.autoUpdate?.intervalMinutes, 60, '自动更新周期必须为 60 分钟 (1小时)');
  });

  // 3. 验证 API: /api/champions 列表与搜索
  await test('GET /api/champions (英雄列表与联想搜索)', async () => {
    // 全量
    const resAll = await fetch(`${BASE_URL}/api/champions`);
    const all = await resAll.json();
    assert.strictEqual(all.champions.length, 173, '必须返回 173 位英雄');

    // 拼音简拼 "ys" 检索亚索
    const resYs = await fetch(`${BASE_URL}/api/champions?q=ys`);
    const ys = await resYs.json();
    assert.ok(ys.champions.length > 0, '搜索 ys 应有结果');
    assert.strictEqual(ys.champions[0].name, '亚索', '首项应为亚索');

    // 别名 "盲僧" 检索李青
    const resMs = await fetch(`${BASE_URL}/api/champions?q=盲僧`);
    const ms = await resMs.json();
    assert.ok(ms.champions.length > 0, '搜索盲僧应有结果');
    assert.strictEqual(ms.champions[0].name, '李青', '首项应为李青');

    // 英文 "Annie" 检索安妮
    const resAn = await fetch(`${BASE_URL}/api/champions?q=Annie`);
    const an = await resAn.json();
    assert.ok(an.champions.length > 0, '搜索 Annie 应有结果');
    assert.strictEqual(an.champions[0].key, '1', '首项应为编号 1 安妮');
  });

  // 4. 验证 API: /api/champions/:key
  await test('GET /api/champions/157 (亚索全量皮肤详情)', async () => {
    const res = await fetch(`${BASE_URL}/api/champions/157`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.key, '157');
    assert.strictEqual(data.name, '亚索');
    assert.ok(data.skins.length > 80, '亚索皮肤总数应 > 80');
    
    // 检查是否包含皮肤编号及下载文件
    const skin157001 = data.skins.find(s => s.id === '157001');
    assert.ok(skin157001, '必须包含 157001 西部牛仔 亚索');
    assert.strictEqual(skin157001.name, '西部牛仔 亚索');
    assert.ok(skin157001.files.length > 0, '157001 必须包含下载文件');
    assert.ok(skin157001.files[0].path.endsWith('.fantome'), '文件应以 .fantome 结尾');
  });

  // 5. 验证头像代理: /api/proxy/champion-icon/:key
  await test('GET /api/proxy/champion-icon/1 (英雄头像代理)', async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/champion-icon/1`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000, '头像文件体积应 > 1KB');
  });

  // 6. 验证皮肤立绘代理: /api/proxy/skin-image/:key/:skinId
  await test('GET /api/proxy/skin-image/157/157001 (皮肤预览代理)', async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/skin-image/157/157001`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.startsWith('image/'), '内容类型必须为图片');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000, '立绘图片体积应 > 1KB');
  });

  // 7. 验证皮肤下载代理: /api/skins/download
  await test('GET /api/skins/download?path=skins/1/1001/1001.fantome (皮肤文件下载)', async () => {
    const res = await fetch(`${BASE_URL}/api/skins/download?path=skins/1/1001/1001.fantome`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/octet-stream');
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition && disposition.includes('1001.fantome'), 'Content-Disposition 应包含文件名');
    const buf = await res.arrayBuffer();
    assert.strictEqual(buf.byteLength, 5094, '下载体积应精确为 5094 bytes');
  });

  // 8. 验证静态首页与完整组件
  await test('GET / (首页加载及组件完整性)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('championSearchInput'), '必须包含英雄搜索输入框');
    assert.ok(html.includes('autocompleteDropdown'), '必须包含下拉联想组件');
    assert.ok(html.includes('lastUpdatedText'), '必须包含最后更新时间展示元素');
    assert.ok(html.includes('skinsGrid'), '必须包含皮肤网格容器');
    assert.ok(!html.includes('id="refreshBtn"'), '页面不得包含客户端检查更新按钮');
    assert.ok(!html.includes('代理就绪'), '页面不得包含“代理就绪”描述');
    assert.ok(!html.includes('所有静态资源均已通过本地服务端自建代理与缓存'), '页面不得暴露服务端代理与缓存技术细节描述');
  });

  // 9. 验证客户端禁止触发同步接口
  await test('POST /api/sync 应已被移除 (禁止客户端触发更新)', async () => {
    const res = await fetch(`${BASE_URL}/api/sync`, { method: 'POST' });
    assert.strictEqual(res.status, 404, 'POST /api/sync 接口应返回 404 Not Found');
  });

  // 10. 验证 DataDragon 动态版本获取
  await test('动态解析 Riot Data Dragon 官方最新版本号', async () => {
    const { getLatestDdragonVersion } = await import('../src/services/ddragon.js');
    const version = await getLatestDdragonVersion();
    assert.ok(typeof version === 'string' && version.length > 0, '版本号必须为非空字符串');
    assert.match(version, /^\d+\.\d+\.\d+$/, '版本号格式必须符合 X.Y.Z');
    console.log(`   [当前解析到的官方最新版本: ${version}]`);
  });

  // 11. 验证智能缓存失效：文件变更 (Git Blob SHA 校验) 自动识别并重新下载
  await test('智能缓存失效机制：源文件变更时自动识别 SHA 差异并重新拉取', async () => {
    const testPath = 'skins/1/1001/1001.fantome';
    const cachedFile = path.join(ROOT_DIR, 'cache', 'skins', testPath);
    
    // 确保已有有效缓存
    await fetch(`${BASE_URL}/api/skins/download?path=${testPath}`);
    assert.ok(fs.existsSync(cachedFile), '测试前缓存文件必须存在');

    // 模拟旧文件过期/作者发布了新补丁（文件内容被修改）
    fs.writeFileSync(cachedFile, Buffer.from('stale outdated content'));

    // 再次请求下载，服务端应检测到 SHA 变动，自动清理旧缓存并重新拉取真实文件
    const res = await fetch(`${BASE_URL}/api/skins/download?path=${testPath}`);
    assert.strictEqual(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.strictEqual(buf.byteLength, 5094, '应自动重新拉取远端真实文件 (5094 bytes)，而非错误的旧缓存');
  });

  // 12. 验证 LTK Manager 代理版本信息接口
  await test('GET /api/tools/ltk-manager (获取最新挂载器版本)', async () => {
    const res = await fetch(`${BASE_URL}/api/tools/ltk-manager`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.tag, '必须包含 tag 字段');
    assert.ok(data.publishedAtBeijing, '必须包含北京时间');
    assert.ok(data.primaryAsset, '必须包含默认主要下载文件');
    assert.ok(data.primaryAsset.name.endsWith('.exe'), '主要文件应为 Windows 可执行程序');
    console.log(`   [当前最新 LTK Manager: ${data.name} | 文件: ${data.primaryAsset.name}]`);
  });

  // 13. 验证 LTK Manager 代理下载接口
  await test('GET /api/tools/ltk-manager/download (下载代理)', async () => {
    // 代理下载小体积资产文件测试代理链路与持久化缓存
    const res = await fetch(`${BASE_URL}/api/tools/ltk-manager/download?filename=latest.json`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/octet-stream');
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition && disposition.includes('latest.json'), 'Header 应包含 filename');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 100, '下载内容体积应 > 100 bytes');
  });

  // 14. 验证全局安全响应头与参数格式防护
  await test('安全响应头与非法参数格式防御校验', async () => {
    const res = await fetch(`${BASE_URL}/api/info`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff', '必须包含 nosniff 头');
    assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN', '必须包含 SAMEORIGIN 头');

    // 非法英雄参数
    const resBadKey = await fetch(`${BASE_URL}/api/champions/abc`);
    assert.strictEqual(resBadKey.status, 400, '非纯数字英雄编号应返回 400 Bad Request');

    // 非法皮肤立绘参数
    const resBadSkin = await fetch(`${BASE_URL}/api/proxy/skin-image/1/bad_skin`);
    assert.strictEqual(resBadSkin.status, 400, '非纯数字皮肤编号应返回 400 Bad Request');
  });

  // 15. 验证严格白名单校验与路径穿越防御
  await test('严格文件白名单校验与防路径穿越测试', async () => {
    // 尝试传入目录路径
    const resDir = await fetch(`${BASE_URL}/api/skins/download?path=skins`);
    assert.strictEqual(resDir.status, 404, '请求目录应被白名单拒绝返回 404，不得返回 500 EISDIR');

    // 尝试路径穿越
    const resTraversal = await fetch(`${BASE_URL}/api/skins/download?path=skins/../../package.json`);
    assert.strictEqual(resTraversal.status, 404, '路径穿越请求应被拒绝返回 404');

    // 尝试伪造不存在的工具发布资产
    const resEvilTool = await fetch(`${BASE_URL}/api/tools/ltk-manager/download?filename=evil_malware.exe`);
    assert.strictEqual(resEvilTool.status, 404, '非 Release 发布资产应直接返回 404，避免向 GitHub 盲目发包');
  });

  console.log(`\n================================`);
  console.log(`🎯 测试结果: ${passed} 项通过, ${failed} 项失败`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
