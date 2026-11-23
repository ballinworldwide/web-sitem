// Kara noktalarını derleme zamanında üretir: eşit yoğunluklu (enleme göre boylam adımı) ızgara, geoContains ile karada kalanlar.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const STEP = 1.8, out = [];
for (let lat = -84; lat <= 84; lat += STEP) {
  const k = Math.max(0.12, Math.cos(lat * Math.PI / 180)), dl = STEP / k;
  for (let lon = -180; lon < 180; lon += dl) if (geoContains(land, [lon, lat])) out.push(Math.round(lon * 10), Math.round(lat * 10));
}
writeFileSync('src/dots.json', JSON.stringify(out));
console.log('nokta sayısı:', out.length / 2, 'bayt:', JSON.stringify(out).length);
