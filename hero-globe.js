/* ===================================================================
   HERO-GLOBE.JS (DÜZELTİLMİŞ) — index.html'de script.bundle.js'ten
   SONRA tek bir satırla ekle, başka HİÇBİR HTML değişikliği GEREKMEZ:
      <script src="hero-globe.js"></script>
   Bu sürüm d3'ü kendi yüklüyor ve canvas'ı "Ana Sayfa" hero bölümüne
   (bg-brand-50 class'lı kutuya) kendisi ekliyor.
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

  function ensureCanvas() {
    const hero = findHeroContainer(); if (!hero) return null;
    let c = document.getElementById('heroGlobe');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'heroGlobe';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;opacity:.9';
      hero.insertBefore(c, hero.firstChild);
    }
    return c;
  }

  function initHeroGlobe() {
    const canvas = ensureCanvas();
    if (!canvas || canvas.dataset.inited) return;
    const hero = canvas.parentElement;
    const w = hero.clientWidth || 800, h = hero.clientHeight || 500;
    if (w < 50 || h < 50) { setTimeout(initHeroGlobe, 300); return; } // hero henüz layout almamış olabilir
    canvas.dataset.inited = '1';
    const context = canvas.getContext('2d'); if (!context) return;

    const radius = Math.min(w, h) / 2.5;
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
      context.fillStyle = '#0b0b0c'; context.fill();
      context.strokeStyle = '#ffffff'; context.lineWidth = 2 * scaleFactor; context.stroke();
      if (!landFeatures) return;

      const graticule = d3.geoGraticule();
      context.beginPath(); path(graticule());
      context.strokeStyle = '#ffffff'; context.lineWidth = 1 * scaleFactor; context.globalAlpha = 0.2; context.stroke(); context.globalAlpha = 1;

      context.beginPath();
      landFeatures.features.forEach(f => path(f));
      context.strokeStyle = '#ffffff'; context.lineWidth = 1 * scaleFactor; context.stroke();

      allDots.forEach(d => {
        const pr = projection([d.lng, d.lat]);
        if (pr && pr[0] >= 0 && pr[0] <= w && pr[1] >= 0 && pr[1] <= h) {
          context.beginPath(); context.arc(pr[0], pr[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
          context.fillStyle = '#d4d4d8'; context.fill();
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

    const rotation = [0, 0]; let autoRotate = true;
    d3.timer(() => { if (autoRotate) { rotation[0] += 0.5; projection.rotate(rotation); render(); } });

    canvas.addEventListener('mousedown', ev => {
      autoRotate = false;
      const startX = ev.clientX, startY = ev.clientY, start = [...rotation];
      function move(me) {
        rotation[0] = start[0] + (me.clientX - startX) * 0.5;
        rotation[1] = Math.max(-90, Math.min(90, start[1] - (me.clientY - startY) * 0.5));
        projection.rotate(rotation); render();
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        setTimeout(() => { autoRotate = true; }, 10);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      const f = ev.deltaY > 0 ? 0.9 : 1.1;
      projection.scale(Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * f)));
      render();
    }, { passive: false });
  }

  function boot() { ensureD3(() => setTimeout(initHeroGlobe, 50)); }
  const _sw = window.switchPage;
  window.switchPage = function (id) { const r = _sw.apply(this, arguments); if (id === 'home') setTimeout(boot, 50); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
