/* BALLIN yama-8.js — Ürün Durumu sekmesine SKU ve maliyet/kâr marjı; Müşteriler sekmesinde sipariş sayısı, toplam harcama ve sipariş geçmişi.
   yama-7'den SONRA yükle. (firestore.rules'a product_costs kuralı eklendi, yeniden yayınla.) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = s => window.esc(s), tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const full = () => !!(currentUser && !currentUser.isAnonymous && (currentUser.email === ADMIN_EMAIL || STAFF_ROLE === 'yonetici'));
  const dt = x => x && x.toDate ? x.toDate().toLocaleString('tr-TR') : '-';

  /* ---- SKU (herkese açık ürün belgesinde) + maliyet (ayrı, yalnızca Sahip/Yönetici görür) ---- */
  let costs = {};
  async function decorate() {
    const el = $('pstatusList'); if (!el) return;
    if (full()) { try { const s = await db.collection('product_costs').get(); costs = {}; s.forEach(d => { costs[d.id] = d.data().cost; }); } catch (e) {} }
    const hr = el.querySelector('thead tr'); if (hr && !hr.querySelector('.skuh')) hr.insertAdjacentHTML('beforeend', '<th class="skuh">SKU</th>' + (full() ? '<th>Maliyet</th><th>Marj</th>' : ''));
    el.querySelectorAll('tbody tr').forEach(tr => {
      const op = tr.querySelector('input[id^="op_"]'); if (!op || tr.dataset.dec) return; tr.dataset.dec = '1';
      const id = op.id.slice(3), p = allProducts.find(x => x.id === id) || {}, c = costs[id];
      const margin = (c != null && p.price) ? Math.round((p.price - c) / p.price * 100) + '%' : '-';
      tr.insertAdjacentHTML('beforeend', '<td><input id="sku_' + E(id) + '" value="' + E(p.sku || '') + '" style="width:90px"></td>' +
        (full() ? '<td><input type="number" id="cost_' + E(id) + '" value="' + (c != null ? c : '') + '" style="width:90px"></td><td>' + margin + '</td>' : ''));
    });
  }
  const _sp = window.savePStatus;
  window.savePStatus = async function (id) {
    const r = await _sp.apply(this, arguments);
    try {
      const sku = $('sku_' + id) ? $('sku_' + id).value.trim().slice(0, 40) : null;
      if (sku !== null) await db.collection('products').doc(id).update({ sku });
      const cv = $('cost_' + id) ? parseFloat($('cost_' + id).value) : NaN;
      if (full() && !isNaN(cv)) await db.collection('product_costs').doc(id).set({ cost: cv });
    } catch (e) { showToast(e.message, 'error'); }
    return r;
  };

  /* ---- Müşteriler: sipariş sayısı, toplam harcama, sipariş geçmişi ---- */
  let agg = {};
  window.loadCustomersCRM = async function () {
    if (!full()) return; const b = $('adminCustomersContainer'); if (!b) return;
    try {
      const [us, os] = await Promise.all([db.collection('users').get(), db.collection('orders').get()]); agg = {};
      os.forEach(d => { const o = d.data(); if (['İptal Edildi', 'İade Onaylandı'].includes(o.status)) return; const a = agg[o.userId] = agg[o.userId] || { n: 0, t: 0, list: [] }; a.n++; a.t += o.totalAmount || 0; a.list.push({ id: d.id, ...o }); });
      b.innerHTML = us.empty ? '<p class="text-xs">Müşteri yok.</p>' : '<table><thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Puan</th><th>Sipariş</th><th>Toplam harcama</th><th></th></tr></thead><tbody>' +
        us.docs.map(d => { const u = d.data(), a = agg[d.id] || { n: 0, t: 0 };
          return '<tr><td>' + E(u.name || '') + ' ' + E(u.surname || '') + '</td><td>' + E(u.email || '-') + '</td><td>' + E(u.phone || '-') + '</td><td>' + tl(u.points) + '</td><td>' + a.n + '</td><td>' + tl(a.t) + ' TL</td><td><button class="btn-ghost" onclick="custHistory(\'' + d.id + '\')">Geçmiş</button> <button class="btn-ghost" onclick="adjustPoints(\'' + d.id + '\')">Puan düzelt</button></td></tr>'; }).join('') + '</tbody></table>';
    } catch (e) { console.warn('müşteriler', e); }
  };
  window.custHistory = function (uid) {
    const a = agg[uid]; const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px'; o.onclick = e => { if (e.target === o) o.remove(); };
    const rows = a ? a.list.sort((x, y) => (y.orderDate && y.orderDate.toMillis ? y.orderDate.toMillis() : 0) - (x.orderDate && x.orderDate.toMillis ? x.orderDate.toMillis() : 0))
      .map(x => '<tr><td>#' + E(x.id.slice(0, 8)) + '</td><td>' + E(dt(x.orderDate)) + '</td><td>' + E(x.status) + '</td><td>' + tl(x.totalAmount) + ' TL</td></tr>').join('') : '';
    o.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;max-width:560px;width:100%;max-height:80vh;overflow:auto;padding:20px"><b>Sipariş geçmişi</b>' + (rows ? '<table style="width:100%;margin-top:10px"><thead><tr><th>No</th><th>Tarih</th><th>Durum</th><th>Tutar</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p style="margin-top:10px">Bu müşterinin (iptal/iade dışında) siparişi yok.</p>') + '<p style="text-align:right;margin-top:12px"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="border:1px solid #999;border-radius:8px;padding:6px 14px">Kapat</button></p></div>';
    document.body.appendChild(o);
  };
  function init() { const el = $('pstatusList'); if (el) new MutationObserver(decorate).observe(el, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
