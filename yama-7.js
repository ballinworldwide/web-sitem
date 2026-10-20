/* BALLIN yama-7.js — iptal/iade mailleri, "Haber Ver" stokta maili, ürün detayında eski fiyat, mobil sabit "Sepete Ekle" çubuğu.
   yama-6'dan SONRA yükle. (mail-worker.js yeni halini Cloudflare'e yapıştır.) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const MAIL_URL = 'https://ballin-mail.ballinworldw.workers.dev';
  async function mail(path, payload) {
    try {
      const tok = await currentUser.getIdToken();
      const r = await fetch(MAIL_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(payload) });
      if (!r.ok) console.warn('mail', path, r.status, await r.text());
      return r.ok;
    } catch (e) { console.warn('mail gönderilemedi', e); return false; }
  }

  /* İptal ve iade mailleri: işlem bitince Worker güncel durumu okuyup uygun maili gönderir */
  ['cancelMyOrder', 'requestReturn', 'rejectReturn'].forEach(n => {
    const o = window[n]; if (!o) return;
    window[n] = function (id) { const r = o.apply(this, arguments); setTimeout(() => mail('/order-status', { orderId: id }), 1800); return r; };
  });
  const _u = window.updateAdminOrder;
  window.updateAdminOrder = async function (id) {
    const st = $('adminStatus_' + id) ? $('adminStatus_' + id).value : '';
    const r = await _u.apply(this, arguments);
    if (['İptal Edildi', 'İade Onaylandı', 'İade Onaylanmadı'].includes(st)) mail('/order-status', { orderId: id });
    return r;
  };

  /* Haber Ver: tek tıkla "ürün stokta" maili (gönderilince talep silinir) */
  function decorate() {
    const el = $('alertsList'); if (!el) return;
    el.querySelectorAll('tr').forEach(tr => {
      const del = tr.querySelector('[onclick^="delAlert("]'); if (!del || tr.querySelector('.ntf')) return;
      const m = /delAlert\('([^']+)'/.exec(del.getAttribute('onclick')); if (!m) return;
      del.insertAdjacentHTML('beforebegin', '<button class="btn-ghost ntf" onclick="notifyAlert(\'' + m[1] + '\')">Stokta maili gönder</button> ');
    });
  }
  window.notifyAlert = async function (id) {
    if (!confirm('Müşteriye "ürün stokta" maili gönderilsin ve talep silinsin mi?')) return;
    if (await mail('/stock-back', { alertId: id })) { showToast('Mail gönderildi.', 'success'); delAlert(id); } else showToast('Mail gönderilemedi.', 'error');
  };

  /* Ürün detayı: eski fiyat (üstü çizili) + indirim yüzdesi */
  const _opd = window.openProductDetail;
  window.openProductDetail = function (id) {
    const r = _opd.apply(this, arguments);
    setTimeout(() => {
      const p = allProducts.find(x => x.id === id), pg = $('page-product-detail');
      if (!p || !pg || !(p.oldPrice > p.price) || pg.querySelector('.oldPriceTag')) return;
      const re = new RegExp('^\\s*' + String(p.price).replace('.', '[.,]') + '\\s*TL\\s*$'), w = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode; if (!re.test(n.nodeValue)) continue;
        const s = document.createElement('span'); s.className = 'oldPriceTag'; s.style.cssText = 'text-decoration:line-through;opacity:.5;font-size:.7em;margin-right:8px'; s.textContent = tl(p.oldPrice) + ' TL';
        n.parentNode.insertBefore(s, n);
        const d = document.createElement('span'); d.style.cssText = 'font-size:.6em;color:#dc2626;margin-left:8px;font-weight:700'; d.textContent = '%' + Math.round((1 - p.price / p.oldPrice) * 100) + ' indirim';
        n.parentNode.appendChild(d); break;
      }
    }, 80);
    return r;
  };

  /* Mobil: ürün sayfasında alta sabit "Sepete Ekle" çubuğu (sayfadaki asıl düğmeyi tetikler) */
  function bar() {
    let b = $('stickyAdd'); const pg = $('page-product-detail');
    const t = pg && !pg.classList.contains('hidden') && innerWidth <= 768 ? pg.querySelector('[onclick^="addDetailedToCart"]') : null;
    if (!t) { if (b) b.style.display = 'none'; return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'stickyAdd';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:4000;background:#fff;padding:10px 14px;box-shadow:0 -6px 20px rgba(0,0,0,.15)';
      b.innerHTML = '<button style="width:100%;background:#212529;color:#fff;border:0;border-radius:12px;padding:14px;font-weight:700;font-size:15px">Sepete Ekle</button>';
      b.firstChild.onclick = () => { const x = $('page-product-detail').querySelector('[onclick^="addDetailedToCart"]'); if (x) x.click(); };
      document.body.appendChild(b);
    }
    b.style.display = 'block';
  }
  setInterval(bar, 700);
  function init() { const el = $('alertsList'); if (el) new MutationObserver(decorate).observe(el, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
