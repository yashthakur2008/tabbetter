const pending = new Map(),
  memory = new Map();
function json(value, status = 200, ttl = 0) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": ttl ? "public, max-age=" + ttl : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
async function upstream(path) {
  const r = await fetch("https://www.tabroom.com" + path, {
    headers: { "User-Agent": "TabBetter/0.1 public tournament companion" },
    signal: AbortSignal.timeout(20000),
    redirect: "manual",
  });
  if (r.status >= 300 && r.status < 400)
    throw Error("Tabroom requires sign-in for this resource");
  if (!r.ok) throw Error("Tabroom returned " + r.status);
  const text = await r.text();
  if (text.length > 12000000) throw Error("Source too large");
  return text;
}
async function cached(request, ctx, key, ttl, fn) {
  const k = new Request(new URL("/_cache/v4/" + key, request.url));
  let edge = null,
    found = null;
  try {
    edge = globalThis.caches
      ? await globalThis.caches.open("tabbetter-public-v4")
      : null;
    found = edge && (await edge.match(k));
  } catch {
    edge = null;
  }
  if (found) return found;
  const local = memory.get(key);
  if (local && local.until > Date.now()) return json(local.data, 200, ttl);
  try {
    if (!pending.has(key))
      pending.set(
        key,
        fn()
          .then((data) => ({ ...data, fetchedAt: new Date().toISOString() }))
          .finally(() => pending.delete(key)),
      );
    const data = await pending.get(key);
    if (memory.size > 100) memory.delete(memory.keys().next().value);
    memory.set(key, { data, until: Date.now() + ttl * 1000 });
    const r = json(data, 200, ttl);
    if (edge) ctx.waitUntil(edge.put(k, r.clone()).catch(() => {}));
    return r;
  } catch (e) {
    if (local)
      return json({ ...local.data, stale: true, error: e.message }, 200, 30);
    return json({ error: e.message, unavailable: true }, 502);
  }
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET")
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET" },
      });
    if (url.pathname === "/logo.png")
      return new Response(
        Uint8Array.from(atob(logo), (c) => c.charCodeAt(0)),
        {
          headers: {
            "content-type": "image/png",
            "cache-control": "public,max-age=86400",
          },
        },
      );
    if (url.pathname === "/api/calendar") {
      const params = new URLSearchParams();
      for (const key of ["year", "circuit_id", "state", "country"]) {
        const v = url.searchParams.get(key);
        if (v) {
          if (!/^[A-Za-z0-9-]{1,10}$/.test(v))
            return json({ error: "Invalid filter" }, 400);
          if (
            key === "year" &&
            (!/^\d{4}$/.test(v) ||
              Number(v) < 2003 ||
              Number(v) > new Date().getUTCFullYear() + 2)
          )
            return json({ error: "Invalid school year" }, 400);
          if (key === "circuit_id" && !/^\d{1,8}$/.test(v))
            return json({ error: "Invalid circuit" }, 400);
          params.set(key, v);
        }
      }
      return cached(
        request,
        ctx,
        "calendar" + encodeURIComponent(params.toString()),
        600,
        async () => ({
          ...parseCalendar(await upstream("/index/index.mhtml?" + params)),
          sourceUrl: "https://www.tabroom.com/index/index.mhtml?" + params,
        }),
      );
    }
    if (url.pathname === "/api/rankings") {
      const event = url.searchParams.get("event") || "";
      const season = url.searchParams.get("season") || "";
      if (!["LD", "PF"].includes(event))
        return json({ error: "Unsupported event" }, 400);
      if (!/^\d{4}-\d{4}$/.test(season))
        return json({ error: "Invalid season" }, 400);
      // The archive corpus is embedded only when redistribution is cleared.
      if (typeof rankingsCorpus === "undefined" || !rankingsCorpus)
        return json(
          {
            available: false,
            reason:
              "Historical rankings are not included in this build. See docs/rankings-sources.md.",
          },
          200,
          3600,
        );
      const corpus = hydrateCorpus(rankingsCorpus);
      return json(
        {
          available: true,
          provider: corpus.provider,
          methodology: corpus.methodology,
          sourceUrl: corpus.sourceUrl,
          retrievedAt: corpus.generatedAt,
          window: corpus.window,
          season,
          event,
          competitors: corpus.competitors.filter(
            (c) => c.event === event && c.season === season,
          ),
        },
        200,
        3600,
      );
    }
    if (url.pathname === "/api/circuits")
      return cached(request, ctx, "circuits", 3600, async () => ({
        circuits: parseCircuits(await upstream("/index/circuits.mhtml")),
        sourceUrl: "https://www.tabroom.com/index/circuits.mhtml",
      }));
    if (["/api/tournament", "/api/invitation"].includes(url.pathname)) {
      const id = url.searchParams.get("id");
      if (!/^\d{1,8}$/.test(id || ""))
        return json({ error: "Invalid tournament ID" }, 400);
      if (url.pathname === "/api/invitation")
        return cached(request, ctx, "invite-" + id, 600, async () =>
          parseInvitation(
            await upstream("/index/tourn/main.mhtml?tourn_id=" + id),
            id,
          ),
        );
      return cached(request, ctx, "tournament-" + id, 300, async () =>
        normalizeExport(
          JSON.parse(await upstream("/api/download_data.mhtml?tourn_id=" + id)),
          id,
        ),
      );
    }
    if (url.pathname !== "/") return new Response("Not found", { status: 404 });
    return new Response(page, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "content-security-policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  },
};
