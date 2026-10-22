/* ===================================================================
   YAMA-10 — yama-9'dan SONRA yükle.
   1) Sipariş tamamlanınca Hesabım'daki puan rozeti ANINDA güncellensin
      (önceden yalnızca bir sonraki girişte/yenilemede görünüyordu).
   2) Sepet ve ödeme ekranında indirimli üründe eski fiyat (üstü çizili)
      + indirim tutarı gösterilsin.
   =================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* 1) Ödeme bitince profil verisini (puan dahil) hemen tazele */
  const _pp = window.processPayment;
  window.processPayment = async function () {
    const r = await _pp.apply(this, arguments);
    if (currentUser && !currentUser.isAnonymous) { try { await loadProfileData(); } catch (e) {} }
    return r;
  };

  /* 2a) Sepete eklerken ürünün eski fiyatını da satıra taşı (varsa) */
  const _add = window.addToCart;
  window.addToCart = function (dbId) {
    const r = _add.apply(this, arguments);
    const p = allProducts.find(x => x.id === dbId);
    if (p && p.oldPrice > p.price) {
      const last = cart[cart.length - 1];
      if (last && last.dbId === dbId && !last.oldPrice) { last.oldPrice = p.oldPrice; localStorage.setItem('ballin_cart', JSON.stringify(cart)); }
    }
    return r;
  };

  /* 2b) Sepet panelinde: eski fiyat (üstü çizili) + indirim tutarı */
  const _rc = window.renderCart;
  window.renderCart = function () {
    const r = _rc.apply(this, arguments);
    try {
      const box = $('cartItems'); if (!box || !cart.length) return r;
      const g = {}; cart.forEach(i => { const k = i.dbId + '|' + i.size; (g[k] = g[k] || { it: i, n: 0 }).n++; });
      const rows = [...box.children];
      Object.values(g).forEach(({ it, n }, idx) => {
        const row = rows[idx]; if (!row || row.querySelector('.discTag')) return;
        if (it.oldPrice > it.price) {
          const save = (it.oldPrice - it.price) * n;
          const priceP = row.querySelector('p.text-xs.text-brand-600');
          if (priceP) priceP.insertAdjacentHTML('beforeend',
            ' <span class="discTag" style="text-decoration:line-through;opacity:.5;margin-left:6px">' + tl(it.oldPrice * n) + ' TL</span>' +
            ' <span style="color:#dc2626;font-weight:700;margin-left:4px">(-' + tl(save) + ' TL)</span>');
        }
      });
    } catch (e) {}
    return r;
  };

  /* 2c) Ödeme ekranı özetinde aynısı */
  const _gc = window.goToCheckout;
  window.goToCheckout = function () {
    const r = _gc.apply(this, arguments);
    try {
      const box = $('checkoutSummaryItems'); if (!box || !cart.length) return r;
      const rows = [...box.children];
      cart.forEach((it, i) => {
        const row = rows[i]; if (!row || row.querySelector('.discTag')) return;
        if (it.oldPrice > it.price) {
          row.insertAdjacentHTML('beforeend',
            '<div class="discTag text-[11px] text-right" style="margin-top:2px">' +
            '<span style="text-decoration:line-through;opacity:.5">' + tl(it.oldPrice) + ' TL</span>' +
            ' <span style="color:#dc2626;font-weight:700">(-' + tl(it.oldPrice - it.price) + ' TL)</span></div>');
        }
      });
    } catch (e) {}
    return r;
  };
})();
