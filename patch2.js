/* BALLIN patch2.js (Aşama 2) — patch.js'ten SONRA yükle:
   <script src="script.js"></script> <script src="patch.js"></script> <script src="patch2.js"></script> */
(function () {
  'use strict';
  const UPLOAD_URL = 'https://ballin-worker.pages.dev';   // <-- Worker adresini yaz
  const $ = id => document.getElementById(id);
  const FV = firebase.firestore.FieldValue;
  const isAdm = () => !!(currentUser && !currentUser.isAnonymous && currentUser.email === ADMIN_EMAIL);
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b && !isNaN(parseInt(b))) m[a.trim().toUpperCase()] = parseInt(b); }); return m; };
  const sum = m => Object.values(m).reduce((a, b) => a + b, 0);

  /* ---------- Stil: mobil admin, tablo taşması, sahte asistanı gizle ---------- */
  const st = document.createElement('style');
  st.textContent = 'body table{min-width:0}#page-admin table{min-width:560px}#page-admin{overflow-y:auto}' +
    '#aiChatBox,button[onclick="toggleAI()"]{display:none!important}' +
    '@media(max-width:820px){.admin-layout{flex-direction:column;height:auto;min-height:100vh}' +
    '.admin-sidebar{width:100%;flex-direction:row;overflow-x:auto;padding:10px;border-right:0;border-bottom:1px solid var(--line)}' +
    '.admin-main{padding:16px;overflow:visible}.kpis{grid-template-columns:repeat(2,1fr)}.grid-2{grid-template-columns:1fr}' +
    '.admin-main table{display:block;overflow-x:auto}}';
  document.head.appendChild(st);

  /* ---------- Karşılaştırma çubuğu (HTML'de yoktu) ---------- */
  if (!$('compareBar')) {
    const bar = document.createElement('div'); bar.id = 'compareBar'; bar.className = 'compare-bar';
    const b = 'style="background:#fff;color:#000;border:0;padding:8px 14px;border-radius:8px;margin-left:8px;cursor:pointer;font-weight:600"';
    bar.innerHTML = '<span><b id="compareCount">0</b> ürün seçildi</span><span><button ' + b + ' onclick="clearCompareSelection()">Temizle</button><button ' + b + ' onclick="goToComparePage()">Karşılaştır</button></span>';
    document.body.appendChild(bar);
  }

  /* ---------- Geri tuşu ve doğrudan sayfa linkleri ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    if (!$('page-' + h) || ['admin', 'checkout', 'product-detail'].includes(h)) return;
    const ps = history.pushState; history.pushState = function () {};
    try { switchPage(h); } finally { history.pushState = ps; }
  }
  window.addEventListener('popstate', route);
  window.addEventListener('load', () => { if (/^#[a-z-]+$/.test(location.hash)) setTimeout(route, 400); });

  /* ---------- Görsel: küçült (WebP, 1200px) + R2'ye yükle ---------- */
  async function toWebp(src) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Görsel okunamadı.')); i.src = url; });
    const r = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/webp', 0.82));
  }
  async function upload(src) {
    const blob = await toWebp(src), tok = await currentUser.getIdToken();
    const r = await fetch(UPLOAD_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': blob.type }, body: blob });
    if (!r.ok) throw new Error('Görsel yüklenemedi (' + r.status + '). Worker adresini ve ayarlarını kontrol edin.');
    return (await r.json()).url;
  }
  const toUrl = s => String(s).startsWith('data:') ? upload(s) : Promise.resolve(s);   // base64 ise yükle, URL ise aynen bırak

  /* ---------- Yeni ürün ---------- */
  window.addNewProduct = async function () {
    if (!isAdm()) return;
    const g = id => $(id) ? $(id).value.trim() : '';
    const name = g('adminProdName'), price = parseFloat(g('adminProdPrice')), sizeStock = g('adminProdSizeStock'), sizes = parseSS(sizeStock);
    if (sizeStock && !Object.keys(sizes).length) return showToast('Beden formatı: S:5, M:3', 'error');
    let stock = parseInt(g('adminProdStock')); stock = isNaN(stock) ? 10 : stock;       // 0 artık 0 kalır
    if (Object.keys(sizes).length) stock = sum(sizes);                                    // toplam stok bedenlerden gelir
    const srcs = [0, 1, 2, 3].map(i => uploadedImages[i] || g('adminProdImg' + (i + 1))).filter(Boolean);
    if (!name || isNaN(price) || price < 0 || !srcs.length) return showToast('Ürün adı, fiyat ve en az 1 görsel gerekli.', 'error');
    const btn = $('btnUploadProduct'); if (btn) { btn.innerText = 'Görseller yükleniyor...'; btn.disabled = true; }
    try {
      const images = []; for (const s of srcs) images.push(await toUrl(s));
      await db.collection('products').add({ name, price, category: g('adminProdCategory') || 'Giyim', stock, description: g('adminProdDesc'), sizeStock, images, createdAt: FV.serverTimestamp() });
      showToast('Ürün eklendi!', 'success');
      ['adminProdName', 'adminProdPrice', 'adminProdDesc', 'adminProdSizeStock'].forEach(i => { if ($(i)) $(i).value = ''; });
      if ($('adminProdStock')) $('adminProdStock').value = '10';
      for (let i = 1; i <= 4; i++) { if ($('adminProdImg' + i)) $('adminProdImg' + i).value = ''; if ($('fileSlot_' + i)) $('fileSlot_' + i).value = ''; if ($('previewSlot_' + (i - 1))) $('previewSlot_' + (i - 1)).classList.add('hidden'); }
      uploadedImages = ['', '', '', '']; loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
    if (btn) { btn.innerText = 'Kataloğa Ekle'; btn.disabled = false; }
  };

  /* ---------- Ürün düzenleme (beden = sizeStock, kategori listesi, R2) ---------- */
  window.openEditModal = function (id) {
    const p = allProducts.find(x => x.id === id); if (!p) return;
    $('editProdId').value = p.id; $('editProdName').value = p.name || ''; $('editProdPrice').value = p.price || 0;
    $('editProdStock').value = p.stock || 0; $('editProdDesc').value = p.description || ''; $('editProdSizeStock').value = p.sizeStock || '';
    const cats = allCategories.includes(p.category) || !p.category ? allCategories : allCategories.concat(p.category);
    $('editProdCategory').innerHTML = cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    $('editProdCategory').value = p.category || cats[0];
    for (let i = 1; i <= 4; i++) { $('editProdImg' + i).value = (p.images || [])[i - 1] || ''; $('editFile_' + i).value = ''; }
    $('editProductModal').classList.remove('hidden');
  };
  window.saveEditedProductData = async function (btn) {
    const id = $('editProdId').value, sizeStock = $('editProdSizeStock').value.trim(), sizes = parseSS(sizeStock);
    if (sizeStock && !Object.keys(sizes).length) return showToast('Beden formatı: S:5, M:3', 'error');
    const stock = Object.keys(sizes).length ? sum(sizes) : (Number($('editProdStock').value) || 0);
    const t = btn.innerText; btn.innerText = 'Kaydediliyor...'; btn.disabled = true;
    try {
      const images = [];
      for (let i = 1; i <= 4; i++) {
        const f = $('editFile_' + i).files[0], u = $('editProdImg' + i).value.trim();
        if (f) images.push(await upload(f)); else if (u) images.push(await toUrl(u));
      }
      if (!images.length) throw new Error('En az 1 görsel gerekli.');
      await db.collection('products').doc(id).update({
        name: $('editProdName').value.trim(), price: Number($('editProdPrice').value), category: $('editProdCategory').value,
        stock, sizeStock, sizes: FV.delete(), description: $('editProdDesc').value, images, updatedAt: FV.serverTimestamp()
      });
      showToast('Ürün güncellendi!', 'success'); closeEditModal(); loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
    btn.innerText = t; btn.disabled = false;
  };

  /* ---------- Tek seferlik: eski base64 görselleri R2'ye taşı ---------- */
  async function migrate(btn) {
    btn.disabled = true; let n = 0;
    try {
      const snap = await db.collection('products').get();
      for (const d of snap.docs) {
        const imgs = d.data().images || [];
        if (!imgs.some(x => String(x).startsWith('data:'))) continue;
        const out = []; for (const x of imgs) out.push(await toUrl(x));
        await d.ref.update({ images: out }); n++; btn.innerText = 'Taşınan ürün: ' + n;
      }
      showToast(n ? n + ' ürünün görselleri taşındı.' : 'Taşınacak görsel yok.', 'success'); loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
    btn.innerText = 'Görselleri taşı'; btn.disabled = false;
  }
  firebase.auth().onAuthStateChanged(u => {
    if (!u || u.email !== ADMIN_EMAIL || $('migrateBtn')) return;
    const b = document.createElement('button'); b.id = 'migrateBtn'; b.innerText = 'Görselleri taşı';
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9998;background:#111;color:#fff;border:1px solid #444;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer';
    b.onclick = () => migrate(b); document.body.appendChild(b);
  });
})();
