// ========== 全局配置 ==========
const API_BASE = (function() {
  const metaApi = document.querySelector('meta[name="api-base"]');
  let base = (metaApi && metaApi.content) ? metaApi.content : 'https://papi.yourdomain.com';
  if (!/^https?:\/\//i.test(base)) {
    base = 'https://' + base;
  }
  return base;
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

    // 显示当前页面
    const pageEl = document.querySelector(`[data-page="${route}"]`);
    if (pageEl) {
      pageEl.style.display = 'block';
    }

    // 更新返回首页按钮显示状态
    document.querySelectorAll('#backToHomeBtn').forEach(btn => {
      btn.style.display = route === 'home' ? 'none' : 'flex';
    });

    // 更新搜索按钮显示状态（只在赞美页面显示）
    const searchFab = document.getElementById('searchFab');
    if (searchFab) {
      searchFab.style.display = route === 'praise' ? 'flex' : 'none';
    }

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
    const url = `${API_BASE}/api/file/${encodeURIComponent(s.key)}`;
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
    miniPlayer.style.display = 'block';
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
          searchOverlay.style.display = 'flex';
          searchOverlay.setAttribute('aria-hidden', 'false');
          searchFab.style.display = 'none';
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

    // 播放/暂停
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (currentKey && player.src) {
          if (isPlaying) {
            player.pause();
          } else {
            player.play();
          }
        }
      });
    }

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

    // 播放器事件
    player.addEventListener('play', () => {
      isPlaying = true;
      if (playPauseBtn) playPauseBtn.classList.add('playing');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
    });

    player.addEventListener('pause', () => {
      isPlaying = false;
      if (playPauseBtn) playPauseBtn.classList.remove('playing');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    player.addEventListener('timeupdate', updateProgress);

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
        const parts = src.split('/api/file/');
        if (parts.length === 2) {
          const decoded = decodeURIComponent(parts[1]);
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
  const currentDir = "jiamingzh/worship/";

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
    const url = `${API_BASE}/api/file/${encodeURIComponent(s.key)}`;
    player.src = url;
    player.play().catch(()=>{});

    const displayName = s.name.replace(/\.mp3$/i, '').replace(/-/g, ' ');
    if (songInfoContent) {
      songInfoContent.textContent = displayName;
    }
    if (PraiseModule.showMiniPlayer) {
      PraiseModule.showMiniPlayer();
    }
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
  let currentBook = null;
  let allBooks = [];

  // 圣经书卷列表
  const bibleBooks = [
    // 旧约 39卷
    { id: 1, name: '创世记', file: '01-创世记.txt', chapters: 50 },
    { id: 2, name: '出埃及记', file: '02-出埃及记.txt', chapters: 40 },
    { id: 3, name: '利未记', file: '03-利未记.txt', chapters: 27 },
    { id: 4, name: '民数记', file: '04-民数记.txt', chapters: 36 },
    { id: 5, name: '申命记', file: '05-申命记.txt', chapters: 34 },
    { id: 6, name: '约书亚记', file: '06-约书亚记.txt', chapters: 24 },
    { id: 7, name: '士师记', file: '07-士师记.txt', chapters: 21 },
    { id: 8, name: '路得记', file: '08-路得记.txt', chapters: 4 },
    { id: 9, name: '撒母耳记上', file: '09-撒母耳记上.txt', chapters: 31 },
    { id: 10, name: '撒母耳记下', file: '10-撒母耳记下.txt', chapters: 24 },
    { id: 11, name: '列王纪上', file: '11-列王纪上.txt', chapters: 22 },
    { id: 12, name: '列王纪下', file: '12-列王纪下.txt', chapters: 25 },
    { id: 13, name: '历代志上', file: '13-历代志上.txt', chapters: 29 },
    { id: 14, name: '历代志下', file: '14-历代志下.txt', chapters: 36 },
    { id: 15, name: '以斯拉记', file: '15-以斯拉记.txt', chapters: 10 },
    { id: 16, name: '尼希米记', file: '16-尼希米记.txt', chapters: 13 },
    { id: 17, name: '以斯帖记', file: '17-以斯帖记.txt', chapters: 10 },
    { id: 18, name: '约伯记', file: '18-约伯记.txt', chapters: 42 },
    { id: 19, name: '诗篇', file: '19-诗篇.txt', chapters: 150 },
    { id: 20, name: '箴言', file: '20-箴言.txt', chapters: 31 },
    { id: 21, name: '传道书', file: '21-传道书.txt', chapters: 12 },
    { id: 22, name: '雅歌', file: '22-雅歌.txt', chapters: 8 },
    { id: 23, name: '以赛亚书', file: '23-以赛亚书.txt', chapters: 66 },
    { id: 24, name: '耶利米书', file: '24-耶利米书.txt', chapters: 52 },
    { id: 25, name: '耶利米哀歌', file: '25-耶利米哀歌.txt', chapters: 5 },
    { id: 26, name: '以西结书', file: '26-以西结书.txt', chapters: 48 },
    { id: 27, name: '但以理书', file: '27-但以理书.txt', chapters: 12 },
    { id: 28, name: '何西阿书', file: '28-何西阿书.txt', chapters: 14 },
    { id: 29, name: '约珥书', file: '29-约珥书.txt', chapters: 3 },
    { id: 30, name: '阿摩司书', file: '30-阿摩司书.txt', chapters: 9 },
    { id: 31, name: '俄巴底亚书', file: '31-俄巴底亚书.txt', chapters: 1 },
    { id: 32, name: '约拿书', file: '32-约拿书.txt', chapters: 4 },
    { id: 33, name: '弥迦书', file: '33-弥迦书.txt', chapters: 7 },
    { id: 34, name: '那鸿书', file: '34-那鸿书.txt', chapters: 3 },
    { id: 35, name: '哈巴谷书', file: '35-哈巴谷书.txt', chapters: 3 },
    { id: 36, name: '西番雅书', file: '36-西番雅书.txt', chapters: 3 },
    { id: 37, name: '哈该书', file: '37-哈该书.txt', chapters: 2 },
    { id: 38, name: '撒迦利亚书', file: '38-撒迦利亚书.txt', chapters: 14 },
    { id: 39, name: '玛拉基书', file: '39-玛拉基书.txt', chapters: 4 },
    // 新约 27卷
    { id: 40, name: '马太福音', file: '40-马太福音.txt', chapters: 28 },
    { id: 41, name: '马可福音', file: '41-马可福音.txt', chapters: 16 },
    { id: 42, name: '路加福音', file: '42-路加福音.txt', chapters: 24 },
    { id: 43, name: '约翰福音', file: '43-约翰福音.txt', chapters: 21 },
    { id: 44, name: '使徒行传', file: '44-使徒行传.txt', chapters: 28 },
    { id: 45, name: '罗马书', file: '45-罗马书.txt', chapters: 16 },
    { id: 46, name: '哥林多前书', file: '46-哥林多前书.txt', chapters: 16 },
    { id: 47, name: '哥林多后书', file: '47-哥林多后书.txt', chapters: 13 },
    { id: 48, name: '加拉太书', file: '48-加拉太书.txt', chapters: 6 },
    { id: 49, name: '以弗所书', file: '49-以弗所书.txt', chapters: 6 },
    { id: 50, name: '腓立比书', file: '50-腓立比书.txt', chapters: 4 },
    { id: 51, name: '歌罗西书', file: '51-歌罗西书.txt', chapters: 4 },
    { id: 52, name: '帖撒罗尼迦前书', file: '52-帖撒罗尼迦前书.txt', chapters: 5 },
    { id: 53, name: '帖撒罗尼迦后书', file: '53-帖撒罗尼迦后书.txt', chapters: 3 },
    { id: 54, name: '提摩太前书', file: '54-提摩太前书.txt', chapters: 6 },
    { id: 55, name: '提摩太后书', file: '55-提摩太后书.txt', chapters: 4 },
    { id: 56, name: '提多书', file: '56-提多书.txt', chapters: 3 },
    { id: 57, name: '腓利门书', file: '57-腓利门书.txt', chapters: 1 },
    { id: 58, name: '希伯来书', file: '58-希伯来书.txt', chapters: 13 },
    { id: 59, name: '雅各书', file: '59-雅各书.txt', chapters: 5 },
    { id: 60, name: '彼得前书', file: '60-彼得前书.txt', chapters: 5 },
    { id: 61, name: '彼得后书', file: '61-彼得后书.txt', chapters: 3 },
    { id: 62, name: '约翰一书', file: '62-约翰一书.txt', chapters: 5 },
    { id: 63, name: '约翰二书', file: '63-约翰二书.txt', chapters: 1 },
    { id: 64, name: '约翰三书', file: '64-约翰三书.txt', chapters: 1 },
    { id: 65, name: '犹大书', file: '65-犹大书.txt', chapters: 1 },
    { id: 66, name: '启示录', file: '66-启示录.txt', chapters: 22 }
  ];

  function loadBooks() {
    booksView = document.getElementById("bibleBooksView");
    chaptersView = document.getElementById("bibleChaptersView");
    contentView = document.getElementById("bibleContentView");

    if (!booksView) return;

    allBooks = bibleBooks;
    renderBooks(allBooks);
  }

  function renderBooks(books) {
    if (!booksView) return;

    booksView.innerHTML = '';
    booksView.style.display = 'block';
    if (chaptersView) chaptersView.style.display = 'none';
    if (contentView) contentView.style.display = 'none';

    const oldTestament = books.slice(0, 39);
    const newTestament = books.slice(39);

    const renderGroup = (title, bookList) => {
      const group = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.className = 'bible-group-title';
      h3.textContent = title;
      group.appendChild(h3);

      const list = document.createElement('div');
      list.className = 'bible-books-list';

      bookList.forEach(book => {
        const btn = document.createElement('button');
        btn.className = 'bible-book-btn';
        btn.textContent = book.name;
        btn.onclick = () => selectBook(book);
        list.appendChild(btn);
      });
      group.appendChild(list);
      booksView.appendChild(group);
    };

    renderGroup('旧约', oldTestament);
    renderGroup('新约', newTestament);
  }

  function selectBook(book) {
    currentBook = book;
    renderChapters(book);
  }

  function renderChapters(book) {
    if (!booksView || !chaptersView) return;

    booksView.style.display = 'none';
    chaptersView.style.display = 'block';
    if (contentView) contentView.style.display = 'none';

    chaptersView.innerHTML = `<h2 class="bible-chapter-title">${book.name}</h2>`;

    const grid = document.createElement('div');
    grid.className = 'chapters-grid';

    for (let i = 1; i <= book.chapters; i++) {
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

  async function loadChapter(book, chapter) {
    if (!contentView) return;

    // 尝试从 API 加载
    const res = await fetch(`${API_BASE}/api/bible/file/${encodeURIComponent(book.file)}`);

    if (!res.ok) {
      contentView.innerHTML = '<p class="bible-content">加载失败，请确保圣经文件已上传到 R2。</p>';
      chaptersView.style.display = 'none';
      contentView.style.display = 'block';
      return;
    }

    const content = await res.text();
    renderContent(content, book, chapter);
  }

  function renderContent(content, book, chapter) {
    if (!booksView || !chaptersView || !contentView) return;

    booksView.style.display = 'none';
    chaptersView.style.display = 'none';
    contentView.style.display = 'block';

    // 解析章节内容（假设用 ===第N章=== 分隔）
    const chapters = content.split(/===第\d+章===/);
    const chapterContent = chapters[chapter] || content;

    // 解析经文
    const verses = parseVerses(chapterContent);

    contentView.innerHTML = `
      <div class="bible-content-wrapper">
        <h2 class="bible-chapter-title">${book.name} 第${chapter}章</h2>
        <div class="bible-verses">${verses}</div>
      </div>
    `;

    // 添加返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← 返回章节';
    backBtn.onclick = () => renderChapters(book);
    contentView.appendChild(backBtn);
  }

  function parseVerses(text) {
    // 简单解析：尝试匹配 "1 经文" 格式
    const lines = text.trim().split('\n');
    return lines.map(line => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        return `<p><span class="bible-verse-num">${match[1]}</span>${escapeHtml(match[2])}</p>`;
      }
      if (line.trim()) {
        return `<p>${escapeHtml(line)}</p>`;
      }
      return '';
    }).filter(Boolean).join('');
  }

  function init() {
    if (BibleModule._initialized) return;
    loadBooks();
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
  let songs = [];
  let currentType = 'all';

  async function loadList() {
    let dir = 'resources/';
    if (currentType !== 'all') {
      dir += currentType + '/';
    }

    const listEl = document.getElementById("resourcesList");
    if (!listEl) return;

    const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    const data = await res.json();
    songs = Array.isArray(data.songs) ? data.songs.map(name => ({
      name: name,
      key: dir + name
    })) : [];
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById("resourcesList");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (songs.length === 0) {
      listEl.innerHTML = '<li class="song-item">暂无内容</li>';
      return;
    }
    songs.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'song-item';

      const ext = s.name.split('.').pop().toLowerCase();
      let icon = '📄';
      if (ext === 'pdf') icon = '📕';
      else if (['mp3', 'wav'].includes(ext)) icon = '🎵';
      else if (['mp4', 'mov', 'avi'].includes(ext)) icon = '🎬';

      li.innerHTML = `<div class="song-name">${icon} ${escapeHtml(s.name)}</div>`;
      li.onclick = () => openResource(s);
      listEl.appendChild(li);
    });
  }

  function openResource(s) {
    const url = `${API_BASE}/api/file/${encodeURIComponent(s.key)}`;
    const ext = s.name.split('.').pop().toLowerCase();

    if (['mp3', 'wav'].includes(ext)) {
      const player = document.getElementById("player");
      const songInfoContent = document.getElementById("songInfoContent");
      player.src = url;
      player.play().catch(()=>{});
      if (songInfoContent) {
        songInfoContent.textContent = s.name;
      }
      if (PraiseModule.showMiniPlayer) {
        PraiseModule.showMiniPlayer();
      }
    } else {
      window.open(url, '_blank');
    }
  }

  function bindEvents() {
    const menuBtns = document.querySelectorAll('[data-page="resources"] .menu-btn');
    menuBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        menuBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
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
