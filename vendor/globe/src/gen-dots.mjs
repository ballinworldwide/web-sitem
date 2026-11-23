// Kara noktalarını derleme zamanında üretir. yama-94: 21st.dev "wireframe-dotted-globe" orijinaliyle aynı ızgara:
// boylam ve enlemde düzgün 1.28° adım (orijinal: dotSpacing 16 x 0.08). Satır başına boylam indeksleri, ilki mutlak, kalanı fark (delta) olarak saklanır.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const STEP = 1.28, rows = [];
let n = 0;
for (let j = 0, lat = -90; lat <= 90; j++, lat = -90 + j * STEP) {
  const idx = [];
  for (let i = 0, lon = -180; lon < 180; i++, lon = -180 + i * STEP) if (geoContains(land, [lon, lat])) idx.push(i);
  n += idx.length;
  rows.push(idx.map((v, k) => k ? v - idx[k - 1] : v));
}
writeFileSync('src/dots.json', JSON.stringify({ step: STEP, rows }));
console.log('nokta sayısı:', n, 'satır:', rows.length, 'bayt:', JSON.stringify({ step: STEP, rows }).length);
