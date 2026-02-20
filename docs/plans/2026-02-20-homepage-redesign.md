# 首页重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将赞美诗播放器重构为多模块平台（赞美、话语、圣经、资料），添加首页入口和路由系统。

**Architecture:** 单页 SPA，使用 Hash 路由，通过 JavaScript 控制 DOM 显示/隐藏。保持 vanilla JS 无构建步骤，继续使用 Cloudflare Pages + Worker + R2。

**Tech Stack:** 原生 JavaScript (ES6+)、CSS、Cloudflare Worker、R2 Storage

---

## Task 1: 重构 app.js 为模块化结构

**Files:**
- Modify: `pages/app.js`

**Step 1: 备份现有代码**

将现有的 app.js 代码重构为模块化结构。

```javascript
// app.js - 新结构

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
    const backBtn = document.getElementById('backToHomeBtn');
    if (backBtn) {
      backBtn.style.display = route === 'home' ? 'none' : 'flex';
    }

    // 调用对应模块的初始化
    if (route === 'home' && HomePage.init) HomePage.init();
    if (route === 'praise' && PraiseModule.init) PraiseModule.init();
    // ... 其他模块
  },

  navigate(route) {
    window.location.hash = route;
  }
};

// ========== 首页模块 ==========
const HomePage = {
  init() {
    // 首页初始化逻辑（如果需要）
  }
};

// ========== 赞美模块（现有代码封装） ==========
const PraiseModule = {
  // 将现有的 app.js 逻辑封装到这里
  songs: [],
  currentDir: "praise/附录/",
  // ... 所有现有变量和方法

  init() {
    // 初始化播放器逻辑
  }
};

// ========== 话语模块 ==========
const WordsModule = {
  songs: [],
  currentDir: "jiamingzh/worship/",

  async init() {
    await this.loadList();
  },

  async loadList() {
    // 加载话语列表
  }
};

// ========== 圣经模块 ==========
const BibleModule = {
  init() {
    this.loadBooks();
  },

  loadBooks() {
    // 加载书卷列表
  }
};

// ========== 资料模块 ==========
const ResourcesModule = {
  init() {
    this.loadList();
  },

  async loadList() {
    // 加载资料列表
  }
};

// ========== 应用入口 ==========
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});
```

**Step 2: 提交重构**

```bash
git add pages/app.js
git commit -m "refactor: 重构 app.js 为模块化结构"
```

---

## Task 2: 创建首页 HTML 结构

**Files:**
- Modify: `pages/index.html`

**Step 1: 添加首页容器和页面容器**

在 `<body>` 开始处添加：

```html
<!-- 首页 -->
<div data-page="home" class="home-page">
  <header>
    <button id="themeToggleBtn" class="icon-btn theme-toggle-header" title="切换主题">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 3v1m0 16v1m9-9h-1m-16 0H1m15.364 1.636l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
      </svg>
    </button>
    <span class="header-title">赞美在线</span>
  </header>

  <main class="home-grid">
    <div class="module-card" data-module="praise">
      <div class="card-icon">🎵</div>
      <h2 class="card-title">赞美</h2>
      <p class="card-desc">赞美诗播放</p>
    </div>
    <div class="module-card" data-module="words">
      <div class="card-icon">📜</div>
      <h2 class="card-title">话语</h2>
      <p class="card-desc">每日话语分享</p>
    </div>
    <div class="module-card" data-module="bible">
      <div class="card-icon">✝️</div>
      <h2 class="card-title">圣经</h2>
      <p class="card-desc">圣经阅读器</p>
    </div>
    <div class="module-card" data-module="resources">
      <div class="card-icon">📁</div>
      <h2 class="card-title">资料</h2>
      <p class="card-desc">学习资料</p>
    </div>
  </main>
</div>

<!-- 赞美模块页面 -->
<div data-page="praise" style="display:none;">
  <!-- 现有的 index.html 内容，移到这个容器里 -->
</div>

<!-- 话语模块页面 -->
<div data-page="words" style="display:none;">
  <header>
    <button id="backToHomeBtn" class="icon-btn" title="返回首页">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <span class="header-title">话语</span>
    <button id="themeToggleBtnWords" class="icon-btn theme-toggle-header" title="切换主题">
      <!-- 同主题按钮 -->
    </button>
  </header>
  <div class="container">
    <ul id="wordsList" class="song-list"></ul>
  </div>
</div>

<!-- 圣经模块页面 -->
<div data-page="bible" style="display:none;">
  <header>
    <button id="backToHomeBtn" class="icon-btn" title="返回首页">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <span class="header-title">圣经</span>
    <button id="themeToggleBtnBible" class="icon-btn theme-toggle-header" title="切换主题">
      <!-- 同主题按钮 -->
    </button>
  </header>
  <div id="bibleBooksView" class="container">
    <!-- 书卷列表 -->
  </div>
  <div id="bibleChaptersView" class="container" style="display:none;">
    <!-- 章节列表 -->
  </div>
  <div id="bibleContentView" class="container bible-content" style="display:none;">
    <!-- 经文内容 -->
  </div>
</div>

<!-- 资料模块页面 -->
<div data-page="resources" style="display:none;">
  <header>
    <button id="backToHomeBtn" class="icon-btn" title="返回首页">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <span class="header-title">资料</span>
    <button id="themeToggleBtnResources" class="icon-btn theme-toggle-header" title="切换主题">
      <!-- 同主题按钮 -->
    </button>
  </header>
  <div class="menu-bar">
    <div class="menu">
      <button class="menu-btn active" data-type="all">全部</button>
      <button class="menu-btn" data-type="pdf">PDF</button>
      <button class="menu-btn" data-type="audio">音频</button>
      <button class="menu-btn" data-type="video">视频</button>
    </div>
  </div>
  <div class="container">
    <ul id="resourcesList" class="song-list"></ul>
  </div>
</div>
```

