/* YAMA-31: /urun/<ad> — sayfa aynı (index.html), Google ve paylaşım önizlemesi için başlık/açıklama/görsel eklenir */
import { urunler, SITE } from '../_urunler.js';
export async function onRequestGet(ctx) {
  const { request, params, env } = ctx;
  const res = await env.ASSETS.fetch(new URL('/', request.url));
  if (!res.ok) return res;
  let list = null; try { list = await urunler(ctx); } catch (e) {}
  const slug = String(params.slug || '');
  const p = list && (list.find(x => x.slug === slug) || list.find(x => x.id === slug));
  if (!p) {
    if (!list) return res;   // ürün listesi alınamadıysa sayfayı olduğu gibi ver
    return new HTMLRewriter().on('head', { element(e) { e.append('<meta name="robots" content="noindex">', { html: true }); } }).transform(res);
  }
  const url = SITE + '/urun/' + p.slug, fiyat = Number(p.price) || 0;
  const title = p.name + ' | BALLIN', desc = (p.description || (p.name + ' — ' + fiyat.toLocaleString('tr-TR') + ' TL. BALLIN lüks sokak giyim.')).slice(0, 300);
  const set = v => ({ element(e) { e.setAttribute('content', v); } });
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc, url, ...(p.image ? { image: [p.image] } : {}), ...(p.category ? { category: p.category } : {}),
    brand: { '@type': 'Brand', name: 'Ballin World Wide' },
    offers: { '@type': 'Offer', url, priceCurrency: 'TRY', price: fiyat.toFixed(2), availability: 'https://schema.org/' + (p.inStock ? 'InStock' : 'OutOfStock') } }).replace(/</g, '\\u003c');
  let rw = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(title); } })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:type"]', set('product'))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:url"]', set(url))
    .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', url); } })
    .on('head', { element(e) { e.append('<meta property="product:price:amount" content="' + fiyat.toFixed(2) + '"><meta property="product:price:currency" content="TRY"><script type="application/ld+json">' + ld + '</script>', { html: true }); } });
  if (p.image) rw = rw.on('meta[property="og:image"]', set(p.image));
  return rw.transform(res);
}
