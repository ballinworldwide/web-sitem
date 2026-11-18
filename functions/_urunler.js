/* YAMA-31: ürün listesi (ballin-mail Worker'ından, servis bağlantısıyla). 5 dk önbellek. */
export const SITE = 'https://ballinworldwide.net';
export async function urunler(ctx) {
  const { env } = ctx;
  const cache = caches.default, key = new Request(SITE + '/__urunler_v1');
  let r = await cache.match(key);
  if (!r) {
    if (!env.MAIL || !env.INTERNAL_KEY) return null;
    const res = await env.MAIL.fetch('https://ballin-mail/public-products', { headers: { 'X-Ballin-Internal': env.INTERNAL_KEY } });
    if (!res.ok) return null;
    r = new Response(await res.text(), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
    ctx.waitUntil(cache.put(key, r.clone()));
  }
  try { const j = await r.json(); return Array.isArray(j) ? j : null; } catch (e) { return null; }
}
