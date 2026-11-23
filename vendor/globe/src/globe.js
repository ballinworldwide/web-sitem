/* BALLIN küre kütüphanesi (yama-90/91)
 * Kaynak: d3-geo (ISC), topojson-client (ISC), world-atlas land-110m (Natural Earth, kamu malı).
 * Tek dosyaya derlenir: vendor/globe/globe.js. Yeniden derleme: vendor/globe/README.md
 * Kullanım: BallinGlobe.create(canvas, { mode: 'dots' | 'wireframe', ... }) -> { destroy, redraw }
 */
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import dotsFlat from './dots.json';

const land = feature(landTopo, landTopo.objects.land);
const graticule = geoGraticule10();
const RAD = Math.PI / 180;
// kara noktaları: dots.json = { step, rows } (gen-dots.mjs). Satır j -> enlem -90 + j*step; satırdaki sayılar boylam indeksi (ilki mutlak, kalanı fark)
const pts = [];
dotsFlat.rows.forEach((row, j) => { let i = 0; row.forEach((d, k) => { i = k ? i + d : d; pts.push([-180 + i * dotsFlat.step, -90 + j * dotsFlat.step]); }); });
const N = pts.length;
const dLon = new Float32Array(N), dSinLat = new Float32Array(N), dCosLat = new Float32Array(N), dLat = new Float32Array(N);
for (let i = 0; i < N; i++) {
  dLon[i] = pts[i][0] * RAD;
  dLat[i] = pts[i][1] * RAD;
  dSinLat[i] = Math.sin(dLat[i]); dCosLat[i] = Math.cos(dLat[i]);
}

