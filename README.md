# 赞美诗播放器

基于 Cloudflare Pages 和 Workers 构建的在线 MP3 播放器项目。

## 项目配置

 - **Pages 项目名**：praise-web  
 - **Pages 访问地址**：https://praise.yourdomain.com  
 - **Worker 项目名**：praise-api  
 - **Worker 访问地址**：https://__API_DOMAIN__  
 - **R2 存储桶**：__BUCKET_NAME__

## 项目结构

- `pages/` - 前端页面（HTML/CSS/JS），部署到 Cloudflare Pages
- `worker/` - 后端 API Worker，部署到 Cloudflare Workers

## 部署步骤

### 1️⃣ 准备工作

1. 在 Cloudflare 控制台中创建 R2 存储桶并上传 MP3 文件
2. 确保已安装 Wrangler CLI：`npm install -g wrangler` 或 `npm i -D wrangler`

### 2️⃣ 配置 Worker

- Worker 配置已设置（示例，请替换为你的值）：
- Worker 名称：praise-api
- R2 存储桶：your_bucket_name
- 域名绑定：papi.yourdomain.com

配置文件 `worker/wrangler.toml` 内容：
```toml
name = "praise-api"
main = "index.js"
compatibility_date = "2024-10-23"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "__BUCKET_NAME__"
preview_bucket_name = "__PREVIEW_BUCKET_NAME__"

routes = [
  { pattern = "__API_DOMAIN__/*", zone_name = "__ZONE_NAME__" }
]
```

注意：请不要在公开的 README 中留下真实的存储桶名称或任何敏感信息。上面示例使用了占位符 `your_bucket_name` / `your_preview_bucket_name`。

建议做法：
- 在 `worker/wrangler.toml` 中将示例的值替换为你自己的存储桶名（仅在私有仓库或本地使用）；或
- 在 CI 中使用 GitHub Secrets（例如 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_PAGES_PROJECT_NAME`），并在工作流里注入到 `wrangler` 命令中进行部署。

如果你希望我为你添加一个 GitHub Actions 工作流来自动部署（使用 GitHub Secrets 管理 API token），请确认你要自动部署：
- 仅 Worker（wrangler publish），或
- Worker + Pages（wrangler pages deploy）

### 在 GitHub 上配置 Cloudflare 相关参数

1. 进入仓库页面 → Settings → Secrets and variables → Actions → New repository secret。
2. 添加以下 Secrets：
  - `CLOUDFLARE_API_TOKEN`：Cloudflare API Token（需要 Worker/Pages/R2 权限，或使用细粒度 Token）。
  - `CLOUDFLARE_PAGES_PROJECT_NAME`：可选，Pages 项目名（若希望 CI 部署 Pages）。
  - `API_BASE`：可选，前端使用的 API 地址（例如 `https://papi.yourdomain.com`），工作流会将其注入到 `pages/index.html`。
  - `FILE_DOMAIN`：可选，R2 公开域名（例如 `https://r2files.242500.xyz`），用于替换 `pages/index.html` 中的 `__FILE_BASE__`；留空时前端回退到默认值。
  - `BUCKET_NAME`：R2 存储桶名，用于替换 `worker/wrangler.toml` 中 `__BUCKET_NAME__` 占位符。
  - `PREVIEW_BUCKET_NAME`：预览存储桶名，用于替换 `__PREVIEW_BUCKET_NAME__`。
  - `API_DOMAIN`：你的 API 自定义域名（例如 `papi.yourdomain.com`），用于替换 `__API_DOMAIN__`。
  - `D1_DATABASE_NAME`：D1 数据库名（圣经数据），用于替换 `worker/wrangler.toml` 中的 `__D1_DATABASE_NAME__`。
  - `ZONE_NAME`：可选，Cloudflare zone（例如 `yourdomain.com`）。如果不填写，工作流会尝试从 `API_DOMAIN` 中自动推断（去掉子域名）。

注意：如果你使用 Cloudflare Pages 的构建（有构建步骤），也可以在 Cloudflare Pages 的项目设置中添加环境变量 `API_BASE` 并在构建脚本中注入到页面；对于纯静态无构建流程，建议通过 GitHub Actions 注入或直接在 `pages/index.html` 中手工设置 meta 标签。

### 触发部署（自动 / 手动）

- 自动：默认工作流设置为 push 到 `main` 分支时触发部署（见 `.github/workflows/deploy.yml`）。
- 手动：在 GitHub -> Actions -> 选择 `Deploy to Cloudflare` 工作流 -> 点击 `Run workflow` 手动触发。
- 本地：可以在本地运行 `cd worker && npx wrangler publish` 来手动发布 Worker。

### CI 如何将这些变量注入到 `wrangler.toml` 和前端

工作流在运行时会：

