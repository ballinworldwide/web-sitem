/* BALLIN yama-2.js — script.bundle.js'ten (ve yama-1'den) SONRA yükle.
   1) "Görselleri taşı" admin paneline  2) kargo ücreti/limiti banner ayarıyla otomatik
   3) ödemede puan/kupon uygulayınca bilgiler silinmesin  4) ödemeye geçerken giriş/misafir penceresi
   5) admin görünümünde TASLAK/ARŞİV etiketi */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const isAdm = () => isStaffNow(currentUser);
  const UPLOAD_URL = 'https://ballin-upload.ballinworldw.workers.dev';
  const st = document.createElement('style'); st.textContent = '#migrateBtn{display:none!important}'; document.head.appendChild(st);

  /* ---- 1) Görselleri taşı: ana ekrandaki düğme gizlendi, Admin > Ürün Durumu içine alındı ---- */
  async function toWebp(src) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Görsel okunamadı.')); i.src = url; });
    const r = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/webp', 0.82));
  }
  async function up(src) {
    const blob = await toWebp(src), tok = await currentUser.getIdToken();
    const r = await fetch(UPLOAD_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': blob.type }, body: blob });
    if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch (e) {} throw new Error('Görsel yüklenemedi (' + r.status + (m ? ': ' + m : '') + ')'); }
    return (await r.json()).url;
  }
  async function migrate(btn) {
    btn.disabled = true; const t = btn.innerText; let n = 0;
    try {
      const snap = await db.collection('products').get();
      for (const d of snap.docs) {
        const imgs = d.data().images || []; if (!imgs.some(x => String(x).startsWith('data:'))) continue;
        const out = []; for (const x of imgs) out.push(String(x).startsWith('data:') ? await up(x) : x);
        await d.ref.update({ images: out }); n++; btn.innerText = 'Taşınan ürün: ' + n;
      }
      showToast(n ? n + ' ürünün görselleri taşındı.' : 'Taşınacak görsel yok.', 'success'); loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
    btn.innerText = t; btn.disabled = false;
  }
  function adminBtn() {
    const c = $('tab-pstatus'); if (!c || $('migrateBtn2')) return;
    c.querySelector('.card').insertAdjacentHTML('afterbegin', '<div style="margin-bottom:14px"><button id="migrateBtn2" class="btn-ghost">Eski görselleri taşı (R2)</button> <span style="font-size:11px;color:var(--mute)">Eski ürünlerdeki büyük görselleri Cloudflare R2\'ye aktarır; bir kez yeterli.</span></div>');
    $('migrateBtn2').onclick = function () { migrate(this); };
  }

  /* ---- 2) Kargo ücreti ve limiti banner ayarından (FREE_SHIPPING_THRESHOLD / SHIPPING_FEE) gelsin ---- */
  function shipText() {
    const T = tl(FREE_SHIPPING_THRESHOLD), F = tl(SHIPPING_FEE);
    const p = document.querySelector('#page-kargo-teslimat .space-y-4 p:nth-of-type(2)');
    if (p) p.innerHTML = '<strong>2. Kargo Ücretleri:</strong> ' + T + ' TL ve üzeri siparişlerde kargo ücretsizdir; bunun altındaki siparişlerde kargo ücreti ' + F + ' TL\'dir.';
    const pd = document.querySelector('[id^="page-product"]');
    if (pd) { const w = document.createTreeWalker(pd, NodeFilter.SHOW_TEXT), ns = []; while (w.nextNode()) ns.push(w.currentNode);
      ns.forEach(n => { if (/3\.?000 TL/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/3\.?000 TL/g, T + ' TL'); }); }
  }
  ['switchPage', 'openProductDetail'].forEach(n => { const o = window[n]; if (o) window[n] = function () { const r = o.apply(this, arguments); setTimeout(shipText, 60); return r; }; });
  const _cms = window.loadCMSBanner;
  if (_cms) window.loadCMSBanner = function () { const r = _cms.apply(this, arguments); Promise.resolve(r).then(() => setTimeout(shipText, 300)); setTimeout(shipText, 1500); return r; };

  /* ---- 3 + 4) Ödeme: puan/kupon sonrası bilgiler korunur; girişsizse giriş/misafir penceresi ---- */
  const FIELDS = ['checkoutName', 'checkoutSurname', 'checkoutEmail', 'checkoutPhone', 'checkoutAddress', 'checkoutCity', 'checkoutDistrict'];
  const _g = window.goToCheckout; let pending = false;
  const onCheckout = () => { const p = $('page-checkout'); return p && !p.classList.contains('hidden'); };
  const closeChooser = () => { const o = $('guestChooser'); if (o) o.remove(); };
  function chooser() {
    closeChooser();
    const b = 'width:100%;padding:13px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;margin-top:10px;';
    const o = document.createElement('div'); o.id = 'guestChooser';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
    o.innerHTML = '<div style="background:#fff;border-radius:18px;max-width:380px;width:100%;padding:26px;text-align:center"><h3 style="font-weight:700;font-size:18px;margin-bottom:8px">Nasıl devam etmek istersiniz?</h3>' +
      '<p style="font-size:13px;color:#666;margin-bottom:12px">Üye olarak siparişlerinizi takip edebilir, puan ve kupon kullanabilirsiniz.</p>' +
      '<button id="gcLogin" style="' + b + 'background:#212529;color:#fff;border:0">Giriş Yap / Üye Ol</button><button id="gcGuest" style="' + b + 'background:#fff;color:#212529;border:1px solid #212529">Misafir Olarak Devam Et</button></div>';
    o.onclick = e => { if (e.target === o) closeChooser(); };
    document.body.appendChild(o);
    $('gcLogin').onclick = () => { pending = true; closeChooser(); openModal(); };
    $('gcGuest').onclick = () => { sessionStorage.setItem('ballin_guest', '1'); closeChooser(); goToCheckout(); };
  }
  window.goToCheckout = function () {
    if (!cart.length) return _g.apply(this, arguments);
    const on = onCheckout();
    if (!on && !currentUser && !sessionStorage.getItem('ballin_guest')) { chooser(); return; }
    const saved = on ? FIELDS.reduce((o, f) => { o[f] = $(f) ? $(f).value : ''; return o; }, {}) : null;
    const r = _g.apply(this, arguments);
    if (saved) {
      const back = () => {
        FIELDS.forEach(f => { if (f !== 'checkoutDistrict' && saved[f] && $(f)) $(f).value = saved[f]; });
        if (saved.checkoutCity && $('checkoutCity')) { $('checkoutCity').value = saved.checkoutCity; populateDistricts('checkoutCity', 'checkoutDistrict'); if (saved.checkoutDistrict) $('checkoutDistrict').value = saved.checkoutDistrict; }
      };
      [400, 1200].forEach(t => setTimeout(back, t));
    }
    return r;
  };
  firebase.auth().onAuthStateChanged(u => { if (pending && u && u.email) { pending = false; setTimeout(() => goToCheckout(), 500); } });

  /* ---- 5) Admin görünümünde taslak/arşiv ürünlere etiket (yayındakilerde etiket yok) ---- */
  const _cpc = window.createProductCard;
  window.createProductCard = function (p) {
    let h = _cpc.apply(this, arguments);
    if (isAdm() && p.status && p.status !== 'published')
      h = h.replace('overflow-hidden mb-4 bg-white">', 'overflow-hidden mb-4 bg-white"><span class="absolute bottom-14 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded z-10">' + (p.status === 'draft' ? 'TASLAK' : 'ARŞİV') + '</span>');
    return h;
  };

  function init() { adminBtn(); shipText(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
