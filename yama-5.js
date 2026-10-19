/* BALLIN yama-5.js — admin siparişleri: arama, tarih filtresi, sayfalama, iç not; dashboard dönem filtresi ve günlük ciro grafiği.
   yama-4'ten SONRA yükle. (firestore.rules'a order_notes kuralı eklendi, yeniden yayınla.) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = s => window.esc(s), tl = n => (Number(n) || 0).toLocaleString('tr-TR'), FV = firebase.firestore.FieldValue;
  const isAdm = () => isStaffNow(currentUser), DAY = 864e5;
  const ms = o => o.orderDate && o.orderDate.toMillis ? o.orderDate.toMillis() : 0;
  const sod = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const since = r => r === 'all' ? 0 : r === '1' ? sod() : Date.now() - Number(r) * DAY;

  /* ---------- Siparişler: arama + tarih + sayfalama + iç not ---------- */
  let q = '', range = 'all', shown = 20, notes = {};
  function toolbar() {
    const box = $('adminOrdersContainer'); if (!box || $('ordToolbar')) return;
    box.insertAdjacentHTML('beforebegin', '<div id="ordToolbar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><input id="ordSearch" placeholder="Ara: ad, e-posta, telefon, sipariş no, not" style="flex:1;min-width:220px"><select id="ordRange"><option value="all">Tüm zamanlar</option><option value="1">Bugün</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option></select></div>');
    box.insertAdjacentHTML('afterend', '<div id="ordMore" style="text-align:center;margin:14px 0"></div>');
    $('ordSearch').oninput = e => { q = e.target.value.trim().toLowerCase(); shown = 20; view(); };
    $('ordRange').onchange = e => { range = e.target.value; shown = 20; view(); };
  }
  function view() {
    const box = $('adminOrdersContainer'); if (!box) return; let ok = 0, hidden = 0; const t0 = since(range);
    [...box.children].forEach(card => {
      const cb = card.querySelector('.order-checkbox'); if (!cb) return;
      const id = cb.value, o = allOrders.find(x => x.id === id) || {};
      const hit = (!q || (card.textContent + ' ' + id + ' ' + (notes[id] || '')).toLowerCase().includes(q)) && (!t0 || ms(o) >= t0);
      if (hit && ok < shown) { card.style.display = ''; ok++; } else { card.style.display = 'none'; if (hit) hidden++; }
    });
    const m = $('ordMore'); if (!m) return;
    m.innerHTML = hidden ? '<button class="btn-ghost" id="ordMoreBtn">Daha fazla göster (' + hidden + ')</button>' : (ok ? '' : '<p class="text-xs">Eşleşen sipariş yok.</p>');
    if ($('ordMoreBtn')) $('ordMoreBtn').onclick = () => { shown += 20; view(); };
  }
  async function decorate() {
    const box = $('adminOrdersContainer'); if (!box) return;
    try { const s = await db.collection('order_notes').get(); notes = {}; s.forEach(d => { notes[d.id] = d.data().note || ''; }); } catch (e) {}
    [...box.children].forEach(card => {
      const cb = card.querySelector('.order-checkbox'); if (!cb || card.querySelector('.ordNote')) return; const id = cb.value;
      card.insertAdjacentHTML('beforeend', '<div class="ordNote w-full" style="display:flex;gap:8px;align-items:flex-start;border-top:1px dashed #ccc;padding-top:10px"><textarea id="note_' + E(id) + '" rows="2" placeholder="İç not (müşteri görmez)" style="flex:1"></textarea><button class="btn-ghost" onclick="saveOrderNote(\'' + E(id) + '\')">Notu kaydet</button></div>');
      $('note_' + id).value = notes[id] || '';
    });
  }
  window.saveOrderNote = async function (id) {
    try { const v = $('note_' + id).value.slice(0, 1000); await db.collection('order_notes').doc(id).set({ note: v, by: currentUser.email, at: FV.serverTimestamp() }); notes[id] = v; showToast('Not kaydedildi.', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  };
  const _lao = window.loadAdminOrders;
  window.loadAdminOrders = async function () { const r = await _lao.apply(this, arguments); if (!isAdm()) return r; toolbar(); await decorate(); view(); return r; };

  /* ---------- Dashboard: dönem filtresi + günlük ciro grafiği ---------- */
  let per = 'all';
  function chart(list) {
    const tab = $('tab-dashboard'); if (!tab) return;
    if (!$('revChart')) { const h = '<div class="card" id="revChart" style="margin-top:14px"><p class="card-title">Günlük Ciro (son 14 gün)</p><div id="revChartBody"></div></div>', k = tab.querySelector('.kpis'); k ? k.insertAdjacentHTML('afterend', h) : tab.insertAdjacentHTML('beforeend', h); }
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d; });
    const live = list.filter(o => !['İptal Edildi', 'İade Onaylandı'].includes(o.status));
    const sums = days.map(d => live.filter(o => ms(o) >= d.getTime() && ms(o) < d.getTime() + DAY).reduce((s, o) => s + (o.totalAmount || 0), 0));
    const max = Math.max(...sums, 1), W = 560, H = 150, bw = W / 14;
    $('revChartBody').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" style="width:100%;height:auto">' + sums.map((v, i) => { const h = Math.round(v / max * H);
      return '<rect x="' + (i * bw + 6) + '" y="' + (H - h) + '" width="' + (bw - 12) + '" height="' + h + '" rx="4" fill="currentColor" opacity=".75"><title>' + days[i].toLocaleDateString('tr-TR') + ': ' + tl(v) + ' TL</title></rect><text x="' + (i * bw + bw / 2) + '" y="' + (H + 15) + '" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">' + days[i].getDate() + '</text>'; }).join('') + '</svg>';
  }
  const _uds = window.updateDashboardStats;
  window.updateDashboardStats = function () {
    const orig = allOrders, t0 = since(per); allOrders = orig.filter(o => !t0 || ms(o) >= t0);
    try { _uds.apply(this, arguments); } finally { allOrders = orig; }
    try { chart(orig); } catch (e) {}
  };
  function init() {
    const tab = $('tab-dashboard'); if (!tab || $('dashRange')) return;
    tab.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:12px"><select id="dashRange"><option value="all">Tüm zamanlar</option><option value="1">Bugün</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option></select></div>');
    $('dashRange').onchange = e => { per = e.target.value; updateDashboardStats(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
