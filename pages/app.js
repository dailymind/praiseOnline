// ========== 全局配置 ==========
const API_BASE = (function() {
  const metaApi = document.querySelector('meta[name="api-base"]');
  let base = (metaApi && metaApi.content) ? metaApi.content : 'https://papi.yourdomain.com';
  if (!/^https?:\/\//i.test(base)) {
    base = 'https://' + base;
  }
  return base;
})();

// 公开文件域名（R2 自定义域）：音频等媒体直接从这里播放，不再走 Worker 的 /api/file/
const FILE_BASE = (function() {
  const metaFile = document.querySelector('meta[name="file-base"]');
  let base = (metaFile && metaFile.content ? metaFile.content : '').trim();
  // 未配置（空值或仍是 CI 占位符）时回退到默认公开域名
  if (!base || /^__.*__$/.test(base)) {
    base = 'https://r2files.242500.xyz';
  }
  if (!/^https?:\/\//i.test(base)) {
    base = 'https://' + base;
  }
  return base.replace(/\/+$/, '');
})();

// 把 R2 key 转换成公开域名下的直链：保留目录分隔符 "/"，其余字符按段编码
function buildFileUrl(key) {
  const encoded = String(key || '')
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
  return `${FILE_BASE}/${encoded}`;
}

// ========== 播放器控件（全局共享，只绑定一次） ==========
// 赞美/话语/资料三个模块共用底部迷你播放器，重复绑定会让播放/暂停互相抵消，这里统一收口。
const PlayerControls = (function() {
  let initialized = false;

  function init() {
    if (initialized) return;

    const player = document.getElementById("player");
    const playPauseBtn = document.getElementById("playPauseBtn");
    if (!player || !playPauseBtn) return;

    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    const progressFill = document.querySelector('.progress-fill');

    // 播放/暂停：以播放器真实状态为准
    playPauseBtn.addEventListener('click', () => {
      if (!player.src) return;
      if (player.paused) {
        player.play().catch(()=>{});
      } else {
        player.pause();
      }
    });

    player.addEventListener('play', () => {
      playPauseBtn.classList.add('playing');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
    });

    player.addEventListener('pause', () => {
      playPauseBtn.classList.remove('playing');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    // 进度环
    player.addEventListener('timeupdate', () => {
      if (!player.duration || !progressFill) return;
      const percent = (player.currentTime / player.duration) * 100;
      const circumference = 100.531;
      progressFill.style.strokeDasharray = `${circumference} ${circumference}`;
      progressFill.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    });

    initialized = true;
  }

  return { init, isInitialized: () => initialized };
})();

// HTML 转义工具
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// 防抖工具
function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ========== 路由模块 ==========
const Router = {
  currentRoute: null,

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    const [route, ...params] = hash.split('/');

    // 隐藏所有页面
    document.querySelectorAll('[data-page]').forEach(el => {
      el.style.display = 'none';
    });

    // 显示当前页面（flex 以便页面内部使用 flex 布局滚动列表）
    const pageEl = document.querySelector(`[data-page="${route}"]`);
    if (pageEl) {
      pageEl.style.display = 'flex';
    }

    // 更新返回首页按钮显示状态
    document.querySelectorAll('#backToHomeBtn').forEach(btn => {
      btn.style.display = route === 'home' ? 'none' : 'flex';
    });

    // 调用对应模块的初始化
    if (route === 'home' && HomePage.init) HomePage.init();
    if (route === 'praise' && PraiseModule.init) PraiseModule.init();
    if (route === 'words' && WordsModule.init) WordsModule.init();
    if (route === 'bible' && BibleModule.init) BibleModule.init();
    if (route === 'resources' && ResourcesModule.init) ResourcesModule.init();
  },

  navigate(route) {
    window.location.hash = route;
  }
};

// ========== 首页模块 ==========
const HomePage = {
  init() {
    // 绑定卡片点击事件
    document.querySelectorAll('.module-card').forEach(card => {
      // 避免重复绑定
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.addEventListener('click', () => {
        const module = card.dataset.module;
        Router.navigate(module);
      });
    });
  }
};

// ========== 赞美模块 ==========
const PraiseModule = (function() {
  // 状态变量
  let songs = [];
  let originalSongs = [];
  let currentDir = "praise/附录/";
  let reverseOrder = false;
  let currentKey = null;
  let currentIndex = -1;
  let playMode = 0; // 0:顺序 1:单曲循环 2:随机
  let recentSongs = [];
  let isPlaying = false;
  let timerId = null;
  let timerMinutes = 0;

  // 过滤和搜索状态
  let filterMode = localStorage.getItem('praise_filterMode') || 'all';
  let searchQuery = localStorage.getItem('praise_searchQuery') || '';

  // DOM 元素
  let menuBtns, player, listEl, miniPlayer, playPauseBtn, playModeBtn;
  let songInfoContent, recentListBtn, recentListPanel, recentListItems;
  let closeRecentBtn, timerBtn, timerPanel, closeTimerBtn, timerStatus, cancelTimerBtn;
  let playIcon, pauseIcon, progressFill, filterControl, filterMenuBtn, filterMenu;
  let sortToggleBtn, searchInputDesktop, searchInputMobile, searchFab, searchOverlay, searchBack, listCountEl;

  // 播放模式图标路径
  const playModeIconPaths = [
    'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
    'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-2.97 2.17-5.43 5-5.91V6.09C8.05 6.57 5 9.93 5 13.93c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    'M9.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm0 5c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm0 5c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zM5.01 15.5l4-4 4 4-4 4-4-4zm9.02-3.5l4-4 4 4-4 4-4-4z'
  ];

  // 获取目录名称
  function getDirName(dirPath) {
    const dirs = dirPath.split('/');
    return dirs[dirs.length - 2] || '未知';
  }

  // 格式化歌曲名称
  function formatSongName(key, name) {
    const dir = getDirName(key);
    const cleanName = name.replace(/\.mp3$/i, '');
    return `(${dir})${cleanName}`;
  }

  // 标准化名称用于匹配
  function normalizeNameForMatch(name) {
    if (!name) return '';
    const withoutExt = name.replace(/\.[^/.]+$/, '');
    return withoutExt.toLowerCase();
  }

  // 检查是否是合唱
  function matchesChorus(name) {
    const n = normalizeNameForMatch(name);
    return n.endsWith('-合');
  }

  // 应用过滤和搜索
  function applyFiltersAndSearch() {
    let list = originalSongs.slice();
    if (filterMode === 'only_chorus') {
      list = list.filter(s => matchesChorus(s.name));
    } else if (filterMode === 'exclude_chorus') {
      list = list.filter(s => !matchesChorus(s.name));
    }
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(s => {
        const name = (s.name || '').toLowerCase();
        const key = (s.key || '').toLowerCase();
        return name.includes(q) || key.includes(q);
      });
    }
    if (reverseOrder) list.reverse();
    songs = list;
    if (listCountEl) {
      listCountEl.textContent = `${songs.length} / ${originalSongs.length}`;
    }
  }

  // 渲染列表
  function renderList() {
    listEl.innerHTML = "";
    songs.forEach((s, idx) => {
      const li = document.createElement('li');
      li.className = 'song-item' + (idx === currentIndex ? ' playing' : '');
      let display = escapeHtml(formatSongName(s.key, s.name));
      const q = (searchQuery || '').trim();
      if (q) {
        const regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        display = display.replace(regex, '<mark class="search-hit">$1</mark>');
      }
      li.innerHTML = `<div class="song-name">${display}</div>`;
      li.onclick = () => playByIndex(idx);
      listEl.appendChild(li);
    });
  }

  // 加载列表
  async function loadList(dir) {
    currentDir = dir;
    const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    const data = await res.json();
    originalSongs = Array.isArray(data.songs) ? data.songs.map(name => ({
      name: name,
      key: dir + name
    })) : [];
    localStorage.setItem('praise_filterMode', filterMode);
    localStorage.setItem('praise_searchQuery', searchQuery);
    applyFiltersAndSearch();
    if (currentKey) currentIndex = songs.findIndex(s => s.key === currentKey);
    else currentIndex = -1;
    renderList();
  }

  // 按索引播放
  function playByIndex(idx) {
    if (idx < 0 || idx >= songs.length) return;
    const s = songs[idx];
    const url = buildFileUrl(s.key);
    player.src = url;
    player.play().catch(()=>{});
    currentKey = s.key;
    currentIndex = idx;
    const displayName = formatSongName(s.key, s.name);
    updateSongInfo(displayName);
    showMiniPlayer();
    addToRecent(s.name, s.key);
    renderList();
  }

  // 更新歌曲信息
  function updateSongInfo(displayName) {
    songInfoContent.textContent = displayName || '未播放';
    songInfoContent.style.animation = 'none';
    setTimeout(() => {
      const contentWidth = songInfoContent.scrollWidth;
      const containerWidth = songInfoContent.parentElement.offsetWidth;
      if (contentWidth > containerWidth) {
        songInfoContent.style.animation = '';
      }
    }, 10);
  }

  // 显示迷你播放器
  function showMiniPlayer() {
    // 如果 miniPlayer 未初始化，先获取它
    if (!miniPlayer) {
      miniPlayer = document.getElementById("miniPlayer");
    }
    if (miniPlayer) {
      miniPlayer.style.display = 'block';
    }
  }

  // 添加到最近播放
  function addToRecent(name, key) {
    recentSongs = recentSongs.filter(s => s.key !== key);
    recentSongs.unshift({ name, key });
    if (recentSongs.length > 10) recentSongs.pop();
  }

  // 渲染最近播放列表
  function renderRecentList() {
    recentListItems.innerHTML = '';
    if (recentSongs.length === 0) {
      recentListItems.innerHTML = '<li style="padding:16px;color:#999;text-align:center;">暂无播放记录</li>';
      return;
    }
    recentSongs.forEach((song, idx) => {
      const li = document.createElement('li');
      li.className = 'recent-list-item' + (song.key === currentKey ? ' playing' : '');
      const displayName = formatSongName(song.key, song.name);
      li.innerHTML = `<span style="width:20px;text-align:center;">${idx + 1}</span>${escapeHtml(displayName)}`;
      li.onclick = () => {
        const foundIndex = songs.findIndex(s => s.key === song.key);
        if (foundIndex >= 0) {
          playByIndex(foundIndex);
          recentListPanel.classList.remove('show');
        }
      };
      recentListItems.appendChild(li);
    });
  }

  // 定时功能
  function startTimer(minutes) {
    cancelTimer();
    timerMinutes = minutes;
    timerId = setTimeout(() => {
      player.pause();
      timerStatus.textContent = '已自动停止播放';
      timerId = null;
      cancelTimerBtn.style.display = 'none';
    }, minutes * 60 * 1000);
    timerStatus.textContent = `将在 ${minutes} 分钟后自动停止`;
    cancelTimerBtn.style.display = 'block';
    document.querySelectorAll('.timer-option-btn').forEach(btn => {
      if (parseInt(btn.dataset.minutes) === minutes) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function cancelTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    timerStatus.textContent = '';
    cancelTimerBtn.style.display = 'none';
    document.querySelectorAll('.timer-option-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  // 更新进度条
  function updateProgress() {
    if (!player.duration) {
      progressFill.style.strokeDasharray = '0 100';
      return;
    }
    const percent = (player.currentTime / player.duration) * 100;
    const circumference = 100.531;
    const dashoffset = circumference - (percent / 100) * circumference;
    progressFill.style.strokeDasharray = `${circumference} ${circumference}`;
    progressFill.style.strokeDashoffset = dashoffset;
  }

  // 高亮当前播放
  function highlightCurrentIfPresent() {
    if (!currentKey) return;
    currentIndex = songs.findIndex(s => s.key === currentKey);
    renderList();
  }

  // 初始化控件
  function initControls() {
    reverseOrder = (localStorage.getItem('praise_reverseOrder') === 'true') || false;

    // 菜单按钮
    menuBtns = document.querySelectorAll("[data-page=\"praise\"] .menu-btn");
    menuBtns.forEach(btn => btn.addEventListener("click", async () => {
      menuBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const dir = btn.dataset.dir;
      await loadList(dir);
      highlightCurrentIfPresent();
    }));

    // 过滤控件
    filterControl = document.getElementById('filterControl');
    filterMenuBtn = document.getElementById('filterMenuBtn');
    filterMenu = document.getElementById('filterMenu');

    if (filterControl) {
      const btns = filterControl.querySelectorAll('button');
      btns.forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filterMode);
        b.addEventListener('click', () => {
          btns.forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          filterMode = b.dataset.filter;
          localStorage.setItem('praise_filterMode', filterMode);
          applyFiltersAndSearch(); renderList();
        });
      });
    }

    if (filterMenuBtn && filterMenu) {
      filterMenu.classList.remove('open');
      filterMenuBtn.setAttribute('aria-expanded', 'false');
      const toggleFilterMenu = (e) => {
        e && e.stopPropagation();
        const isOpen = filterMenu.classList.toggle('open');
        filterMenuBtn.setAttribute('aria-expanded', isOpen.toString());
      };
      filterMenuBtn.addEventListener('click', toggleFilterMenu);
      filterMenuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleFilterMenu(e); });
      const items = filterMenu.querySelectorAll('.fm-item');
      const syncMobileFilterActive = () => {
        items.forEach(i => i.classList.toggle('active', i.dataset.filter === filterMode));
      };
      syncMobileFilterActive();
      items.forEach(it => {
        it.addEventListener('click', (e) => {
          e.stopPropagation();
          filterMode = it.dataset.filter;
          if (filterControl) {
            filterControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.filter === filterMode));
          }
          syncMobileFilterActive();
          localStorage.setItem('praise_filterMode', filterMode);
          applyFiltersAndSearch(); renderList();
          filterMenu.classList.remove('open');
          filterMenuBtn.setAttribute('aria-expanded', 'false');
        });
        it.addEventListener('touchstart', (e) => { e.stopPropagation(); });
      });
      filterMenuBtn.addEventListener('click', () => setTimeout(syncMobileFilterActive, 0));
    }

    // 排序按钮
    sortToggleBtn = document.getElementById('sortToggleBtn');
    if (sortToggleBtn) {
      sortToggleBtn.setAttribute('aria-pressed', reverseOrder ? 'true' : 'false');
      sortToggleBtn.addEventListener('click', () => {
        reverseOrder = !reverseOrder;
        localStorage.setItem('praise_reverseOrder', reverseOrder);
        sortToggleBtn.setAttribute('aria-pressed', reverseOrder ? 'true' : 'false');
        applyFiltersAndSearch(); renderList();
      });
    }

    // 搜索
    searchInputDesktop = document.getElementById('searchInputDesktop');
    searchInputMobile = document.getElementById('searchInputMobile');
    searchFab = document.getElementById('searchFab');
    searchOverlay = document.getElementById('searchOverlay');
    searchBack = document.getElementById('searchBack');
    listCountEl = document.getElementById('listCount');

    const doSearch = debounce((sourceInput) => {
      const val = sourceInput ? sourceInput.value : '';
      searchQuery = val || '';
      localStorage.setItem('praise_searchQuery', searchQuery);
      if (searchInputDesktop && searchInputDesktop !== sourceInput) {
        searchInputDesktop.value = searchQuery;
      }
      if (searchInputMobile && searchInputMobile !== sourceInput) {
        searchInputMobile.value = searchQuery;
      }
      applyFiltersAndSearch(); renderList();
    }, 220);

    const doSearchImmediate = (sourceInput) => {
      const val = sourceInput ? sourceInput.value : '';
      searchQuery = val || '';
      localStorage.setItem('praise_searchQuery', searchQuery);
      if (searchInputDesktop && searchInputDesktop !== sourceInput) {
        searchInputDesktop.value = searchQuery;
      }
      if (searchInputMobile && searchInputMobile !== sourceInput) {
        searchInputMobile.value = searchQuery;
      }
      applyFiltersAndSearch(); renderList();
    };

    if (searchInputDesktop) {
      searchInputDesktop.value = searchQuery || '';
      searchInputDesktop.addEventListener('input', (e) => doSearch(e.target));
      searchInputDesktop.addEventListener('search', (e) => doSearchImmediate(e.target));
    }
    if (searchInputMobile) {
      searchInputMobile.value = searchQuery || '';
      searchInputMobile.addEventListener('input', (e) => doSearch(e.target));
      searchInputMobile.addEventListener('search', (e) => doSearchImmediate(e.target));
    }

    if (searchFab && searchOverlay && searchInputMobile && searchBack) {
      searchOverlay.classList.remove('open');
      searchFab.classList.remove('hidden');
      const openSearch = (e) => {
        e && e.stopPropagation();
        searchOverlay.classList.add('open');
        searchOverlay.setAttribute('aria-hidden', 'false');
        searchFab.classList.add('hidden');
        setTimeout(() => searchInputMobile.focus(), 50);
      };
      const closeSearch = (e) => {
        e && e.stopPropagation();
        searchOverlay.classList.remove('open');
        searchOverlay.setAttribute('aria-hidden', 'true');
        searchFab.classList.remove('hidden');
      };
      searchFab.addEventListener('click', openSearch);
      searchFab.addEventListener('touchstart', (e) => { e.preventDefault(); openSearch(e); });
      searchBack.addEventListener('click', closeSearch);
      searchBack.addEventListener('touchstart', (e) => { e.preventDefault(); closeSearch(e); });
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === '/') {
        e.preventDefault();
        if (searchInputDesktop) searchInputDesktop.focus();
        else if (searchFab && searchOverlay && searchInputMobile) {
          searchOverlay.classList.add('open');
          searchOverlay.setAttribute('aria-hidden', 'false');
          searchFab.classList.add('hidden');
          setTimeout(() => searchInputMobile.focus(), 50);
        }
      }
    });

    // 点击外部关闭弹窗
    document.addEventListener('click', (e) => {
      if (filterMenu && filterMenu.classList.contains('open') && !filterMenu.contains(e.target) && e.target !== filterMenuBtn) {
        filterMenu.classList.remove('open');
        filterMenuBtn.setAttribute('aria-expanded', 'false');
      }
      if (searchOverlay && searchOverlay.classList.contains('open') && !searchOverlay.contains(e.target) && e.target !== searchFab) {
        searchOverlay.classList.remove('open');
        searchOverlay.setAttribute('aria-hidden', 'true');
        if (searchFab) searchFab.classList.remove('hidden');
      }
      if (recentListPanel && recentListPanel.contains(e.target) === false && e.target !== recentListBtn) {
        recentListPanel.classList.remove('show');
      }
      if (timerPanel && timerPanel.contains(e.target) === false && e.target !== timerBtn) {
        timerPanel.classList.remove('show');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (filterMenu && filterMenu.classList.contains('open')) {
          filterMenu.classList.remove('open');
          filterMenuBtn.setAttribute('aria-expanded', 'false');
        }
        if (searchOverlay && searchOverlay.classList.contains('open')) {
          searchOverlay.classList.remove('open');
          searchOverlay.setAttribute('aria-hidden', 'true');
          if (searchFab) searchFab.classList.remove('hidden');
        }
        if (recentListPanel && recentListPanel.classList.contains('show')) recentListPanel.classList.remove('show');
        if (timerPanel && timerPanel.classList.contains('show')) timerPanel.classList.remove('show');
      }
    });
  }

  // 初始化模块
  async function init() {
    // 如果已经初始化过，跳过
    if (PraiseModule._initialized) return;

    // 获取 DOM 元素
    player = document.getElementById("player");
    listEl = document.getElementById("songList");
    miniPlayer = document.getElementById("miniPlayer");
    playPauseBtn = document.getElementById("playPauseBtn");
    playModeBtn = document.getElementById("playModeBtn");
    songInfoContent = document.getElementById("songInfoContent");
    recentListBtn = document.getElementById("recentListBtn");
    recentListPanel = document.getElementById("recentListPanel");
    recentListItems = document.getElementById("recentListItems");
    closeRecentBtn = document.getElementById("closeRecentBtn");
    timerBtn = document.getElementById("timerBtn");
    timerPanel = document.getElementById("timerPanel");
    closeTimerBtn = document.getElementById("closeTimerBtn");
    timerStatus = document.getElementById("timerStatus");
    cancelTimerBtn = document.getElementById("cancelTimerBtn");
    playIcon = playPauseBtn?.querySelector('.play-icon');
    pauseIcon = playPauseBtn?.querySelector('.pause-icon');
    progressFill = document.querySelector('.progress-fill');

    // 检查必需元素
    if (!player || !listEl) return;

    // 播放/暂停控件由全局 PlayerControls 统一绑定，避免与其他模块重复绑定
    PlayerControls.init();

    // 播放模式
    if (playModeBtn) {
      playModeBtn.addEventListener('click', () => {
        playMode = (playMode + 1) % 3;
        const path = playModeBtn.querySelector('.mode-icon path');
        if (path) path.setAttribute('d', playModeIconPaths[playMode]);
        playModeBtn.classList.toggle('active', playMode !== 0);
        const modeNames = ['顺序播放', '单曲循环', '随机播放'];
        playModeBtn.title = '播放模式：' + modeNames[playMode];
      });
    }

    // 最近播放
    if (recentListBtn && closeRecentBtn && recentListPanel) {
      recentListBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (timerPanel) timerPanel.classList.remove('show');
        renderRecentList();
        recentListPanel.classList.toggle('show');
      });
      closeRecentBtn.addEventListener('click', () => {
        recentListPanel.classList.remove('show');
      });
    }

    // 定时按钮
    if (timerBtn && closeTimerBtn && timerPanel) {
      timerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (recentListPanel) recentListPanel.classList.remove('show');
        timerPanel.classList.toggle('show');
      });
      closeTimerBtn.addEventListener('click', () => {
        timerPanel.classList.remove('show');
      });
      document.querySelectorAll('.timer-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const minutes = parseInt(btn.dataset.minutes);
          startTimer(minutes);
        });
      });
      if (cancelTimerBtn) {
        cancelTimerBtn.addEventListener('click', () => {
          cancelTimer();
        });
      }
    }

    // 播放器事件：图标与进度环由 PlayerControls 负责，这里只维护播放状态
    player.addEventListener('play', () => { isPlaying = true; });

    player.addEventListener('pause', () => { isPlaying = false; });

    player.addEventListener('ended', () => {
      let nextIndex = -1;
      if (playMode === 0) {
        if (currentIndex >= 0 && currentIndex < songs.length - 1) {
          nextIndex = currentIndex + 1;
        }
      } else if (playMode === 1) {
        nextIndex = currentIndex;
      } else if (playMode === 2) {
        if (songs.length > 1) {
          let randIndex;
          do {
            randIndex = Math.floor(Math.random() * songs.length);
          } while (randIndex === currentIndex && songs.length > 1);
          nextIndex = randIndex;
        }
      }
      if (nextIndex >= 0) {
        playByIndex(nextIndex);
      }
    });

    // 初始化进度条
    setInterval(updateProgress, 100);

    // 初始化控件
    initControls();

    // 加载默认目录
    await loadList(currentDir);

    // 恢复播放状态
    try {
      const src = player.src;
      if (src) {
        let decoded = null;
        if (src.indexOf(FILE_BASE + '/') === 0) {
          // 新格式：公开域名直链
          decoded = decodeURIComponent(src.slice(FILE_BASE.length + 1));
        } else {
          // 旧格式：Worker /api/file/<encoded-key>
          const parts = src.split('/api/file/');
          if (parts.length === 2) decoded = decodeURIComponent(parts[1]);
        }
        if (decoded) {
          currentKey = decoded;
          const idx = songs.findIndex(s => s.key === currentKey);
          if (idx >= 0) {
            currentIndex = idx;
            const songName = formatSongName(songs[idx].key, songs[idx].name);
            updateSongInfo(songName);
            showMiniPlayer();
            renderList();
          } else {
            const name = decoded.split('/').pop().replace(/\.mp3$/i, '');
            const displayName = `(${getDirName(decoded)})${name}`;
            updateSongInfo(displayName);
            showMiniPlayer();
          }
        }
      }
    } catch (e) { }

    PraiseModule._initialized = true;
  }

  return {
    init,
    loadList,
    playByIndex,
    showMiniPlayer,
    updateSongInfo,
    _initialized: false
  };
})();

