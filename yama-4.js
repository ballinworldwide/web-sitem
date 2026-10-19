/* BALLIN yama-4.js — tüm ürünler yüklenir (12 ürün sınırı kalktı); arama, filtre, sıralama, admin tablosu ve
   CSV dışa aktarma artık tüm ürünlerle çalışır. yama-3'ten SONRA yükle. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const CACHE_KEY = 'ballin_products_v1', TTL = 3 * 60 * 1000;   // ziyaretçiler için 3 dk önbellek (okuma maliyetini düşürür)
  const isStaff = () => typeof isStaffNow === 'function' && isStaffNow(currentUser);

  function readCache() {
    try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); return c && Date.now() - c.t < TTL ? c.p : null; } catch (e) { return null; }
  }
  function writeCache(list) {
    try { const s = JSON.stringify({ t: Date.now(), p: list }); if (s.length < 2000000) sessionStorage.setItem(CACHE_KEY, s); } catch (e) {}
  }
  const plain = d => { const p = d.data(); p.id = d.id; if (p.createdAt && p.createdAt.toMillis) p.createdAt = p.createdAt.toMillis(); if (p.updatedAt && p.updatedAt.toMillis) p.updatedAt = p.updatedAt.toMillis(); return p; };

  window.loadProducts = function () {
    if (isLoadingProducts) return;
    const cached = (!isStaff() && !arguments[1]) ? readCache() : null;
    const done = list => {
      allProducts = list; lastProductDoc = null;
      renderMainGrid(); filterAndSortProducts(); renderNewGrid(); renderWishlistGrid();
      loadOrdersAndCalculateStats(); loadCustomersCRM(); updateWishlistBadge(); renderBulkTable(); loadCouponsAdmin(); loadCMSBanner(); loadAbandonedCarts();
      updateCartBadge();
      const btn = $('loadMoreBtn'); if (btn) btn.style.display = 'none';      // "Daha fazla yükle" artık gerekmiyor
      isLoadingProducts = false;
      const h = window.location.hash;
      if (h && h.startsWith('#/')) { const t = allProducts.find(p => createSlug(p.name) === h.replace('#/', '')); if (t) setTimeout(() => openProductDetail(t.id), 100); }
    };
    if (cached) return done(cached);
    isLoadingProducts = true;
    db.collection('products').orderBy('createdAt', 'desc').limit(500).get()
      .then(snap => { const list = snap.docs.map(plain); if (!isStaff()) writeCache(list); done(list); })
      .catch(e => { isLoadingProducts = false; console.warn('ürünler yüklenemedi', e); });
  };
  // Yönetici bir şeyi kaydedince önbellek temizlensin (ziyaretçiler en geç 3 dk içinde yeni halini görür)
  try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
})();