**Step 2: 提交**

```bash
git add pages/index.html
git commit -m "feat: 添加首页和各模块页面结构"
```

---

## Task 3: 添加首页样式

**Files:**
- Modify: `pages/style.css`

**Step 1: 添加首页相关样式**

```css
/* 首页网格 */
.home-page {
  min-height: 100vh;
  padding: 20px;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 600px;
  margin: 40px auto;
  padding: 0 16px;
}

@media (min-width: 768px) {
  .home-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 30px;
    max-width: 800px;
  }
}

.module-card {
  background: var(--card-bg, rgba(255,255,255,0.8));
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.module-card:active {
  transform: scale(0.98);
}

.card-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: var(--text-color, #333);
}

.card-desc {
  font-size: 14px;
  color: var(--text-muted, #666);
  margin: 0;
}

/* 返回首页按钮 */
#backToHomeBtn {
  display: none;
}

/* 圣经内容样式 */
.bible-content {
  line-height: 1.8;
  font-size: 16px;
}

.bible-chapter-title {
  font-size: 20px;
  font-weight: bold;
  margin: 20px 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #ddd);
}

.bible-verse-num {
  font-size: 12px;
  color: var(--primary-color, #2563eb);
  margin-right: 4px;
}
```

**Step 2: 提交**

```bash
git add pages/style.css
git commit -m "style: 添加首页样式"
```

---

## Task 4: 实现首页点击跳转

**Files:**
- Modify: `pages/app.js`

**Step 1: 添加卡片点击事件**

```javascript
const HomePage = {
  init() {
    // 绑定卡片点击事件
    document.querySelectorAll('.module-card').forEach(card => {
      card.addEventListener('click', () => {
        const module = card.dataset.module;
        Router.navigate(module);
      });
    });
  }
};
```

**Step 2: 添加返回首页按钮事件**

```javascript
// 在 app.js 中添加
document.addEventListener('DOMContentLoaded', () => {
  Router.init();

  // 绑定所有返回首页按钮
  document.querySelectorAll('#backToHomeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      Router.navigate('home');
    });
  });
});
```

**Step 3: 测试并提交**

```bash
git add pages/app.js
git commit -m "feat: 实现首页导航和返回功能"
```

---

## Task 5: 实现话语模块

**Files:**
- Modify: `pages/app.js`

**Step 1: 实现话语模块逻辑**

