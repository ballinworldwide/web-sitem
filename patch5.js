/* BALLIN patch5.js — ürün sıralama, sipariş sorgulama sayfası, müşteri tarafı doğru kargo takip linki.
   patch4.js'ten SONRA yükle: <script src="patch5.js"></script> */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* 1) Ürün sıralama: fiyat artan/azalan, isim */
  const SORTS = { 'price-asc': (a, b) => (a.price || 0) - (b.price || 0), 'price-desc': (a, b) => (b.price || 0) - (a.price || 0), name: (a, b) => String(a.name).localeCompare(String(b.name), 'tr') };
  const _f = window.filterAndSortProducts;
  window.filterAndSortProducts = function () {
    const s = $('sortSelect'), cmp = s && SORTS[s.value];
    if (!cmp) return _f.apply(this, arguments);
    const orig = allProducts; allProducts = [...orig].sort(cmp);
    try { return _f.apply(this, arguments); } finally { allProducts = orig; }
  };
  const pr = $('filterPriceRange');
  if (pr && !$('sortSelect')) {
    const s = document.createElement('select'); s.id = 'sortSelect'; s.className = pr.className;
    s.innerHTML = '<option value="default">Sırala: Yeni</option><option value="price-asc">Fiyat: Artan</option><option value="price-desc">Fiyat: Azalan</option><option value="name">İsim: A-Z</option>';
    s.onchange = () => filterAndSortProducts(); pr.insertAdjacentElement('afterend', s);
  }

  /* 2) Siparişlerim: doğru kargo firması + takip linki (Aras'a sabit link yerine) */
  const trk = {};
  const refreshTrk = () => (!currentUser || currentUser.isAnonymous) ? Promise.resolve() :
    db.collection('orders').where('userId', '==', currentUser.uid).get()
      .then(s => s.forEach(d => { const o = d.data(); if (o.trackingNumber) trk[o.trackingNumber] = { url: o.trackingUrl || '', carrier: o.carrier || '' }; })).catch(() => {});
  function fixLinks() {
    const c = $('ordersList'); if (!c) return;
    c.querySelectorAll('a[href*="araskargo"]').forEach(a => {
      const no = Object.keys(trk).find(n => a.textContent.includes(n));
      if (!no || !trk[no].url) return;
      a.href = trk[no].url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const lab = a.parentNode.querySelector('span');
      if (lab && trk[no].carrier) lab.textContent = trk[no].carrier + ' · Takip No';
    });
  }
  const _lo = window.loadUserOrders;
  window.loadUserOrders = function () { _lo.apply(this, arguments); refreshTrk().then(fixLinks); };
  const oc = $('ordersList'); if (oc) new MutationObserver(fixLinks).observe(oc, { childList: true, subtree: true });

  /* 3) Sipariş sorgula sayfası (misafirler için): sipariş no + e-posta */
  window.lookupOrder = async function () {
    const id = ($('lkId').value || '').trim(), mail = ($('lkMail').value || '').trim().toLowerCase(), out = $('lkResult');
    const notFound = '<p class="text-red-600">Sipariş bulunamadı veya e-posta eşleşmiyor.</p>';
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !/^\S+@\S+\.\S+$/.test(mail)) { out.innerHTML = notFound; return; }
    out.innerHTML = '<p>Sorgulanıyor...</p>';
    try {
      const s = await db.collection('orders').doc(id).get();
      if (!s.exists || String(s.data().userEmail || '').toLowerCase() !== mail) { out.innerHTML = notFound; return; }
      const o = s.data(), d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleString('tr-TR') : '-';
      const trackLine = o.trackingNumber ? '<p><b>Kargo:</b> ' + E(o.carrier || '') + ' · Takip No: ' + (o.trackingUrl ? '<a class="underline font-bold" target="_blank" rel="noopener noreferrer" href="' + E(o.trackingUrl) + '">' + E(o.trackingNumber) + '</a>' : E(o.trackingNumber)) + '</p>' : '';
      out.innerHTML = '<div class="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-2"><p><b>Sipariş:</b> #' + E(id.slice(0, 8)) + ' · ' + E(d) + '</p><p><b>Durum:</b> ' + E(o.status) + '</p>' + trackLine +
        '<p><b>Ürünler:</b> ' + (o.items || []).map(i => E(i.baseName || i.name) + (i.size && i.size !== 'Standart' ? ' (' + E(i.size) + ')' : '')).join(', ') + '</p><p><b>Toplam:</b> ' + tl(o.totalAmount) + ' TL</p></div>';
    } catch (e) { out.innerHTML = notFound; }
  };
  function init() {
    const ref = $('page-destek-merkezi'); if (!ref || $('page-siparis-sorgula')) return;
    const el = document.createElement('section'); el.id = 'page-siparis-sorgula'; el.className = 'page-section hidden max-w-4xl mx-auto px-4 py-16';
    const inp = 'class="w-full border border-brand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-900"';
    el.innerHTML = '<h1 class="font-serif text-3xl text-brand-900 mb-6 border-b pb-3">Sipariş Sorgula</h1><div class="text-sm text-brand-600 leading-relaxed space-y-4">' +
      '<p>Sipariş onay e-postanızdaki sipariş numarası ve sipariş verirken kullandığınız e-posta ile siparişinizin durumunu görebilirsiniz.</p>' +
      '<input id="lkId" ' + inp + ' placeholder="Sipariş numarası"><input id="lkMail" type="email" ' + inp + ' placeholder="E-posta">' +
      '<button onclick="lookupOrder()" class="bg-brand-900 text-white px-6 py-3 rounded-xl text-sm font-bold">Sorgula</button><div id="lkResult"></div></div>';
    ref.parentNode.insertBefore(el, ref);
    const fl = document.querySelector('footer a[onclick*="kargo-teslimat"]');
    if (fl && fl.closest('ul')) fl.closest('ul').insertAdjacentHTML('beforeend', '<li><a onclick="switchPage(\'siparis-sorgula\'); return false;" class="hover:text-white cursor-pointer transition-colors">Sipariş Sorgula</a></li>');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
