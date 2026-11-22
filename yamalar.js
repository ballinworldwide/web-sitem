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

  /* 1) YAMA-63: ödeme sarmalayıcısı kaldırıldı (aşağıdaki processPayment profil verisini kendisi tazeliyor) */

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
      const dv = 'data-v="' + E(it.dbId) + '" data-z="' + E(it.size) + '"', a = 'this.dataset.v,this.dataset.z', b = dv + ' style="width:28px;height:28px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-weight:700"';
      const discHtml = it.oldPrice > it.price
        ? ' <span class="discTag" style="text-decoration:line-through;opacity:.5;margin-left:6px">' + tl(it.oldPrice) + ' TL</span>' +
          ' <span style="color:#dc2626;font-weight:700;margin-left:4px">(-' + tl(it.oldPrice - it.price) + ' TL)</span>'
        : '';
      return '<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="' + E(it.image) + '" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1">' +
        '<h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">' + E(it.baseName || it.name) + '</h4>' +
        '<p class="text-[11px] text-brand-400 mt-1">' + (it.size && it.size !== 'Standart' ? 'Beden: ' + E(it.size) + ' · ' : '') + tl(it.price) + ' TL' + discHtml + '</p>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button ' + b + ' onclick="cartMinus(' + a + ')">−</button><b style="min-width:18px;text-align:center">' + n + '</b><button ' + b + ' onclick="cartPlus(' + a + ')">+</button>' +
        '<span class="text-sm font-bold text-brand-900" style="margin-left:auto">' + tl((it.price || 0) * n) + ' TL</span></div></div>' +
        '<button ' + dv + ' onclick="cartRemoveGroup(' + a + ')" aria-label="Sil" class="text-brand-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>';
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
    s.src = '/vendor/three/three.min.js';   // YAMA-80: projeden servis edilir (three@0.128.0, cdnjs'teki r128 ile aynı dosya)
    s.integrity = 'sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==';   // YAMA-58: SRI (npm three@0.128.0 ve canlı cdnjs ile doğrulandı)
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
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
    if (!window.isValidPhoneTR(phone)) return showToast('Telefon numarası 0 dahil 11 haneli olmalıdır.', 'error');
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
        couponCode: named ? appliedCouponCode : '', usePoints: named ? (Math.floor(appliedPointsValue) || 0) : 0, consents: { terms: true, kvkk: true },
        ...(named && window.__payStaff === true ? { payOnline: true } : {}) };   // YAMA-73: yalnız yönetici rolü, test ödeme akışı
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
      if (r.status === 400 && j.error === 'payment_disabled' && payload.payOnline) {   // YAMA-73: online ödeme kapalıysa yönetici de normal akışla sipariş verir
        window.__payStaff = false; reqId = null; lastSig = ''; btn.disabled = false; btn.innerText = 'Ödemeyi Tamamla'; return window.processPayment();
      }
      if (r.status >= 400 && r.status < 500) { reqId = null; lastSig = ''; }   // YAMA-62: sunucu reddettiyse sipariş oluşmadı; sonraki deneme yeni istek no ile
      if (!r.ok || !j.orderId) throw new Error(j.message || ('Sipariş oluşturulamadı (' + r.status + ')'));

      reqId = null; lastSig = '';
      if (j.pending && typeof window.__testPay === 'function') {   // YAMA-73: ödeme bekleniyor → test ödeme penceresi (sepet ödeme sonucunda temizlenir)
        btn.disabled = false; btn.innerText = 'Ödemeyi Tamamla';
        return window.__testPay(j.orderId, j.total, j.holdUntil);
      }
      // YAMA-61: onay maili yalnız sipariş Worker'ından gider (istemciden ikinci çağrı kaldırıldı)
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

