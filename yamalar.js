/* ===================================================================
   YAMALAR.JS (yama-29) — yama-10, hero-globe, yama-11, yama-13, yama-18,
   yama-23 dosyalarının, index.html'deki yükleme sırasıyla birleşimi.
   Her bölüm kendi try/catch'inde: biri hata verirse diğerleri çalışır
   (ayrı <script> etiketlerindeki davranışla aynı).
   Yüklenme: script.bundle.js'ten SONRA, tek etiketle.
   =================================================================== */

/* ---------- yama-10.js ---------- */
try {
/* ===================================================================
   YAMA-10 (DÜZELTİLMİŞ) — yama-9'dan SONRA yükle, eski yama-10.js'in
   yerine koy (aynı isimle üzerine yaz).
   Önceki sürümdeki hata: sepet fiyat satırını yanlış CSS class'ıyla
   arıyordu (patch4.js'in gerçek markup'ıyla eşleşmiyordu), bu yüzden
   indirim hiç görünmüyordu. Şimdi renderCart TAMAMEN yeniden
   tanımlanıyor (patch4'ün üzerine yazmak yerine), discount satırı
   doğrudan markup'ın içine gömülü.
   1) Sipariş tamamlanınca Hesabım'daki puan ANINDA güncellensin.
   2) Sepete eklerken ürünün eski fiyatını da satıra taşı.
   3) Sepet panelinde: eski fiyat (üstü çizili) + indirim tutarı.
   4) Ödeme ekranı özetinde aynısı.
   =================================================================== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* 1) Ödeme bitince profil verisini (puan dahil) hemen tazele */
  const _pp = window.processPayment;
  window.processPayment = async function () {
    const r = await _pp.apply(this, arguments);
    if (currentUser && !currentUser.isAnonymous) { try { await loadProfileData(); } catch (e) {} }
    return r;
  };

  /* 2) Sepete eklerken ürünün eski fiyatını satıra taşı (varsa) */
  const _add = window.addToCart;
  window.addToCart = function (dbId) {
    const r = _add.apply(this, arguments);
    const p = allProducts.find(x => x.id === dbId);
    if (p && p.oldPrice > p.price) {
      const last = cart[cart.length - 1];
      if (last && last.dbId === dbId && !last.oldPrice) { last.oldPrice = p.oldPrice; localStorage.setItem('ballin_cart', JSON.stringify(cart)); }
    }
    return r;
  };

  /* 3) Sepet paneli: patch4.js'in renderCart'ının TAM YENİDEN TANIMI (discount satırı dahil) */
  window.renderCart = function () {
    const box = $('cartItems'), totalEl = $('cartTotal'); if (!box || !totalEl) return;
    let total = 0;
    if (!cart.length) {
      box.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-cart-arrow-down text-4xl text-brand-200 mb-4"></i><p class="text-sm font-medium text-brand-500">Sepetiniz şu an boş.</p></div>';
      if ($('cartShippingProgressContainer')) $('cartShippingProgressContainer').classList.add('hidden');
      totalEl.innerText = '0 TL';
      return;
    }
    const g = {}; cart.forEach(i => { const k = i.dbId + '|' + i.size; (g[k] = g[k] || { it: i, n: 0 }).n++; total += i.price || 0; });
    box.innerHTML = Object.values(g).map(({ it, n }) => {
      const a = "'" + E(it.dbId) + "','" + E(it.size) + "'", b = 'style="width:28px;height:28px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-weight:700"';
      const discHtml = it.oldPrice > it.price
        ? ' <span class="discTag" style="text-decoration:line-through;opacity:.5;margin-left:6px">' + tl(it.oldPrice) + ' TL</span>' +
          ' <span style="color:#dc2626;font-weight:700;margin-left:4px">(-' + tl(it.oldPrice - it.price) + ' TL)</span>'
        : '';
      return '<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="' + E(it.image) + '" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1">' +
        '<h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">' + E(it.baseName || it.name) + '</h4>' +
        '<p class="text-[11px] text-brand-400 mt-1">' + (it.size && it.size !== 'Standart' ? 'Beden: ' + E(it.size) + ' · ' : '') + tl(it.price) + ' TL' + discHtml + '</p>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button ' + b + ' onclick="cartMinus(' + a + ')">−</button><b style="min-width:18px;text-align:center">' + n + '</b><button ' + b + ' onclick="cartPlus(' + a + ')">+</button>' +
        '<span class="text-sm font-bold text-brand-900" style="margin-left:auto">' + tl((it.price || 0) * n) + ' TL</span></div></div>' +
        '<button onclick="cartRemoveGroup(' + a + ')" aria-label="Sil" class="text-brand-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>';
    }).join('');
    const pc = $('cartShippingProgressContainer'), bar = $('cartShippingBar'), tx = $('cartShippingText');
    if (pc) pc.classList.remove('hidden');
    if (total >= FREE_SHIPPING_THRESHOLD) { if (bar) bar.style.width = '100%'; if (tx) tx.innerHTML = '<i class="fa-solid fa-gift text-emerald-500 mr-1"></i> Tebrikler, kargo bedava!'; }
    else { if (bar) bar.style.width = (total / FREE_SHIPPING_THRESHOLD * 100) + '%'; if (tx) tx.innerHTML = 'Ücretsiz kargoya <strong>' + tl(FREE_SHIPPING_THRESHOLD - total) + ' TL</strong> kaldı!'; }
    totalEl.innerText = tl(total * (1 - appliedDiscountRate)) + ' TL';
  };

  /* 4) Ödeme ekranı özetinde eski fiyat + indirim tutarı (core'un goToCheckout'unu sarmalar) */
  const _gc = window.goToCheckout;
  window.goToCheckout = function () {
    const r = _gc.apply(this, arguments);
    try {
      const box = $('checkoutSummaryItems'); if (!box || !cart.length) return r;
      const rows = [...box.children];
      cart.forEach((it, i) => {
        const row = rows[i]; if (!row || row.querySelector('.discTag')) return;
        if (it.oldPrice > it.price) {
          row.insertAdjacentHTML('beforeend',
            '<div class="discTag text-[11px] text-right" style="margin-top:2px">' +
            '<span style="text-decoration:line-through;opacity:.5">' + tl(it.oldPrice) + ' TL</span>' +
            ' <span style="color:#dc2626;font-weight:700">(-' + tl(it.oldPrice - it.price) + ' TL)</span></div>');
        }
      });
    } catch (e) {}
    return r;
  };
})();
} catch (e) { console.error("yama-10.js hatası:", e); }

