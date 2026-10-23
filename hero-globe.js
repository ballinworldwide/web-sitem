/* ===================================================================
   HERO-GLOBE.JS (v7) — AYNI isimle eskisinin üzerine yaz.
   Önceki D3/GeoJSON tabanlı "noktalı dünya" tamamen terk edildi.
   Bunun yerine: three.js ile basit, siyah temalı, tel kafes (wireframe)
   döner küre. Dışarıdan harita verisi çekmiyor (fetch yok), bu yüzden
   önceki boyut/yükleme sorunlarının çoğu kökünden kalkıyor.
   Hero'nun arka planını ve metin renklerini de siyah temaya çeviriyor.
   =================================================================== */
(function () {
  'use strict';
  console.log('[hero-globe] SÜRÜM v7 (three.js, siyah tema) çalışıyor.');

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
    // Önce bg-brand-50 class'ıyla ara (orijinal yapı); bulunamazsa #page-home'un
    // ilk DIV çocuğunu kullan (class'lar elle değiştirilmiş olsa bile çalışsın diye).
    return [...home.children].find(el => el.classList && el.classList.contains('bg-brand-50'))
      || [...home.children].find(el => el.tagName === 'DIV')
      || null;
  }

  function cleanupHero(hero) {
    hero.querySelectorAll(':scope > div.bg-gradient-to-br').forEach(el => el.remove());
    const btn = hero.querySelector('button[onclick*="switchPage(\'collection\')"]');
    if (btn) btn.remove();
    hero.classList.remove('py-20', 'bg-brand-50');
    hero.classList.add('min-h-screen');
    hero.style.background = '#05050a';
    const h1 = hero.querySelector('h1'), p = hero.querySelector('p');
    if (h1) { h1.style.color = '#ffffff'; }
    if (p) { p.style.color = 'rgba(255,255,255,.65)'; }
  }

  function initHeroGlobe() {
    const hero = findHeroContainer(); if (!hero) return;
    cleanupHero(hero);
    if (hero.dataset.threeInited) return; // tek seferlik kurulum — WebGL context'i tekrar yaratmayalım
    const w = hero.clientWidth, h = hero.clientHeight;
    if (w < 50 || h < 50) { setTimeout(initHeroGlobe, 300); return; } // hero henüz layout almamış olabilir
    hero.dataset.threeInited = '1';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    hero.insertBefore(renderer.domElement, hero.firstChild);

    const group = new THREE.Group();
    scene.add(group);

    // Ana tel kafes küre
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 })
    );
    group.add(sphere);

    // İkinci, biraz daha büyük ve daha soluk bir küre (derinlik hissi için)
    const sphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06 })
    );
    group.add(sphere2);

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
  window.switchPage = function (id) { const r = _sw.apply(this, arguments); if (id === 'home') setTimeout(boot, 50); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
