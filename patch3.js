/* BALLIN patch3.js — yasal sayfalar (TASLAK). patch2.js'ten SONRA yükle:
   <script src="patch3.js"></script>
   Aşağıdaki INFO bilgilerini doldur. Yayına almadan önce bir avukat/mali müşavire kontrol ettir. */
(function () {
  'use strict';
  const INFO = {
    unvan: '[TİCARİ UNVAN / AD SOYAD]',
    adres: '[ADRES]',
    vergi: '[VERGİ DAİRESİ / VERGİ NO]',
    mersis: '[MERSİS NO - varsa]',
    tel: '[TELEFON]',
    mail: '[DESTEK E-POSTASI]',
    site: 'ballinworldwide.net'
  };
  const e = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = (...a) => a.map(x => '<p>' + x + '</p>').join('');
  const H = t => '<h2 class="font-bold text-brand-900 text-base mt-6">' + t + '</h2>';
  const SATICI = '<strong>' + e(INFO.unvan) + '</strong><br>Adres: ' + e(INFO.adres) + '<br>Vergi: ' + e(INFO.vergi) +
    '<br>MERSİS: ' + e(INFO.mersis) + '<br>Telefon: ' + e(INFO.tel) + '<br>E-posta: ' + e(INFO.mail) + '<br>Web: ' + e(INFO.site);

  function setPage(id, title, body) {
    let el = document.getElementById('page-' + id);
    if (!el) {
      el = document.createElement('section'); el.id = 'page-' + id; el.className = 'page-section hidden max-w-4xl mx-auto px-4 py-16';
      const ref = document.getElementById('page-destek-merkezi'); ref.parentNode.insertBefore(el, ref);
    }
    el.innerHTML = '<h1 class="font-serif text-3xl text-brand-900 mb-6 border-b pb-3">' + title + '</h1><div class="text-sm text-brand-600 leading-relaxed space-y-4">' + body + '</div>';
  }

  function init() {
    /* ---- Mesafeli Satış Sözleşmesi + Ön Bilgilendirme ---- */
    setPage('mesafeli-satis', 'Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi',
      P('Bu metin, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında, sipariş verilmeden önce ALICI\'yı bilgilendirmek ve sözleşme şartlarını belirlemek için hazırlanmıştır.') +
      H('1. Taraflar') + P('<b>SATICI:</b><br>' + SATICI, '<b>ALICI:</b> Sipariş sırasında formda adı, adresi ve iletişim bilgileri belirtilen kişidir.') +
      H('2. Konu') + P('Sözleşmenin konusu, ALICI\'nın ' + e(INFO.site) + ' üzerinden sipariş verdiği ürünlerin satışı, teslimi ve tarafların hak ve yükümlülükleridir.') +
      H('3. Ürün, Fiyat ve Ödeme') + P('Ürünlerin temel nitelikleri, beden/seçenekleri ve KDV dahil satış fiyatı ürün sayfasında ve sipariş özetinde gösterilir. Kargo ücreti ve ücretsiz kargo limiti sipariş özetinde belirtilir. Toplam bedel, sipariş onayından önce ALICI\'ya ayrıca gösterilir.') +
      H('4. Teslimat') + P('Siparişler genellikle 1-3 iş günü içinde kargoya verilir. Teslimat süresi hiçbir durumda sipariş tarihinden itibaren 30 günü aşamaz. Ürün, ALICI\'nın bildirdiği adrese kargo firması aracılığıyla teslim edilir. Kargo takip bilgisi e-posta ile iletilir. ALICI, teslim sırasında paketi kontrol etmeli, hasarlı/ezik paketi teslim almayıp tutanak tutturmalıdır.') +
      H('5. Cayma Hakkı') + P('ALICI, ürünün teslim tarihinden itibaren <b>14 gün</b> içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkına sahiptir. Cayma bildirimi ' + e(INFO.mail) + ' adresine yazılı olarak yapılır. İade edilecek ürün kullanılmamış, yıkanmamış, etiketleri ve ambalajı bozulmamış olmalıdır. SATICI, cayma bildiriminin kendisine ulaşmasından itibaren en geç 14 gün içinde ürün bedelini ve varsa teslimat masraflarını ALICI\'ya iade eder. ALICI, bildirimden itibaren 10 gün içinde ürünü geri gönderir. <b>İade kargo ücreti SATICI tarafından karşılanır.</b>') +
      H('6. Cayma Hakkının Kullanılamayacağı Durumlar') + P('Yönetmelik uyarınca; ALICI\'nın istekleri doğrultusunda kişiye özel hazırlanan ürünlerde ve hijyen açısından iadesi uygun olmayan, ambalajı açılmış ürünlerde (ör. iç giyim, mayo) cayma hakkı kullanılamaz.') +
      H('7. Ayıplı Ürün') + P('Ürün ayıplı çıkarsa ALICI, 6502 sayılı Kanun\'daki seçimlik haklarını (ayıpsız misli ile değiştirme, bedel indirimi, sözleşmeden dönme, ücretsiz onarım) kullanabilir.') +
      H('8. Uyuşmazlık') + P('Uyuşmazlıklarda, ilgili parasal sınırlar dahilinde ALICI\'nın yerleşim yerindeki Tüketici Hakem Heyetleri veya Tüketici Mahkemeleri yetkilidir.') +
      H('9. Yürürlük') + P('ALICI, siparişi onaylamadan önce bu metni okuyup kabul ettiğini beyan eder. Sözleşme, sipariş onayı ile kurulur.'));

    /* ---- İade ve cayma ---- */
    setPage('iade-sartlari', 'İade ve Cayma Şartları',
      P('Teslim aldığınız ürünü, <b>14 gün</b> içinde gerekçe göstermeden iade edebilirsiniz. İade kargo ücreti <b>BALLIN tarafından karşılanır</b>.') +
      H('İade nasıl yapılır?') + P('1) ' + e(INFO.mail) + ' adresine sipariş numaranızla iade talebinizi yazın.<br>2) Ürünü kullanılmamış, yıkanmamış, etiketli ve ambalajında gönderin.<br>3) Ürün bize ulaşıp kontrol edildikten sonra bedel, 14 gün içinde ödeme yaptığınız yönteme iade edilir.') +
      H('İade edilemeyen ürünler') + P('Kişiye özel hazırlanan ve hijyen nedeniyle ambalajı açılmış ürünlerde (ör. iç giyim, mayo) cayma hakkı kullanılamaz.') +
      H('Hasarlı veya hatalı ürün') + P('Hasarlı veya yanlış gelen ürünleri teslim anından itibaren bize bildirin, değişim veya iade işlemi başlatalım. Detaylar için <a class="underline font-bold cursor-pointer" onclick="switchPage(\'mesafeli-satis\')">Mesafeli Satış Sözleşmesi</a>.'));

    /* ---- KVKK aydınlatma + gizlilik ---- */
    setPage('gizlilik-politikasi', 'KVKK Aydınlatma Metni ve Gizlilik Politikası',
      P('6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, kişisel verileriniz aşağıda açıklanan kapsamda işlenmektedir.') +
      H('1. Veri sorumlusu') + P(SATICI) +
      H('2. İşlenen veriler') + P('Kimlik (ad, soyad), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, sepet, kupon, puan, yorum) ve işlem güvenliği (oturum/hesap bilgileri) verileri.') +
      H('3. Amaç ve hukuki sebep') + P('Verileriniz; siparişin alınması, teslimi, iade/cayma süreçlerinin yürütülmesi, müşteri iletişimi, hesap yönetimi, yasal yükümlülüklerin yerine getirilmesi ve hakkın tesisi/korunması amaçlarıyla; sözleşmenin kurulması ve ifası, hukuki yükümlülük ve meşru menfaat hukuki sebeplerine dayanılarak işlenir.') +
      H('4. Aktarım') + P('Verileriniz; kargo firmalarına, e-posta ve barındırma/altyapı hizmeti sağlayıcılarına (Google Firebase, Cloudflare, EmailJS gibi, bunların bir kısmı yurt dışında yer alabilir), yetkili kamu kurumlarına ve hizmetin gerektirdiği ölçüde iş ortaklarına aktarılabilir.') +
      H('5. Saklama süresi') + P('Verileriniz, işleme amacının gerektirdiği ve yasal saklama sürelerinin öngördüğü süre boyunca saklanır, süre sonunda silinir veya anonim hale getirilir.') +
      H('6. Haklarınız (KVKK m.11)') + P('Verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, aktarılan üçüncü kişileri öğrenme, itiraz etme ve zarar halinde tazminat talep etme haklarına sahipsiniz.') +
      H('7. Başvuru') + P('Taleplerinizi ' + e(INFO.mail) + ' adresine veya yukarıdaki adrese iletebilirsiniz.'));

    /* ---- Çerez politikası ---- */
    setPage('cerez', 'Çerez ve Yerel Depolama Politikası',
      P('Sitemiz, çalışması için zorunlu olan çerez ve tarayıcı yerel depolama alanlarını kullanır: oturum açma, sepetiniz ve tercihleriniz bu sayede hatırlanır. Şu an reklam veya analiz amaçlı çerez kullanılmamaktadır; ileride eklenirse tercihiniz sorulacaktır.') +
      P('Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz, ancak bu durumda giriş ve sepet gibi bölümler çalışmayabilir.'));

    /* ---- Künye ---- */
    const k = document.getElementById('page-destek-merkezi');
    if (k) k.querySelector('div').innerHTML = P(SATICI);

    /* ---- Ödeme sayfası linki + footer ---- */
    const ct = document.getElementById('checkTerms');
    if (ct && ct.parentNode.querySelector('a')) ct.parentNode.querySelector('a').setAttribute('onclick', "switchPage('mesafeli-satis')");
    const fl = document.querySelector('footer a[onclick*="kargo-teslimat"]');
    if (fl && fl.closest('ul')) {
      const mk = (id, t) => '<li><a onclick="switchPage(\'' + id + '\'); return false;" class="hover:text-white cursor-pointer transition-colors">' + t + '</a></li>';
      fl.closest('ul').insertAdjacentHTML('beforeend', mk('mesafeli-satis', 'Mesafeli Satış Sözleşmesi') + mk('cerez', 'Çerez Politikası'));
    }

    /* ---- Çerez bildirimi ---- */
    try { if (localStorage.getItem('ballin_cookie')) return; } catch (x) {}
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;max-width:560px;margin:auto;background:#212529;color:#fff;padding:14px 16px;border-radius:12px;z-index:5500;font-size:12px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.4)';
    b.innerHTML = '<span>Sitemiz yalnızca çalışması için zorunlu çerez/yerel depolama kullanır. <a style="text-decoration:underline;cursor:pointer" onclick="switchPage(\'cerez\')">Detay</a></span><button style="background:#fff;color:#000;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer">Anladım</button>';
    b.querySelector('button').onclick = () => { try { localStorage.setItem('ballin_cookie', '1'); } catch (x) {} b.remove(); };
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
