/**
 * 英雄联盟皮肤查询与下载服务 - 前端核心逻辑
 * 纯自包含 Vanilla JavaScript (ES6+)，零外部 CDN 依赖
 */

(function () {
  'use strict';

  // 全局状态管理
  const state = {
    champions: [],
    selectedChampion: null,
    currentSkins: [],
    filterType: 'all', // 'all' | 'base' | 'chroma'
    subSearchKeyword: '',
    activeDropdownIndex: -1,
    isSearching: false
  };

  // DOM 元素缓存
  const elements = {
    // 顶部状态
    lastUpdatedText: document.getElementById('lastUpdatedText'),
    champCount: document.getElementById('champCount'),
    skinCount: document.getElementById('skinCount'),
    refreshBtn: document.getElementById('refreshBtn'),

    // 搜索与下拉
    searchInput: document.getElementById('championSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    dropdown: document.getElementById('autocompleteDropdown'),
    dropdownList: document.getElementById('dropdownList'),
    dropdownCountText: document.getElementById('dropdownCountText'),
    quickTags: document.getElementById('quickTags'),

    // 英雄横幅
    bannerAvatar: document.getElementById('bannerAvatar'),
    bannerTitle: document.getElementById('bannerTitle'),
    bannerName: document.getElementById('bannerName'),
    bannerKey: document.getElementById('bannerKey'),
    bannerEnName: document.getElementById('bannerEnName'),
    bannerStats: document.getElementById('bannerStats'),

    // 过滤器与皮肤网格
    filterTabs: document.getElementById('skinFilterTabs'),
    countAll: document.getElementById('countAll'),
    countBase: document.getElementById('countBase'),
    countChroma: document.getElementById('countChroma'),
    subSearchInput: document.getElementById('skinSubSearchInput'),
    skinsGrid: document.getElementById('skinsGrid'),
    emptySkinsState: document.getElementById('emptySkinsState'),

    // Toast 通知
    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * 初始化应用
   */
  async function init() {
    bindEvents();
    await fetchInfo();
    await fetchChampions();
    
    // 默认展示亚索 (key: 157)，若无则展示第一位英雄
    const defaultChamp = state.champions.find(c => c.key === '157') || state.champions[0];
    if (defaultChamp) {
      selectChampion(defaultChamp.key);
    }
  }

  /**
   * 绑定界面交互事件
   */
  function bindEvents() {
    // 搜索框输入联想
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    elements.searchInput.addEventListener('focus', () => {
      if (elements.searchInput.value.trim()) {
        openDropdown();
      }
    });

    // 清除搜索框
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      closeDropdown();
      elements.searchInput.focus();
    });

    // 点击页面其他区域关闭下拉菜单
    document.addEventListener('click', (e) => {
      if (!elements.searchInput.contains(e.target) && !elements.dropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    // 快捷标签点击
    elements.quickTags.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-btn');
      if (btn && btn.dataset.key) {
        selectChampion(btn.dataset.key);
      }
    });

    // 皮肤类型筛选 Tab 切换
    elements.filterTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (tab && tab.dataset.filter) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.filterType = tab.dataset.filter;
        renderSkins();
      }
    });

    // 皮肤内部关键字筛选
    elements.subSearchInput.addEventListener('input', (e) => {
      state.subSearchKeyword = e.target.value.trim().toLowerCase();
      renderSkins();
    });

    // 检查更新按钮
    elements.refreshBtn.addEventListener('click', handleSync);
  }

  /**
   * 获取服务基本信息及北京时间
   */
  async function fetchInfo() {
    try {
      const res = await fetch('/api/info');
      if (!res.ok) return;
      const data = await res.json();
      if (data.lastUpdatedBeijing) {
        elements.lastUpdatedText.textContent = data.lastUpdatedBeijing;
      }
      if (data.stats) {
        elements.champCount.textContent = data.stats.totalChampions || '173';
        elements.skinCount.textContent = (data.stats.totalSkins || '9,000+').toLocaleString();
      }
    } catch (err) {
      console.error('获取服务信息失败:', err);
    }
  }

  /**
   * 获取全部英雄基础摘要列表
   */
  async function fetchChampions() {
    try {
      const res = await fetch('/api/champions');
      if (!res.ok) return;
      const data = await res.json();
      state.champions = data.champions || [];
    } catch (err) {
      console.error('获取英雄列表失败:', err);
      showToast('获取英雄列表失败，请刷新页面', 'error');
    }
  }

  /**
   * 搜索框输入处理 (带本地极速检索)
   */
  let searchDebounceTimer = null;
  function handleSearchInput(e) {
    const val = e.target.value.trim();
    if (val) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
      closeDropdown();
      return;
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchChampions(val);
    }, 120);
  }

  /**
   * 本地实时匹配英雄 (中文名、称号、全拼、首拼、英文名、编号)
   */
  function searchChampions(query) {
    const q = query.toLowerCase();
    const scored = [];

    for (const c of state.champions) {
      let score = 0;
      const key = c.key;
      const id = c.id.toLowerCase();
      const name = c.name.toLowerCase();
      const title = c.title.toLowerCase();

      // 1. 精确命中
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

      // 5. 别名/俗称匹配 (如 "盲僧")
      for (const alias of c.aliases || []) {
        const al = alias.toLowerCase();
        if (al === q) score += 100;
        else if (al.startsWith(q)) score += 50;
        else if (al.includes(q)) score += 30;
      }

      // 6. 拼音匹配
      for (const token of c.searchTokens || []) {
        if (token === q) score += 60;
        else if (token.startsWith(q)) score += 25;
      }

      // 核心本名拼音首字母匹配加分
      if (c.searchTokens && (c.searchTokens[6] === q || c.searchTokens[7] === q)) {
        score += 30;
      }

      if (score > 0) {
        const tieBreaker = (c.totalSkins || 0) * 0.05;
        scored.push({ champion: c, score: score + tieBreaker });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.map(item => item.champion).slice(0, 15);
    renderDropdown(matches, query);
  }

  /**
   * 渲染下拉菜单
   */
  function renderDropdown(matches, query) {
    if (matches.length === 0) {
      elements.dropdownCountText.textContent = `未找到与 “${escapeHtml(query)}” 相关的英雄`;
      elements.dropdownList.innerHTML = `<li class="dropdown-item" style="color:var(--text-dim); justify-content:center; padding:20px;">无匹配英雄，请尝试输入英雄别称或拼音</li>`;
      openDropdown();
      state.activeDropdownIndex = -1;
      return;
    }

    elements.dropdownCountText.textContent = `找到 ${matches.length} 位匹配英雄`;
    state.activeDropdownIndex = 0; // 默认高亮第一项

    elements.dropdownList.innerHTML = matches.map((c, index) => {
      const activeClass = index === 0 ? 'active' : '';
      return `
        <li class="dropdown-item ${activeClass}" data-key="${c.key}" data-index="${index}">
          <div class="dropdown-item-left">
            <img class="item-avatar" src="/api/proxy/champion-icon/${c.key}" alt="${c.name}" loading="lazy" onerror="this.src='/api/proxy/champion-icon/${c.key}'">
            <div class="item-info">
              <div class="item-name-row">
                <span class="item-title">${escapeHtml(c.title)}</span>
                <strong class="item-name">${escapeHtml(c.name)}</strong>
              </div>
              <span class="item-en">${escapeHtml(c.id)}</span>
            </div>
          </div>
          <div class="dropdown-item-right">
            <span class="item-key-badge">#${c.key}</span>
            <span class="item-skins-badge">${c.totalSkins} 款皮肤</span>
          </div>
        </li>
      `;
    }).join('');

    // 点击下拉项
    elements.dropdownList.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.key;
        if (key) {
          selectChampion(key);
          closeDropdown();
        }
      });
    });

    openDropdown();
  }

  /**
   * 键盘上下键与回车操作下拉菜单
   */
  function handleSearchKeydown(e) {
    const items = elements.dropdownList.querySelectorAll('.dropdown-item[data-key]');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.activeDropdownIndex = (state.activeDropdownIndex + 1) % items.length;
      updateDropdownActiveState(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.activeDropdownIndex = (state.activeDropdownIndex - 1 + items.length) % items.length;
      updateDropdownActiveState(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state.activeDropdownIndex >= 0 && state.activeDropdownIndex < items.length) {
        const activeItem = items[state.activeDropdownIndex];
        const key = activeItem.dataset.key;
        if (key) {
          selectChampion(key);
          closeDropdown();
        }
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  function updateDropdownActiveState(items) {
    items.forEach((it, idx) => {
      if (idx === state.activeDropdownIndex) {
        it.classList.add('active');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('active');
      }
    });
  }

  function openDropdown() {
    elements.dropdown.classList.remove('hidden');
  }

  function closeDropdown() {
    elements.dropdown.classList.add('hidden');
    state.activeDropdownIndex = -1;
  }

  /**
   * 选中英雄并加载其全量皮肤数据
   */
  async function selectChampion(key) {
    try {
      const res = await fetch(`/api/champions/${key}`);
      if (!res.ok) {
        throw new Error(`加载英雄详情失败: HTTP ${res.status}`);
      }
      const champ = await res.json();
      state.selectedChampion = champ;
      state.currentSkins = champ.skins || [];

      // 更新搜索框展示
      elements.searchInput.value = `${champ.title} ${champ.name}`;
      elements.clearSearchBtn.classList.remove('hidden');

      // 更新横幅概览
      elements.bannerAvatar.src = `/api/proxy/champion-icon/${champ.key}`;
      elements.bannerAvatar.alt = champ.name;
      elements.bannerTitle.textContent = champ.title;
      elements.bannerName.textContent = champ.name;
      elements.bannerKey.textContent = `#${champ.key}`;
      elements.bannerEnName.textContent = champ.id;
      elements.bannerStats.textContent = `收录 ${champ.totalSkins} 款皮肤 (${champ.totalFiles} 个下载文件)`;

      // 重置二级筛选
      state.filterType = 'all';
      state.subSearchKeyword = '';
      elements.subSearchInput.value = '';
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === 'all');
      });

      // 计算统计角标
      const baseCount = state.currentSkins.filter(s => !s.isChroma).length;
      const chromaCount = state.currentSkins.filter(s => s.isChroma).length;
      elements.countAll.textContent = state.currentSkins.length;
      elements.countBase.textContent = baseCount;
      elements.countChroma.textContent = chromaCount;

      // 渲染皮肤卡片
      renderSkins();

      // 平滑滚动至内容区
      elements.bannerAvatar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('加载英雄失败:', err);
      showToast('加载皮肤数据失败，请重试', 'error');
    }
  }

  /**
   * 渲染皮肤卡片列表
   */
  function renderSkins() {
    if (!state.selectedChampion || !state.currentSkins) return;

    let filtered = state.currentSkins;

    // 1. 类型过滤
    if (state.filterType === 'base') {
      filtered = filtered.filter(s => !s.isChroma);
    } else if (state.filterType === 'chroma') {
      filtered = filtered.filter(s => s.isChroma);
    }

    // 2. 关键词过滤
    if (state.subSearchKeyword) {
      filtered = filtered.filter(s => {
        const idMatch = s.id.includes(state.subSearchKeyword);
        const nameMatch = s.name.toLowerCase().includes(state.subSearchKeyword);
        return idMatch || nameMatch;
      });
    }

    if (filtered.length === 0) {
      elements.skinsGrid.innerHTML = '';
      elements.emptySkinsState.classList.remove('hidden');
      return;
    }

    elements.emptySkinsState.classList.add('hidden');
    const champKey = state.selectedChampion.key;

    elements.skinsGrid.innerHTML = filtered.map(skin => {
      const mainFile = skin.files[0] || null;
      const hasFiles = skin.files && skin.files.length > 0;
      const fileSizeFormatted = mainFile ? formatFileSize(mainFile.size) : '0 B';

      // 徽标类型
      let typeLabel = '常规皮肤';
      let typeClass = 'type-skin';
      if (skin.isBase) {
        typeLabel = '基础原皮';
        typeClass = 'type-base';
      } else if (skin.isChroma) {
        typeLabel = '炫彩皮肤';
        typeClass = 'type-chroma';
      }

      // 下载按钮渲染
      let downloadButtonHtml = '';
      if (hasFiles) {
        downloadButtonHtml = `
          <button class="download-btn" data-path="${escapeHtml(mainFile.path)}" data-name="${escapeHtml(skin.name)}">
            <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="btn-text">立即下载 (.fantome)</span>
          </button>
        `;
      } else {
        downloadButtonHtml = `
          <div class="no-file-notice">暂无单独独立文件</div>
        `;
      }

      // 多文件选项（例如包含 classic 旧版资源）
      let extraFilesHtml = '';
      if (skin.files.length > 1) {
        extraFilesHtml = `
          <div class="extra-files-group">
            <span style="font-size:0.7rem; color:var(--text-dim); margin-right:4px;">备选版本:</span>
            ${skin.files.slice(1).map(f => `
              <a href="/api/skins/download?path=${encodeURIComponent(f.path)}" class="sub-download-btn" download>
                ${f.category === 'classic' ? '经典旧版' : '备选包'} (${formatFileSize(f.size)})
              </a>
            `).join('')}
          </div>
        `;
      }

      return `
        <article class="skin-card" data-skin-id="${skin.id}">
          <div class="skin-image-box">
            <img 
              class="skin-image" 
              src="/api/proxy/skin-image/${champKey}/${skin.id}" 
              alt="${escapeHtml(skin.name)}"
              loading="lazy"
            >
            <span class="skin-badge-id">编号: ${skin.id}</span>
            <span class="skin-badge-type ${typeClass}">${typeLabel}</span>
          </div>
          <div class="skin-content">
            <div class="skin-header">
              <h3 class="skin-name" title="${escapeHtml(skin.name)}">${escapeHtml(skin.name)}</h3>
              <div class="skin-details-row">
                <span>编号: ${skin.id}</span>
                <span class="skin-size">${hasFiles ? `文件大小: ${fileSizeFormatted}` : ''}</span>
              </div>
            </div>
            <div class="skin-download-actions">
              ${downloadButtonHtml}
              ${extraFilesHtml}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // 绑定下载点击动效
    elements.skinsGrid.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const filePath = btn.dataset.path;
        const skinName = btn.dataset.name;
        if (filePath) {
          triggerDownload(btn, filePath, skinName);
        }
      });
    });
  }

  /**
   * 触发文件下载及前端状态反馈
   */
  async function triggerDownload(btn, filePath, skinName) {
    if (btn.classList.contains('downloading')) return;

    btn.classList.add('downloading');
    const textSpan = btn.querySelector('.btn-text');
    const originalText = textSpan ? textSpan.textContent : '立即下载 (.fantome)';
    if (textSpan) textSpan.textContent = '正在下载...';

    try {
      // 创建隐藏 a 标签触发代理下载
      const downloadUrl = `/api/skins/download?path=${encodeURIComponent(filePath)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filePath.split('/').pop() || 'skin.fantome';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 视觉状态变为成功
      setTimeout(() => {
        btn.classList.remove('downloading');
        btn.classList.add('success');
        if (textSpan) textSpan.textContent = '已触发下载 ✓';
        showToast(`已开始下载: ${skinName}`, 'success');

        setTimeout(() => {
          btn.classList.remove('success');
          if (textSpan) textSpan.textContent = originalText;
        }, 2500);
      }, 600);
    } catch (err) {
      console.error('下载触发失败:', err);
      btn.classList.remove('downloading');
      if (textSpan) textSpan.textContent = '下载失败';
      showToast('文件下载失败，请重试', 'error');

      setTimeout(() => {
        if (textSpan) textSpan.textContent = originalText;
      }, 2000);
    }
  }

  /**
   * 主动检查与同步最新资源
   */
  async function handleSync() {
    if (elements.refreshBtn.classList.contains('spinning')) return;
    elements.refreshBtn.classList.add('spinning');
    showToast('正在从 GitHub 检查皮肤仓库最新数据...', 'info');

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.info) {
        elements.lastUpdatedText.textContent = data.info.lastUpdatedBeijing;
        elements.champCount.textContent = data.info.stats.totalChampions || '173';
        elements.skinCount.textContent = (data.info.stats.totalSkins || '9,000+').toLocaleString();
        await fetchChampions();
        if (state.selectedChampion) {
          await selectChampion(state.selectedChampion.key);
        }
        showToast(`同步成功！更新时间: ${data.info.lastUpdatedBeijing}`, 'success');
      } else {
        throw new Error(data.error || '同步失败');
      }
    } catch (err) {
      console.error('同步失败:', err);
      showToast(`同步失败: ${err.message}`, 'error');
    } finally {
      elements.refreshBtn.classList.remove('spinning');
    }
  }

  /**
   * 格式化文件大小
   */
  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  /**
   * HTML 转义防 XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 简易 Toast 提示
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  }

  // 启动应用
  document.addEventListener('DOMContentLoaded', init);
})();
