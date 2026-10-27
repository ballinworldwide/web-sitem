/* ===================================================================
   YAMA-11 — index.html'de hero-globe.js'ten SONRA yükle:
   <script src="yama-11.js"></script>
   1) Hero metinleri (üst etiket / başlık / açıklama) artık ürünlerin
      yüklenmesini BEKLEMEDEN uygulanıyor:
        - önceki ziyaretten kalan önbellek (localStorage) anında,
        - Firestore'daki settings/cms belgesi hemen (küçük tek okuma).
      Böylece sayfa açılırken eski/varsayılan yazı görünmüyor.
   2) Koleksiyon sayfasındaki artık gereksiz "Ürünleri karşılaştırmak
      için..." yazısı kaldırılıyor (karşılaştırma özelliği yok).
   =================================================================== */
(function () {
  'use strict';
  const KEY = 'ballin_cms_cache';
  let latest = null;

  function pick(d) { return { heroKicker: d.heroKicker, heroTitle: d.heroTitle, heroDesc: d.heroDesc }; }
  function apply() { if (latest && typeof applyCMSBannerData === 'function') applyCMSBannerData(latest); }

  // 1a) önbellek: h1/p zaten HTML'de, hemen yazılır
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c) { latest = c; apply(); } } catch (e) {}

  // 1b) taze veri: ürünleri beklemeden hemen çek
  try {
    db.collection('settings').doc('cms').get().then(doc => {
      if (!doc.exists) return;
      latest = pick(doc.data());
      try { localStorage.setItem(KEY, JSON.stringify(latest)); } catch (e) {}
      apply();
    }).catch(() => {});
  } catch (e) {}

  // 1c) üst etiket elemanı hero-globe.js tarafından DOMContentLoaded'da oluşturuluyor;
  //     oluşur oluşmaz (ve birkaç kez daha) son değeri yeniden uygula
  function reapply() { apply(); [0, 150, 600, 1500].forEach(t => setTimeout(apply, t)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reapply); else reapply();

  // 2) eski karşılaştırma yazısı
  function cleanOld() {
    document.querySelectorAll('#page-collection p').forEach(p => {
      if (/karşılaştırmak için/i.test(p.textContent)) p.remove();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanOld); else cleanOld();
})();