/* ---------- yama-70: Hesabım > Kayıtlı Adreslerim (en fazla 3) ---------- */
try {
(function () {
  'use strict';
  var MAX_EXTRA = 2;            // 1. adres profil formundaki adres; ek olarak en fazla 2 adres
  var editIdx = -1;             // -1: yeni, >=0: düzenlenen ek adres
  var extras = [];              // sunucudaki ek adresler (users/{uid}.extraAddresses)
  var has1 = false;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return escHtml(s); }
  function summary(a) { return esc(a.address) + '<br><span class="text-brand-600">' + esc(a.district) + ' / ' + esc(a.city) + '</span>'; }

  function render() {
    var box = $('addrList'); if (!box) return;
    var u = (typeof userData !== 'undefined' && userData) || {};
    has1 = !!(u.address && u.city);
    var h = '';
    if (has1) {
      h += '<div class="bg-white border border-brand-200 rounded-2xl p-4 text-sm"><div class="font-bold text-xs mb-1">Adres 1 <span class="font-normal text-brand-600">· yukarıdaki formdan düzenlenir</span></div>' +
        summary({ address: u.address, district: u.district || '', city: u.city }) + '</div>';
    }
    extras.forEach(function (a, i) {
      h += '<div class="bg-white border border-brand-200 rounded-2xl p-4 text-sm"><div class="font-bold text-xs mb-1">Adres ' + (i + 2) + (a.title ? ' · ' + esc(a.title) : '') + '</div>' + summary(a) +
        '<div class="flex flex-wrap gap-2 mt-3"><button type="button" data-addr-edit="' + i + '" class="border border-brand-300 text-brand-700 px-4 py-2 rounded-lg text-xs font-medium">Düzenle</button>' +
        '<button type="button" data-addr-del="' + i + '" class="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-medium">Sil</button></div></div>';
    });
    box.innerHTML = h;
    var add = $('addrAddBtn'), hint = $('addrHint'), form = $('addrForm');
    var total = (has1 ? 1 : 0) + extras.length;
    if (!has1) { add.classList.add('hidden'); hint.textContent = 'Önce yukarıdaki formdan 1. adresinizi kaydedin; ardından buradan yeni adres ekleyebilirsiniz.'; hint.classList.remove('hidden'); }
    else if (extras.length >= MAX_EXTRA) { add.classList.add('hidden'); hint.textContent = '3 adres sınırına ulaştınız. Yeni adres eklemek için bir adresi silin.'; hint.classList.remove('hidden'); }
    else { add.textContent = '+ Adres ' + (total + 1) + ' Ekle'; add.classList.toggle('hidden', !form.classList.contains('hidden')); hint.classList.add('hidden'); }
  }

  function openForm(i) {
    editIdx = i;
    var a = i >= 0 ? extras[i] : { title: '', city: '', district: '', address: '' };
    var c = $('addrCity');
    if (!c.options.length) {
      c.innerHTML = '<option value="">İl Seçiniz</option>' + Object.keys(TURKEY_LOCATIONS).sort(function (x, y) { return x.localeCompare(y, 'tr'); }).map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
      c.addEventListener('change', function () { populateDistricts('addrCity', 'addrDistrict'); });
    }
    $('addrTitle').value = a.title || ''; c.value = a.city || ''; populateDistricts('addrCity', 'addrDistrict');
    $('addrDistrict').value = a.district || ''; $('addrText').value = a.address || '';
    $('addrForm').classList.remove('hidden'); $('addrAddBtn').classList.add('hidden');
    $('addrForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function closeForm() { $('addrForm').classList.add('hidden'); editIdx = -1; render(); }

  async function persist(list, okMsg) {
    if (!currentUser || currentUser.isAnonymous) return false;
    try {
      await db.collection('users').doc(currentUser.uid).set({ extraAddresses: list }, { merge: true });
      extras = list; if (userData) userData.extraAddresses = list;
      if (okMsg) showToast(okMsg, 'success'); return true;
    } catch (e) { showToast('Adres kaydedilemedi: ' + (e && e.message || e), 'error'); return false; }
  }

  async function save() {
    var a = { title: $('addrTitle').value.trim().slice(0, 30), city: $('addrCity').value, district: $('addrDistrict').value, address: $('addrText').value.trim().slice(0, 300) };
    if (!a.city || !TURKEY_LOCATIONS[a.city]) { showToast('Lütfen il seçin.', 'error'); return; }
    if (!a.district || TURKEY_LOCATIONS[a.city].indexOf(a.district) < 0) { showToast('Lütfen ilçe seçin.', 'error'); return; }
    if (a.address.length < 10) { showToast('Açık adres en az 10 karakter olmalıdır.', 'error'); return; }
    var list = extras.slice();
    if (editIdx >= 0) list[editIdx] = a; else { if (list.length >= MAX_EXTRA) { showToast('En fazla 3 adres kaydedebilirsiniz.', 'error'); return; } list.push(a); }
    $('addrSaveBtn').disabled = true;
    var ok = await persist(list, 'Adres kaydedildi.');
    $('addrSaveBtn').disabled = false;
    if (ok) closeForm();
  }

  function init() {
    var book = $('addrBook'); if (!book || book.dataset.ready) return; book.dataset.ready = '1';
    $('addrAddBtn').addEventListener('click', function () { openForm(-1); });
    $('addrCancelBtn').addEventListener('click', closeForm);
    $('addrSaveBtn').addEventListener('click', save);
    $('addrList').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-addr-edit')) openForm(parseInt(b.getAttribute('data-addr-edit'), 10));
      else if (b.hasAttribute('data-addr-del')) {
        var i = parseInt(b.getAttribute('data-addr-del'), 10);
        if (!confirm('Bu adres silinsin mi?')) return;
        var list = extras.slice(); list.splice(i, 1); persist(list, 'Adres silindi.').then(render);
      }
    });
  }

  // Profil okunduğunda (loadProfileData → readUserDoc) listeyi güncelle
  var _read = window.readUserDoc;
  if (typeof _read === 'function') {
    window.readUserDoc = function () {
      return _read.apply(this, arguments).then(function (doc) {
        try { var d = doc && doc.exists ? doc.data() : {}; extras = Array.isArray(d.extraAddresses) ? d.extraAddresses.slice(0, MAX_EXTRA) : []; init(); setTimeout(render, 0); } catch (e) {}
        return doc;
      });
    };
  }
  // 1. adres "Güncelle" ile kaydedilince "Adres 1" kartı ve Ekle düğmesi yenilensin
  var _save = window.saveProfile;
  if (typeof _save === 'function') window.saveProfile = async function () {
    var r = await _save.apply(this, arguments);
    try { if (currentUser) _read(currentUser.uid).then(function (doc) { if (doc && doc.exists) userData = doc.data(); render(); }).catch(function () {}); } catch (e) {}
    return r;
  };
  // Çıkışta liste ekranda kalmasın
  var _clr = window.clearAccountUI;
  if (typeof _clr === 'function') window.clearAccountUI = function () { extras = []; editIdx = -1; try { $('addrForm').classList.add('hidden'); } catch (e) {} var r = _clr.apply(this, arguments); render(); return r; };
  init();
})();
} catch (e) { console.error("yama-70 hatası:", e); }

