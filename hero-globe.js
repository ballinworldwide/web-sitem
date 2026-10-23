/* ===================================================================
   HERO-GLOBE.JS (v4) — aynı isimle eskisinin üzerine yaz.
   index.html'deki hero div'ini de yukarıdaki talimata göre değiştirdiysen
   (gradient + buton kaldırıldı, min-h-screen) ideal; ama onu unutsan bile
   bu script eski gradient overlay'i ve "Koleksiyonu Keşfet" butonunu
   KENDİSİ bulup kaldırıyor — tek başına çalışır.
   =================================================================== */
(function () {
  'use strict';
  console.log('[hero-globe] SÜRÜM v6 çalışıyor (ResizeObserver eklendi) — bu satırı görmüyorsan tarayıcı/CDN eski dosyayı önbellekten veriyor demektir.');

  function ensureD3(cb) {
    if (window.d3) return cb();
    const s = document.createElement('script');
    s.src = 'https://d3js.org/d3.v7.min.js';
    s.onload = cb;
    s.onerror = () => console.warn('[hero-globe] d3 yüklenemedi');
    document.head.appendChild(s);
  }

  function findHeroContainer() {
    const home = document.getElementById('page-home'); if (!home) return null;
    return [...home.children].find(el => el.classList && el.classList.contains('bg-brand-50')) || null;
  }

  function cleanupHero(hero) {
    // Eski gradient overlay'i kaldır
    hero.querySelectorAll(':scope > div.bg-gradient-to-br').forEach(el => el.remove());
    // "Koleksiyonu Keşfet" butonunu kaldır (manşet ve başlık hariç her şey gitsin)
    const btn = hero.querySelector('button[onclick*="switchPage(\'collection\')"]');
    if (btn) btn.remove();
    // Hero'yu gerçekten tam ekrana yakın yap (eski min-h-[80vh] + py-20 kalmışsa da düzelt)
    hero.classList.remove('py-20');
    hero.classList.add('min-h-screen');
  }

  function ensureCanvas() {
    const hero = findHeroContainer(); if (!hero) return null;
    cleanupHero(hero);
    let c = document.getElementById('heroGlobe');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'heroGlobe';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:1;z-index:0';
      hero.insertBefore(c, hero.firstChild);
    }
    return c;
  }

  function initHeroGlobe() {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const hero = canvas.parentElement;
    const w = hero.clientWidth, h = hero.clientHeight;
    if (w < 50 || h < 50) { setTimeout(initHeroGlobe, 300); return; }

    if (canvas.dataset.inited && canvas.dataset.w == w && canvas.dataset.h == h) return;
    canvas.dataset.inited = '1'; canvas.dataset.w = w; canvas.dataset.h = h;

    const context = canvas.getContext('2d'); if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const radius = Math.max(w, h) * 0.62;
    const projection = d3.geoOrthographic().scale(radius).translate([w / 2, h / 2]).clipAngle(90);
    const path = d3.geoPath().projection(projection).context(context);

    function pointInPolygon(point, polygon) {
      const [x, y] = point; let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    function pointInFeature(point, feature) {
      const g = feature.geometry;
      if (g.type === 'Polygon') {
        const c = g.coordinates;
        if (!pointInPolygon(point, c[0])) return false;
        for (let i = 1; i < c.length; i++) if (pointInPolygon(point, c[i])) return false;
        return true;
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) {
          if (pointInPolygon(point, poly[0])) {
            let inHole = false;
            for (let i = 1; i < poly.length; i++) if (pointInPolygon(point, poly[i])) { inHole = true; break; }
            if (!inHole) return true;
          }
        }
        return false;
      }
      return false;
    }
    function generateDots(feature, dotSpacing) {
      const dots = [], bounds = d3.geoBounds(feature);
      const [[minLng, minLat], [maxLng, maxLat]] = bounds, step = dotSpacing * 0.08;
      for (let lng = minLng; lng <= maxLng; lng += step)
        for (let lat = minLat; lat <= maxLat; lat += step)
          if (pointInFeature([lng, lat], feature)) dots.push([lng, lat]);
      return dots;
    }

    const allDots = []; let landFeatures = null;

    function render() {
      context.clearRect(0, 0, w, h);
      const scaleFactor = projection.scale() / radius;

      context.beginPath();
      context.arc(w / 2, h / 2, projection.scale(), 0, 2 * Math.PI);
      context.strokeStyle = '#212529'; context.lineWidth = 1.5 * scaleFactor; context.stroke();
      if (!landFeatures) return;

      const graticule = d3.geoGraticule();
      context.beginPath(); path(graticule());
      context.strokeStyle = '#212529'; context.lineWidth = 1 * scaleFactor; context.globalAlpha = 0.25; context.stroke(); context.globalAlpha = 1;

      context.beginPath();
      landFeatures.features.forEach(f => path(f));
      context.strokeStyle = '#212529'; context.lineWidth = 1 * scaleFactor; context.stroke();

      allDots.forEach(d => {
        const pr = projection([d.lng, d.lat]);
        if (pr && pr[0] >= 0 && pr[0] <= w && pr[1] >= 0 && pr[1] <= h) {
          context.beginPath(); context.arc(pr[0], pr[1], 1.3 * scaleFactor, 0, 2 * Math.PI);
          context.fillStyle = '#495057'; context.fill();
        }
      });
    }

    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json')
      .then(r => { if (!r.ok) throw new Error('land data'); return r.json(); })
      .then(data => {
        landFeatures = data; allDots.length = 0;
        landFeatures.features.forEach(f => generateDots(f, 16).forEach(([lng, lat]) => allDots.push({ lng, lat })));
        render();
      })
      .catch(e => console.warn('[hero-globe] veri yüklenemedi', e));

    if (!canvas.dataset.timerStarted) {
      canvas.dataset.timerStarted = '1';
      const rotation = [0, 0];
      d3.timer(() => { rotation[0] += 0.35; projection.rotate(rotation); render(); });
    }
  }

  function boot() {
    ensureD3(() => {
      const hero = findHeroContainer(); if (!hero) return;
      cleanupHero(hero);
      // ResizeObserver: hero'nun GERÇEK nihai boyutu ne zaman netleşirse (fontlar/CSS
      // yüklenip layout oturduğunda, pencere boyutu değişince, vs.) anında yeniden çizer.
      // Eski sürümdeki "yalnızca window resize'da yeniden ölç" yaklaşımı, sayfa henüz
      // tam yerleşmeden yapılan ilk (küçük) ölçümü bir daha düzeltmiyordu — küçük
      // görünmenin sebebi buydu.
      if (!hero.dataset.roSet) {
        hero.dataset.roSet = '1';
        const ro = new ResizeObserver(() => initHeroGlobe());
        ro.observe(hero);
      }
      initHeroGlobe();
      // Ekstra güvence: birkaç kare sonra ve 1sn sonra tekrar dene (font swap vb. geç tetiklenen değişimler için)
      requestAnimationFrame(() => initHeroGlobe());
      setTimeout(initHeroGlobe, 1000);
    });
  }
  const _sw = window.switchPage;
  window.switchPage = function (id) { const r = _sw.apply(this, arguments); if (id === 'home') setTimeout(boot, 50); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
