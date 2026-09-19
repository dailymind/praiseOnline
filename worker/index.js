// ---------- 公共小工具 ----------
// D1 绑定名兼容：默认 DB，也接受 BIBLE_DB / bible_db
const getBibleDb = (env) => env.DB || env.BIBLE_DB || env.bible_db || null;

const jsonResponse = (data, corsHeaders, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  });

const dbBindingMissing = (corsHeaders) =>
  jsonResponse(
    {
      error:
        "Worker 未绑定 D1 数据库，请在 Cloudflare 控制台为该 Worker 添加 D1 绑定（变量名建议 DB）后重试",
    },
    corsHeaders,
    500
  );

export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;

      // 处理 CORS 预检请求
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // CORS 头部
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      // 1️⃣ /api/list?dir=xxx&ext=mp3,mp4,pdf
      if (path === "/api/list") {
        const prefix = url.searchParams.get("dir") || "praise/附录/";
        // ext：逗号分隔的扩展名过滤，未传时保持老行为（只返回 mp3）
        const exts = (url.searchParams.get("ext") || "mp3")
          .split(",")
          .map(e => e.trim().toLowerCase().replace(/^\./, ""))
          .filter(Boolean)
          .map(e => "." + e);
        const list = await env.R2_BUCKET.list({ prefix, limit: 1000 });
        const objects = list.objects.filter(o =>
          exts.some(ext => o.key.toLowerCase().endsWith(ext))
        );
        const songs = objects.map(o => o.key.split("/").pop());
        // keys：完整 R2 key（含 audio/video 等子目录），供前端直接拼接播放地址
        const keys = objects.map(o => o.key);
        return new Response(JSON.stringify({ songs, keys }, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      // 2️⃣ /api/bible/books - 书卷列表（数据来自 D1）
      if (path === "/api/bible/books") {
        const db = getBibleDb(env);
        if (!db) return dbBindingMissing(corsHeaders);

        const { results } = await db
          .prepare(
            `SELECT id, name, name_short, pinyin, pinyin_short, chapter_total, testament_sn, kind_sn
               FROM bible_volume
              ORDER BY id`
          )
          .all();

        const books = (results || []).map((r) => ({
          id: r.id,
          name: r.name,
          nameShort: r.name_short,
          pinyin: r.pinyin,
          pinyinShort: r.pinyin_short,
          chapters: r.chapter_total,
          testament: r.testament_sn, // 0 = 旧约, 1 = 新约
          group: r.kind_sn, // 1..8 分类（摩西五经/历史书/...）
        }));

        return jsonResponse({ count: books.length, books }, corsHeaders);
      }

      // 3️⃣ /api/bible/chapter?book=<volume_id>&chapter=<chapter_sn> - 单章经文（数据来自 D1）
      if (path === "/api/bible/chapter") {
        const db = getBibleDb(env);
        if (!db) return dbBindingMissing(corsHeaders);

        const bookId = Number(url.searchParams.get("book"));
        const chapterSn = Number(url.searchParams.get("chapter"));
        if (!Number.isInteger(bookId) || !Number.isInteger(chapterSn) || bookId < 1 || chapterSn < 1) {
          return jsonResponse(
            { error: "参数错误：需要 book（书卷 id）与 chapter（章号）" },
            corsHeaders,
            400
          );
        }

        const { results } = await db
          .prepare(
            `SELECT verse_sn, verse_txt
               FROM bible_verses
              WHERE volume_id = ? AND chapter_sn = ?
              ORDER BY verse_sn`
          )
          .bind(bookId, chapterSn)
          .all();

        const verses = (results || []).map((r) => ({ verse: r.verse_sn, text: r.verse_txt }));
        return jsonResponse({ bookId, chapter: chapterSn, count: verses.length, verses }, corsHeaders);
      }
      // 3️⃣ /api/bible/file/<filename> - 获取圣经文件内容
      if (path.startsWith("/api/bible/file/")) {
        const filename = path.replace("/api/bible/file/", "");
        const key = `bible/${decodeURIComponent(filename)}`;
        const object = await env.R2_BUCKET.get(key);
        if (!object) {
          return new Response("Bible file not found", {
            status: 404,
            headers: corsHeaders,
          });
        }
        return new Response(object.body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            ...corsHeaders,
          },
        });
      }

      // 4️⃣ /api/file/<encoded-key> - 获取文件（音频/PDF等）
      if (path.startsWith("/api/file/")) {
        const encoded = path.replace("/api/file/", "");
        const key = decodeURIComponent(encoded);
        const object = await env.R2_BUCKET.get(key);
        if (!object)
          return new Response("File not found", {
            status: 404,
            headers: corsHeaders,
          });

        // 根据文件扩展名设置 Content-Type
        let contentType = "application/octet-stream";
        if (key.endsWith(".mp3")) contentType = "audio/mpeg";
        else if (key.endsWith(".wav")) contentType = "audio/wav";
        else if (key.endsWith(".pdf")) contentType = "application/pdf";
        else if (key.endsWith(".mp4")) contentType = "video/mp4";
        else if (key.endsWith(".mov")) contentType = "video/quicktime";
        else if (key.endsWith(".txt")) contentType = "text/plain; charset=utf-8";

        return new Response(object.body, {
          headers: {
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
            ...corsHeaders,
          },
        });
      }

      // 默认返回 404
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    },
  };
  