/* ---------- yama-71: Ödeme sayfasında kayıtlı adres seçme ---------- */
try {
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var list = [];   // [{label, city, district, address}]
  function build() {
    var u = (typeof userData !== 'undefined' && userData) || {};
    list = [];
    if (u.address && u.city) list.push({ title: '', city: u.city, district: u.district || '', address: u.address });
    (Array.isArray(u.extraAddresses) ? u.extraAddresses : []).forEach(function (a) { if (a && a.address && a.city) list.push(a); });
    var wrap = $('checkoutAddrPickWrap'), sel = $('checkoutAddrPick'); if (!wrap || !sel) return;
    var named = typeof currentUser !== 'undefined' && currentUser && !currentUser.isAnonymous;
    if (!named || list.length < 2) { wrap.classList.add('hidden'); return; }   // tek adres zaten forma doldurulur
    var prev = sel.value;
    sel.innerHTML = '<option value="">Adres seçin…</option>' + list.map(function (a, i) {
      return '<option value="' + i + '">Adres ' + (i + 1) + (a.title ? ' · ' + escHtml(a.title) : '') + ' — ' + escHtml(a.district) + ' / ' + escHtml(a.city) + '</option>';
    }).join('');
    sel.value = (prev && list[parseInt(prev, 10)]) ? prev : '0';
    wrap.classList.remove('hidden');
  }
  function apply() {
    var a = list[parseInt($('checkoutAddrPick').value, 10)]; if (!a) return;
    $('checkoutCity').value = a.city; populateDistricts('checkoutCity', 'checkoutDistrict');
    $('checkoutDistrict').value = a.district || ''; $('checkoutAddress').value = a.address;
  }
  var sel = $('checkoutAddrPick'); if (sel) sel.addEventListener('change', apply);
  var _clr = window.clearAccountUI;   // çıkışta başka kullanıcıya adres görünmesin
  if (typeof _clr === 'function') window.clearAccountUI = function () { list = []; var w = $('checkoutAddrPickWrap'); if (w) w.classList.add('hidden'); return _clr.apply(this, arguments); };
  var _read = window.readUserDoc;
  if (typeof _read === 'function') window.readUserDoc = function () {
    return _read.apply(this, arguments).then(function (doc) { setTimeout(build, 50); return doc; });
  };
})();
} catch (e) { console.error("yama-71 hatası:", e); }