```javascript
const WordsModule = {
  songs: [],
  currentDir: "jiamingzh/worship/",

  async init() {
    await this.loadList();
    this.bindEvents();
  },

  async loadList() {
    const listEl = document.getElementById("wordsList");
    const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(this.currentDir)}`);
    if (!res.ok) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    const data = await res.json();
    this.songs = Array.isArray(data.songs) ? data.songs.map(name => ({
      name: name,
      key: this.currentDir + name
    })) : [];

    this.renderList();
  },

  renderList() {
    const listEl = document.getElementById("wordsList");
    listEl.innerHTML = "";
    this.songs.forEach((s, idx) => {
      const li = document.createElement('li');
      li.className = 'song-item';
      // 格式化：去除.mp3，显示为 "2025-01-15 主题标题"
      const display = s.name.replace(/\.mp3$/i, '').replace(/-/g, ' ');
      li.innerHTML = `<div class="song-name">${escapeHtml(display)}</div>`;
      li.onclick = () => this.playWord(idx);
      listEl.appendChild(li);
    });
  },

  playWord(idx) {
    const s = this.songs[idx];
    const url = `${API_BASE}/api/file/${encodeURIComponent(s.key)}`;
    player.src = url;
    player.play().catch(()=>{);

    const displayName = s.name.replace(/\.mp3$/i, '').replace(/-/g, ' ');
    songInfoContent.textContent = displayName;
    showMiniPlayer();
  },

  bindEvents() {
    // 事件绑定
  }
};
```

**Step 2: 提交**

```bash
git add pages/app.js
git commit -m "feat: 实现话语模块"
```

---

## Task 6: 实现圣经模块

**Files:**
- Modify: `pages/app.js`

**Step 1: 实现圣经模块逻辑**

```javascript
const BibleModule = {
  booksView: null,
  chaptersView: null,
  contentView: null,
  currentBook: null,
  currentChapter: null,

  init() {
    this.booksView = document.getElementById("bibleBooksView");
    this.chaptersView = document.getElementById("bibleChaptersView");
    this.contentView = document.getElementById("bibleContentView");

    this.loadBooks();
  },

  async loadBooks() {
    const res = await fetch(`${API_BASE}/api/bible/books`);
    if (!res.ok) {
      this.booksView.innerHTML = '<p>加载失败</p>';
      return;
    }
    const books = await res.json();
    this.renderBooks(books);
  },

  renderBooks(books) {
    this.booksView.innerHTML = '';
    this.booksView.style.display = 'block';
    this.chaptersView.style.display = 'none';
    this.contentView.style.display = 'none';

    // 按旧约/新约分组
    const oldTestament = books.slice(0, 39);
    const newTestament = books.slice(39);

    const renderGroup = (title, bookList) => {
      const group = document.createElement('div');
      group.innerHTML = `<h3 class="bible-group-title">${title}</h3>`;
      const list = document.createElement('div');
      list.className = 'bible-books-list';

      bookList.forEach(book => {
        const btn = document.createElement('button');
        btn.className = 'bible-book-btn';
        btn.textContent = book.name;
        btn.onclick = () => this.selectBook(book);
        list.appendChild(btn);
      });
      group.appendChild(list);
      this.booksView.appendChild(group);
    };

    renderGroup('旧约', oldTestament);
    renderGroup('新约', newTestament);
  },

  selectBook(book) {
    this.currentBook = book;
    this.renderChapters(book);
  },

  renderChapters(book) {
    this.booksView.style.display = 'none';
    this.chaptersView.style.display = 'block';
    this.contentView.style.display = 'none';

    this.chaptersView.innerHTML = `<h2 class="bible-chapter-title">${book.name}</h2>`;

    const grid = document.createElement('div');
    grid.className = 'chapters-grid';

    for (let i = 1; i <= book.chapters; i++) {
      const btn = document.createElement('button');
      btn.className = 'chapter-btn';
      btn.textContent = `第${i}章`;
      btn.onclick = () => this.loadChapter(book, i);
      grid.appendChild(btn);
    }

    this.chaptersView.appendChild(grid);

    // 添加返回书卷按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← 返回书卷';
    backBtn.onclick = () => this.renderBooks(this.allBooks);
    this.chaptersView.appendChild(backBtn);
  },

  async loadChapter(book, chapter) {
    const res = await fetch(`${API_BASE}/api/bible/file/${encodeURIComponent(book.file)}`);
    if (!res.ok) {
      this.contentView.innerHTML = '<p>加载失败</p>';
      return;
    }

    const content = await res.text();
    this.currentChapter = chapter;

    this.renderContent(content, chapter);
  },

  renderContent(content, chapter) {
    this.booksView.style.display = 'none';
    this.chaptersView.style.display = 'none';
    this.contentView.style.display = 'block';

    // 解析章节内容（假设用 ===第N章=== 分隔）
    const chapters = content.split(/===第\d+章===/);
    const chapterContent = chapters[chapter] || '';

    this.contentView.innerHTML = `
      <div class="bible-content-wrapper">
        <h2 class="bible-chapter-title">${this.currentBook.name} 第${chapter}章</h2>
        <div class="bible-verses">${this.parseVerses(chapterContent)}</div>
      </div>
    `;
  },

  parseVerses(text) {
    // 假设格式为 "1 经文内容 2 经文内容..."
    return text.split(/\d+/).filter(Boolean).map((v, i) =>
      `<p><span class="bible-verse-num">${i + 1}</span>${v}</p>`
    ).join('');
  }
};
```

**Step 2: 添加圣经相关样式**

```css
.bible-group-title {
  font-size: 16px;
  color: var(--text-muted);
  margin: 20px 0 10px;
}

.bible-books-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.bible-book-btn {
  padding: 12px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  border-radius: 8px;
  cursor: pointer;
}

