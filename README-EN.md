# Hymn Player

An online MP3 player built on Cloudflare Pages and Workers.

## Project configuration

- **Pages project name**: praise-web
- **Pages URL**: https://praise.yourdomain.com
- **Worker project name**: praise-api
- **Worker URL**: https://__API_DOMAIN__
- **R2 bucket**: __BUCKET_NAME__

## Project structure

- `pages/` - frontend pages (HTML/CSS/JS), deployed to Cloudflare Pages
- `worker/` - backend API Worker, deployed to Cloudflare Workers

## Deployment steps

### 1) Prerequisites

1. Create an R2 bucket in the Cloudflare dashboard and upload your MP3 files.
2. Install Wrangler CLI: `npm install -g wrangler` or `npm i -D wrangler`.

### 2) Configure the Worker

Worker configuration (replace with your own values):

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

Note: Do not include real bucket names or sensitive information in a public README. Replace the placeholders or manage secrets via CI (GitHub Secrets) and use them in your deployment workflow.

### 3) Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

After deployment, the Worker can be accessed at:
- Worker dev URL: https://praise-api.yourname.workers.dev
- Custom domain (example): https://papi.yourdomain.com

### 4) Configure Pages frontend

The Pages frontend reads the API base from a meta tag (injected at deploy-time):

Add this placeholder to `pages/index.html`:

```html
<meta name="api-base" content="__API_BASE__" />
```

The deployment workflow can replace `__API_BASE__` with the secret `API_BASE` so the client uses your configured API domain.

If not injected, the client falls back to `https://papi.yourdomain.com`.

### GitHub / Cloudflare configuration

Set these repository Secrets in GitHub (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with necessary permissions for Workers/Pages/R2.
- `CLOUDFLARE_PAGES_PROJECT_NAME` — (optional) Pages project name to enable Pages deployment in CI.
- `API_BASE` — (optional) API base URL used by the frontend, e.g. `https://papi.yourdomain.com`.
- `BUCKET_NAME` — R2 bucket name; workflow replaces `__BUCKET_NAME__` in `worker/wrangler.toml`.
- `PREVIEW_BUCKET_NAME` — preview bucket name; replaces `__PREVIEW_BUCKET_NAME__`.
- `API_DOMAIN` — your API domain, e.g. `papi.yourdomain.com`; replaces `__API_DOMAIN__`.
- `ZONE_NAME` — (optional) Cloudflare zone root, e.g. `yourdomain.com`. If omitted, the workflow will try to derive it from `API_DOMAIN`.

Note: If you use a build step for Cloudflare Pages, you can add an environment variable `API_BASE` in the Pages project settings and inject it during build. For pure static sites without a build step, it's recommended to inject `API_BASE` via GitHub Actions or set the meta tag manually in `pages/index.html`.

Triggers:
- Automatic: push to `main` triggers the workflow.
- Manual: GitHub Actions → select the workflow → Run workflow.

How CI injects these values into `wrangler.toml` and the frontend

The workflow will:

- Replace `__API_BASE__` in `pages/index.html` with `API_BASE` (so client reads the correct API URL).
- Replace `__BUCKET_NAME__`, `__PREVIEW_BUCKET_NAME__`, `__API_DOMAIN__`, and `__ZONE_NAME__` in `worker/wrangler.toml` with the corresponding secrets.

Example replacement commands that run on the Actions runner (the workflow contains equivalent steps):

```bash
sed -i "s|__BUCKET_NAME__|${BUCKET_NAME}|g" worker/wrangler.toml
sed -i "s|__PREVIEW_BUCKET_NAME__|${PREVIEW_BUCKET_NAME}|g" worker/wrangler.toml
sed -i "s|__API_DOMAIN__|${API_DOMAIN}|g" worker/wrangler.toml
sed -i "s|__ZONE_NAME__|${ZONE_NAME:-$(echo $API_DOMAIN | awk -F. '{print $(NF-1)"."$NF}')}|g" worker/wrangler.toml
sed -i "s|__API_BASE__|${API_BASE:-https://$API_DOMAIN}|g" pages/index.html
```

Once placeholders are replaced the workflow runs the normal `npx wrangler publish` and (optionally) `npx wrangler pages deploy` commands.


### 5) Initialize Pages project (first time only)

```bash
npx wrangler pages project create praise-web
```

### 6) Deploy Pages

```bash
npx wrangler pages deploy pages --project-name=praise-web
```

## Notes

- Organize your MP3 files in R2 like:
  - `praise/附录/`
  - `praise/大本/`
  - `praise/新编/`
- The Worker `list` API defaults to 1000 items; edit `worker/index.js` to change.
- After changing Worker code, redeploy with: `cd worker && npx wrangler deploy`.
- Use GitHub Secrets (for example `CLOUDFLARE_API_TOKEN`) to keep tokens safe when automating deployments.

If you want, I can also add a GitHub Actions workflow to automate deployment using those secrets.
