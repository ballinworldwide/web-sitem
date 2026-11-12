/* ===================================================================
   YAMA-23: Admin paneli HTML'i artık index.html'de değil, admin-panel.html'de.
   Panel ilk açıldığında bir kez indirilip sayfaya eklenir. Ziyaretçiler ve
   müşteriler bu ~25 KB'lık HTML'i hiç indirmez.
   Yükleme sırasında admin DOM'una bağlanan başlatıcılar (sekmeler, dönem
   seçici, gözlemciler) panel eklendikten sonra window.__adminInits ile
   bir kez daha çalıştırılır; hepsi tekrar çalışmaya karşı korumalıdır.
   =================================================================== */
(function () {
  var _open = window.openAdminPanel, loading = null;
  function ensurePanel() {
    if (document.getElementById('page-admin')) return Promise.resolve();
    if (!loading) {
      loading = fetch('/admin-panel.html', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (html) {
          if (!document.getElementById('page-admin')) document.body.insertAdjacentHTML('beforeend', html);
          (window.__adminInits || []).forEach(function (f) { try { f(); } catch (e) { console.error('admin başlatıcı hatası', e); } });
          // Panel yokken gelen veriler admin alanlarına yazılamamıştı: şimdi doldur
          try { updateCategoryDropdowns(); } catch (e) {}
          try { renderAdminCategories(); } catch (e) {}
          try { loadCMSBanner(); } catch (e) {}
        })
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }
  window.openAdminPanel = function () {
    var self = this, args = arguments;
    return ensurePanel().then(function () { return _open.apply(self, args); }).catch(function (e) {
      if (typeof showToast === 'function') showToast('Admin paneli yüklenemedi: ' + e.message, 'error');
    });
  };
})();