.chapters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.chapter-btn {
  padding: 10px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  border-radius: 8px;
  cursor: pointer;
}
```

**Step 3: 提交**

```bash
git add pages/app.js pages/style.css
git commit -m "feat: 实现圣经模块"
```

---

## Task 7: 实现资料模块

**Files:**
- Modify: `pages/app.js`

**Step 1: 实现资料模块逻辑**

```javascript
const ResourcesModule = {
  songs: [],
  currentType: 'all',

  async init() {
    await this.loadList();
    this.bindEvents();
  },

  async loadList() {
    let dir = 'resources/';
    if (this.currentType !== 'all') {
      dir += this.currentType + '/';
    }

    const listEl = document.getElementById("resourcesList");
    const res = await fetch(`${API_BASE}/api/list?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      listEl.innerHTML = '<li class="song-item">加载失败</li>';
      return;
    }
    const data = await res.json();
    this.songs = Array.isArray(data.songs) ? data.songs.map(name => ({
      name: name,
      key: dir + name
    })) : [];

    this.renderList();
  },

  renderList() {
    const listEl = document.getElementById("resourcesList");
    listEl.innerHTML = "";
    this.songs.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'song-item';

      const ext = s.name.split('.').pop().toLowerCase();
      let icon = '📄';
      if (ext === 'pdf') icon = '📕';
      else if (['mp3', 'wav'].includes(ext)) icon = '🎵';
      else if (['mp4', 'mov'].includes(ext)) icon = '🎬';

      li.innerHTML = `<div class="song-name">${icon} ${escapeHtml(s.name)}</div>`;
      li.onclick = () => this.openResource(s);
      listEl.appendChild(li);
    });
  },

  openResource(s) {
    const url = `${API_BASE}/api/file/${encodeURIComponent(s.key)}`;
    const ext = s.name.split('.').pop().toLowerCase();

    if (['mp3', 'wav'].includes(ext)) {
      // 音频使用播放器
      player.src = url;
      player.play().catch(()=>{});
      songInfoContent.textContent = s.name;
      showMiniPlayer();
    } else if (['mp4', 'mov'].includes(ext)) {
      // 视频在新标签打开
      window.open(url, '_blank');
    } else {
      // PDF/文档在新标签打开
      window.open(url, '_blank');
    }
  },

  bindEvents() {
    const menuBtns = document.querySelectorAll('[data-page="resources"] .menu-btn');
    menuBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        menuBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        await this.loadList();
      });
    });
  }
};
```

**Step 2: 提交**

```bash
git add pages/app.js
git commit -m "feat: 实现资料模块"
```

---

## Task 8: 扩展 Worker API

**Files:**
- Modify: `worker/index.js`

**Step 1: 添加圣经书卷列表接口**

```javascript
// 在 Worker 中添加
app.get('/api/bible/books', async (c) => {
  const books = [
    // 旧约
    { id: 1, name: '创世记', file: '01-创世记.txt', chapters: 50 },
    { id: 2, name: '出埃及记', file: '02-出埃及记.txt', chapters: 40 },
    // ... 完整66卷
    // 新约
    { id: 40, name: '马太福音', file: '40-马太福音.txt', chapters: 28 },
    // ...
  ];
  return c.json(books);
});
```

**Step 2: 添加圣经文件接口**

```javascript
app.get('/api/bible/file/:file', async (c) => {
  const file = c.req.param('file');
  const key = `bible/${file}`;

  const object = await c.env.R2_BUCKET.get(key);
  if (!object) {
    return c.json({ error: 'Not found' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'text/plain; charset=utf-8');

  return new Response(object.body, { headers });
});
```

**Step 3: 提交**

```bash
git add worker/index.js
git commit -m "feat: 添加圣经 API 接口"
```

---

## Task 9: 更新 R2 目录结构

创建以下 R2 目录结构（如果不存在）：

```
bucket/
├── praise/          (现有)
├── jiamingzh/       (新增)
│   └── worship/
│       └── *.mp3
├── bible/           (新增)
│   ├── 01-创世记.txt
│   ├── 02-出埃及记.txt
│   └── ...
└── resources/       (新增)
    ├── pdf/
    ├── audio/
    ├── video/
    └── docs/
```

---

## Task 10: 测试和优化

**测试清单：**

1. 首页卡片点击跳转
2. 各模块返回首页
3. 话语列表加载和播放
4. 圣经书卷/章节/内容导航
5. 资料列表和文件打开
6. 浏览器前进/后退
7. 刷新页面状态保持
8. 主题切换在所有页面正常

**Step 1: 测试并修复 bug**

**Step 2: 提交**

```bash
git commit -m "test: 完成测试和优化"
```

---

## 完成标准

- [ ] 首页显示 4 个模块卡片
- [ ] 点击卡片进入对应模块
- [ ] 各模块有返回首页按钮
- [ ] 话语模块显示并播放音频
- [ ] 圣经模块支持书卷→章节→经文导航
- [ ] 资料模块显示文件列表并正确打开
- [ ] URL hash 路由正常工作
- [ ] 浏览器前进/后退正常
- [ ] 所有 Worker API 接口正常
