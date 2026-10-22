/* ===================================================================
   YAMA-10 (DÜZELTİLMİŞ) — yama-9'dan SONRA yükle, eski yama-10.js'in
   yerine koy (aynı isimle üzerine yaz).
   Önceki sürümdeki hata: sepet fiyat satırını yanlış CSS class'ıyla
   arıyordu (patch4.js'in gerçek markup'ıyla eşleşmiyordu), bu yüzden
   indirim hiç görünmüyordu. Şimdi renderCart TAMAMEN yeniden
   tanımlanıyor (patch4'ün üzerine yazmak yerine), discount satırı
   doğrudan markup'ın içine gömülü.
   1) Sipariş tamamlanınca Hesabım'daki puan ANINDA güncellensin.
   2) Sepete eklerken ürünün eski fiyatını da satıra taşı.
   3) Sepet panelinde: eski fiyat (üstü çizili) + indirim tutarı.
   4) Ödeme ekranı özetinde aynısı.
   =================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* 1) Ödeme bitince profil verisini (puan dahil) hemen tazele */
  const _pp = window.processPayment;
  window.processPayment = async function () {
    const r = await _pp.apply(this, arguments);
    if (currentUser && !currentUser.isAnonymous) { try { await loadProfileData(); } catch (e) {} }
    return r;
  };

  /* 2) Sepete eklerken ürünün eski fiyatını satıra taşı (varsa) */
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

  /* 3) Sepet paneli: patch4.js'in renderCart'ının TAM YENİDEN TANIMI (discount satırı dahil) */
  window.renderCart = function () {
    const box = $('cartItems'), totalEl = $('cartTotal'); if (!box || !totalEl) return;
    let total = 0;
    if (!cart.length) {
      box.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-cart-arrow-down text-4xl text-brand-200 mb-4"></i><p class="text-sm font-medium text-brand-500">Sepetiniz şu an boş.</p></div>';
      if ($('cartShippingProgressContainer')) $('cartShippingProgressContainer').classList.add('hidden');
      totalEl.innerText = '0 TL';
      return;
    }
    const g = {}; cart.forEach(i => { const k = i.dbId + '|' + i.size; (g[k] = g[k] || { it: i, n: 0 }).n++; total += i.price || 0; });
    box.innerHTML = Object.values(g).map(({ it, n }) => {
      const a = "'" + E(it.dbId) + "','" + E(it.size) + "'", b = 'style="width:28px;height:28px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-weight:700"';
      const discHtml = it.oldPrice > it.price
        ? ' <span class="discTag" style="text-decoration:line-through;opacity:.5;margin-left:6px">' + tl(it.oldPrice) + ' TL</span>' +
          ' <span style="color:#dc2626;font-weight:700;margin-left:4px">(-' + tl(it.oldPrice - it.price) + ' TL)</span>'
        : '';
      return '<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="' + E(it.image) + '" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1">' +
        '<h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">' + E(it.baseName || it.name) + '</h4>' +
        '<p class="text-[11px] text-brand-400 mt-1">' + (it.size && it.size !== 'Standart' ? 'Beden: ' + E(it.size) + ' · ' : '') + tl(it.price) + ' TL' + discHtml + '</p>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button ' + b + ' onclick="cartMinus(' + a + ')">−</button><b style="min-width:18px;text-align:center">' + n + '</b><button ' + b + ' onclick="cartPlus(' + a + ')">+</button>' +
        '<span class="text-sm font-bold text-brand-900" style="margin-left:auto">' + tl((it.price || 0) * n) + ' TL</span></div></div>' +
        '<button onclick="cartRemoveGroup(' + a + ')" aria-label="Sil" class="text-brand-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>';
    }).join('');
    const pc = $('cartShippingProgressContainer'), bar = $('cartShippingBar'), tx = $('cartShippingText');
    if (pc) pc.classList.remove('hidden');
    if (total >= FREE_SHIPPING_THRESHOLD) { if (bar) bar.style.width = '100%'; if (tx) tx.innerHTML = '<i class="fa-solid fa-gift text-emerald-500 mr-1"></i> Tebrikler, kargo bedava!'; }
    else { if (bar) bar.style.width = (total / FREE_SHIPPING_THRESHOLD * 100) + '%'; if (tx) tx.innerHTML = 'Ücretsiz kargoya <strong>' + tl(FREE_SHIPPING_THRESHOLD - total) + ' TL</strong> kaldı!'; }
    totalEl.innerText = tl(total * (1 - appliedDiscountRate)) + ' TL';
  };

  /* 4) Ödeme ekranı özetinde eski fiyat + indirim tutarı (core'un goToCheckout'unu sarmalar) */
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
