/* BALLIN yama-9.js — reconcile() artık script.bundle.js içinde transaction ile kilitli olduğu için admin
   tarafında ek bir çifte-tıklama koruması; CSV ürün adı kaçışını arayüz tarafında da güvene alır.
   yama-8'den SONRA yükle. (Asıl düzeltmeler script.bundle.js içinde yapıldı, bkz. değişiklik notu.) */
(function () {
  'use strict';
  const isAdm = () => isStaffNow(currentUser);

  /* loadAdminOrders'ı 1.5 sn içinde üst üste tetiklenmeye karşı kilitle (örn. sekme değişimi + buton tıklaması aynı anda) */
  let busy = false;
  const _lao = window.loadAdminOrders;
  window.loadAdminOrders = async function () {
    if (!isAdm() || busy) return;
    busy = true;
    try { return await _lao.apply(this, arguments); }
    finally { setTimeout(() => { busy = false; }, 1500); }
  };

  /* CSV dışa aktarmada ürün adındaki çift tırnağı kaçır (script.bundle.js'teki düzeltmeyi henüz
     uygulamadıysan diye arayüz tarafında ikinci bir güvenlik katmanı) */
  const _exp = window.exportProductsToCSV;
  if (_exp) window.exportProductsToCSV = function () {
    const orig = allProducts;
    allProducts = orig.map(p => ({ ...p, name: String(p.name || '').replace(/"/g, '""') }));
    try { return _exp.apply(this, arguments); } finally { allProducts = orig; }
  };
})();
