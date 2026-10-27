/* ===================================================================
   YAMA-13 — yama-11'den SONRA yükle: <script src="yama-13.js"></script>
   1) Firebase'in İngilizce/teknik hata mesajları müşteriye anlaşılır
      Türkçe mesaja çevrilir (ödeme, kupon, giriş vb. hepsinde).
      Orijinal mesaj tarayıcı konsoluna (F12) yazılmaya devam eder.
   2) "Sipariş Sorgula" artık Firestore'dan doğrudan değil, Worker
      üzerinden çalışır (güvenlik kuralları siparişi sadece sahibine
      açtığı için). Worker: order-lookup-worker.js
   =================================================================== */
(function () {
  'use strict';
  const LOOKUP_URL = 'https://ballin-order-lookup.ballinworldw.workers.dev'; // Worker adı: ballin-order-lookup
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* ---------- 1) Anlaşılır hata mesajları ---------- */
  const MAP = [
    [/missing or insufficient permissions|permission-denied/i, 'Bu işlem için yetkiniz yok ya da oturumunuz yenilenmeli. Sayfayı yenileyip tekrar deneyin.'],
    [/transaction failed all retries|too much contention|aborted/i, 'Aynı anda çok fazla işlem yapıldı (aynı ürünü başka biri de almış olabilir). Lütfen tekrar deneyin.'],
    [/client is offline|network|unavailable|failed to fetch|load failed/i, 'İnternet bağlantınızda sorun var. Bağlantınızı kontrol edip tekrar deneyin.'],
    [/quota|resource-exhausted/i, 'Sistem şu an yoğun. Birkaç dakika sonra tekrar deneyin.'],
    [/too-many-requests/i, 'Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.'],
    [/already exists|already-exists/i, 'Bu kayıt zaten mevcut.'],
    [/requires an index/i, 'Bu liste şu an hazırlanamıyor. Lütfen yönetici ile iletişime geçin.']
  ];
  function friendly(m) {
    const s = String(m == null ? '' : m);
    for (const [re, tr] of MAP) if (re.test(s)) { try { console.warn('[hata - orijinal]', s); } catch (e) {} return tr; }
    return s;
  }
  const _st = window.showToast;
  window.showToast = function (message, type) { return _st.call(this, friendly(message), type); };

  /* ---------- 2) Sipariş sorgula (Worker üzerinden) ---------- */
  const safeUrl = u => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');
  window.lookupOrder = async function () {
    const id = (($('lkId') || {}).value || '').trim(), mail = (($('lkMail') || {}).value || '').trim().toLowerCase(), out = $('lkResult');
    if (!out) return;
    const notFound = '<p class="text-red-600">Sipariş bulunamadı veya e-posta eşleşmiyor.</p>';
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !/^\S+@\S+\.\S+$/.test(mail)) { out.innerHTML = notFound; return; }
    out.innerHTML = '<p>Sorgulanıyor...</p>';
    try {
      const r = await fetch(LOOKUP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id, email: mail }) });
      if (r.status === 404) { out.innerHTML = notFound; return; }
      if (r.status === 429) { out.innerHTML = '<p class="text-red-600">Çok fazla deneme yaptınız, biraz sonra tekrar deneyin.</p>'; return; }
      if (!r.ok) throw new Error('lookup ' + r.status);
      const o = (await r.json()).order || {};
      const d = o.orderDate ? new Date(o.orderDate).toLocaleString('tr-TR') : '-';
      const link = safeUrl(o.trackingUrl);
      const trackLine = o.trackingNumber ? '<p><b>Kargo:</b> ' + E(o.carrier || '') + ' · Takip No: ' +
        (link ? '<a class="underline font-bold" target="_blank" rel="noopener noreferrer" href="' + E(link) + '">' + E(o.trackingNumber) + '</a>' : E(o.trackingNumber)) + '</p>' : '';
      out.innerHTML = '<div class="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-2"><p><b>Sipariş:</b> #' + E(id.slice(0, 8)) + ' · ' + E(d) + '</p><p><b>Durum:</b> ' + E(o.status) + '</p>' + trackLine +
        '<p><b>Ürünler:</b> ' + (o.items || []).map(i => E(i.name) + (i.size && i.size !== 'Standart' ? ' (' + E(i.size) + ')' : '')).join(', ') + '</p><p><b>Toplam:</b> ' + tl(o.totalAmount) + ' TL</p></div>';
    } catch (e) {
      console.warn('[sipariş sorgula]', e);
      out.innerHTML = '<p class="text-red-600">Sorgulama şu an yapılamıyor. Lütfen biraz sonra tekrar deneyin.</p>';
    }
  };
})();
