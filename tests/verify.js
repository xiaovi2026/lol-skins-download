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

    // 检查是否有外部 script 标签（因采用 /stats/script.js 同源第一方代理，页面中不得存在任何外部第三方的 script 标签）
    const scriptSrcMatches = [...html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]);
    assert.strictEqual(scriptSrcMatches.length, 0, `index.html 中不得包含外部 http/https script: ${scriptSrcMatches.join(', ')}`);
    assert.ok(html.includes('/stats/script.js'), '必须包含同源反代统计脚本 /stats/script.js');
    assert.ok(html.includes('data-website-id="2e1dbf68-10c3-4605-8b98-d9da96a655e3"'), '必须包含用户 website-id');
    assert.ok(html.includes('data-host-url="https://u.xiaovi.de"'), '必须包含直连 host-url 配置以保证地理位置识别准确');
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
    assert.ok(data.stats.totalFiles >= 9000, '收录下载文件数必须 >= 9000');
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

  // 7. 验证皮肤下载代理接口已下线
  await test('GET /api/skins/download 应已被移除 (禁止服务端代理下载皮肤大文件)', async () => {
    const res = await fetch(`${BASE_URL}/api/skins/download?path=skins/1/1001/1001.fantome`);
    assert.strictEqual(res.status, 404, '皮肤代理下载接口应返回 404 Not Found');
  });

  // 8. 验证静态首页与完整组件 (含右上角线路选择器)
  await test('GET / (首页加载及组件完整性，含右上角线路选择器)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('championSearchInput'), '必须包含英雄搜索输入框');
    assert.ok(html.includes('autocompleteDropdown'), '必须包含下拉联想组件');
    assert.ok(html.includes('lastUpdatedText'), '必须包含最后更新时间展示元素');
    assert.ok(html.includes('skinsGrid'), '必须包含皮肤网格容器');
    assert.ok(html.includes('downloadRouteSelect'), '必须包含右上角下载线路选择器');
    assert.ok(html.includes('https://ghfast.top/'), '必须包含 ghfast 加速线路选项');
    assert.ok(html.includes('direct'), '必须包含 GitHub 直连线路选项');
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

  // 11. 验证客户端直链与代理加速逻辑
  await test('客户端直接下载与加速线路生成逻辑验证', async () => {
    const appJs = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf-8');
    assert.ok(appJs.includes('raw.githubusercontent.com/Alban1911/LeagueSkins/main/'), '必须包含 GitHub raw 皮肤直链基准地址');
    assert.ok(appJs.includes('https://ghfast.top/'), '必须包含默认推荐代理线路 ghfast.top');
    assert.ok(appJs.includes('getSkinDownloadUrl'), '必须包含皮肤下载直链/代理生成函数');
    assert.ok(appJs.includes('downloadRouteSelect'), '必须绑定线路选择器');
  });

  // 12. 验证 LTK Manager 官方直链发布信息接口
  await test('GET /api/tools/ltk-manager (获取最新挂载器版本与 GitHub 官方直链)', async () => {
    const res = await fetch(`${BASE_URL}/api/tools/ltk-manager`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.tag, '必须包含 tag 字段');
    assert.ok(data.publishedAtBeijing, '必须包含北京时间');
    assert.ok(data.primaryAsset, '必须包含默认主要下载文件');
    assert.ok(data.primaryAsset.name.endsWith('.exe'), '主要文件应为 Windows 可执行程序');
    assert.ok(data.primaryAsset.downloadUrl.startsWith('https://github.com/'), '下载链接必须为 GitHub 官方直链');
    console.log(`   [当前最新 LTK Manager: ${data.name} | 直链: ${data.primaryAsset.downloadUrl}]`);
  });

  // 13. 验证 LTK Manager 代理下载接口已下线
  await test('GET /api/tools/ltk-manager/download 应已被移除 (禁止服务端代理下载工具安装包)', async () => {
    const res = await fetch(`${BASE_URL}/api/tools/ltk-manager/download?filename=latest.json`);
    assert.strictEqual(res.status, 404, '工具代理下载接口应返回 404 Not Found');
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

  // 15. 验证已下线接口与非法访问防护
  await test('已下线下载代理接口与防护测试', async () => {
    const resSkin = await fetch(`${BASE_URL}/api/skins/download?path=skins/1/1001/1001.fantome`);
    assert.strictEqual(resSkin.status, 404, '皮肤代理已下线返回 404');

    const resTool = await fetch(`${BASE_URL}/api/tools/ltk-manager/download?filename=evil.exe`);
    assert.strictEqual(resTool.status, 404, '工具代理已下线返回 404');
  });

  // 16. 验证 Umami 同源第一方统计代理通道 (防 AdBlock 广告拦截器)
  await test('Umami 同源反向代理通道验证 (防 AdBlocker)', async () => {
    // 验证客户端脚本同源拉取
    const resScript = await fetch(`${BASE_URL}/stats/script.js`);
    assert.strictEqual(resScript.status, 200, 'stats/script.js 代理应返回 200 OK');
    const scriptType = resScript.headers.get('content-type');
    assert.ok(scriptType.includes('javascript'), 'Content-Type 必须为 JavaScript');
    const scriptContent = await resScript.text();
    assert.ok(scriptContent.length > 1000, '脚本内容体积应正常 (> 1KB)');

    // 验证事件上报通道 (向 /stats/api/send 发送测试 ping)
    const resSend = await fetch(`${BASE_URL}/stats/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: '2e1dbf68-10c3-4605-8b98-d9da96a655e3',
          name: 'verify_test_ping',
          data: { test: true }
        }
      })
    });
    assert.strictEqual(resSend.status, 200, '/stats/api/send 代理应成功转发');
    const sendJson = await resSend.json();
    assert.ok(sendJson.beep === 'boop' || sendJson.ok !== undefined, 'Umami 应返回确认响应');
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