/* ---------- yama-73: test ödeme penceresi (sağlayıcı bağlanana kadar; YALNIZ yönetici rolü) ---------- */
try {
(function () {
  'use strict';
  var BASE = 'https://ballin-order.ballinworldw.workers.dev';
  var timer = null;
  function $(id) { return document.getElementById(id); }
  window.__payStaff = false;
  // yönetici mi? (sahip hesap veya staff koleksiyonunda rol = yonetici). Sunucu yine kendi doğrular.
  firebase.auth().onAuthStateChanged(function (u) {
    window.__payStaff = false;
    if (!u || u.isAnonymous || !u.email || !u.emailVerified) return;
    var em = u.email.toLowerCase();
    function set(v) { if (v && window.__payStaff !== true) { window.__payStaff = true; try { if (typeof loadUserOrders === 'function') loadUserOrders(); } catch (e) {} } }
    if (em === String(ADMIN_EMAIL).toLowerCase()) return set(true);
    db.collection('staff').doc(em).get().then(function (d) { set(d.exists && d.data().role === 'yonetici'); }).catch(function () {});
  });
  async function call(path, orderId) {
    var u = firebase.auth().currentUser; if (!u) throw new Error('Oturum bulunamadı.');
    var idToken = await u.getIdToken(), ac = ''; try { ac = (await firebase.appCheck().getToken()).token; } catch (e) {}
    var r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken, 'X-Firebase-AppCheck': ac }, body: JSON.stringify({ orderId: orderId }) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var er = new Error(j.message || ('İşlem yapılamadı (' + r.status + ')')); er.code = j.error; throw er; }
    return j;
  }
  function clearCartAfterOrder() {
    try {
      cart = []; appliedDiscountRate = 0; appliedCouponCode = ''; appliedPointsValue = 0;
      localStorage.removeItem('ballin_cart'); updateCartBadge(); syncCartToFirebase();
      var pi = $('promoDiscountInfo'); if (pi) pi.style.display = 'none';
    } catch (e) {}
  }
  function close() { if (timer) { clearInterval(timer); timer = null; } var m = $('testPayModal'); if (m) m.remove(); }
  function goOrders() { try { switchPage('profile'); loadUserOrders(); loadProfileData(); loadProducts(); } catch (e) {} }
  function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  // fromCart: sipariş az önce sepetten verildi (sepet temizlenir); Hesabım'dan açıldıysa sepete dokunulmaz
  window.__testPay = function (orderId, total, holdUntil, fromHesabim) {
    close();
    var fromCart = !fromHesabim;
    var tl = (Number(total) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var m = document.createElement('div'); m.id = 'testPayModal';
    m.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm';
    m.innerHTML = '<div class="bg-white rounded-3xl w-[90%] max-w-md p-6 shadow-2xl">' +
      '<h3 class="font-serif text-xl font-bold mb-1 text-brand-900"><i class="fa-solid fa-lock mr-2 text-amber-500"></i>Güvenli Ödeme</h3>' +
      '<p class="text-xs bg-amber-50 rounded-xl p-3 mb-4" style="border:1px solid #fde68a;color:#92400e">TEST MODU: Ödeme sağlayıcısı henüz bağlı değil. Bu ekran yalnız yönetici hesaplarında görünür; kart bilgisi alınmaz.</p>' +
      '<div class="flex justify-between text-sm mb-1"><span class="text-brand-500">Sipariş no</span><span class="font-bold text-brand-900" style="font-family:monospace" id="tpNo"></span></div>' +
      '<div class="flex justify-between text-sm mb-1"><span class="text-brand-500">Tutar</span><span class="font-bold text-brand-900">' + tl + ' TL</span></div>' +
      '<div class="flex justify-between text-sm mb-4"><span class="text-brand-500">Kalan süre</span><span class="font-bold text-amber-600" id="tpLeft">--:--</span></div>' +
      '<button id="tpOk" class="w-full bg-brand-900 text-white py-3 rounded-xl font-medium hover:bg-brand-800 mb-2">Ödemeyi Onayla (Test)</button>' +
      '<button id="tpFail" class="w-full border border-red-200 text-red-600 py-3 rounded-xl font-medium hover:bg-red-50 mb-2">Ödeme Başarısız (Test)</button>' +
      '<button id="tpLater" class="w-full text-xs text-brand-500 underline py-2">Sonra öde (Hesabım\'da bekler)</button></div>';
    document.body.appendChild(m);
    $('tpNo').textContent = String(orderId).slice(0, 10).toUpperCase();
    var busy = false, expired = false;
    function lock(v) { busy = v; ['tpOk', 'tpFail'].forEach(function (id) { if ($(id)) $(id).disabled = v || expired; }); }
    function tick() {
      var left = Number(holdUntil) - Date.now(), el = $('tpLeft'); if (!el) return;
      if (left <= 0) { expired = true; el.textContent = 'Süre doldu'; lock(busy); } else el.textContent = mmss(left);
    }
    tick(); timer = setInterval(tick, 1000);
    $('tpOk').onclick = async function () {
      if (busy || expired) return; lock(true);
      try {
        await call('/payment/test-complete', orderId);
        close(); if (fromCart) clearCartAfterOrder();
        goOrders();   // arkada Hesabım açılır; fiş pop-up'ı (yama-75) üstüne gelir
        if (typeof window.__showReceipt === 'function') window.__showReceipt(orderId);
        else showToast('Ödeme alındı! Siparişiniz hazırlanıyor.', 'success');
      } catch (e) {
        showToast(e.message || 'Ödeme onaylanamadı.', 'error');
        if (e.code === 'expired' || e.code === 'state') { close(); if (fromCart) clearCartAfterOrder(); goOrders(); } else lock(false);
      }
    };
    $('tpFail').onclick = async function () {
      if (busy) return; lock(true);
      try {
        await call('/cancel', orderId);
        close(); showToast('Ödeme başarısız. Sipariş iptal edildi' + (fromCart ? ', sepetiniz korundu.' : '.'), 'error');
        if (!fromCart) goOrders();
      } catch (e) { showToast(e.message || 'İşlem yapılamadı.', 'error'); lock(false); }
    };
    $('tpLater').onclick = function () { close(); if (fromCart) clearCartAfterOrder(); showToast('Sipariş ödeme bekliyor. Hesabım sayfasından tamamlayabilirsiniz.', 'success'); goOrders(); };
  };
})();
} catch (e) { console.error("yama-73 hatası:", e); }

