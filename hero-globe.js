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
  console.log('[hero-globe] SÜRÜM v8 (kicker+bar+buton tasarımı) çalışıyor.');

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
    ensureStyles();
    buildHeroContent(hero);
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

    function animate() {
      requestAnimationFrame(animate);
      group.rotation.y += 0.0022;
      group.rotation.x += 0.0006;
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const nw = hero.clientWidth, nh = hero.clientHeight;
      if (nw < 10 || nh < 10) return;
      camera.aspect = nw / nh; camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(hero);
  }

  function boot() { ensureThree(() => initHeroGlobe()); }
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
