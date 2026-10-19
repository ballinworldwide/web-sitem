/* BALLIN yama-3.js — yönetici rolleri (Sahip, Sipariş sorumlusu, Ürün sorumlusu).
   Yeni script.bundle.js ile birlikte çalışır; yama-2'den SONRA yükle. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = s => window.esc(s), FV = firebase.firestore.FieldValue;
  const isOwner = () => !!(currentUser && !currentUser.isAnonymous && currentUser.email === ADMIN_EMAIL);
  const role = () => isOwner() ? 'owner' : (currentUser && !currentUser.isAnonymous ? STAFF_ROLE : null);
  const TABS = { owner: ['dashboard', 'orders', 'products', 'customers', 'coupons', 'settings', 'pstatus', 'alerts', 'logs', 'staff'], siparis: ['orders'], urun: ['products', 'pstatus', 'alerts'] };
  TABS.yonetici = TABS.owner;
  const NAMES = { siparis: 'Sipariş sorumlusu', urun: 'Ürün sorumlusu', yonetici: 'Yönetici' };
  const full = () => ['owner', 'yonetici'].includes(role());
  const ok = t => (TABS[role()] || []).includes(t);
  const log = (action, detail) => db.collection('admin_logs').add({ action, detail, by: currentUser.email, at: FV.serverTimestamp() }).catch(() => {});

  function applyRole() {
    const r = role(), b = $('adminButton'); if (b) b.style.display = r ? 'inline-block' : 'none';
    document.querySelectorAll('.nav-item[onclick^="switchAdminTab"]').forEach(n => {
      const m = /switchAdminTab\('(\w+)'/.exec(n.getAttribute('onclick')); if (m) n.style.display = (!r || ok(m[1])) ? '' : 'none';
    });
  }
  firebase.auth().onAuthStateChanged(async u => {
    STAFF_ROLE = null;
    if (u && !u.isAnonymous && u.email && u.emailVerified && u.email !== ADMIN_EMAIL) {
      try { const d = await db.collection('staff').doc(u.email.toLowerCase()).get(); if (d.exists && NAMES[d.data().role]) STAFF_ROLE = d.data().role; } catch (e) {}
    }
    applyRole();
  });

  /* Yetkisiz sekmeler kapalı; yönetici açılışta kendi ilk sekmesine gider */
  const _sw = window.switchAdminTab;
  window.switchAdminTab = function (id) {
    if (role() && !ok(id)) return showToast('Bu bölüm için yetkiniz yok.', 'error');
    _sw.apply(this, arguments);
    if (id === 'staff') { if ($('adminPageTitle')) $('adminPageTitle').innerText = 'Yöneticiler'; loadStaff(); }
  };
  const _oap = window.openAdminPanel;
  window.openAdminPanel = function () {
    const r0 = _oap.apply(this, arguments); applyRole(); const rl = role();
    if (rl && !full()) { const f = TABS[rl][0]; switchAdminTab(f, [...document.querySelectorAll('.nav-item')].find(n => (n.getAttribute('onclick') || '').includes("'" + f + "'"))); }
    return r0;
  };
  const gate = (n, roles) => { const o = window[n]; if (o) window[n] = function () { const r = role(); if (!r || (!full() && !roles.includes(r))) return; return o.apply(this, arguments); }; };
  ['loadAdminOrders', 'loadOrdersAndCalculateStats', 'loadCustomersCRM', 'loadAbandonedCarts'].forEach(n => gate(n, ['siparis']));
  gate('loadCouponsAdmin', []);

  /* Sahip: Yöneticiler sekmesi */
  function ui() {
    const last = $('tab-logs') || $('tab-coupons'); if (!last || $('tab-staff')) return;
    const nav = [...document.querySelectorAll('.nav-item')].find(n => (n.getAttribute('onclick') || '').includes("'logs'"));
    if (nav) nav.insertAdjacentHTML('afterend', '<a class="nav-item" onclick="switchAdminTab(\'staff\', this)">Yöneticiler</a>');
    last.insertAdjacentHTML('afterend', '<div id="tab-staff" class="admin-tab"><div class="card"><p class="card-title">Yöneticiler ve Roller</p>' +
      '<p style="font-size:12px;color:var(--mute);margin-bottom:12px"><b>Sipariş sorumlusu:</b> yalnızca Siparişler. <b>Ürün sorumlusu:</b> Ürün Yönetimi, Ürün Durumu, Haber Ver. <b>Yönetici:</b> Sahip gibi her şeye erişir (Yönetici rolünü yalnızca Sahip verir/kaldırır). Eklenen kişi bu e-posta ile (Google girişi önerilir, e-posta doğrulanmış olmalı) giriş yapınca Yönetim düğmesini görür.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><input id="stfMail" type="email" placeholder="E-posta" style="flex:1;min-width:200px"><select id="stfRole"><option value="siparis">Sipariş sorumlusu</option><option value="urun">Ürün sorumlusu</option><option value="yonetici">Yönetici</option></select><button class="btn-primary" onclick="addStaff()">Ekle</button></div><div id="staffList"></div></div></div>');
  }
  async function loadStaff() {
    const b = $('staffList'); if (!b) return; const s = await db.collection('staff').get().catch(() => null); if (!s) return;
    b.innerHTML = s.empty ? '<p class="text-xs">Henüz yönetici eklenmedi.</p>' : '<table><thead><tr><th>E-posta</th><th>Rol</th><th></th></tr></thead><tbody>' +
      s.docs.map(d => '<tr><td>' + E(d.id) + '</td><td>' + E(NAMES[d.data().role] || d.data().role) + '</td><td><button class="btn-ghost" data-del="' + E(d.id) + '">Kaldır</button></td></tr>').join('') + '</tbody></table>';
    b.querySelectorAll('[data-del]').forEach(x => { x.onclick = () => delStaff(x.dataset.del); });
  }
  window.addStaff = async function () {
    if (!full()) return; const m = ($('stfMail').value || '').trim().toLowerCase(), r = $('stfRole').value;
    if (!/^\S+@\S+\.\S+$/.test(m) || m === ADMIN_EMAIL) return showToast('Geçerli bir e-posta girin.', 'error');
    if (r === 'yonetici' && !isOwner()) return showToast('Yönetici rolünü yalnızca Sahip verebilir.', 'error');
    try { await db.collection('staff').doc(m).set({ role: r, addedBy: currentUser.email, at: FV.serverTimestamp() }); log('yönetici eklendi', m + ' → ' + r); $('stfMail').value = ''; showToast('Yönetici eklendi.', 'success'); loadStaff(); }
    catch (e) { showToast(e.message, 'error'); }
  };
  async function delStaff(m) {
    if (!confirm(m + ' yetkisi kaldırılsın mı?')) return;
    try { await db.collection('staff').doc(m).delete(); log('yönetici kaldırıldı', m); showToast('Kaldırıldı.', 'success'); loadStaff(); } catch (e) { showToast(e.message, 'error'); }
  }
  function init() { ui(); applyRole(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
