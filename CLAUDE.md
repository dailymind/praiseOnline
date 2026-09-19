# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Cloudflare-based hymn player (赞美诗播放器) with MP3 streaming from R2 storage. The application consists of:
- **Frontend**: Static HTML/CSS/JS deployed to Cloudflare Pages
- **Backend**: Cloudflare Worker that serves as an API layer for R2 storage
- **Storage**: Cloudflare R2 bucket containing MP3 files organized in directories

## Architecture

### Frontend (`pages/`)
- Single-page application with no build step (vanilla JS)
- `app.js`: Main application logic (data modules + shared `PlayerControls`)
  - Audio player with play modes (sequential, single-loop, random)
  - Real-time filtering and search with localStorage persistence
  - Recent playlist tracking (last 10 songs)
  - Timer functionality for auto-stop
  - Mobile-responsive UI with overlays and FABs
- API base URL is injected via meta tag `<meta name="api-base" content="__API_BASE__">` during deployment
- Media playback uses `<meta name="file-base" content="__FILE_BASE__">` (public R2 domain, secret `FILE_DOMAIN`). `buildFileUrl(key)` in `pages/app.js` builds `{file-base}/{R2 key}` with per-segment `encodeURIComponent` (slashes preserved). Empty/placeholder value falls back to `https://r2files.242500.xyz`
- State persistence: filter mode, sort order, and search query stored in localStorage with `praise_*` prefix

### Backend (`worker/index.js`)
- Cloudflare Worker endpoints:
  - `GET /api/list?dir=<path>&ext=<exts>`: Lists files from R2 bucket (limit: 1000). `ext` is a comma separated extension filter (default `mp3`); the JSON response contains `songs` (file names) and `keys` (full R2 keys, used by the frontend to build playback URLs, including the `resources/audio/` and `resources/video/` sub-directories)
  - `GET /api/file/<encoded-key>`: Streams MP3 file from R2 (kept for legacy links and playback-state restore; the frontend now plays media straight from the public R2 domain)
  - `GET /api/bible/books`: Book list from the D1 table `bible_volume`
  - `GET /api/bible/chapter?book=<volume_id>&chapter=<chapter_sn>`: Verses of one chapter from the D1 table `bible_verses`
  - `GET /api/bible/file/<filename>`: Legacy plain-text Bible file from R2 (`bible/*.txt`), kept for compatibility
- CORS enabled for all origins
- Bindings: `env.R2_BUCKET` (R2) and `env.DB` (D1; `BIBLE_DB` / `bible_db` are also accepted)
- Bible data lives in D1: `bible_volume(id, name, name_short, pinyin, pinyin_short, chapter_total, testament_sn 0=旧约/1=新约, kind_sn)` and `bible_verses(id, volume_id, chapter_sn, verse_sn, verse_txt)`

### Expected R2 Directory Structure
```
praise/
├── 附录/
├── 大本/
├── 新编/
└── 少儿/

resources/
├── audio/   # 资料 - 音频
├── video/   # 资料 - 视频
└── pdf/     # 资料 - PDF
```

### Configuration & Deployment
All sensitive values use placeholders that are replaced during CI/CD:
- `__API_BASE__`, `__FILE_BASE__` in `pages/index.html`
- `__BUCKET_NAME__`, `__API_DOMAIN__`, `__ZONE_NAME__`, `__D1_DATABASE_NAME__` in `worker/wrangler.toml`
- The D1 `database_id` for the Bible data is committed in `worker/wrangler.toml`; the binding must be named `DB`

## Development Commands

### Local Development
```bash
# Test Worker locally (requires wrangler.toml configuration)
cd worker
npx wrangler dev

# Serve Pages locally (use any static server)
cd pages
python -m http.server 8080
# or: npx serve .
```

### Deployment

**Manual deployment:**
```bash
# Deploy Worker only
cd worker
npx wrangler deploy

# Deploy Pages only
npx wrangler pages deploy pages --project-name=praise-web

# First-time Pages project creation
npx wrangler pages project create praise-web
```

**Automated deployment:**
- Push to `main` branch triggers `.github/workflows/deploy.yml`
- Or manually trigger via GitHub Actions UI
- Requires these GitHub Secrets:
  - `CLOUDFLARE_API_TOKEN`: API token with Worker/Pages/R2 permissions
  - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
  - `CLOUDFLARE_PAGES_PROJECT_NAME`: Pages project name (e.g., `praise-web`)
  - `BUCKET_NAME`: R2 bucket name
  - `API_DOMAIN`: Worker custom domain (e.g., `papi.yourdomain.com`)
  - `ZONE_NAME`: Cloudflare zone (e.g., `yourdomain.com`)

## Key Implementation Details

### Filter System
The app supports three filter modes for chorus songs (files ending with `-合.mp3`):
- `all`: Show all songs
- `only_chorus`: Only `-合` songs
- `exclude_chorus`: Exclude `-合` songs

Filter state syncs between desktop (segmented control) and mobile (dropdown menu) using `filterMode` variable.

### Search Functionality
- Debounced search (220ms) across song names and keys
- Two search inputs (desktop and mobile) stay synchronized
- Keyboard shortcut: `/` key focuses search input or opens mobile overlay
- Search highlights matches with `<mark class="search-hit">` tags

### Mobile UI Patterns
- Search: FAB (🔍) opens full-screen overlay with input and back button
- Filter: Funnel icon (⚙) opens dropdown menu
- Both overlays close on: click outside, Escape key, or explicit close button
- Uses class-based state management (`.open`, `.show`, `.hidden`) for CSS transitions

### Player State Management
- `currentKey`: Currently playing song's R2 key
- `currentIndex`: Index in filtered `songs` array
- `songs`: Filtered/sorted/searched list (derived from `originalSongs`)
- Progress ring: SVG circle with stroke-dasharray animation (updates every 100ms)
- Song info marquee: Auto-scrolls when text overflows container width

### Restoration on Reload
On page load, if `player.src` is set (from browser history), the app:
1. Extracts the R2 key from URL
2. Finds matching song in current list
3. Restores player UI with song name
4. Highlights song in list if found

## Code Style & Patterns

- ES6+ async/await for all API calls
- No framework dependencies (vanilla JS)
- Event delegation where appropriate
- Defensive checks: `if (!foo) return;` pattern
- HTML escaping via `escapeHtml()` utility to prevent XSS
- Mobile-first responsive: `.mobile-only` / `.desktop-only` classes for conditional rendering


## Note:

After each task is completed, you need to remind me whether to commit via Git. There are three options:

1. Commit but do not push

2. Commit and push

3. Do not commit this time.


## Note 2:

If the changes and additions made to the local system are not reflected in the requirements document, the requirements document, test code, and test case report need to be updated.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.