function create(canvas, opts) {
  opts = Object.assign({
    mode: 'dots',          // 'dots' = 21st.dev orijinali gibi noktalı küre (hero), 'wireframe' = yalnız tel kafes (iletişim)
    color: '255,255,255',  // çizgi/nokta rengi (r,g,b)
    fill: null,            // küre dolgusu, ör. 'rgba(255,255,255,.04)'
    ocean: '#000000',      // 'dots' modu: küre (okyanus) dolgusu (21st.dev orijinali: siyah)
    ink: '#ffffff',        // 'dots' modu: küre çerçevesi, enlem/boylam ve kıta kenarı rengi (orijinal: beyaz)
    dot: '#999999',        // 'dots' modu: kara noktası rengi (orijinal: #999999)
    refR: 240,             // 'dots' modu: çizgi kalınlığı/nokta boyu bu yarıçapta orijinaldeki gibi (2px / 1px / 1.2px); daha büyük küre orantılı kalınlaşır
    alpha: 1,              // tüm nokta/çizgi saydamlıklarının çarpanı (metin okunabilirliği için kısılabilir)
    scale: 0.46,           // yarıçap = min(genişlik, yükseklik) * scale (ya da (w,h) => oran)
    cx: 0.5, cy: 0.5,      // merkez (alanın oranı)
    speed: 7,              // otomatik dönüş, derece/sn
    tilt: 18,              // başlangıç eğimi (derece, kuzey yukarı)
    startLon: 30,          // başlangıçta ekranın ortasındaki boylam (Türkiye'ye bakar)
    drag: true,
    dragTarget: null,      // sürüklemeyi dinleyen eleman (varsayılan: canvas)
    dragIgnore: 'a,button,input,textarea,select,label'
  }, opts || {});
  const ctx = canvas.getContext('2d');
  const proj = geoOrthographic().clipAngle(90).precision(0.6);
  const path = geoPath(proj, ctx);
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let W = 0, H = 0, dpr = 1, yaw = -opts.startLon, pitch = -opts.tilt, running = false, visible = true, raf = 0, last = 0, dragging = false, px = 0, py = 0, destroyed = false;

  const sc = () => typeof opts.scale === 'function' ? opts.scale(W, H) : opts.scale;   // ölçek sabit sayı ya da (genişlik, yükseklik) → oran

  function resize() {
    const r = canvas.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    W = r.width; H = r.height; return true;
  }

  function draw() {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * sc(), cx = W * opts.cx, cy = H * opts.cy;
    proj.scale(R).translate([cx, cy]).rotate([yaw, pitch, 0]);
    const c = opts.color;
    if (opts.mode === 'dots') {
      // 21st.dev "wireframe-dotted-globe" orijinaliyle aynı çizim: siyah küre + 2px beyaz çerçeve, %25 beyaz enlem/boylam, 1px beyaz kıta kenarı, #999 noktalar (r=1.2)
      const k = Math.max(0.9, Math.min(1.6, R / opts.refR));
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = opts.ocean; ctx.fill(); ctx.strokeStyle = opts.ink; ctx.lineWidth = 2 * k; ctx.stroke();
      ctx.globalAlpha = 0.25; ctx.beginPath(); path(graticule); ctx.strokeStyle = opts.ink; ctx.lineWidth = 1 * k; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); path(land); ctx.strokeStyle = opts.ink; ctx.lineWidth = 1 * k; ctx.stroke();
      const cl = -yaw * RAD, cp = -pitch * RAD, sp = Math.sin(cp), cpp = Math.cos(cp), rad = 1.2 * k;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        if (dSinLat[i] * sp + dCosLat[i] * cpp * Math.cos(dLon[i] - cl) <= 0.02) continue;   // arka yüzey
        const p = proj([dLon[i] / RAD, dLat[i] / RAD]); if (!p) continue;
        ctx.moveTo(p[0] + rad, p[1]); ctx.arc(p[0], p[1], rad, 0, 6.2832);
      }
      ctx.fillStyle = opts.dot; ctx.fill();
      return;
    }
    // 'wireframe' modu (iletişim sayfası)
    ctx.beginPath(); path({ type: 'Sphere' });
    if (opts.fill) { ctx.fillStyle = opts.fill; ctx.fill(); }
    ctx.strokeStyle = 'rgba(' + c + ',' + (.35 * opts.alpha) + ')'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); path(graticule); ctx.strokeStyle = 'rgba(' + c + ',' + (.16 * opts.alpha) + ')'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(land); ctx.strokeStyle = 'rgba(' + c + ',' + (.55 * opts.alpha) + ')'; ctx.lineWidth = 0.9; ctx.stroke();
  }

  function frame(t) {
    raf = 0; if (destroyed || !running) return;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
    if (!dragging && !reduce) yaw -= opts.speed * dt;   // sola doğru (doğudan batıya) döner
    draw(); raf = requestAnimationFrame(frame);
  }
  function start() { if (running || destroyed || reduce) { draw(); return; } running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { if (visible && !document.hidden) start(); else stop(); }

  const ro = new ResizeObserver(() => { if (resize()) { draw(); sync(); } }); ro.observe(canvas);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }); io.observe(canvas);
  const onVis = () => sync(); document.addEventListener('visibilitychange', onVis);

  // sürükleyerek döndürme (dokunmatikte yalnız yatay sürükleme; dikey kaydırma sayfayı kaydırır)
  const tgt = opts.dragTarget || canvas;
  function down(e) {
    if (!opts.drag || (e.button != null && e.button > 0)) return;
    if (e.target && e.target.closest && e.target.closest(opts.dragIgnore)) return;
    dragging = true; px = e.clientX; py = e.clientY; try { tgt.setPointerCapture(e.pointerId); } catch (x) {}
    tgt.style.cursor = 'grabbing';
  }
  function move(e) {
    if (!dragging) return;
    const k = 180 / (Math.min(W, H) * sc() * Math.PI) * 1.1;   // piksel → derece
    yaw += (e.clientX - px) * k; pitch = Math.max(-70, Math.min(70, pitch - (e.clientY - py) * k));
    px = e.clientX; py = e.clientY; if (reduce || !running) draw();
  }
  function up(e) { if (!dragging) return; dragging = false; tgt.style.cursor = opts.drag ? 'grab' : ''; try { tgt.releasePointerCapture(e.pointerId); } catch (x) {} }
  if (opts.drag) {
    tgt.style.touchAction = 'pan-y'; tgt.style.cursor = 'grab';
    tgt.addEventListener('pointerdown', down); tgt.addEventListener('pointermove', move);
    tgt.addEventListener('pointerup', up); tgt.addEventListener('pointercancel', up);
  }

  if (resize()) draw();
  sync();
  return {
    redraw() { if (resize()) draw(); },
    destroy() { destroyed = true; stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
      tgt.removeEventListener('pointerdown', down); tgt.removeEventListener('pointermove', move); tgt.removeEventListener('pointerup', up); tgt.removeEventListener('pointercancel', up); }
  };
}

export { create };
