(async function(){
    let songs = [];
    let currentDir = "praise/附录/";
    let reverseOrder = false;
    let currentKey = null;
    let currentIndex = -1;
    let playMode = 0; // 0:顺序 1:单曲循环 2:随机
    let recentSongs = []; // 最近播放列表
    let isPlaying = false;
    let timerId = null; // 定时器ID
    let timerMinutes = 0; // 定时分钟数
  
    const menuBtns = document.querySelectorAll(".menu-btn");
    const player = document.getElementById("player");
    const listEl = document.getElementById("songList");
    const miniPlayer = document.getElementById("miniPlayer");
    const playPauseBtn = document.getElementById("playPauseBtn");
    const playModeBtn = document.getElementById("playModeBtn");
    const songInfoContent = document.getElementById("songInfoContent");
    const recentListBtn = document.getElementById("recentListBtn");
    const recentListPanel = document.getElementById("recentListPanel");
    const recentListItems = document.getElementById("recentListItems");
    const closeRecentBtn = document.getElementById("closeRecentBtn");
    const timerBtn = document.getElementById("timerBtn");
    const timerPanel = document.getElementById("timerPanel");
    const closeTimerBtn = document.getElementById("closeTimerBtn");
    const timerStatus = document.getElementById("timerStatus");
    const cancelTimerBtn = document.getElementById("cancelTimerBtn");
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    const progressFill = document.querySelector('.progress-fill');
    // Controls
    const filterControl = document.getElementById('filterControl');
    const filterMenuBtn = document.getElementById('filterMenuBtn');
    const filterMenu = document.getElementById('filterMenu');
    const sortToggleBtn = document.getElementById('sortToggleBtn');
    const searchInputDesktop = document.getElementById('searchInputDesktop');
    const searchInputMobile = document.getElementById('searchInputMobile');
    const searchFab = document.getElementById('searchFab');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchBack = document.getElementById('searchBack');
    const listCountEl = document.getElementById('listCount');
  
    // Worker API 域名：从页面 meta 标签读取，若未设置则回退到默认
    // 请在 `pages/index.html` 中添加：<meta name="api-base" content="__API_BASE__" />
    const metaApi = document.querySelector('meta[name="api-base"]');
    let API_BASE = (metaApi && metaApi.content) ? metaApi.content : 'https://papi.yourdomain.com';
    // 自动补全 https:// 前缀
    if (!/^https?:\/\//i.test(API_BASE)) {
      API_BASE = 'https://' + API_BASE;
    }

    // 播放模式图标路径
    const playModeIconPaths = [
      // 顺序播放
      'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
      // 单曲循环
      'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-2.97 2.17-5.43 5-5.91V6.09C8.05 6.57 5 9.93 5 13.93c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
      // 随机播放
      'M9.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm0 5c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm0 5c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zM5.01 15.5l4-4 4 4-4 4-4-4zm9.02-3.5l4-4 4 4-4 4-4-4z'
    ];

    // 获取目录名称
    function getDirName(dirPath) {
      const dirs = dirPath.split('/');
      return dirs[dirs.length - 2] || '未知';
    }

    // 格式化歌曲名称：去除.mp3后缀
    function formatSongName(key, name) {
      const dir = getDirName(key);
      const cleanName = name.replace(/\.mp3$/i, '');
      return `(${dir})${cleanName}`;
    }
  
    menuBtns.forEach(btn => btn.addEventListener("click", async () => {
      menuBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const dir = btn.dataset.dir;
      await loadList(dir);
      highlightCurrentIfPresent();
    }));

    // 播放/暂停按钮
    playPauseBtn.addEventListener('click', () => {
      if (currentKey && player.src) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      }
    });

    // 播放模式切换
    playModeBtn.addEventListener('click', () => {
      playMode = (playMode + 1) % 3;
      // 更新SVG图标路径
      const path = playModeBtn.querySelector('.mode-icon path');
      path.setAttribute('d', playModeIconPaths[playMode]);
      playModeBtn.classList.toggle('active', playMode !== 0);
      const modeNames = ['顺序播放', '单曲循环', '随机播放'];
      playModeBtn.title = '播放模式：' + modeNames[playMode];
    });

    // 最近播放列表
    recentListBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      timerPanel.classList.remove('show');
      renderRecentList();
      recentListPanel.classList.toggle('show');
    });

    closeRecentBtn.addEventListener('click', () => {
      recentListPanel.classList.remove('show');
    });

    // 定时按钮
    timerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      recentListPanel.classList.remove('show');
      timerPanel.classList.toggle('show');
    });

    closeTimerBtn.addEventListener('click', () => {
      timerPanel.classList.remove('show');
    });

    // 定时选项按钮
    document.querySelectorAll('.timer-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);
        startTimer(minutes);
      });
    });

    cancelTimerBtn.addEventListener('click', () => {
      cancelTimer();
    });

    // 点击外部关闭弹窗
    document.addEventListener('click', (e) => {
      if (!recentListPanel.contains(e.target) && e.target !== recentListBtn) {
        recentListPanel.classList.remove('show');
      }
      if (!timerPanel.contains(e.target) && e.target !== timerBtn) {
        timerPanel.classList.remove('show');
      }
    });
  
    // state for filtering/search
    let originalSongs = [];
    let filterMode = localStorage.getItem('praise_filterMode') || 'all';
    reverseOrder = (localStorage.getItem('praise_reverseOrder') === 'true') || false;
    let searchQuery = localStorage.getItem('praise_searchQuery') || '';

    // debounce helper
    function debounce(fn, wait) {
      let t;
      return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    }

    async function loadList(dir) {
      currentDir = dir;
      const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(dir)}`);
      if (!res.ok) {
        listEl.innerHTML = '<li class="song-item">加载失败</li>';
        return;
      }
      const data = await res.json();
      // Convert string array to object array with name and key
      originalSongs = Array.isArray(data.songs) ? data.songs.map(name => ({
        name: name,
        key: dir + name
      })) : [];
      // reset local storage on each new fetch
      localStorage.setItem('praise_filterMode', filterMode);
      localStorage.setItem('praise_reverseOrder', reverseOrder);
      localStorage.setItem('praise_searchQuery', searchQuery);
      applyFiltersAndSearch();
      if (currentKey) currentIndex = songs.findIndex(s => s.key === currentKey);
      else currentIndex = -1;
      renderList();
    }

    function normalizeNameForMatch(name) {
      if (!name) return '';
      // remove extension and trim
      const withoutExt = name.replace(/\.[^/.]+$/, '');
      return withoutExt.toLowerCase();
    }

    function matchesChorus(name) {
      const n = normalizeNameForMatch(name);
      return n.endsWith('-合');
    }

    function applyFiltersAndSearch() {
      let list = originalSongs.slice();
      // filter
      if (filterMode === 'only_chorus') {
        list = list.filter(s => matchesChorus(s.name));
      } else if (filterMode === 'exclude_chorus') {
        list = list.filter(s => !matchesChorus(s.name));
      }
      // search
      const q = (searchQuery || '').trim().toLowerCase();
      if (q) {
        list = list.filter(s => {
          const name = (s.name || '').toLowerCase();
          const key = (s.key || '').toLowerCase();
          return name.includes(q) || key.includes(q);
        });
      }
      // sort (reverseOrder toggles)
      if (reverseOrder) list.reverse();
      songs = list;
      // update count
      listCountEl.textContent = `${songs.length} / ${originalSongs.length}`;
    }
  
    function renderList() {
      listEl.innerHTML = "";
      songs.forEach((s, idx) => {
        const li = document.createElement('li');
        li.className = 'song-item' + (idx === currentIndex ? ' playing' : '');
        // highlight search matches
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

    // initialize controls state
    function initControls() {
      // filter - desktop segmented
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

      // filter - mobile menu
      if (filterMenuBtn && filterMenu) {
        // ensure closed by default
        filterMenu.classList.remove('open');
        filterMenuBtn.setAttribute('aria-expanded', 'false');
        // toggle with class to improve responsiveness
        const toggleFilterMenu = (e) => {
          e && e.stopPropagation();
          const isOpen = filterMenu.classList.toggle('open');
          filterMenuBtn.setAttribute('aria-expanded', isOpen.toString());
        };
        filterMenuBtn.addEventListener('click', toggleFilterMenu);
        // support touchstart for better responsiveness on mobile
        filterMenuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleFilterMenu(e); });
        const items = filterMenu.querySelectorAll('.fm-item');
        const syncMobileFilterActive = () => {
          items.forEach(i => i.classList.toggle('active', i.dataset.filter === filterMode));
        };
        // initial sync
        syncMobileFilterActive();
        items.forEach(it => {
          it.addEventListener('click', (e) => {
            e.stopPropagation();
            filterMode = it.dataset.filter;
            if (filterControl) {
              filterControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.filter === filterMode));
            }
            // sync mobile items visually
            syncMobileFilterActive();
            localStorage.setItem('praise_filterMode', filterMode);
            applyFiltersAndSearch(); renderList();
            filterMenu.classList.remove('open');
            filterMenuBtn.setAttribute('aria-expanded', 'false');
          });
          it.addEventListener('touchstart', (e) => { e.stopPropagation(); });
        });
        // when the filter button toggles open, ensure active item is synced
        filterMenuBtn.addEventListener('click', () => setTimeout(syncMobileFilterActive, 0));
      }

      // sort
      sortToggleBtn.setAttribute('aria-pressed', reverseOrder ? 'true' : 'false');
      sortToggleBtn.addEventListener('click', () => {
        reverseOrder = !reverseOrder;
        localStorage.setItem('praise_reverseOrder', reverseOrder);
        sortToggleBtn.setAttribute('aria-pressed', reverseOrder ? 'true' : 'false');
        applyFiltersAndSearch(); renderList();
      });

      // search (debounced) - wire desktop and mobile inputs
      const doSearch = debounce(() => {
        // prefer desktop input value if present, otherwise mobile
        const val = (searchInputDesktop && searchInputDesktop.value) ? searchInputDesktop.value : (searchInputMobile && searchInputMobile.value ? searchInputMobile.value : '');
        searchQuery = val || '';
        localStorage.setItem('praise_searchQuery', searchQuery);
        applyFiltersAndSearch(); renderList();
      }, 220);
      if (searchInputDesktop) {
        searchInputDesktop.value = searchQuery || '';
        searchInputDesktop.addEventListener('input', doSearch);
      }
      if (searchInputMobile) {
        searchInputMobile.value = searchQuery || '';
        searchInputMobile.addEventListener('input', doSearch);
      }

      // search FAB behavior for mobile
      if (searchFab && searchOverlay && searchInputMobile && searchBack) {
        // ensure closed by default
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
      // keyboard shortcut: '/' focus - open mobile overlay if needed
      document.addEventListener('keydown', (e) => {
        if (e.key === '/') {
          e.preventDefault();
          if (searchInputDesktop) searchInputDesktop.focus();
          else if (searchFab && searchOverlay && searchInputMobile) {
            searchOverlay.style.display = 'flex'; searchOverlay.setAttribute('aria-hidden', 'false'); searchFab.style.display = 'none'; setTimeout(() => searchInputMobile.focus(), 50);
          }
        }
      });
      // click outside to close mobile menus/search overlay (use class-based checks)
      document.addEventListener('click', (e) => {
        if (filterMenu && filterMenu.classList.contains('open') && !filterMenu.contains(e.target) && e.target !== filterMenuBtn) {
          filterMenu.classList.remove('open'); filterMenuBtn.setAttribute('aria-expanded', 'false');
        }
        if (searchOverlay && searchOverlay.classList.contains('open') && !searchOverlay.contains(e.target) && e.target !== searchFab) {
          searchOverlay.classList.remove('open'); searchOverlay.setAttribute('aria-hidden', 'true'); searchFab.classList.remove('hidden');
        }
      });
      // close overlays with Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (filterMenu && filterMenu.classList.contains('open')) {
            filterMenu.classList.remove('open'); filterMenuBtn.setAttribute('aria-expanded', 'false');
          }
          if (searchOverlay && searchOverlay.classList.contains('open')) {
            searchOverlay.classList.remove('open'); searchOverlay.setAttribute('aria-hidden', 'true'); searchFab.classList.remove('hidden');
          }
          if (recentListPanel && recentListPanel.classList.contains('show')) recentListPanel.classList.remove('show');
          if (timerPanel && timerPanel.classList.contains('show')) timerPanel.classList.remove('show');
        }
      });
    }
  
    function highlightCurrentIfPresent() {
      if (!currentKey) return;
      currentIndex = songs.findIndex(s => s.key === currentKey);
      renderList();
    }
  
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

    function updateSongInfo(displayName) {
      songInfoContent.textContent = displayName || '未播放';
      // 触发动画重置
      songInfoContent.style.animation = 'none';
      setTimeout(() => {
        // 检查是否需要滚动
        const contentWidth = songInfoContent.scrollWidth;
        const containerWidth = songInfoContent.parentElement.offsetWidth;
        if (contentWidth > containerWidth) {
          songInfoContent.style.animation = '';
        }
      }, 10);
    }

    function showMiniPlayer() {
      miniPlayer.style.display = 'block';
    }

    function addToRecent(name, key) {
      // 移除已存在的
      recentSongs = recentSongs.filter(s => s.key !== key);
      // 添加到开头
      recentSongs.unshift({ name, key });
      // 最多保存10首
      if (recentSongs.length > 10) recentSongs.pop();
    }

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
      cancelTimer(); // 取消之前的定时
      timerMinutes = minutes;
      timerId = setTimeout(() => {
        player.pause();
        timerStatus.textContent = '已自动停止播放';
        timerId = null;
        cancelTimerBtn.style.display = 'none';
      }, minutes * 60 * 1000);
      
      // 更新状态
      timerStatus.textContent = `将在 ${minutes} 分钟后自动停止`;
      cancelTimerBtn.style.display = 'block';
      
      // 取消其他按钮的激活状态
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

    function updateProgress() {
      if (!player.duration) {
        progressFill.style.strokeDasharray = '0 100';
        return;
      }
      const percent = (player.currentTime / player.duration) * 100;
      const circumference = 100.531; // 2 * PI * 16
      const dashoffset = circumference - (percent / 100) * circumference;
      progressFill.style.strokeDasharray = `${circumference} ${circumference}`;
      progressFill.style.strokeDashoffset = dashoffset;
    }

    // 初始化进度条
    setInterval(updateProgress, 100);

    player.addEventListener('play', () => {
      isPlaying = true;
      playPauseBtn.classList.add('playing');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    });

    player.addEventListener('pause', () => {
      isPlaying = false;
      playPauseBtn.classList.remove('playing');
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    });

    player.addEventListener('timeupdate', updateProgress);

    player.addEventListener('ended', () => {
      let nextIndex = -1;
      if (playMode === 0) { // 顺序
        if (currentIndex >= 0 && currentIndex < songs.length - 1) {
          nextIndex = currentIndex + 1;
        }
      } else if (playMode === 1) { // 单曲循环
        nextIndex = currentIndex;
      } else if (playMode === 2) { // 随机
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
  
    initControls();
    await loadList(currentDir);
  
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    // 页面 reload / onload 时，如果 audio 已经有 src（比如从浏览器历史），显示对应名称（尝试从当前列表匹配）
    // 若 audio.src 指向某个 key，则尝试解析并显示名称
    (function restoreNowPlayingFromSrc(){
      try {
        const src = player.src;
        if (src) {
          // src 形如 https://.../api/file/<encodedKey>
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
              // 不在当前列表，尝试从 key 提取文件名显示
              const name = decoded.split('/').pop().replace(/\.mp3$/i, '');
              const displayName = `(${getDirName(decoded)})${name}`;
              updateSongInfo(displayName);
              showMiniPlayer();
            }
          }
        }
      } catch (e) { /* ignore */ }
    })();
  })();
