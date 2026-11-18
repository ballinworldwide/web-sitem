/* YAMA-31: sitemap — ana sayfa + tüm ürünler (ürün eklenince kendiliğinden güncellenir).
   Koleksiyon/hakkımızda gibi bölümler index.html'in parçası ve canonical'ı ana sayfa; bu yüzden ayrıca listelenmez. */
import { urunler, SITE } from './_urunler.js';
const SAYFALAR = [''];
const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export async function onRequestGet(ctx) {
  let list = null; try { list = await urunler(ctx); } catch (e) {}
  const u = [];
  for (const s of SAYFALAR) u.push('<url><loc>' + SITE + '/' + s + '</loc>' + (s ? '' : '<priority>1.0</priority>') + '</url>');
  for (const p of list || []) {
    if (!p.slug) continue;
    const d = p.updated ? new Date(p.updated) : null;
    u.push('<url><loc>' + x(SITE + '/urun/' + p.slug) + '</loc>' + (d && !isNaN(d) ? '<lastmod>' + d.toISOString().slice(0, 10) + '</lastmod>' : '') + '</url>');
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + u.join('\n') + '\n</urlset>\n',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
