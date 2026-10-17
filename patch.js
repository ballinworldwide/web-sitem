/* BALLIN patch.js (Aşama 1) — index.html'de script.js'ten HEMEN SONRA yükle:
   <script src="script.js"></script>
   <script src="patch.js"></script>                                              */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.esc = esc;
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const FV = firebase.firestore.FieldValue;
  const isAdm = () => !!(currentUser && !currentUser.isAnonymous && currentUser.email === ADMIN_EMAIL);
  const sizeKey = i => (i.size && i.size !== 'Standart') ? String(i.size).toUpperCase() : null;
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b) m[a.trim().toUpperCase()] = parseInt(b) || 0; }); return m; };
  const joinSS = m => Object.entries(m).map(([a, b]) => a + ':' + b).join(', ');
  const groupCart = items => { const n = {}; items.forEach(i => { const g = n[i.dbId] = n[i.dbId] || { t: 0, s: {} }; g.t++; const z = sizeKey(i); if (z) g.s[z] = (g.s[z] || 0) + 1; }); return n; };

  // Kargo takip adresleri: kullandığın firmaların güncel takip linkini kontrol et, gerekirse düzelt
  const CARRIERS = {
    'Aras Kargo': 'https://kargotakip.araskargo.com.tr/mainpage.aspx?code=',
    'Yurtiçi Kargo': 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=',
    'MNG Kargo': 'https://www.mngkargo.com.tr/gonderi-takip/?takipNo=',
    'PTT Kargo': 'https://gonderitakip.ptt.gov.tr/Track/Verify?q=',
    'Sürat Kargo': 'https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=',
    'HepsiJet': 'https://www.hepsijet.com/gonderi-takibi/'
  };

  /* ---------- Oturum ---------- */
  firebase.auth().onAuthStateChanged(u => {
    if (u && u.isAnonymous) currentUser = u;                       // misafir oturumu artık "çıkış yapmış" sayılmaz
    else if (u && u.email) db.collection('users').doc(u.uid).set({ email: u.email }, { merge: true }).catch(() => {});
  });
  async function ensureAuth() { if (!currentUser) currentUser = (await firebase.auth().signInAnonymously()).user; return currentUser; }

  // Admin dışı ziyaretçiler için gereksiz/yetkisiz sorguları kapat
  ['loadOrdersAndCalculateStats', 'loadCustomersCRM', 'loadAbandonedCarts', 'loadCouponsAdmin'].forEach(n => {
    const o = window[n]; window[n] = function () { if (isAdm()) return o.apply(this, arguments); };
  });

  window.syncCartToFirebase = function () {
    if (!currentUser || currentUser.isAnonymous) return;
    db.collection('users').doc(currentUser.uid).set({
      cartData: cart.map(i => ({ ...i, image: String(i.image || '').startsWith('data:') ? '' : (i.image || '') })),
      lastUpdated: FV.serverTimestamp()
    }, { merge: true }).catch(() => {});
  };

  /* ---------- Ödeme / sipariş (tek transaction: stok + sipariş + puan + kupon) ---------- */
  window.processPayment = async function () {
    const v = id => ($(id) && $(id).value || '').trim();
    const name = v('checkoutName'), surname = v('checkoutSurname'), phone = v('checkoutPhone'),
      city = v('checkoutCity'), district = v('checkoutDistrict'), address = v('checkoutAddress');
    const email = (currentUser && currentUser.email) || v('checkoutEmail');
    if (!name || !surname || !phone || !city || !district || !address || !/^\S+@\S+\.\S+$/.test(email))
      return showToast('Ad, soyad, telefon, geçerli e-posta, il, ilçe ve adres zorunludur.', 'error');
    if (!$('checkTerms').checked || !$('checkKvkk').checked) return showToast('Lütfen sözleşme ve KVKK metinlerini onaylayın.', 'error');
    if (!cart.length) return showToast('Sepetiniz boş!', 'error');
    const btn = $('btnCompletePayment'); btn.disabled = true; btn.innerText = 'İşlem yapılıyor...';
    try {
      await ensureAuth();
      const uid = currentUser.uid, named = !currentUser.isAnonymous;
      let rate = 0, code = '', pts = 0;
      if (appliedCouponCode) {
        if (!named) throw new Error('Kupon için hesabınızla giriş yapın.');
        const cr = db.collection('coupons').doc(appliedCouponCode);
        const [cs, us] = await Promise.all([cr.get(), cr.collection('uses').doc(uid).get()]);
        const c = cs.exists && cs.data();
        if (!c || us.exists || (c.usedCount || 0) >= c.limit || (c.expiryDate && new Date(c.expiryDate + 'T23:59:59') < new Date()))
          throw new Error('Kupon artık geçerli değil. Kuponu kaldırıp tekrar deneyin.');
        rate = c.discount / 100; code = cs.id;
      }
      if (named && appliedPointsValue > 0) {
        const ud = await db.collection('users').doc(uid).get();
        pts = Math.min(Math.floor(appliedPointsValue), (ud.data() || {}).points || 0);
      }
      const need = groupCart(cart), ids = Object.keys(need), oref = db.collection('orders').doc();
      let order;
      await db.runTransaction(async tx => {
        const snaps = await Promise.all(ids.map(id => tx.get(db.collection('products').doc(id))));
        const price = {}, writes = [];
        snaps.forEach((s, k) => {
          const n = need[ids[k]];
          if (!s.exists) throw new Error('Sepetteki bir ürün artık satışta değil.');
          const p = s.data(); price[ids[k]] = Number(p.price) || 0;
          if ((p.stock || 0) < n.t) throw new Error('"' + p.name + '" için yeterli stok yok.');
          let ss = p.sizeStock || '';
          if (ss && Object.keys(n.s).length) {
            const m = parseSS(ss);
            Object.keys(n.s).forEach(z => { if (m[z] === undefined || m[z] < n.s[z]) throw new Error('"' + p.name + '" ' + z + ' bedeni yeterli değil.'); m[z] -= n.s[z]; });
            ss = joinSS(m);
          }
          writes.push([s.ref, { stock: p.stock - n.t, sizeStock: ss }]);
        });
        const items = cart.map(i => ({ cartId: i.cartId, dbId: i.dbId, baseName: i.baseName, name: i.name, size: i.size, price: price[i.dbId], image: String(i.image || '').startsWith('data:') ? '' : (i.image || '') }));
        const disc = items.reduce((s, i) => s + i.price, 0) * (1 - rate);
        const use = Math.min(pts, Math.max(0, Math.floor(disc - 1)));
        let fin = Math.max(0, disc - use); fin += (fin >= FREE_SHIPPING_THRESHOLD || fin === 0) ? 0 : SHIPPING_FEE;
        order = { userId: uid, userEmail: email, shippingInfo: { name, surname, phone, city, district, address }, items, productIds: ids,
          totalAmount: Math.round(fin * 100) / 100, usedPoints: use, status: 'Hazırlanıyor', trackingNumber: '', carrier: '', couponCode: code, orderDate: FV.serverTimestamp() };
        writes.forEach(([r, d]) => tx.update(r, d));
        tx.set(oref, order);
        if (use > 0) tx.update(db.collection('users').doc(uid), { points: FV.increment(-use) });
        if (code) {
          const cr = db.collection('coupons').doc(code);
          tx.update(cr, { usedCount: FV.increment(1) });
          tx.set(cr.collection('uses').doc(uid), { at: FV.serverTimestamp() });
        }
      });
      sendOrderConfirmationEmail({ ...order, orderId: oref.id });
      showToast('Siparişiniz alındı!', 'success');
      if (!named) alert('Sipariş numaranız:\n' + oref.id + '\n\nLütfen saklayın.');
      cart = []; appliedDiscountRate = 0; appliedCouponCode = ''; appliedPointsValue = 0;
      localStorage.removeItem('ballin_cart'); updateCartBadge(); syncCartToFirebase();
      if (named) { switchPage('profile'); loadUserOrders(); } else switchPage('home');
      loadProducts();
    } catch (e) { showToast(e.message || String(e), 'error'); }
    btn.disabled = false; btn.innerText = 'Ödemeyi Tamamla';
  };

  // Müşteri iptali: sadece durum değişir; stok ve puan iadesini admin paneli yapar
  window.cancelMyOrder = function (id) {
    if (!confirm('Siparişi iptal etmek istediğinize emin misiniz?')) return;
    db.collection('orders').doc(id).update({ status: 'İptal Edildi' })
      .then(() => { showToast('Sipariş iptal edildi. Stok ve puan iadesi kısa süre içinde yansıtılır.', 'success'); loadUserOrders(); })
      .catch(() => showToast('Bu sipariş artık iptal edilemez.', 'error'));
  };

  /* ---------- Kuponlar (belge ID = kod) ---------- */
  window.addNewCoupon = function () {
    const g = id => $(id) ? $(id).value.trim() : '';
    const ids = ['newCouponCode', 'newCouponDiscount', 'newCouponLimit', 'newCouponExpiry'];
    const code = g(ids[0]).toUpperCase(), discount = parseInt(g(ids[1])), limit = parseInt(g(ids[2])) || 100, expiryDate = g(ids[3]);
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !(discount >= 1 && discount <= 100)) return showToast('Kod (3-30 harf/rakam) ve %1-100 indirim girin.', 'error');
    db.collection('coupons').doc(code).set({ code, discount, limit, expiryDate, usedCount: 0, createdAt: FV.serverTimestamp() })
      .then(() => { showToast('Kupon oluşturuldu.', 'success'); ids.forEach(i => { if ($(i)) $(i).value = ''; }); loadCouponsAdmin(); })
      .catch(e => showToast('Hata: ' + e.message, 'error'));
  };
  window.applyPromoCode = async function () {
    const code = ($('promoCodeInput').value || '').trim().toUpperCase();
    if (!code) return showToast('Kupon kodu giriniz.', 'error');
    if (!currentUser || currentUser.isAnonymous) { showToast('Kupon için hesabınızla giriş yapın.', 'error'); return openModal(); }
    try {
      const cr = db.collection('coupons').doc(code);
      const [cs, us] = await Promise.all([cr.get(), cr.collection('uses').doc(currentUser.uid).get()]);
      if (!cs.exists) return showToast('Geçersiz kupon kodu!', 'error');
      const c = cs.data();
      if (us.exists) return showToast('Bu kuponu daha önce kullandınız.', 'error');
      if ((c.usedCount || 0) >= c.limit) return showToast('Kuponun kullanım limiti dolmuş!', 'error');
      if (c.expiryDate && new Date(c.expiryDate + 'T23:59:59') < new Date()) return showToast('Kuponun süresi dolmuş!', 'error');
      appliedDiscountRate = c.discount / 100; appliedCouponCode = cs.id;
      const i = $('promoDiscountInfo'); i.style.display = 'block'; i.innerText = 'Kupon uygulandı: %' + Number(c.discount) + ' indirim!';
      showToast('İndirim uygulandı.', 'success'); goToCheckout();
    } catch (e) { showToast('Kupon uygulanamadı.', 'error'); }
  };

  /* ---------- Yorumlar ---------- */
  window.submitProductReview = async function () {
    if (!currentUser || currentUser.isAnonymous) { showToast('Yorum yapmak için hesabınızla giriş yapın.', 'error'); return openModal(); }
    const rating = Math.min(5, Math.max(1, parseInt($('newReviewRating') ? $('newReviewRating').value : 5) || 5));
    const text = ($('newReviewText') ? $('newReviewText').value.trim() : '').slice(0, 500);
    try {
      const os = await db.collection('orders').where('userId', '==', currentUser.uid).get();
      const o = os.docs.find(d => { const x = d.data(); return x.status !== 'İptal Edildi' && (x.productIds || []).includes(activeProductId); });
      if (!o) return showToast('Yalnızca satın aldığınız ürünlere yorum yapabilirsiniz.', 'error');
      const u = await db.collection('users').doc(currentUser.uid).get(), d = u.exists ? u.data() : {};
      const author = ((d.name || 'Müşteri') + ' ' + (d.surname ? d.surname[0] + '.' : '')).trim().slice(0, 60);
      await db.collection('products').doc(activeProductId).collection('reviews').doc(currentUser.uid)
        .set({ userId: currentUser.uid, author, rating, text, verifiedPurchase: true, orderId: o.id, date: FV.serverTimestamp() });
      showToast('Değerlendirmeniz eklendi!', 'success'); if ($('newReviewText')) $('newReviewText').value = ''; loadProductReviews(activeProductId);
    } catch (e) { showToast('Yorum gönderilemedi (ürün başına tek yorum yapılabilir).', 'error'); }
  };
  window.loadProductReviews = function (pid) {
    db.collection('products').doc(pid).collection('reviews').orderBy('date', 'desc').get().then(snap => {
      const c = $('reviewsListContainer'), a = $('averageRatingContainer'); if (!c) return;
      if (snap.empty) { c.innerHTML = '<p class="text-xs text-brand-400">Henüz değerlendirme yapılmamış.</p>'; if (a) a.innerText = ''; return; }
      let t = 0, h = '';
      snap.forEach(d => { const r = d.data(), n = Math.min(5, Math.max(1, parseInt(r.rating) || 5)); t += n;
        h += '<div class="bg-brand-50 p-4 rounded-xl border border-brand-200"><div class="font-bold text-xs text-brand-900 mb-1">' + esc(r.author || 'Müşteri') +
          ' <span class="text-amber-500 ml-2">' + '⭐'.repeat(n) + '</span></div>' + (r.text ? '<div class="text-xs text-brand-600 mt-1">' + esc(r.text) + '</div>' : '') + '</div>'; });
      c.innerHTML = h; if (a) a.innerText = (t / snap.size).toFixed(1) + ' / 5.0';
    }).catch(() => {});
  };

  /* ---------- Admin: iade/iptal/puan mutabakatı ---------- */
  async function reconcile(orders) {
    for (const o of orders) {
      try {
        const orf = db.collection('orders').doc(o.id), uref = db.collection('users').doc(o.userId);
        if (['İptal Edildi', 'İade Onaylandı'].includes(o.status) && !o.refundDone) {
          const need = groupCart(o.items || []);
          for (const id of Object.keys(need)) {
            await db.runTransaction(async tx => {
              const r = db.collection('products').doc(id), s = await tx.get(r); if (!s.exists) return;
              const p = s.data(); let ss = p.sizeStock || '';
              if (ss) { const m = parseSS(ss); Object.keys(need[id].s).forEach(z => { if (m[z] !== undefined) m[z] += need[id].s[z]; }); ss = joinSS(m); }
              tx.update(r, { stock: (p.stock || 0) + need[id].t, sizeStock: ss });
            });
          }
          const us = await uref.get();
          const delta = (o.usedPoints || 0) - (o.pointsCredited ? (o.creditedPoints || 0) : 0);
          if (us.exists && delta) await uref.update({ points: FV.increment(delta) });
          await orf.update({ refundDone: true });
        } else if (o.status === 'Tamamlandı' && !o.pointsCredited) {
          const pts = Math.floor((o.totalAmount || 0) * 0.05), us = await uref.get();
          if (us.exists && pts > 0) await uref.update({ points: FV.increment(pts) });
          await orf.update({ pointsCredited: true, creditedPoints: us.exists ? pts : 0 });
        }
      } catch (e) { console.warn('mutabakat', o.id, e.message); }
    }
  }

  /* ---------- Admin: siparişler ---------- */
  window.loadAdminOrders = async function () {
    if (!isAdm()) return;
    const box = $('adminOrdersContainer'); if (!box) return;
    try {
      const snap = await db.collection('orders').orderBy('orderDate', 'desc').get();
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id })); allOrders = all;
      const list = all.filter(o => currentOrderFilter === 'all' || o.status === currentOrderFilter);
      const pids = [...new Set(all.filter(o => o.status === 'Hazırlanıyor').flatMap(o => (o.items || []).map(i => i.dbId)))];
      const cur = {};
      await Promise.all(pids.map(id => db.collection('products').doc(id).get().then(s => { if (s.exists) cur[id] = s.data().price; }).catch(() => {})));
      const opt = (arr, sel) => arr.map(x => '<option ' + (x === sel ? 'selected' : '') + '>' + esc(x) + '</option>').join('');
      box.innerHTML = list.length ? list.map(o => {
        const si = o.shippingInfo || {}, id = esc(o.id);
        const bad = o.status === 'Hazırlanıyor' && (o.items || []).some(i => cur[i.dbId] !== undefined && cur[i.dbId] !== i.price);
        const d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleString('tr-TR') : '-';
        const states = ['Hazırlanıyor', 'Kargoya Verildi', 'Tamamlandı', 'İade Onaylandı', 'İade Onaylanmadı', 'İptal Edildi'].concat(o.status === 'İade Talebi Alındı' ? ['İade Talebi Alındı'] : []);
        return '<div class="bg-white p-5 rounded-2xl border border-brand-200 flex flex-col md:flex-row gap-6 flex-wrap">' +
          '<div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-3"><input type="checkbox" class="order-checkbox" value="' + id + '"><b>#' + esc(o.id.slice(0, 8)) + '</b>' +
          (o.status === 'İade Talebi Alındı' ? ' <span class="bg-red-100 text-red-600 px-2 rounded text-[10px]">İADE TALEBİ</span>' : '') +
          (bad ? ' <span class="bg-amber-100 text-amber-700 px-2 rounded text-[10px]">⚠ Güncel fiyattan farklı, kontrol et</span>' : '') + '</div>' +
          '<p class="text-[10px] mb-3">' + esc(d) + '</p>' +
          '<div class="p-3 rounded-xl border border-brand-100 mb-3 text-xs">' + esc(si.name) + ' ' + esc(si.surname) + ' (' + esc(o.userEmail) + ')<br>' + esc(si.phone) + '<br>' + esc(si.address) + ' - <b>' + esc(si.district) + '/' + esc(si.city) + '</b></div>' +
          '<div class="p-3 rounded-xl border border-brand-100 mb-3 text-xs"><b>Ürünler:</b><br>' + (o.items || []).map(i => '1x ' + esc(i.baseName || i.name) + ' (' + esc(i.size || 'Standart') + ') - ' + tl(i.price) + ' TL').join('<br>') + '</div>' +
          '<p class="text-sm font-bold">Toplam: ' + tl(o.totalAmount) + ' TL' + (o.usedPoints ? ' (puan: -' + tl(o.usedPoints) + ')' : '') + (o.couponCode ? ' · kupon: ' + esc(o.couponCode) : '') + '</p>' +
          (o.returnNote ? '<p class="mt-2 text-xs text-red-700">Not: ' + esc(o.returnNote) + '</p>' : '') + '</div>' +
          '<div class="w-full md:w-64 flex flex-col justify-center shrink-0 gap-2">' +
          '<button onclick="printInvoice(\'' + id + '\')" class="btn-ghost">Sipariş / Kargo Fişi</button>' +
          (o.status === 'İade Talebi Alındı' ? '<button onclick="rejectReturn(\'' + id + '\')" class="btn-ghost" style="color:#ff7a7a">İadeyi Reddet (Not)</button>' : '') +
          '<select id="adminStatus_' + id + '">' + opt(states, o.status) + '</select>' +
          '<select id="adminCarrier_' + id + '"><option value="">Kargo firması seç</option>' + opt(Object.keys(CARRIERS), o.carrier) + '</select>' +
          '<input type="text" id="adminTrack_' + id + '" value="' + esc(o.trackingNumber || '') + '" placeholder="Takip no">' +
          '<button onclick="updateAdminOrder(\'' + id + '\')" class="btn-primary">Kaydet ve Bildir</button></div></div>';
      }).join('') : '<p class="text-xs">Bu filtreye uygun sipariş yok.</p>';
      reconcile(all);
    } catch (e) { showToast('Siparişler yüklenemedi: ' + e.message, 'error'); }
  };
  window.updateAdminOrder = async function (id) {
    if (!isAdm()) return;
    const status = $('adminStatus_' + id).value, carrier = $('adminCarrier_' + id).value, track = $('adminTrack_' + id).value.trim();
    if (status === 'Kargoya Verildi' && (!carrier || !track)) return showToast('Kargoya vermek için firma ve takip numarası girin.', 'error');
    try {
      const o = allOrders.find(x => x.id === id) || {};
      await db.collection('orders').doc(id).update({ status, carrier, trackingNumber: track, trackingUrl: carrier && track ? (CARRIERS[carrier] || '') + encodeURIComponent(track) : '' });
      if (status === 'Kargoya Verildi' && (o.status !== status || o.trackingNumber !== track)) sendShippingUpdateEmail(id, o.userEmail, (o.shippingInfo || {}).name || 'Müşteri', track, o.items);
      showToast('Sipariş güncellendi!', 'success'); loadAdminOrders(); loadOrdersAndCalculateStats();
    } catch (e) { showToast('Güncelleme hatası: ' + e.message, 'error'); }
  };
  const _bulk = window.bulkUpdateOrderStatus;
  window.bulkUpdateOrderStatus = function (s) { return s === 'Kargoya Verildi' ? showToast('Kargolamak için her siparişte firma ve takip no girin.', 'error') : _bulk.apply(this, arguments); };

  window.printInvoice = function (id) {
    const o = allOrders.find(x => x.id === id); if (!o) return;
    const si = o.shippingInfo || {}, w = window.open('', '_blank'); if (!w) return showToast('Açılır pencere engellendi.', 'error');
    const d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleDateString('tr-TR') : '-';
    w.document.write('<!doctype html><meta charset="utf-8"><title>Sipariş Fişi</title><style>body{font:14px sans-serif;padding:30px;max-width:720px;margin:auto}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.box{border:2px dashed #000;padding:14px;margin-top:20px}</style>' +
      '<h2>BALLIN - Sipariş ve Kargo Fişi</h2><p>Sipariş No: <b>' + esc(o.id) + '</b><br>Tarih: ' + esc(d) + '</p>' +
      '<p><b>Alıcı:</b> ' + esc(si.name) + ' ' + esc(si.surname) + '<br>' + esc(si.phone) + '<br>' + esc(si.address) + '<br>' + esc(si.district) + ' / ' + esc(si.city) + '</p>' +
      '<table><tr><th>Ürün</th><th>Beden</th><th>Fiyat</th></tr>' + (o.items || []).map(i => '<tr><td>' + esc(i.baseName || i.name) + '</td><td>' + esc(i.size || 'Standart') + '</td><td>' + tl(i.price) + ' TL</td></tr>').join('') + '</table>' +
      '<p><b>Toplam: ' + tl(o.totalAmount) + ' TL</b></p><div class="box">Kargo: ' + esc(o.carrier || '-') + '<br>Takip No: ' + esc(o.trackingNumber || '-') + '</div>' +
      '<p style="font-size:11px;color:#666">Bu belge resmi fatura yerine geçmez.</p><script>onload=function(){print()}<\/script>');
    w.document.close();
  };

  /* ---------- Admin: müşteriler, terk edilen sepetler, dashboard ---------- */
  window.loadCustomersCRM = function () {
    if (!isAdm()) return;
    db.collection('users').get().then(s => { const b = $('adminCustomersContainer'); if (!b) return;
      b.innerHTML = s.empty ? '<p class="text-xs">Müşteri yok.</p>' : '<table><thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Puan</th><th>Şehir</th></tr></thead><tbody>' +
        s.docs.map(d => { const u = d.data(); return '<tr><td>' + esc(u.name) + ' ' + esc(u.surname) + '</td><td>' + esc(u.email || '-') + '</td><td>' + esc(u.phone || '-') + '</td><td>' + tl(u.points) + '</td><td>' + esc(u.city ? u.city + '/' + (u.district || '') : '-') + '</td></tr>'; }).join('') + '</tbody></table>'; }).catch(() => {});
  };
  window.loadAbandonedCarts = function () {
    if (!isAdm()) return;
    db.collection('users').get().then(s => { const b = $('adminAbandonedContainer'); if (!b) return;
      const h = s.docs.filter(d => (d.data().cartData || []).length).map(d => { const u = d.data(), c = u.cartData;
        return '<div class="row"><span>' + esc(u.name) + ' ' + esc(u.surname) + ' · ' + esc(u.email || '') + '</span><span>' + c.length + ' ürün · ' + tl(c.reduce((t, i) => t + (i.price || 0), 0)) + ' TL</span></div>'; }).join('');
      b.innerHTML = h || '<p class="text-xs">Terk edilmiş sepet yok.</p>'; }).catch(() => {});
  };
  window.updateDashboardStats = function () {
    const live = allOrders.filter(o => !['İptal Edildi', 'İade Onaylandı'].includes(o.status));
    const pend = allOrders.filter(o => o.status === 'Hazırlanıyor').length;
    const set = (id, v) => { if ($(id)) $(id).innerText = v; };
    set('kpiRevenue', '₺' + tl(live.reduce((s, o) => s + (o.totalAmount || 0), 0)));
    set('kpiOrders', allOrders.length); set('kpiPending', pend); set('navBadgeOrders', pend);
    set('kpiLowStock', allProducts.filter(p => p.stock <= 3).length);
    const cnt = {}; live.forEach(o => (o.items || []).forEach(i => { const n = i.baseName || i.name || '?'; cnt[n] = cnt[n] || { q: 0, r: 0 }; cnt[n].q++; cnt[n].r += i.price || 0; }));
    const top = Object.keys(cnt).sort((a, b) => cnt[b].q - cnt[a].q).slice(0, 5);
    if ($('topProductsContainer')) $('topProductsContainer').innerHTML = top.length ? '<div class="space-y-2">' + top.map((n, k) => '<div class="flex justify-between text-xs border-b border-brand-100 pb-2"><span><strong>#' + (k + 1) + '</strong> ' + esc(n) + '</span><span>Satış: <strong>' + cnt[n].q + '</strong> | Ciro: <strong>' + tl(cnt[n].r) + ' TL</strong></span></div>').join('') + '</div>' : '<p class="text-xs">Satış verisi yok.</p>';
    if ($('ordersTable')) $('ordersTable').innerHTML = allOrders.slice(0, 5).map(o => {
      const sc = o.status === 'Hazırlanıyor' ? 's-hazir' : o.status === 'Kargoya Verildi' ? 's-kargo' : o.status === 'Tamamlandı' ? 's-bitti' : String(o.status).includes('İade') ? 's-iade' : 's-yeni';
      return '<tr><td>#' + esc(o.id.slice(0, 6).toUpperCase()) + '</td><td>' + esc((o.shippingInfo || {}).name || 'Misafir') + '</td><td>₺' + tl(o.totalAmount) + '</td><td><span class="status ' + sc + '">' + esc(o.status) + '</span></td><td></td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--mute)">Sipariş bulunamadı.</td></tr>';
    if ($('lowStockListHTML')) $('lowStockListHTML').innerHTML = allProducts.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 3)
      .map(p => '<div class="row"><span>' + esc(p.name) + '</span><b style="color:var(--accent)">' + p.stock + ' adet</b></div>').join('') || '<p style="color:var(--mute)">Stok sorunu yok.</p>';
  };
})();
