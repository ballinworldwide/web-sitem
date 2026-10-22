/* ===================================================================
   HERO-GLOBE.JS — index.html'de script.bundle.js'ten SONRA yükle.
   ÖNEMLİ: Bu, paylaştığın React/shadcn bileşeninin (RotatingEarth)
   vanilla JS + D3 çevirisidir. Projen Next.js/React/shadcn değil, düz
   HTML/JS olduğu için ".tsx" dosyasını olduğu gibi kopyalayamayız;
   aynı görsel mantığı (noktalı/halftone dünya, fare ile döndürme,
   scroll ile zoom) canvas üzerinde yeniden kuruldu.

   index.html'de yapman gerekenler:
   1) <head> içine (tailwind.css'ten sonra, fark etmez):
      <script src="https://d3js.org/d3.v7.min.js"></script>
   2) #page-home içindeki hero div'ine (h1/p/button'un olduğu kısım),
      arka plan olarak eklemek için şu satırı ekle:
      <canvas id="heroGlobe" style="position:absolute;inset:0;margin:auto;max-width:100%"></canvas>
      (hero div'i zaten position:relative, overflow:hidden olduğu için
      canvas'ı metnin arkasına koymak için z-index: metin bloğuna
      "relative z-10" eklemen yeterli — mevcut hero'da zaten var.)
   3) Bu dosyayı en sona, diğer script etiketlerinden sonra ekle.

   Not: Veri raw.githubusercontent.com'dan çekiliyor; _headers'ta CSP
   yok şu an, o yüzden sorun çıkarmaz. İleride CSP eklersen bu domaini
   connect-src'ye eklemeyi unutma.
   =================================================================== */
(function () {
  'use strict';
  function initHeroGlobe() {
    const canvas = document.getElementById('heroGlobe');
    if (!canvas || !window.d3 || canvas.dataset.inited) return;
    canvas.dataset.inited = '1';
    const context = canvas.getContext('2d');
    if (!context) return;

    const parent = canvas.closest('.relative') || canvas.parentElement;
    const w = Math.min(parent.clientWidth || 800, window.innerWidth - 40);
    const h = Math.min(600, window.innerHeight - 100);
    const radius = Math.min(w, h) / 2.5;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
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
      context.fillStyle = '#000000'; context.fill();
      context.strokeStyle = '#ffffff'; context.lineWidth = 2 * scaleFactor; context.stroke();
      if (!landFeatures) return;

      const graticule = d3.geoGraticule();
      context.beginPath(); path(graticule());
      context.strokeStyle = '#ffffff'; context.lineWidth = 1 * scaleFactor; context.globalAlpha = 0.25; context.stroke(); context.globalAlpha = 1;

      context.beginPath();
      landFeatures.features.forEach(f => path(f));
      context.strokeStyle = '#ffffff'; context.lineWidth = 1 * scaleFactor; context.stroke();

      allDots.forEach(d => {
        const pr = projection([d.lng, d.lat]);
        if (pr && pr[0] >= 0 && pr[0] <= w && pr[1] >= 0 && pr[1] <= h) {
          context.beginPath(); context.arc(pr[0], pr[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
          context.fillStyle = '#999999'; context.fill();
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
      .catch(() => {});

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

  const _sw = window.switchPage;
  window.switchPage = function (id) { const r = _sw.apply(this, arguments); if (id === 'home') setTimeout(initHeroGlobe, 50); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeroGlobe); else initHeroGlobe();
})();
