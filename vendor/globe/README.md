# vendor/globe — hero ve iletişim küresi

`globe.js` tek dosyalık derlenmiş kütüphanedir (`window.BallinGlobe.create(canvas, seçenekler)`).
İçindekiler: d3-geo 3 (ISC), topojson-client 3 (ISC), world-atlas 2 `land-110m` (Natural Earth, kamu malı). Lisans metinleri bu klasörde.
Harici istek yapmaz; kara noktaları derleme zamanında hesaplanıp gömülüdür.

Yeniden derleme (temiz bir klasörde, repo dışında):

    npm i d3-geo@3 topojson-client@3 world-atlas@2 esbuild
    # src/ klasörünü ve gen-dots.mjs dosyasını oraya kopyala
    node gen-dots.mjs
    npx esbuild src/globe.js --bundle --minify --format=iife --global-name=BallinGlobe --target=es2019 --legal-comments=none --outfile=globe.js

Kullanım yerleri: yamalar.js (hero, yama-90) ve yamalar.js (iletişim sayfası, yama-91). Değişiklikten sonra index.html'deki `?v=` sayısını artır.
