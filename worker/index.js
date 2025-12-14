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
  
      // 2️⃣ /api/file/<encoded-key>
      if (path.startsWith("/api/file/")) {
        const encoded = path.replace("/api/file/", "");
        const key = decodeURIComponent(encoded);
        const object = await env.R2_BUCKET.get(key);
        if (!object)
          return new Response("File not found", { 
            status: 404,
            headers: corsHeaders,
          });
        return new Response(object.body, {
          headers: {
            "Content-Type": "audio/mpeg",
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
  