/* ---------- hero-globe.js ---------- */
try {
/* ===================================================================
   HERO-GLOBE.JS (v8) — AYNI isimle eskisinin üzerine yaz.
   Onaylanan hero tasarımı (üst etiket + animasyonlu dolan çizgi +
   başlık + açıklama + 2 buton + arkada dönen tel kafes küre) burada
   kuruluyor. Üç metin de (kicker/başlık/açıklama) Admin > Vitrin &
   Ayarlar'dan değiştirilebilir — script.bundle.js'teki loadCMSBanner/
   saveCMSBanner zaten #homeHeroKicker/#homeHeroTitle/#homeHeroDesc
   id'lerini kullanıyor, burada SADECE o id'lere sahip elemanları
   (yoksa) oluşturup stillendiriyoruz.
   =================================================================== */
(function () {
  'use strict';
  console.log('[hero-globe] SÜRÜM v12 (hareket azaltma desteği) çalışıyor.');

  function ensureThree(cb) {
    if (window.THREE) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = cb;
    s.onerror = () => console.warn('[hero-globe] three.js yüklenemedi');
    document.head.appendChild(s);
  }

  function findHeroContainer() {
    const home = document.getElementById('page-home'); if (!home) return null;
    return [...home.children].find(el => el.classList && el.classList.contains('bg-brand-50'))
      || [...home.children].find(el => el.tagName === 'DIV')
      || null;
  }

  function ensureStyles() {
    if (document.getElementById('heroGlobeStyles')) return;
    const st = document.createElement('style');
    st.id = 'heroGlobeStyles';
    st.textContent = `
      .hero-kicker{font-family:Inter,sans-serif;display:inline-block;color:rgba(255,255,255,.8);font-size:12px;letter-spacing:.3em;text-transform:uppercase;margin-bottom:12px;opacity:0;animation:heroFadeIn .7s ease forwards;animation-delay:.1s}
      .hero-fillbar-wrap{width:140px;height:2px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden;margin:0 auto 32px}
      .hero-fillbar{height:100%;width:0;background:linear-gradient(90deg,#fff,rgba(255,255,255,.3));border-radius:2px;animation:heroFillBar 1.3s cubic-bezier(.16,1,.3,1) forwards;animation-delay:.35s}
      #homeHeroTitle{color:#fff !important;opacity:0;transform:translateY(24px);animation:heroRiseIn .8s cubic-bezier(.16,1,.3,1) forwards;animation-delay:.25s}
      #homeHeroDesc{color:rgba(255,255,255,.55) !important;opacity:0;animation:heroFadeIn .9s ease forwards;animation-delay:.55s}
      .hero-btns{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:10px;opacity:0;animation:heroFadeIn .9s ease forwards;animation-delay:.8s}
      .hero-btn-primary{font-family:Inter,sans-serif;font-weight:600;font-size:14px;letter-spacing:.05em;text-transform:uppercase;padding:16px 34px;border-radius:999px;background:#fff;color:#05050a;border:0;cursor:pointer;transition:transform .25s}
      .hero-btn-primary:hover{transform:scale(1.04)}
      .hero-btn-ghost{font-family:Inter,sans-serif;font-weight:600;font-size:14px;letter-spacing:.05em;text-transform:uppercase;padding:16px 34px;border-radius:999px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3);cursor:pointer;transition:.25s}
      .hero-btn-ghost:hover{border-color:#fff;background:rgba(255,255,255,.06)}
      @keyframes heroRiseIn{to{opacity:1;transform:translateY(0)}}
      @keyframes heroFadeIn{to{opacity:1}}
      @keyframes heroFillBar{to{width:100%}}
      @media (prefers-reduced-motion: reduce){
        .hero-kicker,.hero-btns,#homeHeroDesc{animation:none !important;opacity:1 !important}
        #homeHeroTitle{animation:none !important;opacity:1 !important;transform:none !important}
        .hero-fillbar{animation:none !important;width:100% !important}
      }
    `;
    document.head.appendChild(st);
  }

  function buildHeroContent(hero) {
    // Eski gradient/buton kalıntıları varsa temizle
    hero.querySelectorAll(':scope > div.bg-gradient-to-br').forEach(el => el.remove());
    hero.classList.remove('py-20', 'bg-brand-50');
    hero.classList.add('min-h-screen');
    hero.style.background = '#05050a';

    let wrap = hero.querySelector(':scope > .relative.z-10');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'relative z-10 max-w-7xl mx-auto text-center flex flex-col items-center px-4';
      hero.appendChild(wrap);
    }

    if (!document.getElementById('homeHeroKicker')) {
      const k = document.createElement('span');
      k.id = 'homeHeroKicker'; k.className = 'hero-kicker';
      k.textContent = 'LÜKSÜN YENİ TANIMI';
      wrap.insertBefore(k, wrap.firstChild);
    }
    if (!document.querySelector('.hero-fillbar-wrap')) {
      const bw = document.createElement('div');
      bw.className = 'hero-fillbar-wrap';
      bw.innerHTML = '<div class="hero-fillbar"></div>';
      const kicker = document.getElementById('homeHeroKicker');
      kicker.insertAdjacentElement('afterend', bw);
    }
    const h1 = document.getElementById('homeHeroTitle');
    if (h1) h1.classList.add('font-serif', 'text-4xl', 'md:text-6xl', 'lg:text-7xl', 'tracking-tight', 'mb-6');

    const p = document.getElementById('homeHeroDesc');
    if (p) p.classList.add('mt-4', 'max-w-2xl', 'text-lg', 'md:text-xl', 'font-light', 'mb-10');

    const oldBtn = hero.querySelector('button[onclick*="switchPage(\'collection\')"]');
    if (oldBtn && !oldBtn.closest('.hero-btns')) oldBtn.remove(); // eski tekil buton varsa kaldır, yenisini aşağıda kuracağız

    if (!hero.querySelector('.hero-btns')) {
      const btns = document.createElement('div');
      btns.className = 'hero-btns';
      btns.innerHTML =
        '<button onclick="switchPage(\'collection\')" class="hero-btn-primary">Koleksiyonu Keşfet</button>' +
        '<button onclick="switchPage(\'new\')" class="hero-btn-ghost">Yeni Gelenler</button>';
      wrap.appendChild(btns);
    }

    wireKickerVisibility();
  }

  // Admin panelinden üst etiket (kicker) silinirse/eklenirse, altındaki çizgi de
  // otomatik görünür/gizlenir olsun diye metin değişimini canlı izliyoruz.
  function wireKickerVisibility() {
    const k = document.getElementById('homeHeroKicker');
    const bw = document.querySelector('.hero-fillbar-wrap');
    if (!k || !bw || k.dataset.visWired) return;
    k.dataset.visWired = '1';
    const sync = () => {
      const empty = !k.textContent.trim();
      k.style.display = empty ? 'none' : '';
      bw.style.display = empty ? 'none' : '';
    };
    sync();
    new MutationObserver(sync).observe(k, { childList: true, characterData: true, subtree: true });
  }

  function replayHeroAnimations(hero) {
    hero.querySelectorAll('.hero-kicker, .hero-fillbar, #homeHeroTitle, #homeHeroDesc, .hero-btns').forEach(n => {
      n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
    });
  }

  function ensureCanvas(hero) {
    let c = document.getElementById('heroGlobe');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'heroGlobe';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
      hero.insertBefore(c, hero.firstChild);
    }
    return c;
  }

  function initHeroGlobe() {
    const hero = findHeroContainer(); if (!hero) return;
    const canvas = ensureCanvas(hero);
    if (canvas.dataset.threeInited) return;
    const w = hero.clientWidth, h = hero.clientHeight;
    if (w < 50 || h < 50) { setTimeout(initHeroGlobe, 300); return; }
    canvas.dataset.threeInited = '1';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);

    const group = new THREE.Group(); scene.add(group);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 })
    );
    group.add(sphere);

    // Kullanıcı "hareketi azalt" ayarını açtıysa küre dönmez, sabit bir kare çizilir
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function animate() {
      if (!reduceMotion) requestAnimationFrame(animate);
      group.rotation.y += reduceMotion ? 0 : 0.0022;
      group.rotation.x += reduceMotion ? 0 : 0.0006;
      renderer.render(scene, camera);
    }
    if (reduceMotion) group.rotation.set && group.rotation.set(0.4, 0.8, 0);
    animate();

    const ro = new ResizeObserver(() => {
      const nw = hero.clientWidth, nh = hero.clientHeight;
      if (nw < 10 || nh < 10) return;
      camera.aspect = nw / nh; camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(hero);
  }

  // Admin panelindeki "Ana Sayfa Banner" kartına "Üst Etiket" alanını kendimiz ekliyoruz —
  // index.html'de elle HTML eklemeye güvenmek yerine (önceki mesajlarda bu adım hep atlanmıştı).
  function ensureAdminKickerField() {
    if (document.getElementById('cmsHeroKicker')) return;
    const titleInput = document.getElementById('cmsHeroTitle');
    if (!titleInput) return; // admin bölümü henüz DOM'da değilse sorun değil, boot() periyodik tekrar dener
    const grid = titleInput.closest('.grid');
    if (!grid || !grid.parentElement) return;
    const field = document.createElement('div');
    field.className = 'mb-4';
    field.innerHTML = '<label class="block text-xs mb-1" style="color:var(--mute)">Üst Etiket (küre üzerindeki kısa yazı)</label><input type="text" id="cmsHeroKicker" class="w-full" />';
    grid.parentElement.insertBefore(field, grid);
  }

  (window.__adminInits = window.__adminInits || []).push(ensureAdminKickerField);  // yama-23: admin paneli geç yüklenince tekrar çalıştırılır
  function boot() {
    ensureAdminKickerField();
    // ÖNEMLİ (yama-11 düzeltmesi): içerik (kicker/bar/buton) three.js'in CDN'den
    // yüklenmesini BEKLEMEDEN hemen kuruluyor. Önceki sürümde kicker elemanı
    // three.js yüklendikten SONRA oluşturuluyordu; script.bundle.js'teki
    // loadCMSBanner() sayfa açılır açılmaz çalıştığı için o an #homeHeroKicker
    // henüz DOM'da olmadığından admin panelindeki metin hiç uygulanmıyordu.
    const hero = findHeroContainer();
    if (hero) { ensureStyles(); buildHeroContent(hero); }
    ensureThree(() => initHeroGlobe());
  }
  const _sw = window.switchPage;
  window.switchPage = function (id) {
    const r = _sw.apply(this, arguments);
    if (id === 'home') {
      setTimeout(boot, 50);
      const hero = findHeroContainer();
      if (hero) setTimeout(() => replayHeroAnimations(hero), 60);
    }
    return r;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
} catch (e) { console.error("hero-globe.js hatası:", e); }

/* ---------- yama-11.js ---------- */
try {
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
} catch (e) { console.error("yama-11.js hatası:", e); }

/* ---------- yama-13.js ---------- */
try {
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
} catch (e) { console.error("yama-13.js hatası:", e); }

/* ---------- yama-18.js ---------- */
try {
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
} catch (e) { console.error("yama-18.js hatası:", e); }

/* ---------- yama-23.js ---------- */
try {
/* ===================================================================
   YAMA-23: Admin paneli HTML'i artık index.html'de değil, admin-panel.html'de.
   Panel ilk açıldığında bir kez indirilip sayfaya eklenir. Ziyaretçiler ve
   müşteriler bu ~25 KB'lık HTML'i hiç indirmez.
   Yükleme sırasında admin DOM'una bağlanan başlatıcılar (sekmeler, dönem
   seçici, gözlemciler) panel eklendikten sonra window.__adminInits ile
   bir kez daha çalıştırılır; hepsi tekrar çalışmaya karşı korumalıdır.
   =================================================================== */
(function () {
  var _open = window.openAdminPanel, loading = null;
  function ensurePanel() {
    if (document.getElementById('page-admin')) return Promise.resolve();
    if (!loading) {
      loading = fetch('/admin-panel.html', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (html) {
          if (!document.getElementById('page-admin')) document.body.insertAdjacentHTML('beforeend', html);
          (window.__adminInits || []).forEach(function (f) { try { f(); } catch (e) { console.error('admin başlatıcı hatası', e); } });
          // Panel yokken gelen veriler admin alanlarına yazılamamıştı: şimdi doldur
          try { updateCategoryDropdowns(); } catch (e) {}
          try { renderAdminCategories(); } catch (e) {}
          try { loadCMSBanner(); } catch (e) {}
        })
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }
  window.openAdminPanel = function () {
    var self = this, args = arguments;
    return ensurePanel().then(function () { return _open.apply(self, args); }).catch(function (e) {
      if (typeof showToast === 'function') showToast('Admin paneli yüklenemedi: ' + e.message, 'error');
    });
  };
})();
} catch (e) { console.error("yama-23.js hatası:", e); }
