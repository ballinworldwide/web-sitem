/* BALLIN yama-1.js — sipariş e-postaları artık Worker + Resend üzerinden gider (EmailJS kullanılmaz).
   script.bundle.js'ten SONRA yükle. MAIL_URL'ye mail Worker adresini yaz. */
(function () {
  'use strict';
  const MAIL_URL = 'https://ballin-mail.ballinworldw.workers.dev';
  const call = async (path, orderId) => {
    try {
      const tok = await currentUser.getIdToken();
      const r = await fetch(MAIL_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ orderId }) });
      if (!r.ok) console.warn('mail hatası', path, r.status, await r.text());
    } catch (e) { console.warn('mail gönderilemedi', e); }
  };
  window.sendOrderConfirmationEmail = o => call('/order-created', o.orderId);
  window.sendShippingUpdateEmail = id => call('/order-shipped', id);
})();