// ========== 话语模块 ==========
const WordsModule = (function() {
  let songs = [];
  const currentDir = "worship/";

  async function loadList() {
    const listEl = document.getElementById("wordsList");
    if (!listEl) return;

    const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(currentDir)}`);
    if (!res.ok) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    const data = await res.json();
    songs = Array.isArray(data.songs) ? data.songs.map(name => ({
      name: name,
      key: currentDir + name
    })) : [];
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById("wordsList");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (songs.length === 0) {
      listEl.innerHTML = '<li class="song-item">暂无内容</li>';
      return;
    }
    songs.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'song-item';
      const display = s.name.replace(/\.mp3$/i, '').replace(/-/g, ' ');
      li.innerHTML = `<div class="song-name">${escapeHtml(display)}</div>`;
      li.onclick = () => playWord(s);
      listEl.appendChild(li);
    });
  }

  async function playWord(s) {
    const player = document.getElementById("player");
    const songInfoContent = document.getElementById("songInfoContent");
    const url = buildFileUrl(s.key);
    player.src = url;
    player.play().catch(()=>{});

    const displayName = s.name.replace(/\.mp3$/i, '').replace(/-/g, ' ');
    if (songInfoContent) {
      songInfoContent.textContent = displayName;
    }
    if (PraiseModule.showMiniPlayer) {
      PraiseModule.showMiniPlayer();
    }
    // 确保播放器控件事件已绑定
    initPlayerControls();
  }

  // 初始化播放器控件（统一走全局 PlayerControls，只绑定一次）
  function initPlayerControls() {
    PlayerControls.init();
  }

  async function init() {
    if (WordsModule._initialized) return;
    await loadList();
    WordsModule._initialized = true;
  }

  return {
    init,
    loadList,
    _initialized: false
  };
})();

// ========== 圣经模块 ==========
const BibleModule = (function() {
  let booksView, chaptersView, contentView;
  let allBooks = [];
  // bookId -> { chapterSn: verses[] }
  const chapterCache = new Map();

  function setView(view) {
    if (booksView) booksView.style.display = view === 'books' ? 'block' : 'none';
    if (chaptersView) chaptersView.style.display = view === 'chapters' ? 'block' : 'none';
    if (contentView) contentView.style.display = view === 'content' ? 'block' : 'none';
  }

  // 书卷列表：GET /api/bible/books（来自 D1 bible_volume）
  async function loadBooks() {
    booksView = document.getElementById("bibleBooksView");
    chaptersView = document.getElementById("bibleChaptersView");
    contentView = document.getElementById("bibleContentView");
    if (!booksView) return;

    setView('books');
    booksView.innerHTML = '<p class="bible-hint">加载中…</p>';

    try {
      const res = await fetch(`${API_BASE}/api/bible/books`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allBooks = Array.isArray(data.books) ? data.books : (Array.isArray(data) ? data : []);
      if (allBooks.length === 0) {
        booksView.innerHTML = '<p class="bible-hint">暂无书卷数据</p>';
        return;
      }
      renderBooks(allBooks);
    } catch (e) {
      booksView.innerHTML = '<p class="bible-hint">加载失败，请稍后重试</p>';
    }
  }

  function renderBooks(books) {
    if (!booksView) return;
    setView('books');
    booksView.innerHTML = '';

    // testament_sn：0 = 旧约，1 = 新约
    const groups = [
      { title: '旧约', list: books.filter(b => Number(b.testament) === 0) },
      { title: '新约', list: books.filter(b => Number(b.testament) === 1) }
    ];

    groups.forEach(({ title, list }) => {
      if (list.length === 0) return;

      const group = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.className = 'bible-group-title';
      h3.textContent = `${title}（${list.length}卷）`;
      group.appendChild(h3);

      const wrap = document.createElement('div');
      wrap.className = 'bible-books-list';

      list.forEach(book => {
        const btn = document.createElement('button');
        btn.className = 'bible-book-btn';
        btn.textContent = book.name;
        btn.title = `${book.name} 共${book.chapters}章`;
        btn.onclick = () => selectBook(book);
        wrap.appendChild(btn);
      });

      group.appendChild(wrap);
      booksView.appendChild(group);
    });
  }

  function selectBook(book) {
    renderChapters(book);
  }

  function renderChapters(book) {
    if (!booksView || !chaptersView) return;
    setView('chapters');

    chaptersView.innerHTML = `<h2 class="bible-chapter-title">${escapeHtml(book.name)}</h2>`;

    const grid = document.createElement('div');
    grid.className = 'chapters-grid';

    const total = Number(book.chapters) || 0;
    for (let i = 1; i <= total; i++) {
      const btn = document.createElement('button');
      btn.className = 'chapter-btn';
      btn.textContent = `第${i}章`;
      btn.onclick = () => loadChapter(book, i);
      grid.appendChild(btn);
    }
    chaptersView.appendChild(grid);

    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← 返回书卷';
    backBtn.onclick = () => renderBooks(allBooks);
    chaptersView.appendChild(backBtn);
  }

  // 单章经文：GET /api/bible/chapter?book=<volume_id>&chapter=<chapter_sn>
  async function loadChapter(book, chapter) {
    if (!contentView) return;
    setView('content');
    contentView.innerHTML = `<div class="bible-content-wrapper">
        <h2 class="bible-chapter-title">${escapeHtml(book.name)} 第${chapter}章</h2>
        <p class="bible-hint">加载中…</p>
      </div>`;

    const cached = chapterCache.get(book.id);
    let verses = cached ? cached[chapter] : null;

    if (!verses) {
      try {
        const res = await fetch(`${API_BASE}/api/bible/chapter?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(chapter)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        verses = Array.isArray(data.verses) ? data.verses : [];
        const bucket = chapterCache.get(book.id) || {};
        bucket[chapter] = verses;
        chapterCache.set(book.id, bucket);
      } catch (e) {
        contentView.innerHTML = `<div class="bible-content-wrapper">
            <h2 class="bible-chapter-title">${escapeHtml(book.name)} 第${chapter}章</h2>
            <p class="bible-hint">加载失败，请稍后重试</p>
          </div>`;
        appendBackToChapters(book);
        return;
      }
    }

    renderChapter(book, chapter, verses);
  }

  function renderChapter(book, chapter, verses) {
    if (!contentView) return;
    setView('content');

    const body = verses.length === 0
      ? '<p class="bible-hint">该章暂无经文数据</p>'
      : `<div class="bible-verses">${verses.map(v =>
          `<p><span class="bible-verse-num">${escapeHtml(String(v.verse))}</span>${escapeHtml(v.text)}</p>`
        ).join('')}</div>`;

    contentView.innerHTML = `<div class="bible-content-wrapper">
        <h2 class="bible-chapter-title">${escapeHtml(book.name)} 第${chapter}章</h2>
        ${body}
      </div>`;

    appendBackToChapters(book);
  }

  function appendBackToChapters(book) {
    if (!contentView) return;
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← 返回章节';
    backBtn.onclick = () => renderChapters(book);
    contentView.appendChild(backBtn);
  }

  async function init() {
    // 已经加载过书卷就直接复用当前视图（返回时保留阅读位置）
    if (BibleModule._initialized && allBooks.length > 0) return;
    await loadBooks();
    BibleModule._initialized = true;
  }

  return {
    init,
    loadBooks,
    selectBook,
    _initialized: false
  };
})();
// ========== 资料模块 ==========
const ResourcesModule = (function() {
  // 分类 -> R2 子目录 + 展示的文件类型
  // 目录结构：resources/audio/*.mp3、resources/video/*.mp4、resources/pdf/*.pdf
  const TYPES = {
    all:   { dir: 'resources/',       ext: 'mp3,wav,mp4,mov,avi,pdf', empty: '暂无内容' },
    pdf:   { dir: 'resources/pdf/',   ext: 'pdf',                     empty: '暂无 PDF' },
    audio: { dir: 'resources/audio/', ext: 'mp3,wav',                 empty: '暂无音频' },
    video: { dir: 'resources/video/', ext: 'mp4,mov,avi',             empty: '暂无视频' }
  };
  const AUDIO_EXTS = ['mp3', 'wav'];
  const VIDEO_EXTS = ['mp4', 'mov', 'avi'];

  let songs = [];
  let currentType = 'all';

  function extOf(name) {
    return (String(name).split('.').pop() || '').toLowerCase();
  }

  // 由扩展名推断所属子目录（接口未返回完整 key 时用于补全）
  function dirOf(name) {
    const ext = extOf(name);
    if (AUDIO_EXTS.includes(ext)) return 'resources/audio/';
    if (VIDEO_EXTS.includes(ext)) return 'resources/video/';
    return 'resources/pdf/';
  }

  function iconOf(ext) {
    if (ext === 'pdf') return '📕';
    if (AUDIO_EXTS.includes(ext)) return '🎵';
    if (VIDEO_EXTS.includes(ext)) return '🎬';
    return '📄';
  }

  async function loadList() {
    const listEl = document.getElementById("resourcesList");
    if (!listEl) return;

    const type = TYPES[currentType] || TYPES.all;
    listEl.innerHTML = '<li class="song-item">加载中…</li>';

    try {
      const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(type.dir)}&ext=${encodeURIComponent(type.ext)}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const names = Array.isArray(data.songs) ? data.songs : [];
      const keys = Array.isArray(data.keys) ? data.keys : null;
      songs = names.map((name, i) => ({
        name: name,
        // 优先使用接口返回的完整 R2 key（含 audio/video 子目录）；旧接口只给文件名，则按分类目录补全
        key: (keys && keys[i]) ? keys[i] : (currentType === 'all' ? dirOf(name) : type.dir) + name
      }));
    } catch (e) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById("resourcesList");
    if (!listEl) return;

    const type = TYPES[currentType] || TYPES.all;
    listEl.innerHTML = "";
    if (songs.length === 0) {
      listEl.innerHTML = `<li class="song-item">${type.empty}</li>`;
      return;
    }
    songs.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'song-item';

      li.innerHTML = `<div class="song-name">${iconOf(extOf(s.name))} ${escapeHtml(s.name)}</div>`;
      li.onclick = () => openResource(s);
      listEl.appendChild(li);
    });
  }

  function openResource(s) {
    // 播放地址 = 公开域名 + 完整 R2 key：resources/audio/xxx.mp3、resources/video/xxx.mp4
    const url = buildFileUrl(s.key);
    const ext = extOf(s.name);

    if (AUDIO_EXTS.includes(ext)) {
      const player = document.getElementById("player");
      if (!player) return;
      player.src = url;
      player.play().catch(()=>{});
      const songInfoContent = document.getElementById("songInfoContent");
      if (songInfoContent) {
        songInfoContent.textContent = s.name;
      }
      // 直接进资料页播放时，迷你播放器控件也要可用
      PlayerControls.init();
      PraiseModule.showMiniPlayer();
    } else {
      window.open(url, '_blank');
    }
  }

  function bindEvents() {
    const menuBtns = document.querySelectorAll('[data-page="resources"] .menu-btn');
    menuBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.classList.contains('active')) return;
        menuBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type || 'all';
        await loadList();
      });
    });
  }

  async function init() {
    if (ResourcesModule._initialized) return;
    bindEvents();
    await loadList();
    ResourcesModule._initialized = true;
  }

  return {
    init,
    loadList,
    _initialized: false
  };
})();

// ========== 应用入口 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 初始化路由
  Router.init();

  // 绑定所有返回首页按钮
  document.querySelectorAll('#backToHomeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      Router.navigate('home');
    });
  });
});
