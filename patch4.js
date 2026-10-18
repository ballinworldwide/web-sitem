/* BALLIN patch4.js — sepette adet, kartta "Sepete Ekle", beden seçimi. patch3.js'ten SONRA yükle:
   <script src="patch4.js"></script> */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b && !isNaN(parseInt(b))) m[a.trim().toUpperCase()] = parseInt(b); }); return m; };
  const prodOf = id => allProducts.find(p => p.id === id);
  const limitFor = (p, size) => { const m = parseSS(p.sizeStock); return Object.keys(m).length ? (m[String(size).toUpperCase()] || 0) : (p.stock || 0); };
  const countIn = (id, size) => cart.filter(i => i.dbId === id && i.size === size).length;
  const cover = p => (p.images && p.images[0]) || p.image || 'https://placehold.co/600x800/f1f3f5/a3a3a3?text=BALLIN';

  /* Stok sınırını aşan eklemeyi engelle (ürün sayfası dahil) */
  const _add = window.addToCart;
  window.addToCart = function (dbId, name, price, image, size) {
    size = size || 'Standart';
    const p = prodOf(dbId);
    if (p && countIn(dbId, size) >= limitFor(p, size)) return showToast('Bu üründen stokta yeterli adet yok.', 'error');
    return _add.call(this, dbId, name, price, image, size);
  };

  /* Ürün kartı: favori kalbi + hızlı "Sepete Ekle" */
  window.createProductCard = function (prod) {
    const out = prod.stock <= 0, fav = wishlist.includes(prod.id);
    const badge = out ? '<span class="absolute top-3 right-3 bg-red-600 text-white px-2.5 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Tükendi</span>'
      : (prod.stock <= 5 ? '<span class="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Son ' + prod.stock + ' Ürün</span>' : '');
    return '<div class="group relative flex flex-col cursor-pointer bg-brand-50 rounded-2xl p-4 overflow-hidden border border-brand-100 hover:border-brand-300 transition-all hover:shadow-xl" onclick="openProductDetail(\'' + prod.id + '\')">' + badge +
      '<div class="absolute top-3 left-3 z-10"><button onclick="toggleWishlist(\'' + prod.id + '\', event)" aria-label="Favorilere ekle" class="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center transition-colors ' + (fav ? 'text-red-500' : 'text-brand-400 hover:text-red-500') + '"><i class="fa-solid fa-heart"></i></button></div>' +
      '<div class="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-4 bg-white"><img loading="lazy" alt="' + E(prod.name) + '" src="' + E(cover(prod)) + '" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ' + (out ? 'grayscale brightness-50' : '') + '">' +
      '<button ' + (out ? 'disabled' : 'onclick="quickAdd(\'' + prod.id + '\', event)"') + ' class="absolute bottom-2 left-2 right-2 ' + (out ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-900 hover:bg-black') + ' text-white text-xs font-bold py-2.5 rounded-lg shadow-lg z-10">' + (out ? 'Tükendi' : '<i class="fa-solid fa-bag-shopping mr-1"></i> Sepete Ekle') + '</button></div>' +
      '<div class="flex justify-between items-start mt-2"><div><h3 class="text-sm font-medium text-brand-900 font-serif line-clamp-1">' + E(prod.name) + '</h3><p class="text-[10px] text-brand-400 uppercase mt-1 tracking-wider">' + E(prod.category || 'Diğer') + '</p></div>' +
      '<p class="text-sm font-bold text-brand-900">' + tl(prod.price) + ' TL</p></div></div>';
  };

  function addSize(p, size) { addToCart(p.id, p.name + (size && size !== 'Standart' ? ' (' + size + ')' : ''), p.price, cover(p), size); }

  window.quickAdd = function (id, ev) {
    if (ev) ev.stopPropagation();
    const p = prodOf(id); if (!p) return;
    const m = parseSS(p.sizeStock), sizes = Object.keys(m);
    if (!sizes.length) return addSize(p, 'Standart');                       // beden yok: direkt ekle
    if (sizes.length === 1) return m[sizes[0]] > 0 ? addSize(p, sizes[0]) : showToast('Ürün tükendi.', 'error');   // tek beden: direkt ekle
    closePick();
    const o = document.createElement('div'); o.id = 'sizePickModal';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    o.onclick = e => { if (e.target === o) closePick(); };
    o.innerHTML = '<div style="background:#fff;width:100%;max-width:420px;border-radius:20px 20px 0 0;padding:22px 20px 26px">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><img src="' + E(cover(p)) + '" style="width:56px;height:70px;object-fit:cover;border-radius:10px"><div style="flex:1"><div style="font-weight:700;font-size:14px">' + E(p.name) + '</div><div style="font-size:13px;color:#666">' + tl(p.price) + ' TL</div></div><button onclick="closePick()" style="font-size:22px;border:0;background:none;cursor:pointer">&times;</button></div>' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Beden seçin</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      sizes.map(z => { const n = m[z], dis = n <= 0 || countIn(id, z) >= n; return '<button ' + (dis ? 'disabled' : 'onclick="pickSize(\'' + id + '\',\'' + E(z) + '\')"') + ' style="min-width:52px;padding:10px 14px;border-radius:10px;border:1px solid ' + (dis ? '#ddd' : '#212529') + ';background:#fff;color:' + (dis ? '#bbb' : '#212529') + ';font-weight:700;' + (dis ? 'text-decoration:line-through;cursor:not-allowed' : 'cursor:pointer') + '">' + E(z) + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(o);
  };
  function closePick() { const o = $('sizePickModal'); if (o) o.remove(); }
  window.closePick = closePick;
  window.pickSize = function (id, size) { const p = prodOf(id); if (p) { addSize(p, size); closePick(); } };

  /* Sepet: aynı ürün + beden tek satırda, adet +/- */
  const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const save = () => { localStorage.setItem('ballin_cart', JSON.stringify(cart)); renderCart(); updateCartBadge(); syncCartToFirebase(); };
  window.cartPlus = function (id, size) {
    const line = cart.find(i => i.dbId === id && i.size === size); if (!line) return;
    const p = prodOf(id); if (p && countIn(id, size) >= limitFor(p, size)) return showToast('Stok sınırına ulaştınız.', 'error');
    cart.push({ ...line, cartId: uid() }); save();
  };
  window.cartMinus = function (id, size) {
    const k = cart.map(i => i.dbId === id && i.size === size).lastIndexOf(true);
    if (k > -1) { cart.splice(k, 1); save(); }
  };
  window.cartRemoveGroup = function (id, size) { cart = cart.filter(i => !(i.dbId === id && i.size === size)); save(); };

  window.renderCart = function () {
    const box = $('cartItems'), totalEl = $('cartTotal'); if (!box || !totalEl) return;
    let total = 0;
    if (!cart.length) {
      box.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-cart-arrow-down text-4xl text-brand-200 mb-4"></i><p class="text-sm font-medium text-brand-500">Sepetiniz şu an boş.</p></div>';
      if ($('cartShippingProgressContainer')) $('cartShippingProgressContainer').classList.add('hidden');
    } else {
      const g = {}; cart.forEach(i => { const k = i.dbId + '|' + i.size; (g[k] = g[k] || { it: i, n: 0 }).n++; total += i.price || 0; });
      box.innerHTML = Object.values(g).map(({ it, n }) => {
        const a = "'" + E(it.dbId) + "','" + E(it.size) + "'", b = 'style="width:28px;height:28px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-weight:700"';
        return '<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="' + E(it.image) + '" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1">' +
          '<h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">' + E(it.baseName || it.name) + '</h4>' +
          '<p class="text-[11px] text-brand-400 mt-1">' + (it.size && it.size !== 'Standart' ? 'Beden: ' + E(it.size) + ' · ' : '') + tl(it.price) + ' TL</p>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button ' + b + ' onclick="cartMinus(' + a + ')">−</button><b style="min-width:18px;text-align:center">' + n + '</b><button ' + b + ' onclick="cartPlus(' + a + ')">+</button>' +
          '<span class="text-sm font-bold text-brand-900" style="margin-left:auto">' + tl((it.price || 0) * n) + ' TL</span></div></div>' +
          '<button onclick="cartRemoveGroup(' + a + ')" aria-label="Sil" class="text-brand-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>';
      }).join('');
      const pc = $('cartShippingProgressContainer'), bar = $('cartShippingBar'), tx = $('cartShippingText');
      if (pc) pc.classList.remove('hidden');
      if (total >= FREE_SHIPPING_THRESHOLD) { if (bar) bar.style.width = '100%'; if (tx) tx.innerHTML = '<i class="fa-solid fa-gift text-emerald-500 mr-1"></i> Tebrikler, kargo bedava!'; }
      else { if (bar) bar.style.width = (total / FREE_SHIPPING_THRESHOLD * 100) + '%'; if (tx) tx.innerHTML = 'Ücretsiz kargoya <strong>' + tl(FREE_SHIPPING_THRESHOLD - total) + ' TL</strong> kaldı!'; }
    }
    totalEl.innerText = tl(total * (1 - appliedDiscountRate)) + ' TL';
  };
  renderCart(); updateCartBadge();
  if (typeof renderMainGrid === 'function') { try { renderMainGrid(); filterAndSortProducts(); renderNewGrid(); renderWishlistGrid(); } catch (e) {} }
})();
