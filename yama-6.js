/* BALLIN yama-6.js — Firebase App Check (reCAPTCHA Enterprise, görünmez). yama-5'ten SONRA yükle.
   ÖNEMLİ: index.html'de firebase-firestore-compat.js satırının altına şu satır da eklenmeli:
   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js"></script> */
(function () {
  'use strict';
  const SITE_KEY = '6LdT3_YtAAAAABqQnHQTdwwRHRDEB8wpM-24q4Vz';
  try {
    if (!firebase.appCheck) { console.warn('App Check SDK yüklü değil: index.html\'e firebase-app-check-compat.js ekleyin.'); return; }
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(SITE_KEY), true);
  } catch (e) { console.warn('App Check başlatılamadı', e); }
})();