/* ---------- yama-75: sipariş fişi pop-up (ödeme onaylanınca; fiş yazıcıdan çıkar, koparılır) ---------- */
try {
(function () {
  'use strict';
  var ac = null, noiseBuf = null, soundOn = true, motor = null;
  function audio() {
    if (!soundOn) return null;
    try {
      if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C();
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function burst(freq, dur, gain, type, q) {
    var a = audio(); if (!a) return;
    try {
      var s = a.createBufferSource(); s.buffer = noiseBuf;
      var f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.2;
      var g = a.createGain(), t = a.currentTime;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(a.destination); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function motorOn() {
    var a = audio(); if (!a || motor) return;
    try {
      var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), t = a.currentTime, lp = a.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 62; o2.type = 'square'; o2.frequency.value = 124;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.12); lp.type = 'lowpass'; lp.frequency.value = 420;
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(a.destination); o.start(); o2.start();
      motor = { o: o, o2: o2, g: g };
    } catch (e) { motor = null; }
  }
  function motorOff() {
    if (!motor || !ac) { motor = null; return; }
    try { var t = ac.currentTime; motor.g.gain.cancelScheduledValues(t); motor.g.gain.setValueAtTime(motor.g.gain.value || 0.01, t); motor.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      motor.o.stop(t + 0.18); motor.o2.stop(t + 0.18); } catch (e) {}
    motor = null;
  }
  function esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tl(n) { return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function bars(code) {
    var h = '', seed = 0, i, w;
    for (i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
    for (i = 0; i < 46; i++) { seed = (seed * 1103515245 + 12345) >>> 0; w = 1 + ((seed >>> 16) % 3); h += '<i style="width:' + w + 'px;margin-right:' + (1 + ((seed >>> 20) % 2)) + 'px"></i>'; }
    return '<div class="rp-bars">' + h + '</div>';
  }
  // o: Firestore sipariş belgesi (items, subtotal, discountRate, usedPoints, shippingFee, totalAmount)
  function receiptHTML(orderId, o) {
    var g = {}, order = [], rows = '', sub = 0;
    (o.items || []).forEach(function (it) {
      var sz = String(it.size || 'Standart'), nm = String(it.name), suf = ' (' + sz + ')';
      if (nm.toLowerCase().slice(-suf.length) === suf.toLowerCase()) nm = nm.slice(0, -suf.length);   // ürün adı sonuna eklenen "(S)" beden eki tekrar yazılmasın
      var k = nm + '|' + sz;
      if (!g[k]) { g[k] = { name: nm, size: sz, qty: 0, price: Number(it.price) || 0 }; order.push(k); }
      g[k].qty++;
    });
    order.forEach(function (k) { var x = g[k], line = x.price * x.qty; sub += line;
      rows += '<div class="rp-it"><div class="rp-row"><span>' + x.qty + 'x ' + esc(x.name) + '</span><span>' + tl(line) + '</span></div><div class="rp-sz">Beden: ' + esc(x.size) + '</div></div>'; });
    var subtotal = Number(o.subtotal) > 0 ? Number(o.subtotal) : sub, rate = Number(o.discountRate), disc = (rate > 0 && rate < 1) ? subtotal * (1 - rate) : subtotal;
    var d = new Date(), pad = function (x) { return String(x).padStart(2, '0'); };
    var stamp = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + '  ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    var no = String(orderId).slice(0, 10).toUpperCase();
    var extra = '';
    if (rate > 0 && rate < 1) extra += '<div class="rp-row"><span>İndirim</span><span>-' + tl(subtotal - disc) + '</span></div>';
    if (Number(o.usedPoints) > 0) extra += '<div class="rp-row"><span>Puan</span><span>-' + tl(o.usedPoints) + '</span></div>';
    return '<div class="rp-rcpt"><div class="rp-logo">BALLIN</div><div class="rp-sub">WORLDWIDE</div>' +
      '<div class="rp-row"><span>Tarih</span><span>' + stamp + '</span></div><div class="rp-row"><span>Sipariş</span><span>#' + esc(no) + '</span></div><hr>' + rows + '<hr>' +
      '<div class="rp-row"><span>Ara toplam</span><span>' + tl(subtotal) + '</span></div>' + extra +
      '<div class="rp-row"><span>Kargo</span><span>' + (Number(o.shippingFee) ? tl(o.shippingFee) : 'ÜCRETSİZ') + '</span></div>' +
      '<div class="rp-row rp-tot"><span>TOPLAM</span><span>' + tl(o.totalAmount) + ' TL</span></div><hr>' +
      '<div class="rp-ok">✔ ÖDEME ALINDI</div><div class="rp-thx">Siparişin hazırlanıyor.<br>Teşekkürler!</div>' + bars(no) +
      '<div class="rp-no">' + esc(no) + '</div><div class="rp-thx">ballinworldwide.net</div></div>';
  }

  var open = null;   // aynı anda tek pop-up
  window.__showReceipt = async function (orderId, onGoShop) {
    if (open) open.close(true);
    var o = null;
    try { var d = await db.collection('orders').doc(orderId).get(); if (d.exists) o = d.data(); } catch (e) {}
    if (!o) o = { items: [], totalAmount: 0 };
    var root = document.createElement('div'); root.className = 'rp-overlay open'; root.setAttribute('aria-hidden', 'false');
    root.innerHTML = '<div class="rp-card" role="dialog" aria-modal="true" aria-label="Sipariş fişi">' +
      '<button class="rp-x" type="button" aria-label="Kapat">✕</button>' +
      '<div class="rp-head"><div class="rp-ok">✔ Ödeme alındı</div><div class="rp-sub2">Siparişin hazırlanıyor</div></div>' +
      '<div class="rpstage"><div class="rp-paperLayer"><div class="rp-strip"><div class="rp-sheet"></div></div></div>' +
      '<div class="rp-body"><div class="rp-brand">BALLIN · RECEIPT</div><div class="rp-slot"></div><div class="rp-led"><b></b><span class="rp-ledTxt">Hazır</span></div>' +
      '<button class="rp-snd" type="button" aria-label="Ses aç/kapat">🔊</button><div class="rp-vents"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<button class="rp-print" type="button" aria-label="Fiş yazdır">PRINT<small class="rp-pLabel">YAZDIR</small></button></div><div class="rp-lip"></div></div>' +
      '<div class="rphint" style="opacity:0">Fişi tutup yukarı çek, kopar ↑</div>' +
      '<div class="rp-acts"><button class="rp-btn pri" type="button" data-a="orders">Siparişlerime Git</button><button class="rp-btn sec" type="button" data-a="shop">Alışverişe Devam Et</button></div></div><div class="rptoast"></div>';
    document.body.appendChild(root); document.body.classList.add('rp-lock');
    var q = function (s) { return root.querySelector(s); };
    var stage = q('.rpstage'), strip = q('.rp-strip'), sheet = q('.rp-sheet'), layer = q('.rp-paperLayer'), btn = q('.rp-print'), led = q('.rp-led'), ledTxt = q('.rp-ledTxt'),
      snd = q('.rp-snd'), hint = q('.rphint'), pLabel = q('.rp-pLabel');
    var STEP = 14, cap = 520, state = 'idle', off = 0, p = 0, H = 0, timer = null, drag = null, TEAR_AT = 72, closed = false;
    function fit() {
      var sh = Math.max(470, Math.min(740, window.innerHeight - 170));
      stage.style.setProperty('--sh', sh + 'px'); cap = Math.max(240, sh - 236 - 18 - 22);
    }
    fit(); window.addEventListener('resize', fit);
    function setState(s) {
      state = s;
      led.className = 'rp-led' + (s === 'printing' ? ' busy' : (s === 'stopped' || s === 'full') ? ' stop' : '');
      ledTxt.textContent = s === 'printing' ? 'Yazdırıyor' : s === 'stopped' ? 'Durdu' : s === 'full' ? 'Kopar' : 'Hazır';
      pLabel.textContent = s === 'printing' ? 'DURDUR' : (s === 'stopped' || s === 'full') ? 'DEVAM' : 'YAZDIR';
    }
    function addReceipt() { var tmp = document.createElement('div'); tmp.innerHTML = receiptHTML(orderId, o); sheet.appendChild(tmp.firstChild); H = sheet.offsetHeight; }
    function tick() {
      if (state !== 'printing' || closed) return;
      if (off + p >= H) { finish(p >= cap - STEP ? 'Kağıt dolu, fişi kopar' : ''); return; }
      if (p >= cap) { clearTimeout(timer); timer = null; motorOff(); setState('full'); burst(900, 0.08, 0.06, 'lowpass', .8); toast('Fişi kopar, kalan kısmı yazılmaya devam eder'); return; }
      p = Math.min(p + STEP, cap, H - off); strip.style.height = p + 'px'; burst(2200, 0.03, 0.05, 'bandpass', 2);
      hint.style.opacity = p > 60 ? 1 : 0; timer = setTimeout(tick, 52 + Math.random() * 22);
    }
    function finish(msg) { clearTimeout(timer); timer = null; motorOff(); setState('idle'); burst(900, 0.08, 0.06, 'lowpass', .8); if (msg) toast(msg); }
    function start() { motorOn(); setState('printing'); clearTimeout(timer); tick(); }
    var toastEl = q('.rptoast'), toastT = null;
    function toast(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2000); }
    btn.addEventListener('click', function () {
      audio();
      if (state === 'printing') { clearTimeout(timer); timer = null; motorOff(); setState('stopped'); burst(700, 0.06, 0.05, 'lowpass', .8); return; }
      if (state === 'full' && p >= cap) { toast('Önce fişi kopar, kalan kısmı yazılsın'); return; }
      if (off + p >= H) addReceipt();
      start();
    });
    snd.addEventListener('click', function () { soundOn = !soundOn; snd.textContent = soundOn ? '🔊' : '🔇'; snd.classList.toggle('off', !soundOn); if (!soundOn) motorOff(); else audio(); });
    strip.addEventListener('pointerdown', function (e) {
      if (p < 40) return; audio();
      drag = { y: e.clientY, dy: 0 }; strip.classList.add('dragging'); strip.classList.remove('spring');
      try { strip.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    });
    strip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dy = Math.max(0, drag.y - e.clientY); drag.dy = dy;
      strip.style.transform = 'translateY(' + (-Math.min(dy, TEAR_AT * 1.6) * 0.6) + 'px) rotate(' + (Math.min(dy, TEAR_AT) / TEAR_AT * -1.2) + 'deg)';
      if (dy > 8 && Math.random() < .35) burst(3000, 0.02, 0.025, 'highpass', .7);
      if (dy >= TEAR_AT) { var dd = drag; drag = null; strip.classList.remove('dragging'); tear(dd.dy); }
    });
    function endDrag() { if (!drag) return; drag = null; strip.classList.remove('dragging'); strip.classList.add('spring'); strip.style.transform = 'translateY(0) rotate(0)'; }
    strip.addEventListener('pointerup', endDrag); strip.addEventListener('pointercancel', endDrag);
    function tear(dy) {
      var h = p, piece = document.createElement('div'); piece.className = 'rp-torn';
      var inner = strip.cloneNode(true); inner.style.cssText = 'position:relative;height:' + h + 'px;overflow:hidden;transform:none'; inner.className = 'rp-strip'; piece.appendChild(inner);
      piece.style.bottom = (Math.min(dy, TEAR_AT * 1.6) * 0.6) + 'px'; piece.style.height = h + 'px';
      piece.style.setProperty('--tx', (Math.random() * 80 - 20) + 'px'); piece.style.setProperty('--rot', (Math.random() * 16 - 4) + 'deg');
      layer.appendChild(piece);
      burst(1800, 0.22, 0.11, 'highpass', .6); setTimeout(function () { burst(1200, 0.12, 0.07, 'highpass', .6); }, 70);
      requestAnimationFrame(function () { piece.classList.add('go'); }); setTimeout(function () { piece.remove(); }, 1350);
      off += h; p = 0; strip.style.transition = 'none'; strip.style.height = '0px'; strip.style.transform = 'translateY(0) rotate(0)';
      sheet.style.transform = 'translateY(' + (-off) + 'px)'; requestAnimationFrame(function () { strip.style.transition = ''; });
      hint.style.opacity = 0;
      if (state === 'printing') { clearTimeout(timer); tick(); } else if (state === 'full') { start(); }
      toast('Fiş koparıldı ✂');
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close(silent) {
      if (closed) return; closed = true; clearTimeout(timer); motorOff();
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', fit);
      root.remove(); document.body.classList.remove('rp-lock'); open = null;
    }
    q('.rp-x').addEventListener('click', function () { close(); });
    root.addEventListener('pointerdown', function (e) { if (e.target === root) close(); });                // pop-up dışına tıklama
    root.querySelector('[data-a="orders"]').addEventListener('click', function () { close(); try { switchPage('profile'); loadUserOrders(); } catch (e) {} });
    root.querySelector('[data-a="shop"]').addEventListener('click', function () { close(); try { switchPage('home'); } catch (e) {} });
    document.addEventListener('keydown', onKey);
    open = { close: close };
    setState('idle'); q('.rp-x').focus();
    setTimeout(function () { if (!closed && state === 'idle') { addReceipt(); start(); } }, 550);   // fiş kendiliğinden yazılmaya başlar
  };
})();
} catch (e) { console.error("yama-75 hatası:", e); }
