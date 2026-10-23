/* ===================================================================
   HERO-GLOBE.JS (v2) — aynı isimle eskisinin üzerine yaz.
   Değişiklik: Globe artık hero'yu TAMAMEN kaplamıyor (önceki sürüm
   muhtemelen "berbat" görünmesinin sebebiydi: açık renkli hero'nun
   üstüne oturan büyük siyah daire + buton/metnin üstünü kapatıyordu).
   Şimdi: sağ tarafta, sabit boyutlu, pointer-events:none (tıklamaları
   ASLA engellemez), metnin arkasında kalacak şekilde, yalnızca büyük
   ekranlarda (≥1024px) görünür — mobilde hero zaten dar olduğu için
   gösterilmiyor (metni ezmesin diye).
   =================================================================== */
(function () {
  'use strict';

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

  const SIZE = 420; // canvas kare boyutu (px) — masaüstünde

  function ensureCanvas() {
    const hero = findHeroContainer(); if (!hero) return null;
    let c = document.getElementById('heroGlobe');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'heroGlobe';
      c.style.cssText = 'position:absolute;right:-60px;top:50%;transform:translateY(-50%);width:' + SIZE + 'px;height:' + SIZE + 'px;pointer-events:none;opacity:.35;z-index:0;display:none';
      hero.insertBefore(c, hero.firstChild);
      // Sadece büyük ekranda göster (mobilde metni ezmesin)
      const mq = window.matchMedia('(min-width: 1024px)');
      const apply = () => { c.style.display = mq.matches ? 'block' : 'none'; };
      apply(); mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    }
    return c;
  }

  function initHeroGlobe() {
    const canvas = ensureCanvas();
    if (!canvas || canvas.dataset.inited) return;
    canvas.dataset.inited = '1';
    const context = canvas.getContext('2d'); if (!context) return;

    const w = SIZE, h = SIZE, radius = w / 2.4;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    context.scale(dpr, dpr);

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
      const [[minLng, minLat], [maxLng, maxLat]] = bounds, step = dotSpacing * 0.1; // v1'den daha seyrek (performans)
      for (let lng = minLng; lng <= maxLng; lng += step)
        for (let lat = minLat; lat <= maxLat; lat += step)
          if (pointInFeature([lng, lat], feature)) dots.push([lng, lat]);
      return dots;
    }

    const allDots = []; let landFeatures = null;

    function render() {
      context.clearRect(0, 0, w, h);
      const scaleFactor = projection.scale() / radius;
      // Dolgusuz, sadece ince çerçeve — hero'nun açık rengiyle çakışmasın
      context.beginPath();
      context.arc(w / 2, h / 2, projection.scale(), 0, 2 * Math.PI);
      context.strokeStyle = '#212529'; context.lineWidth = 1.5 * scaleFactor; context.stroke();
      if (!landFeatures) return;

      context.beginPath();
      landFeatures.features.forEach(f => path(f));
      context.strokeStyle = '#212529'; context.lineWidth = 1 * scaleFactor; context.stroke();

      allDots.forEach(d => {
        const pr = projection([d.lng, d.lat]);
        if (pr && pr[0] >= 0 && pr[0] <= w && pr[1] >= 0 && pr[1] <= h) {
          context.beginPath(); context.arc(pr[0], pr[1], 1 * scaleFactor, 0, 2 * Math.PI);
          context.fillStyle = '#495057'; context.fill();
        }
      });
    }

    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json')
      .then(r => { if (!r.ok) throw new Error('land data'); return r.json(); })
      .then(data => {
        landFeatures = data;
        landFeatures.features.forEach(f => generateDots(f, 16).forEach(([lng, lat]) => allDots.push({ lng, lat })));
        render();
      })
      .catch(e => console.warn('[hero-globe] veri yüklenemedi', e));

    const rotation = [0, 0];
    d3.timer(() => { rotation[0] += 0.35; projection.rotate(rotation); render(); });
    // Not: artık pointer-events:none olduğu için fare ile döndürme/zoom kaldırıldı —
    // dekoratif bir arka plan öğesi, kullanıcı etkileşimi hero'daki butonları engellemesin diye bilerek kapatıldı.
  }

  function boot() { ensureD3(() => setTimeout(initHeroGlobe, 50)); }
  const _sw = window.switchPage;
  window.switchPage = function (id) { const r = _sw.apply(this, arguments); if (id === 'home') setTimeout(boot, 50); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
