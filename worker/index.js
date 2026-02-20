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

      // 1️⃣ /api/list?dir=xxx
      if (path === "/api/list") {
        const prefix = url.searchParams.get("dir") || "praise/附录/";
        const list = await env.R2_BUCKET.list({ prefix, limit: 1000 });
        const songs = list.objects
          .filter(o => o.key.endsWith(".mp3"))
          .map(o => o.key.split("/").pop());
        return new Response(JSON.stringify({ songs }, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      // 2️⃣ /api/bible/books - 获取圣经书卷列表
      if (path === "/api/bible/books") {
        const books = [
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
        return new Response(JSON.stringify(books, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
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
  