- 用 `API_BASE` 替换 `pages/index.html` 中的 `__API_BASE__` 占位符（供前端读取）。
- 用 `BUCKET_NAME` / `PREVIEW_BUCKET_NAME` / `API_DOMAIN` / `ZONE_NAME` 替换 `worker/wrangler.toml` 中对应的 `__BUCKET_NAME__` / `__PREVIEW_BUCKET_NAME__` / `__API_DOMAIN__` / `__ZONE_NAME__`。

示例（在 GitHub Actions Runner 中的替换命令，工作流已经为你添加）：

```bash
sed -i "s|__BUCKET_NAME__|${BUCKET_NAME}|g" worker/wrangler.toml
sed -i "s|__PREVIEW_BUCKET_NAME__|${PREVIEW_BUCKET_NAME}|g" worker/wrangler.toml
sed -i "s|__API_DOMAIN__|${API_DOMAIN}|g" worker/wrangler.toml
sed -i "s|__ZONE_NAME__|${ZONE_NAME:-$(echo $API_DOMAIN | awk -F. '{print $(NF-1)"."$NF}')}|g" worker/wrangler.toml
sed -i "s|__API_BASE__|${API_BASE:-https://$API_DOMAIN}|g" pages/index.html
```

说明：把这些 Secrets 设置好后，Github Actions 会在运行时替换占位符并在相同 runner 上执行 `npx wrangler publish`（Worker）和可选的 `npx wrangler pages deploy`（Pages）。


### 3️⃣ 部署 Worker

```bash
cd worker
npx wrangler deploy
```

部署完成后，Worker 可通过以下地址访问：
- Worker 原生 URL：https://praise-api.yourname.workers.dev
- 自定义域名（示例）：https://papi.yourdomain.com

### 4️⃣ 配置 Pages 前端

Pages 前端读取 Worker API 地址（可注入）：

前端会从页面 meta 标签读取 API 根地址。示例在 `pages/index.html` 中使用占位符：

```html
<meta name="api-base" content="__API_BASE__" />
<meta name="file-base" content="__FILE_BASE__" />
```

运行时，`pages/app.js` 会读取这两个 meta 值：

- `api-base`：Worker API 根地址（列表、圣经等接口）。未被替换时回退到默认 `https://papi.yourdomain.com`。
- `file-base`：R2 公开域名，音频 / PDF 等媒体直链由此拼接，不再经过 Worker 的 `/api/file/<encoded-key>`；由工作流用 GitHub Secret `FILE_DOMAIN`（例如 `https://r2files.242500.xyz`）替换 `__FILE_BASE__`，留空或未替换时回退到默认 `https://r2files.242500.xyz`。

播放地址按“逐段编码”拼接为 `{file-base}/{R2 key}`：目录分隔符 `/` 保留，其余字符逐个 `encodeURIComponent`。例如 R2 key `praise/附录/001.将这山地赐给我.mp3` 的播放地址为：

```
https://r2files.242500.xyz/praise/%E9%99%84%E5%BD%95/001.%E5%B0%86%E8%BF%99%E5%B1%B1%E5%9C%B0%E8%B5%90%E7%BB%99%E6%88%91.mp3
```

Worker 的 `/api/file/<encoded-key>` 仍然保留，用于兼容旧链接以及刷新页面后恢复播放状态。

### 5️⃣ 初始化 Pages 项目（仅首次）

在项目根目录执行：

```bash
npx wrangler pages project create praise-web
```

### 6️⃣ 部署 Pages

```bash
npx wrangler pages deploy pages --project-name=praise-web
```

部署完成后，访问地址：https://praise.yourdomain.com

## 注意事项

- 确保 R2 存储桶中的文件按以下目录结构组织：
  - 赞美诗：`praise/附录/`、`praise/大本/`、`praise/新编/`
  - 资料：「音频」放在 `resources/audio/`，「视频」放在 `resources/video/`，PDF 放在 `resources/pdf/`
- Worker 的 `list` 接口默认限制 1000 条，如需修改请编辑 `worker/index.js`
- `GET /api/list?dir=<目录>&ext=<扩展名>`：`ext` 逗号分隔（如 `mp3,mp4,pdf`），不传时只返回 mp3；响应除 `songs`（文件名）外新增 `keys`（完整 R2 key，含子目录），前端用它拼接播放地址
- 首次部署后需要在 Cloudflare Dashboard 中配置 Pages 的自定义域名（可选）
- 圣经数据存放在 D1 数据库（表 `bible_volume`、`bible_verses`），需要在 Worker 上添加一个 D1 绑定，变量名用 `DB`；前端通过 `/api/bible/books` 与 `/api/bible/chapter?book=<id>&chapter=<章号>` 读取
- Worker 已配置 CORS 支持，允许跨域访问
- 修改 Worker 代码后需要重新部署：`cd worker && npx wrangler deploy`

## 常见问题

### CORS 错误
如果遇到 CORS 错误，确保已部署带有 CORS 头部的 Worker 代码。Worker 已配置允许所有来源的跨域请求。
