/* ===================================================================
   YAMA-18 — yama-13'ten SONRA yükle: <script src="yama-18.js"></script>
   Sipariş artık tarayıcıdan Firestore'a doğrudan YAZILMIYOR. Tarayıcı
   siparişi Worker'a (order-worker.js) gönderir; fiyat, stok, indirim,
   puan, kupon ve kargo hesabı sunucuda yapılır.
   Bu dosya eski processPayment'in (ve onu saran e-posta doğrulama ve
   profil yenileme sarmalayıcılarının) yerini alır; ikisi de burada
   yeniden uygulanıyor.
   =================================================================== */
(function () {
  'use strict';
  const ORDER_URL = 'https://ballin-order.ballinworldw.workers.dev/create-order';   // Worker adı: ballin-order
  const $ = id => document.getElementById(id);
  const newId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)));
  const unverified = u => !!(u && !u.isAnonymous && u.email && !u.emailVerified && (u.providerData || []).some(p => p.providerId === 'password'));
  let reqId = null, lastSig = '';

  window.processPayment = async function () {
    const v = id => ($(id) && $(id).value || '').trim();
    const name = v('checkoutName'), surname = v('checkoutSurname'), phone = v('checkoutPhone'),
      city = v('checkoutCity'), district = v('checkoutDistrict'), address = v('checkoutAddress');
    const email = (currentUser && currentUser.email) || v('checkoutEmail');
    if (!name || !surname || !phone || !city || !district || !address || !/^\S+@\S+\.\S+$/.test(email))
      return showToast('Ad, soyad, telefon, geçerli e-posta, il, ilçe ve adres zorunludur.', 'error');
    if (!$('checkTerms').checked || !$('checkKvkk').checked) return showToast('Lütfen sözleşme ve KVKK metinlerini onaylayın.', 'error');
    if (!cart.length) return showToast('Sepetiniz boş!', 'error');
    if (unverified(currentUser)) return showToast('Bu işlem için e-posta adresinizi doğrulayın (Hesabım sayfası).', 'error');
    const btn = $('btnCompletePayment'); if (btn.disabled) return;
    btn.disabled = true; btn.innerText = 'İşlem yapılıyor...';
    try {
      if (!currentUser) currentUser = (await firebase.auth().signInAnonymously()).user;
      const named = !currentUser.isAnonymous;
      const idToken = await currentUser.getIdToken();
      let ac = ''; try { ac = (await firebase.appCheck().getToken()).token; } catch (e) {}

      const g = {};
      cart.forEach(i => { const k = i.dbId + '|' + (i.size || 'Standart'); (g[k] = g[k] || { dbId: i.dbId, size: i.size || 'Standart', qty: 0, price: Number(i.price) || 0 }).qty++; });
      const payload = { items: Object.values(g), shipping: { name, surname, phone, city, district, address }, email,
        couponCode: named ? appliedCouponCode : '', usePoints: named ? (Math.floor(appliedPointsValue) || 0) : 0, consents: { terms: true, kvkk: true } };
      // aynı içerikle yeniden denemede AYNI istek no (çift sipariş olmaz); içerik değişirse yeni no
      const sig = JSON.stringify(payload); if (sig !== lastSig || !reqId) { reqId = newId(); lastSig = sig; }
      payload.requestId = reqId;

      const r = await fetch(ORDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken, 'X-Firebase-AppCheck': ac }, body: JSON.stringify(payload) });
      let j = {}; try { j = await r.json(); } catch (e) {}

      if (r.status === 409 && j.error === 'price_changed' && j.current) {         // fiyatlar değişmiş: sepeti güncelle, müşteri tekrar onaylasın
        cart.forEach(i => { const c = j.current[i.dbId]; if (c) { i.price = c.price; if (c.oldPrice) i.oldPrice = c.oldPrice; else delete i.oldPrice; } });
        localStorage.setItem('ballin_cart', JSON.stringify(cart)); renderCart(); goToCheckout();
        return showToast(j.message, 'error');
      }
      if (r.status === 409 && j.error === 'coupon') {                              // kupon geçersiz: kaldır, müşteri kuponsuz devam edebilsin
        appliedDiscountRate = 0; appliedCouponCode = ''; const pi = $('promoDiscountInfo'); if (pi) pi.style.display = 'none';
        goToCheckout(); return showToast(j.message, 'error');
      }
      if (!r.ok || !j.orderId) throw new Error(j.message || ('Sipariş oluşturulamadı (' + r.status + ')'));

      reqId = null; lastSig = '';
      try { sendOrderConfirmationEmail({ orderId: j.orderId }); } catch (e) {}
      showToast('Siparişiniz alındı!', 'success');
      if (!named) alert('Sipariş numaranız:\n' + j.orderId + '\n\nLütfen saklayın.');
      cart = []; appliedDiscountRate = 0; appliedCouponCode = ''; appliedPointsValue = 0;
      localStorage.removeItem('ballin_cart'); updateCartBadge(); syncCartToFirebase();
      const pi = $('promoDiscountInfo'); if (pi) pi.style.display = 'none';
      if (named) { switchPage('profile'); loadUserOrders(); try { await loadProfileData(); } catch (e) {} } else switchPage('home');
      loadProducts();
    } catch (e) { showToast(e.message || String(e), 'error'); }
    btn.disabled = false; btn.innerText = 'Ödemeyi Tamamla';
  };
})();
