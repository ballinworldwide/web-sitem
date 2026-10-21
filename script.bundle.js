const firebaseConfig = { apiKey: "AIzaSyAiwyFOinP5FQc3npY0S34k1OrLG6u7Elo", authDomain: "ballinww.firebaseapp.com", projectId: "ballinww", storageBucket: "ballinww.firebasestorage.app", messagingSenderId: "460665379220", appId: "1:460665379220:web:b162c760e1b06bfbc2d781" };
const ADMIN_EMAIL = "ballinworldw@gmail.com";
let STAFF_ROLE = null; // yama-3: "siparis" | "urun" | "yonetici" | null
function isStaffNow(u) { return !!(u && !u.isAnonymous && (u.email === ADMIN_EMAIL || STAFF_ROLE)); }
 

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();
let currentUser = null;
let userData = null;
let allProducts = []; 
let allOrders = [];
let allCustomers = [];
let activeCoupons = [];
let currentCategory = 'Tümü';
let currentDashboardPeriod = 'all'; 
let currentOrderFilter = 'all'; 

let allCategories = ["Giyim", "Aksesuar", "Ayakkabı"];

// --- YENİ: Sayfalama Değişkenleri ---
let lastProductDoc = null; 
let isLoadingProducts = false;

function loadCategories() {
    db.collection("settings").doc("categories").get().then(doc => {
        if (doc.exists && doc.data().list) {
            allCategories = doc.data().list;
        } else {
            db.collection("settings").doc("categories").set({ list: allCategories });
        }
        renderAdminCategories();
        updateCategoryDropdowns();
        renderCategoryFilters();
    }).catch(e => console.log("Kategoriler yüklenemedi:", e));
}

function renderAdminCategories() {
    const listEl = document.getElementById('adminCategoriesList');
    if (!listEl) return;
    listEl.innerHTML = allCategories.map((cat, index) =>
        `<span class="bg-white border border-brand-200 px-3 py-1.5 rounded-full text-sm font-medium text-brand-700 flex items-center gap-2 shadow-sm">
            ${cat} <i class="fa-solid fa-xmark text-red-500 cursor-pointer hover:scale-110" onclick="deleteCategory(${index})"></i>
        </span>`
    ).join('');
}

function addCategory() {
    const input = document.getElementById('newCategoryInput');
    if(!input) return;
    const val = input.value.trim();
    if (!val) return;
    if (allCategories.includes(val)) { showToast("Bu kategori zaten mevcut.", "error"); return; }
    
    allCategories.push(val);
    db.collection("settings").doc("categories").set({ list: allCategories }).then(() => {
        input.value = '';
        showToast("Kategori eklendi!", "success");
        loadCategories();
    });
}

function deleteCategory(index) {
    if(!confirm(`"${allCategories[index]}" kategorisini silmek istediğinize emin misiniz?`)) return;
    allCategories.splice(index, 1);
    db.collection("settings").doc("categories").set({ list: allCategories }).then(() => {
        showToast("Kategori silindi.", "success");
        loadCategories();
    });
}

function updateCategoryDropdowns() {
    const optionsHTML = allCategories.map(c => `<option value="${c}">${c}</option>`).join('');
    const addSelect = document.getElementById('adminProdCategory');
    const bulkSelect = document.getElementById('bulkTargetCategory');
    if(addSelect) addSelect.innerHTML = optionsHTML;
    if(bulkSelect) bulkSelect.innerHTML = optionsHTML;
}

function renderCategoryFilters() {
    const filterContainer = document.getElementById('categoryFilterContainer');
    if(!filterContainer) return;
    let html = `<button class="cat-btn ${currentCategory === 'Tümü' ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'} px-6 py-2 rounded-full text-sm font-medium transition-all active" onclick="setCategoryFilter('Tümü', this)">Tümü</button>`;
    allCategories.forEach(cat => {
        html += `<button class="cat-btn ${currentCategory === cat ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'} px-6 py-2 rounded-full text-sm font-medium transition-all" onclick="setCategoryFilter('${cat}', this)">${cat}</button>`;
    });
    filterContainer.innerHTML = html;
}

let wishlist = [];
try { let w = JSON.parse(localStorage.getItem('ballin_wishlist')); if(Array.isArray(w)) wishlist = w; } catch(e){}
let cart = [];
try { let c = JSON.parse(localStorage.getItem('ballin_cart')); if(Array.isArray(c)) cart = c; } catch(e){}
let compareList = []; 

let appliedDiscountRate = 0;
let appliedCouponCode = "";
let appliedPointsValue = 0;
let FREE_SHIPPING_THRESHOLD = 3000;
let SHIPPING_FEE = 99;

const TURKEY_LOCATIONS = {
    "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
    "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"],
    "Afyonkarahisar": ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
    "Ağrı": ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
    "Amasya": ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
    "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
    "Antalya": ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
    "Artvin": ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
    "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
    "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
    "Bilecik": ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
    "Bingöl": ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
    "Bitlis": ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
    "Bolu": ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
    "Burdur": ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
    "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
    "Çanakkale": ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
    "Çankırı": ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
    "Çorum": ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
    "Denizli": ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
    "Diyarbakır": ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
    "Edirne": ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
    "Elazığ": ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
    "Erzincan": ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
    "Erzurum": ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
    "Eskişehir": ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
    "Gaziantep": ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
    "Giresun": ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
    "Gümüşhane": ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
    "Hakkari": ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
    "Hatay": ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
    "Isparta": ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"],
    "İstanbul": ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
    "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
    "Kahramanmaraş": ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
    "Karabük": ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
    "Karaman": ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
    "Kars": ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
    "Kastamonu": ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
    "Kayseri": ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
    "Kırıkkale": ["Bahşılı", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
    "Kırklareli": ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
    "Kırşehir": ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
    "Kilis": ["Elbeyli", "Merkez", "Musabeyli", "Polateli"],
    "Kocaeli": ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
    "Konya": ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
    "Kütahya": ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Şaphane", "Simav", "Tavşanlı"],
    "Malatya": ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
    "Manisa": ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
    "Mardin": ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
    "Mersin": ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
    "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
    "Muş": ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
    "Nevşehir": ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
    "Niğde": ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
    "Ordu": ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
    "Osmaniye": ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
    "Rize": ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
    "Sakarya": ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
    "Samsun": ["19 Mayıs", "Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
    "Siirt": ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
    "Sinop": ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
    "Sivas": ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"],
    "Şanlıurfa": ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
    "Şırnak": ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
    "Tekirdağ": ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
    "Tokat": ["Almus", "Artova", "Başçiftlik", "Erbaa", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile", "Merkez"],
    "Trabzon": ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"],
    "Tunceli": ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
    "Uşak": ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
    "Van": ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
    "Yalova": ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
    "Yozgat": ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy"],
    "Zonguldak": ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"]
};
function initLocationDropdowns() {
    ['profCity', 'checkoutCity'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = '<option value="">İl Seçiniz</option>';
        Object.keys(TURKEY_LOCATIONS).sort((a, b) => a.localeCompare(b, 'tr')).forEach(city => {
            el.innerHTML += `<option value="${city}">${city}</option>`;
        });
    });
}

function populateDistricts(citySelectId, districtSelectId) {
    const cityEl = document.getElementById(citySelectId);
    const distSelect = document.getElementById(districtSelectId);
    if(!cityEl || !distSelect) return;
    const city = cityEl.value;
    distSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
    if(city && TURKEY_LOCATIONS[city]) {
        TURKEY_LOCATIONS[city].sort((a, b) => a.localeCompare(b, 'tr')).forEach(d => {
            distSelect.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }
}

let toastTimeout;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    if(!toast || !icon || !msg) return;
    
    msg.innerText = message;
    if(type === 'error') {
        toast.className = 'toast-notification toast-error show';
        icon.className = 'fa-solid fa-circle-xmark text-lg';
    } else {
        toast.className = 'toast-notification toast-success show';
        icon.className = 'fa-solid fa-circle-check text-lg';
    }

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

function toggleSizeGuide() { 
    const m = document.getElementById('sizeGuideModal');
    if(m) m.classList.toggle('hidden'); 
}

function syncCartToFirebase() {
    if(currentUser) { 
        db.collection("users").doc(currentUser.uid).update({ 
            cartData: cart, 
            lastActive: firebase.firestore.FieldValue.serverTimestamp() 
        }).catch(e => {}); 
    }
}

function createSlug(text) {
    const trMap = { 'çÇ':'c', 'ğĞ':'g', 'şŞ':'s', 'üÜ':'u', 'ıİ':'i', 'öÖ':'o' };
    for (let key in trMap) {
        text = text.replace(new RegExp('[' + key + ']', 'g'), trMap[key]);
    }
    return text.toLowerCase()
        .replace(/[^-a-zA-Z0-9\s]+/ig, '')
        .replace(/\s/gi, "-")
        .replace(/-+/g, "-")
        .trim();
}

// --- YENİ: Sayfalama (Pagination) ile LoadProducts ---
function loadProducts(isLoadMore = false) { 
    if (isLoadingProducts) return;
    isLoadingProducts = true;

    let query = db.collection("products").orderBy("createdAt", "desc").limit(12);

    if (isLoadMore && lastProductDoc) {
        query = query.startAfter(lastProductDoc);
    }

    query.get().then((snap) => {
        if (snap.empty) {
            const btn = document.getElementById('loadMoreBtn');
            if (btn) btn.style.display = 'none';
            isLoadingProducts = false;
            return;
        }

        lastProductDoc = snap.docs[snap.docs.length - 1];

        if (!isLoadMore) {
            allProducts = []; 
        }

        snap.forEach(doc => { 
            let p = doc.data(); 
            p.id = doc.id; 
            allProducts.push(p); 
        }); 
        
        renderMainGrid(); filterAndSortProducts(); renderNewGrid(); renderWishlistGrid();
        loadOrdersAndCalculateStats(); loadCustomersCRM(); updateWishlistBadge(); renderBulkTable(); loadCouponsAdmin(); loadCMSBanner(); loadAbandonedCarts();
        updateCartBadge();
        
        const btn = document.getElementById('loadMoreBtn');
        if (btn && snap.docs.length === 12) { 
            btn.style.display = 'block';
        } else if (btn) {
             btn.style.display = 'none';
        }

        isLoadingProducts = false;

        let currentHash = window.location.hash;
        if (currentHash && currentHash.startsWith('#/')) {
            let aranacakSlug = currentHash.replace('#/', '');
            let hedefUrun = allProducts.find(p => createSlug(p.name) === aranacakSlug);
            if (hedefUrun) {
                setTimeout(() => { openProductDetail(hedefUrun.id); }, 100);
            }
        }
    }).catch(e => {
        showToast("Ürünler yüklenemedi: " + e.message, 'error');
        isLoadingProducts = false;
    }); 
}

function toggleMobileMenu() { 
    const m = document.getElementById('mobile-menu');
    if(m) m.classList.toggle('hidden'); 
}

function toggleAccordion(id) {
    let content = document.getElementById(id);
    let icon = document.getElementById('icon_' + id);
    if(!content || !icon) return;
    if(content.classList.contains('hidden')) { content.classList.remove('hidden'); icon.className = "fa-solid fa-minus"; } 
    else { content.classList.add('hidden'); icon.className = "fa-solid fa-plus"; }
}

function loadCMSBanner() {
    db.collection("settings").doc("cms").get().then(doc => {
        if(doc.exists) {
            let d = doc.data();
            if(d.heroTitle && document.getElementById('homeHeroTitle')) document.getElementById('homeHeroTitle').innerText = d.heroTitle;
            if(d.heroDesc && document.getElementById('homeHeroDesc')) document.getElementById('homeHeroDesc').innerText = d.heroDesc;
            
            if(d.freeShippingLimit !== undefined) {
                FREE_SHIPPING_THRESHOLD = Number(d.freeShippingLimit);
                if(document.getElementById('cmsFreeShippingLimit')) document.getElementById('cmsFreeShippingLimit').value = FREE_SHIPPING_THRESHOLD;
                
                // Kayan yazıyı dinamik güncelle
                let marqueeText = document.getElementById('marqueeShippingText');
                if(marqueeText) {
                    marqueeText.innerHTML = `${FREE_SHIPPING_THRESHOLD.toLocaleString('tr-TR')} TL ÜZERİ ÜCRETSİZ KARGO &amp; KOLAY İADE - TÜM SİPARİŞLERDE`;
                }
            }
            if(d.shippingCost !== undefined) {
                SHIPPING_FEE = Number(d.shippingCost);
                if(document.getElementById('cmsShippingCost')) document.getElementById('cmsShippingCost').value = SHIPPING_FEE;
            }
        }
    }).catch(e => console.log("CMS yüklenemedi:", e));
}
function saveCMSBanner() {
    if(!isStaffNow(currentUser)) return;
    let t = document.getElementById('cmsHeroTitle') ? document.getElementById('cmsHeroTitle').value.trim() : "";
    let d = document.getElementById('cmsHeroDesc') ? document.getElementById('cmsHeroDesc').value.trim() : "";
    let limitVal = document.getElementById('cmsFreeShippingLimit') ? parseFloat(document.getElementById('cmsFreeShippingLimit').value) : 3000;
    let costVal = document.getElementById('cmsShippingCost') ? parseFloat(document.getElementById('cmsShippingCost').value) : 99;

    let updatePayload = {
        heroTitle: t || "LÜKSÜN YENİ TANIMI",
        heroDesc: d || "Zarafetin ve metalik estetiğin fütüristik çizgilerle buluştuğu nokta.",
        freeShippingLimit: isNaN(limitVal) ? 3000 : limitVal,
        shippingCost: isNaN(costVal) ? 99 : costVal
    };

    db.collection("settings").doc("cms").set(updatePayload, { merge: true })
    .then(() => { 
        showToast("Banner ve kargo ayarları güncellendi!", 'success'); 
        loadCMSBanner(); 
    }).catch(e => showToast("Ayarlar kaydedilemedi: " + e.message, 'error'));
}

function toggleCompare(prodId, event) {
    if(event) event.stopPropagation();
    const index = compareList.indexOf(prodId);
    if(index > -1) { compareList.splice(index, 1); } 
    else {
        if(compareList.length >= 3) { showToast("En fazla 3 ürün karşılaştırılabilir.", 'error'); return; }
        compareList.push(prodId);
    }
    updateCompareBar(); filterAndSortProducts();
}

function updateCompareBar() {
    const bar = document.getElementById('compareBar');
    const countEl = document.getElementById('compareCount');
    if(!bar || !countEl) return;
    countEl.innerText = compareList.length;
    if(compareList.length > 0) bar.classList.add('show'); else bar.classList.remove('show');
}

function clearCompareSelection() { compareList = []; updateCompareBar(); filterAndSortProducts(); }

function goToComparePage() {
    const container = document.getElementById('compareContainer');
    if(!container) return;
    if(compareList.length === 0) { container.innerHTML = '<p class="text-brand-400">Ürün seçilmedi.</p>'; switchPage('compare'); return; }
    let html = '';
    compareList.forEach(id => {
        let p = allProducts.find(item => item.id === id);
        if(p) {
            let img = (p.images && p.images[0]) ? p.images[0] : (p.image || 'https://placehold.co/300');
            html += `<div class="bg-brand-50 p-6 rounded-2xl border border-brand-200 text-center"><img src="${img}" class="w-full h-64 object-cover rounded-xl mb-4 shadow-sm"><h3 class="font-serif font-bold text-lg text-brand-900 mb-2">${p.name}</h3><p class="font-semibold text-brand-900 text-lg mb-3">${(p.price||0).toLocaleString('tr-TR')} TL</p><p class="text-xs text-brand-500 uppercase mb-2">Kategori: ${p.category || 'Diğer'}</p><p class="text-xs text-brand-500 mb-4">Stok: ${p.stock > 0 ? (p.stock <= 5 ? 'Sınırlı Stok!' : 'Mevcut') : 'Tükendi'}</p><p class="text-xs text-brand-600 text-left border-t border-brand-200 pt-4">${p.description || 'Açıklama yok.'}</p></div>`;
        }
    });
    container.innerHTML = html; switchPage('compare');
}

function clearCompare() { compareList = []; updateCompareBar(); switchPage('collection'); }

// --- YENİ: Favorileri (Wishlist) Firestore ile Senkronize Etme ---
function syncWishlistToFirebase() {
    if (currentUser && !currentUser.isAnonymous) {
        db.collection("users").doc(currentUser.uid).set({
            wishlist: wishlist,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(e => console.error("Wishlist sync hatası:", e));
    }
}

function loadWishlistFromFirebase(uid) {
    db.collection("users").doc(uid).get().then((doc) => {
        if (doc.exists && doc.data().wishlist) {
            wishlist = doc.data().wishlist;
            localStorage.setItem("ballin_wishlist", JSON.stringify(wishlist));
            updateWishlistBadge();
            renderWishlistGrid();
        }
    }).catch(e => console.error("Wishlist okuma hatası:", e));
}

function toggleWishlist(productId, event) {
    if(event) event.stopPropagation();
    const index = wishlist.indexOf(productId);
    if(index > -1) { wishlist.splice(index, 1); showToast("Favorilerden çıkarıldı.", 'success'); } 
    else { wishlist.push(productId); showToast("Favorilere eklendi.", 'success'); }
    localStorage.setItem('ballin_wishlist', JSON.stringify(wishlist));
    
    syncWishlistToFirebase();
    updateWishlistBadge(); filterAndSortProducts(); renderNewGrid(); renderWishlistGrid(); renderMainGrid();
}

function updateWishlistBadge() {
    const badge = document.getElementById('wishlistBadge');
    if(!badge) return;
    if(wishlist.length > 0) { badge.classList.remove('hidden'); badge.innerText = wishlist.length; } else { badge.classList.add('hidden'); }
}

function renderWishlistGrid() {
    const grid = document.getElementById('wishlistProductGrid');
    if(!grid) return;
    const favProducts = allProducts.filter(p => wishlist.includes(p.id));
    if(favProducts.length === 0) { grid.innerHTML = '<p class="text-center text-brand-400 col-span-full">Favori listeniz boş.</p>'; return; }
    let html = ''; favProducts.forEach(prod => { html += createProductCard(prod); }); grid.innerHTML = html;
}

function exportProductsToCSV() {
    if(allProducts.length === 0) { showToast("Dışa aktarılacak ürün bulunamadı.", 'error'); return; }
    let csv = "name,price,category,stock,sizeStock,description,image\n";
    allProducts.forEach(p => {
        let img = (p.images && p.images[0]) ? p.images[0] : (p.image || '');
        let desc = (p.description || '').replace(/"/g, '""');
        csv += `"${p.name}",${p.price},"${p.category || 'Giyim'}",${p.stock},"${p.sizeStock || ''}","${desc}","${img}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `ballin_katalog_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Ürünler CSV olarak indirildi.", 'success');
}

function importProductsFromCSV() {
    const fileInput = document.getElementById('csvFileInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) { showToast("Lütfen bir CSV dosyası seçin.", 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        if(rows.length <= 1) { showToast("CSV dosyası geçersiz.", 'error'); return; }
        let batch = db.batch();
        let count = 0;
        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(cols.length >= 4) {
                let name = cols[0].replace(/"/g, '').trim();
                let price = parseFloat(cols[1]) || 0;
                let category = cols[2].replace(/"/g, '').trim();
                let stock = parseInt(cols[3]) || 0;
                let sizeStock = cols[4] ? cols[4].replace(/"/g, '').trim() : '';
                let desc = cols[5] ? cols[5].replace(/"/g, '').trim() : '';
                let img = cols[6] ? cols[6].replace(/"/g, '').trim() : '';

                let docRef = db.collection("products").doc();
                batch.set(docRef, { name: name, price: price, category: category, stock: stock, sizeStock: sizeStock, description: desc, images: [img], createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                count++;
            }
        }
        batch.commit().then(() => { showToast(`${count} ürün kataloğa aktarıldı!`, 'success'); fileInput.value = ''; loadProducts(); }).catch(err => showToast("Hata: " + err.message, 'error'));
    };
    reader.readAsText(fileInput.files[0]);
}

let uploadedImages = ["", "", "", ""];
function previewImageSlot(inputEl, slotIndex) {
    if(inputEl.files && inputEl.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImages[slotIndex] = e.target.result;
            const preview = document.getElementById(`previewSlot_${slotIndex}`);
            if(preview) {
                preview.src = uploadedImages[slotIndex];
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(inputEl.files[0]);
    }
}

function loadCouponsAdmin() {
    db.collection("coupons").get().then((snap) => {
        activeCoupons = [];
        let html = '<table class="w-full text-left text-sm mt-2"><thead><tr class="border-b border-brand-200"><th class="pb-2">Kod</th><th class="pb-2">İndirim</th><th class="pb-2">Limit</th><th class="pb-2">İşlem</th></tr></thead><tbody>';
        if(snap.empty) { html = '<p class="text-xs text-brand-400">Aktif kupon yok.</p>'; } 
        else {
            snap.forEach(doc => {
                let c = doc.data(); c.id = doc.id; activeCoupons.push(c);
                html += `<tr class="border-b border-brand-100"><td class="py-2 font-bold">${c.code}</td><td class="py-2">%${c.discount}</td><td class="py-2">${c.usedCount || 0} / ${c.limit}</td><td class="py-2"><button onclick="deleteCoupon('${c.id}')" class="text-red-600 text-xs font-bold hover:underline">Sil</button></td></tr>`;
            });
            html += '</tbody></table>';
        }
        const box = document.getElementById('adminCouponsList');
        if(box) box.innerHTML = html;
    }).catch(e=>{});
}

function addNewCoupon() {
    if(!isStaffNow(currentUser)) return;
    let code = document.getElementById('adminCouponCode') ? document.getElementById('adminCouponCode').value.trim().toUpperCase() : "";
    let discount = document.getElementById('adminCouponDiscount') ? parseFloat(document.getElementById('adminCouponDiscount').value) : NaN;
    let limit = document.getElementById('adminCouponLimit') ? parseInt(document.getElementById('adminCouponLimit').value) : NaN;
    let expiry = document.getElementById('adminCouponExpiry') ? document.getElementById('adminCouponExpiry').value : "";

    if(!code || isNaN(discount) || isNaN(limit)) { showToast("Kupon kodu, indirim ve kişi sınırını eksiksiz doldurun.", 'error'); return; }

    db.collection("coupons").add({ 
        code: code, 
        discount: discount, 
        limit: limit, 
        expiryDate: expiry, 
        usedCount: 0, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp() 
    })
    .then(() => { 
        showToast("Kupon başarıyla aktifleştirildi!", 'success'); 
        if(document.getElementById('adminCouponCode')) document.getElementById('adminCouponCode').value = ''; 
        if(document.getElementById('adminCouponDiscount')) document.getElementById('adminCouponDiscount').value = ''; 
        if(document.getElementById('adminCouponLimit')) document.getElementById('adminCouponLimit').value = ''; 
        if(document.getElementById('adminCouponExpiry')) document.getElementById('adminCouponExpiry').value = ''; 
        loadCouponsAdmin(); 
    }).catch(e=> showToast("Hata: " + e.message, 'error'));
}

function deleteCoupon(id) { db.collection("coupons").doc(id).delete().then(() => { showToast("Kupon silindi.", 'success'); loadCouponsAdmin(); }).catch(e=>{}); }

function renderBulkTable() {
    const tbody = document.getElementById('bulkTableBody');
    if(!tbody) return;
    if(allProducts.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-brand-400">Ürün yok.</td></tr>'; return; }
    let html = '';
    allProducts.forEach(prod => {
        html += `
            <tr class="border-b border-brand-100 hover:bg-white transition-colors">
                <td class="py-3 pl-2"><input type="checkbox" class="product-checkbox" value="${prod.id}"></td>
                <td class="py-3 font-medium text-xs">${prod.name}</td>
                <td class="py-3 text-[10px] font-bold text-brand-500 uppercase">${prod.category || 'Diğer'}</td>
                <td class="py-3"><input type="number" id="bulkPrice_${prod.id}" value="${prod.price}" class="w-20 bg-brand-50 border border-brand-200 rounded p-1.5 text-xs outline-none focus:border-brand-900"></td>
                <td class="py-3"><input type="number" id="bulkStock_${prod.id}" value="${prod.stock}" class="w-14 bg-brand-50 border border-brand-200 rounded p-1.5 text-xs outline-none focus:border-brand-900"></td>
                <td class="py-3"><input type="text" id="bulkSizeStock_${prod.id}" value="${prod.sizeStock || ''}" placeholder="S:2, M:0" class="w-32 bg-brand-50 border border-brand-200 rounded p-1.5 text-xs outline-none focus:border-brand-900"></td>
                <td class="py-3"><button onclick="saveBulkItem('${prod.id}')" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:bg-emerald-700">Kaydet</button></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function toggleSelectAll(master) { document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = master.checked); }

function bulkDeleteProducts() {
    let checked = document.querySelectorAll('.product-checkbox:checked');
    if(checked.length === 0) { showToast("Ürün seçilmedi.", 'error'); return; }
    if(!confirm(`Seçilen ${checked.length} ürünü silmek istiyor musunuz?`)) return;
    let batch = db.batch();
    checked.forEach(cb => { batch.delete(db.collection("products").doc(cb.value)); });
    batch.commit().then(() => { showToast("Ürünler silindi.", 'success'); loadProducts(); }).catch(e=>{});
}

function bulkMoveCategory() {
    let checked = document.querySelectorAll('.product-checkbox:checked');
    let newCatEl = document.getElementById('bulkTargetCategory');
    let newCat = newCatEl ? newCatEl.value : "Giyim";
    if(checked.length === 0) { showToast("Ürün seçilmedi.", 'error'); return; }
    let batch = db.batch();
    checked.forEach(cb => { batch.update(db.collection("products").doc(cb.value), { category: newCat }); });
    batch.commit().then(() => { showToast(`Kategori güncellendi.`, 'success'); loadProducts(); }).catch(e=>{});
}

function saveBulkItem(prodId) {
    let pEl = document.getElementById(`bulkPrice_${prodId}`);
    let sEl = document.getElementById(`bulkStock_${prodId}`);
    let ssEl = document.getElementById(`bulkSizeStock_${prodId}`);
    let newPrice = pEl ? parseFloat(pEl.value) : 0;
    let newStock = sEl ? parseInt(sEl.value) : 0;
    let newSizeStock = ssEl ? ssEl.value.trim() : "";
    if(isNaN(newPrice) || isNaN(newStock)) { showToast("Geçersiz fiyat veya stok değeri!", 'error'); return; }
    db.collection("products").doc(prodId).update({ price: newPrice, stock: newStock, sizeStock: newSizeStock }).then(() => { showToast("Stoklar kaydedildi!", 'success'); loadProducts(); }).catch(e=>{});
}

function loadCustomersCRM() {
    if(!isStaffNow(currentUser)) return;
    db.collection("users").get().then((snap) => {
        allCustomers = [];
        let html = '<table class="w-full text-left text-sm"><thead><tr class="border-b border-brand-200"><th class="pb-2">Ad Soyad</th><th class="pb-2">E-posta</th><th class="pb-2">Telefon</th><th class="pb-2">Puan</th><th class="pb-2">Şehir</th><th class="pb-2">Kayıt Tarihi</th></tr></thead><tbody>';
        if(snap.empty) { html = '<p class="text-xs text-brand-400">Müşteri yok.</p>'; }
        else {
            snap.forEach(doc => {
                let u = doc.data();
                let dStr = (u.lastUpdated && typeof u.lastUpdated.toDate === 'function') ? u.lastUpdated.toDate().toLocaleDateString('tr-TR') : "Bilinmiyor";
                html += `<tr class="border-b border-brand-100 hover:bg-white"><td class="py-3 font-medium">${u.name || ''} ${u.surname || ''}</td><td class="py-3">${doc.id}</td><td class="py-3">${u.phone || '-'}</td><td class="py-3 font-bold text-amber-500">${u.points || 0}</td><td class="py-3">${u.city ? u.city + '/' + (u.district||'') : '-'}</td><td class="py-3 text-xs text-brand-500">${dStr}</td></tr>`;
            });
            html += '</tbody></table>';
        }
        const box = document.getElementById('adminCustomersContainer');
        if(box) box.innerHTML = html;
    }).catch(e=>{});
}

function loadAbandonedCarts() {
    if(!isStaffNow(currentUser)) return;
    db.collection("users").get().then(snap => {
        let html = '';
        snap.forEach(doc => {
            let u = doc.data();
            if(u.cartData && Array.isArray(u.cartData) && u.cartData.length > 0) {
                let total = u.cartData.reduce((s, i) => s + (i.price||0), 0);
                html += `<div class="flex justify-between items-center bg-white border border-brand-200 p-4 rounded-xl mb-2 shadow-sm"><div><p class="font-bold text-sm">${u.name || ''} ${u.surname || ''} <span class="text-xs text-brand-400 font-normal">(${doc.id})</span></p><p class="text-xs text-brand-500 mt-1">Sepette: ${u.cartData.length} ürün - Toplam: ${total.toLocaleString('tr-TR')} TL</p></div><button onclick="sendRecoveryEmail('${doc.id}', '${u.name||''}')" class="bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-amber-600 shadow-md"><i class="fa-solid fa-paper-plane mr-1"></i> İndirimli E-posta Gönder</button></div>`;
            }
        });
        if(html === '') html = '<p class="text-xs text-brand-400">Terk edilmiş sepet bulunamadı.</p>';
        const box = document.getElementById('adminAbandonedContainer');
        if(box) box.innerHTML = html;
    }).catch(e=>{});
}

function compressImageForEmail(base64Str) { 
    return new Promise((resolve) => { 
        if (!base64Str.startsWith('data:image')) { 
            resolve(base64Str); 
            return; 
        } 
        let img = new Image(); 
        img.onload = function() { 
            let canvas = document.createElement('canvas'); 
            canvas.width = 50; 
            canvas.height = 65; 
            let ctx = canvas.getContext('2d'); 
            ctx.drawImage(img, 0, 0, 50, 65); 
            let compressed = canvas.toDataURL('image/jpeg', 0.6); 
            resolve(compressed); 
        }; 
        img.onerror = () => resolve('https://placehold.co/100x120?text=BALLIN'); 
        img.src = base64Str; 
    }); 
}

async function generateEmailItemsHTML(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return '<p style="font-size:12px;color:#868e96;">Ürün detayı bulunamadı.</p>';
    }
    let html = '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-top: 10px;">';
    for (let item of items) {
        let rawImg = item.image || '';
        let finalImgSrc = 'https://placehold.co/100x120?text=BALLIN';
        if (rawImg.startsWith('data:image')) {
            finalImgSrc = await compressImageForEmail(rawImg);
        } else if (rawImg.startsWith('http')) {
            finalImgSrc = rawImg;
        }
        let price = (item.price || 0).toLocaleString('tr-TR') + ' TL';
        let size = item.size && item.size !== "Standart" ? `<span style="font-size: 11px; color: #868e96; display: block; margin-top: 3px;">Beden: <strong>${item.size}</strong></span>` : '';
        html += `
        <tr style="border-bottom: 1px solid #f1f3f5; background-color: #ffffff;">
            <td style="padding: 10px; width: 60px; vertical-align: middle;">
                <img src="${finalImgSrc}" alt="${item.name}" width="50" height="65" style="width: 50px; height: 65px; object-fit: cover; border-radius: 6px; display: block; border: 1px solid #eee;">
            </td>
            <td style="padding: 10px; vertical-align: middle;">
                <span style="font-size: 13px; font-weight: bold; color: #212529; display: block;">${item.baseName || item.name}</span>
                ${size}
            </td>
            <td align="right" style="padding: 10px; vertical-align: middle; font-weight: bold; font-size: 13px; color: #212529; white-space: nowrap;">
                ${price}
            </td>
        </tr>`;
    }
    html += '</table>';
    return html;
}

/* sendOrderConfirmationEmail yama-1 ile Worker üzerinden çalışır */

/* sendShippingUpdateEmail yama-1 ile Worker üzerinden çalışır */

function sendRecoveryEmail(email, name) {
    showToast(`${email} adresine sepet hatırlatması iletildi.`, 'success');
}

function printInvoice(orderId) {
    let order = allOrders.find(o => o.id === orderId);
    if(!order) { showToast("Sipariş verisi alınamadı.", 'error'); return; }
    let shipInfo = order.shippingInfo || {};
    let orderDate = (order.orderDate && typeof order.orderDate.toDate === 'function') ? order.orderDate.toDate().toLocaleString('tr-TR') : '-';
    
    let items = order.items || [];
    let itemsSubtotal = items.reduce((s, i) => s + (i.price || 0), 0);
    let usedPts = Number(order.usedPoints) || 0;
    let finalPaid = Number(order.totalAmount) || 0;
    
    let netProductTotal = Math.max(0, itemsSubtotal - usedPts);
    let shippingFee = Math.max(0, finalPaid - netProductTotal);
    let shippingText = shippingFee === 0 ? '<span style="color:#10b981; font-weight:bold;">Ücretsiz (0 TL)</span>' : `${shippingFee.toLocaleString('tr-TR')} TL`;

    let printWin = window.open('', '', 'width=800,height=650');
    printWin.document.write(`
        <html>
        <head>
            <title>Fatura & Kargo - ${orderId}</title>
            <style>
                body { font-family:'Segoe UI', Arial, sans-serif; padding:40px; color:#111; }
                table { width:100%; border-collapse:collapse; margin-top:20px; }
                th, td { border:1px solid #ccc; padding:12px; text-align:left; }
                th { background:#f4f4f4; font-size:13px; }
                .header { border-bottom:3px solid #000; padding-bottom:15px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; }
                .barcode-box { text-align:center; padding:10px 18px; border:2px dashed #000; display:inline-block; }
                .customer-box { background:#f9f9f9; padding:15px 20px; border:1px solid #ddd; border-radius:6px; margin-top:15px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 style="margin:0; font-size:24px;">BALLIN E-Arşiv Fatura & Kargo Fişi</h1>
                    <p style="color:#555; margin-top:4px; font-size:13px;">Resmi e-ticaret bilgilendirme belgesidir.</p>
                </div>
                <div class="barcode-box">
                    <h4 style="margin:0 0 3px 0; font-size:11px; color:#555; letter-spacing:1px;">KARGO BARKODU</h4>
                    <p style="font-family:monospace; font-size:24px; letter-spacing:4px; margin:0; font-weight:bold;">*${orderId.toUpperCase().slice(0,8)}*</p>
                </div>
            </div>

            <p style="margin:4px 0; font-size:13px;"><strong>Sipariş No:</strong> #${orderId.toUpperCase()}</p>
            <p style="margin:4px 0; font-size:13px;"><strong>Tarih:</strong> ${orderDate}</p>

            <div class="customer-box">
                <h3 style="margin:0 0 6px 0; font-size:15px;">Alıcı & Kargo Bilgileri</h3>
                <p style="font-size:15px; margin:0 0 4px 0;"><strong>${shipInfo.name || ''} ${shipInfo.surname || ''}</strong></p>
                <p style="margin:0 0 4px 0; font-size:13px;">${shipInfo.address || ''} - <strong>${shipInfo.district || ''} / ${shipInfo.city || ''}</strong></p>
                <p style="margin:0; font-size:13px;"><strong>Tel:</strong> ${shipInfo.phone || '-'} | <strong>E-posta:</strong> ${order.userEmail || '-'}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Ürün Adı</th>
                        <th style="width:100px; text-align:center;">Beden</th>
                        <th style="width:130px; text-align:right;">Tutar</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                        <tr>
                            <td><strong>${i.baseName || i.name}</strong></td>
                            <td style="text-align:center;">${i.size || 'Standart'}</td>
                            <td style="text-align:right;">${(i.price || 0).toLocaleString('tr-TR')} TL</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="text-align:right; margin-top:25px; line-height: 1.8;">
                <div style="font-size:14px; color:#555;">Ara Toplam: <strong>${itemsSubtotal.toLocaleString('tr-TR')} TL</strong></div>
                ${usedPts > 0 ? `<div style="font-size:14px; color:#d97706; font-weight:bold;">Kullanılan Puan: -${usedPts.toLocaleString('tr-TR')} TL</div>` : ''}
                <div style="font-size:14px; color:#555;">Kargo Ücreti: <strong>${shippingText}</strong></div>
                <h1 style="border-top:2px solid #000; padding-top:8px; display:inline-block; margin-top:8px; font-size:24px;">Tahsil Edilen Toplam: ${finalPaid.toLocaleString('tr-TR')} TL</h1>
            </div>

            <script>
                setTimeout(() => { window.print(); window.close(); }, 400);
            <\/script>
        </body>
        </html>
    `);
    printWin.document.close();
}

function setDashboardPeriod(period, btnEl) {
    document.querySelectorAll('#accAnalytics button').forEach(b => { b.classList.remove('bg-brand-900', 'text-white'); b.classList.add('bg-brand-200', 'text-brand-800'); });
    btnEl.classList.remove('bg-brand-200', 'text-brand-800'); btnEl.classList.add('bg-brand-900', 'text-white');
    currentDashboardPeriod = period; updateDashboardStats();
}

function setOrderFilter(status, btnEl) {
    document.querySelectorAll('#accOrders button').forEach(b => { if(b.getAttribute('onclick') && b.getAttribute('onclick').includes('setOrderFilter')) { b.classList.remove('bg-brand-900', 'text-white'); b.classList.add('bg-brand-200', 'text-brand-800'); } });
    btnEl.classList.remove('bg-brand-200', 'text-brand-800'); btnEl.classList.add('bg-brand-900', 'text-white');
    currentOrderFilter = status; loadAdminOrders();
}

function toggleSelectAllOrders(master) { document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = master.checked); }

function bulkUpdateOrderStatus(targetStatus) {
    if(!isStaffNow(currentUser)) return;
    let checked = document.querySelectorAll('.order-checkbox:checked');
    if(checked.length === 0) { showToast("En az bir sipariş seçin.", 'error'); return; }
    if(!confirm(`Seçilen ${checked.length} sipariş '${targetStatus}' yapılacak. Onaylıyor musunuz?`)) return;

    let batch = db.batch();
    checked.forEach(cb => { batch.update(db.collection("orders").doc(cb.value), { status: targetStatus }); });
    batch.commit().then(() => { showToast(`Siparişler güncellendi!`, 'success'); loadAdminOrders(); loadOrdersAndCalculateStats(); }).catch(e=>{});
}

function loadOrdersAndCalculateStats() {
    db.collection("orders").orderBy("orderDate", "desc").get().then((snap) => {
        allOrders = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; allOrders.push(d); }); 
        updateDashboardStats();
    }).catch(e=>{});
}

// --- YENİ: Net Ciro Hesabı (İptal ve İadeleri Cirodan Düşer) ---
function updateDashboardStats() {
    let criticalCount = allProducts.filter(p => p.stock <= 3).length;
    if(document.getElementById('statCriticalStock')) document.getElementById('statCriticalStock').innerText = criticalCount;
    let now = new Date("2026-10-17T02:33:00");
    let filteredOrders = allOrders.filter(o => {
        if(!o.orderDate || currentDashboardPeriod === 'all') return true;
        if(typeof o.orderDate.toDate !== 'function') return true;
        let oDate = o.orderDate.toDate(); let diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        if(currentDashboardPeriod === '1month') return diffDays <= 30;
        if(currentDashboardPeriod === '3months') return diffDays <= 90;
        return true;
    });

    let totalRev = 0; let preparing = 0; let shipped = 0; let completed = 0;
    let productSalesCount = {}; let productRevenueMap = {};

    filteredOrders.forEach(o => {
        if(o.status !== 'İptal Edildi' && o.status !== 'İade Onaylandı' && o.totalAmount) {
             totalRev += o.totalAmount;
             if(o.items && Array.isArray(o.items)) {
                o.items.forEach(item => {
                    let pName = item.baseName || item.name; let pPrice = item.price || 0;
                    productSalesCount[pName] = (productSalesCount[pName] || 0) + 1;
                    productRevenueMap[pName] = (productRevenueMap[pName] || 0) + pPrice;
                });
            }
        }
        
        if(o.status === 'Kargoya Verildi') shipped++;
        else if(o.status === 'Tamamlandı') completed++;
        else if(o.status === 'Hazırlanıyor') preparing++;
    });

    if(document.getElementById('statTotalOrders')) document.getElementById('statTotalOrders').innerText = filteredOrders.length;
    if(document.getElementById('statPreparingOrders')) document.getElementById('statPreparingOrders').innerText = preparing;
    if(document.getElementById('statShippedOrders')) document.getElementById('statShippedOrders').innerText = shipped;
    if(document.getElementById('statCompletedOrders')) document.getElementById('statCompletedOrders').innerText = completed;
    if(document.getElementById('statTotalRevenue')) document.getElementById('statTotalRevenue').innerText = totalRev.toLocaleString('tr-TR') + ' TL';

    let sortedProducts = Object.keys(productSalesCount).sort((a,b) => productSalesCount[b] - productSalesCount[a]);
    let topContainer = document.getElementById('topProductsContainer');
    
    if(topContainer) {
        if(sortedProducts.length === 0) { topContainer.innerHTML = '<p class="text-xs text-brand-400">Satış verisi yok.</p>'; } 
        else {
            let html = '<div class="space-y-2">';
            sortedProducts.slice(0, 5).forEach((pName, index) => {
                let qty = productSalesCount[pName]; let rev = productRevenueMap[pName];
                html += `<div class="flex justify-between text-xs border-b border-brand-100 pb-2"><span><strong>#${index + 1}</strong> ${pName}</span> <span class="text-brand-500">Satış: <strong>${qty}</strong> | Ciro: <strong>${rev.toLocaleString('tr-TR')} TL</strong></span></div>`;
            });
            topContainer.innerHTML = html + '</div>';
        }
    }
}

function renderMainGrid() { 
    const mainGrid = document.getElementById('mainProductGrid'); 
    if(!mainGrid) return;
    if(allProducts.length === 0) { mainGrid.innerHTML = '<p class="text-center text-brand-400 col-span-full">Ürün yok.</p>'; return; } 
    let html = ''; allProducts.slice(0, 3).forEach(prod => { html += createProductCard(prod); }); mainGrid.innerHTML = html; 
}

function setCategoryFilter(catName, btnElement) { 
    document.querySelectorAll('.cat-btn').forEach(b => { 
        b.classList.remove('bg-brand-900', 'text-white', 'active'); 
        b.classList.add('bg-brand-100', 'text-brand-700'); 
    }); 
    if(btnElement) { 
        btnElement.classList.remove('bg-brand-100', 'text-brand-700'); 
        btnElement.classList.add('bg-brand-900', 'text-white', 'active'); 
    } 
    currentCategory = catName; 
    filterAndSortProducts(); 
}

// --- YENİ: Gelişmiş Filtreleme (Beden, Fiyat, Arama, Kategori) ---
function filterAndSortProducts() {
    let searchQuery = document.getElementById('productSearchInput') ? document.getElementById('productSearchInput').value.toLowerCase() : '';
    let sizeVal = document.getElementById('filterSize') ? document.getElementById('filterSize').value : "all";
    let priceVal = document.getElementById('filterPriceRange') ? document.getElementById('filterPriceRange').value : "all";

    let filtered = allProducts.filter(p => {
        let matchCat = (currentCategory === 'Tümü' || p.category === currentCategory);
        let matchSearch = p.name.toLowerCase().includes(searchQuery) || (p.description && p.description.toLowerCase().includes(searchQuery));
        
        let matchPrice = true;
        if (priceVal === "0-1000") matchPrice = p.price <= 1000;
        else if (priceVal === "1000-3000") matchPrice = p.price > 1000 && p.price <= 3000;
        else if (priceVal === "3000+") matchPrice = p.price > 3000;

        let matchSize = true;
        if (sizeVal !== "all" && p.sizeStock) {
            let parsedSize = {};
            p.sizeStock.split(',').forEach(part => {
                let [sz, st] = part.split(':');
                if(sz && st) parsedSize[sz.trim().toUpperCase()] = parseInt(st.trim()) || 0;
            });
             matchSize = parsedSize[sizeVal] && parsedSize[sizeVal] > 0;
        } else if (sizeVal !== "all" && !p.sizeStock) {
             matchSize = false; 
        }
        
        return matchCat && matchSearch && matchPrice && matchSize;
    });

    const colGrid = document.getElementById('collectionProductGrid');
    if(!colGrid) return;
    if(filtered.length === 0) { colGrid.innerHTML = '<p class="text-center text-brand-400 col-span-full">Ürün bulunamadı.</p>'; return; }
    let html = ''; filtered.forEach(prod => { html += createProductCard(prod); }); colGrid.innerHTML = html; 
}

function renderNewGrid() { 
    const newGrid = document.getElementById('newProductGrid'); 
    if(!newGrid) return;
    if(allProducts.length === 0) { newGrid.innerHTML = '<p class="text-center text-brand-400 col-span-full">Ürün yok.</p>'; return; } 
    let html = ''; allProducts.slice(0, 4).forEach(prod => { html += createProductCard(prod); }); newGrid.innerHTML = html; 
}

function createProductCard(prod) { 
    let isOut = prod.stock <= 0;
    let stockBadgeHTML = isOut ? `<span class="absolute top-3 right-3 bg-red-600 text-white px-2.5 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Tükendi</span>` : (prod.stock <= 5 ? `<span class="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Sınırlı Stok</span>` : '');
    let coverImg = (prod.images && prod.images.length > 0) ? prod.images[0] : (prod.image || 'https://placehold.co/600x800/f1f3f5/a3a3a3?text=BALLIN');
    let isFav = wishlist.includes(prod.id);
    let isCompared = compareList.includes(prod.id);
    
    return `
        <div class="group relative flex flex-col cursor-pointer bg-brand-50 rounded-2xl p-4 overflow-hidden border border-brand-100 hover:border-brand-300 transition-all hover:shadow-xl" onclick="openProductDetail('${prod.id}')">
            ${stockBadgeHTML}
            <div class="absolute top-3 left-3 z-10 flex flex-col gap-2">
                <button onclick="toggleWishlist('${prod.id}', event)" class="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center transition-colors ${isFav ? 'text-red-500' : 'text-brand-400 hover:text-red-500'}"><i class="fa-solid fa-heart"></i></button>
                <input type="checkbox" class="compare-checkbox w-5 h-5 accent-brand-900 cursor-pointer shadow" ${isCompared ? 'checked' : ''} onclick="toggleCompare('${prod.id}', event)" title="Karşılaştır">
            </div>
            <div class="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-4 bg-white">
                <img src="${coverImg}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isOut ? 'grayscale brightness-50' : ''}">
            </div>
            <div class="flex justify-between items-start mt-2">
                <div>
                    <h3 class="text-sm font-medium text-brand-900 font-serif line-clamp-1">${prod.name}</h3>
                    <p class="text-[10px] text-brand-400 uppercase mt-1 tracking-wider">${prod.category || 'Diğer'}</p>
                </div>
                <p class="text-sm font-bold text-brand-900">${(prod.price||0).toLocaleString('tr-TR')} TL</p>
            </div>
        </div>`; 
}

function switchPage(pageId) { 
    if (pageId === 'admin') {
        if (!isStaffNow(currentUser)) {
            showToast("Bu sayfaya erişim yetkiniz bulunmamaktadır.", 'error');
            return;
        }
    }

    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden')); 
    const target = document.getElementById('page-' + pageId);
    if(target) target.classList.remove('hidden');
    window.scrollTo(0, 0); 
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenu) mobileMenu.classList.add('hidden');
    if (pageId !== 'product-detail') {
        window.history.pushState({}, '', '/#' + pageId);
    }
}

let currentSliderImages = []; let selectedSize = ""; let activeProductId = null; let parsedSizeStock = {};

function openProductDetail(id) {
    const prod = allProducts.find(p => p.id === id); if(!prod) return;
    currentSliderImages = (prod.images && prod.images.length > 0) ? prod.images : [prod.image];
    activeProductId = prod.id;
    
    parsedSizeStock = {};
    if(prod.sizeStock && typeof prod.sizeStock === 'string' && prod.sizeStock.trim() !== "") {
        prod.sizeStock.split(',').forEach(part => {
            let [sz, st] = part.split(':');
            if(sz && st) parsedSizeStock[sz.trim().toUpperCase()] = parseInt(st.trim()) || 0;
        });
    }

    let sizeKeys = Object.keys(parsedSizeStock);
    selectedSize = "";
    for(let sz of sizeKeys) { if(parsedSizeStock[sz] > 0) { selectedSize = sz; break; } }
    if(!selectedSize && sizeKeys.length > 0) selectedSize = sizeKeys[0];

    let sliderThumbnails = '';
    if(currentSliderImages.length > 1) {
        sliderThumbnails = '<div class="flex gap-2 mt-3 overflow-x-auto pb-2">';
        currentSliderImages.forEach((imgSrc, idx) => {
            sliderThumbnails += `<img src="${imgSrc}" class="w-16 h-20 object-cover rounded-lg border-2 cursor-pointer transition-all ${idx===0 ? 'border-brand-900' : 'border-brand-200 opacity-60 hover:opacity-100'}" onclick="document.getElementById('activeMainImg').src='${imgSrc}'; document.querySelectorAll('#productDetailContainer .border-brand-900').forEach(el=>el.classList.replace('border-brand-900','border-brand-200')); this.classList.replace('border-brand-200','border-brand-900');">`;
        });
        sliderThumbnails += '</div>';
    }

    let isFavDetail = wishlist.includes(prod.id);
    let favBtnHtml = `<button onclick="toggleWishlist('${prod.id}', event); if(activeProductId === '${prod.id}') openProductDetail('${prod.id}');" class="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${isFavDetail ? 'text-red-500' : 'text-brand-400 hover:text-red-500'}"><i class="fa-solid fa-heart text-lg"></i></button>`;

    let sliderHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
                <div class="relative aspect-[4/5] bg-brand-50 rounded-2xl overflow-hidden mb-2 shadow-sm border border-brand-100 zoom-img-container">
                    ${favBtnHtml}
                    <img src="${currentSliderImages[0]}" id="activeMainImg" class="w-full h-full object-cover">
                </div>
                ${sliderThumbnails}
            </div>
            <div class="flex flex-col justify-center">`;
    
    let sizesHTML = "";
    if(sizeKeys.length > 0) {
        sizesHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-3">
                    <label class="block text-xs font-bold uppercase tracking-wider text-brand-500">Beden Seçimi</label>
                    <button onclick="toggleSizeGuide()" class="text-xs text-brand-900 underline font-semibold"><i class="fa-solid fa-ruler mr-1"></i>Beden Rehberi</button>
                </div>
                <div class="flex gap-2 flex-wrap" id="sizeSelectorGroup">`;
        sizeKeys.forEach((sz) => {
            let stCount = parsedSizeStock[sz];
            let isOut = stCount <= 0;
            sizesHTML += `<button class="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${sz === selectedSize && !isOut ? 'border-brand-900 bg-brand-900 text-white shadow-md transform scale-105' : 'border-brand-200 text-brand-700 hover:border-brand-400'} ${isOut ? 'opacity-40 line-through border-red-200 text-red-500 hover:border-red-200' : ''}" onclick="selectSizeOrNotify('${sz}', ${isOut}, this, '${prod.id}', '${prod.name.replace(/'/g, "\\'")}')">${sz} ${isOut ? '<span class="text-[9px] block">Haber Ver</span>' : ''}</button>`;
        });
        sizesHTML += `</div></div>`;
    }

    let isGlobalOut = prod.stock <= 0;
    let btnStatus = !isGlobalOut ? `<button onclick="addDetailedToCart('${prod.id}', '${prod.name.replace(/'/g, "\\'")}', ${prod.price}, '${currentSliderImages[0]}')" class="w-full bg-brand-900 text-white py-4 rounded-xl font-bold hover:bg-brand-800 transition-colors shadow-xl text-sm uppercase tracking-widest"><i class="fa-solid fa-cart-plus mr-2"></i> Sepete Ekle</button>` : `<button onclick="notifyWhenAvailable('${prod.id}', '${prod.name.replace(/'/g, "\\'")}')" class="w-full bg-brand-100 border border-brand-300 text-brand-700 py-4 rounded-xl font-bold text-sm uppercase tracking-widest"><i class="fa-regular fa-bell mr-2"></i> Stokta Yok - Gelince Haber Ver</button>`;
    
    let descText = prod.description || 'Premium BALLIN koleksiyonuna ait bu özel tasarım ürün, fütüristik çizgileri ve kaliteli yapısıyla tarzınıza eşsiz bir dokunuş katar.';
    let shareBtnHTML = `<button onclick="shareProduct()" class="w-full mt-3 border border-brand-200 text-brand-700 py-3 rounded-xl text-sm font-medium hover:bg-brand-50 transition-colors"><i class="fa-solid fa-share-nodes mr-2"></i> Ürünü Paylaş</button>`;

    let crossSellHtml = '';
    let others = allProducts.filter(p => p.id !== prod.id && p.stock > 0).sort(()=> 0.5 - Math.random()).slice(0, 2);
    if(others.length > 0) {
        crossSellHtml = `<div class="mt-10 border-t border-brand-100 pt-8"><h3 class="font-serif text-lg font-bold text-brand-900 mb-4"><i class="fa-solid fa-wand-magic-sparkles mr-2 text-amber-500"></i>Kombini Tamamla</h3><div class="grid grid-cols-2 gap-4">`;
        others.forEach(o => {
            let img = o.images && o.images.length > 0 ? o.images[0] : (o.image || 'https://placehold.co/300');
            crossSellHtml += `<div class="cursor-pointer group bg-brand-50 p-3 rounded-xl border border-brand-100 hover:border-brand-300 transition-colors" onclick="openProductDetail('${o.id}')"><img src="${img}" class="w-full h-32 object-cover rounded-lg mb-3 shadow-sm group-hover:opacity-80 transition-opacity"><h4 class="text-xs font-bold font-serif text-brand-900 line-clamp-1">${o.name}</h4><p class="text-xs text-brand-600 mt-1">${(o.price||0).toLocaleString('tr-TR')} TL</p></div>`;
        });
        crossSellHtml += `</div></div>`;
    }

    let infoHTML = `<span class="text-xs uppercase tracking-widest text-brand-400 font-semibold">${prod.category || 'Koleksiyon'}</span><h2 class="font-serif text-3xl md:text-4xl text-brand-900 mt-2 mb-4">${prod.name}</h2><p class="text-2xl font-bold text-brand-900 mb-6">${(prod.price||0).toLocaleString('tr-TR')} TL</p><p class="text-brand-600 font-light text-sm mb-8 leading-relaxed">${descText}</p>${sizesHTML}<div class="text-xs font-bold mb-5 flex items-center gap-2 ${!isGlobalOut ? 'text-emerald-600' : 'text-red-500'}"><i class="fa-solid ${!isGlobalOut ? 'fa-check' : 'fa-xmark'}"></i> ${!isGlobalOut ? (prod.stock <= 5 ? 'Sadece '+prod.stock+' adet kaldı!' : 'Stokta mevcut') : 'Bu ürün şu an tükendi.'}</div>${btnStatus}${shareBtnHTML}${crossSellHtml}<div class="mt-10 pt-6 border-t border-brand-100 space-y-3 text-xs text-brand-500 font-medium"><p><i class="fa-solid fa-truck-fast text-brand-700 w-5"></i> 3000 TL üzeri kargo bedava</p><p><i class="fa-solid fa-arrow-rotate-left text-brand-700 w-5"></i> 14 gün içinde ücretsiz iade</p><p><i class="fa-solid fa-shield-halved text-brand-700 w-5"></i> 256-bit SSL güvenli alışveriş</p></div></div></div>`;
    
    infoHTML += `
        <div class="mt-16 border-t border-brand-100 pt-10">
            <h3 class="font-serif text-2xl font-bold mb-6 text-brand-900 flex items-center">Müşteri Değerlendirmeleri <span id="averageRatingContainer" class="ml-3 text-lg text-amber-500 font-bold"></span></h3>
            <div id="reviewsListContainer" class="space-y-3 mb-8 text-sm text-brand-600">Yorumlar yükleniyor...</div>
            <div class="bg-brand-50 p-6 rounded-2xl border border-brand-200 max-w-xl">
                <h4 class="font-bold text-sm mb-4">Değerlendirme Yap</h4>
                <div class="mb-4"><label class="block text-xs font-bold mb-2 uppercase tracking-wide text-brand-500">Puanınız</label><select id="newReviewRating" class="w-full bg-white border border-brand-200 rounded-lg p-3 text-sm outline-none focus:border-brand-900"><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option></select></div>
                <div class="mb-4"><label class="block text-xs font-bold mb-2 uppercase tracking-wide text-brand-500">Yorumunuz (İsteğe Bağlı)</label><textarea id="newReviewText" rows="3" placeholder="Ürün hakkında düşünceleriniz..." class="w-full bg-white border border-brand-200 rounded-lg p-3 text-sm outline-none focus:border-brand-900 resize-none"></textarea></div>
                <button onclick="submitProductReview()" class="bg-brand-900 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-800 shadow-lg">Gönder</button>
            </div>
        </div>`;

    const detailContainer = document.getElementById('productDetailContainer');
    if(detailContainer) detailContainer.innerHTML = sliderHTML + infoHTML; 
    switchPage('product-detail');
    
    let urunSlug = createSlug(prod.name);
    window.history.pushState({ id: prod.id }, prod.name, `/#/${urunSlug}`);
    
    loadProductReviews(prod.id);
}

function shareProduct() {
    if (navigator.share) { navigator.share({ title: 'BALLIN Store', url: window.location.href }).catch(() => {}); } 
    else { navigator.clipboard.writeText(window.location.href); showToast("Bağlantı panoya kopyalandı!", 'success'); }
}

// --- YENİ: Haber Ver Veritabanı Kaydı ---
function selectSizeOrNotify(sz, isOut, btnEl, prodId, prodName) { 
    if(isOut) { 
        let userMail = currentUser && currentUser.email ? currentUser.email : prompt(`${sz} bedeni stoğa girdiğinde haber almak için e-posta adresinizi girin:`); 
        if(userMail && userMail.includes('@')) { 
            db.collection("stock_alerts").add({
                email: userMail, productId: prodId || "Bilinmiyor", productName: prodName || "Bilinmiyor", size: sz, status: "bekliyor", requestDate: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => { showToast(`(${sz} Bedeni) Talebiniz alındı. Stok güncellendiğinde e-posta alacaksınız.`, 'success'); }).catch(e => { showToast("Talep kaydedilemedi, tekrar deneyin.", 'error'); });
        } else if (userMail) { showToast("Geçerli bir e-posta adresi giriniz.", 'error'); }
        return; 
    } 
    
    selectedSize = sz; 
    document.querySelectorAll('#sizeSelectorGroup button').forEach(b => { 
        b.classList.remove('border-brand-900', 'bg-brand-900', 'text-white', 'shadow-md', 'transform', 'scale-105'); 
        b.classList.add('text-brand-700', 'border-brand-200'); 
    }); 
    btnEl.classList.remove('text-brand-700', 'border-brand-200'); 
    btnEl.classList.add('border-brand-900', 'bg-brand-900', 'text-white', 'shadow-md', 'transform', 'scale-105'); 
}

function notifyWhenAvailable(prodId, prodName) { 
    let userMail = currentUser && currentUser.email ? currentUser.email : prompt("Ürün stoğa girdiğinde haber almak için e-posta adresinizi girin:"); 
    if(userMail && userMail.includes('@')) { 
        db.collection("stock_alerts").add({
            email: userMail, productId: prodId || "Bilinmiyor", productName: prodName || "Bilinmiyor", size: "Standart / Tümü", status: "bekliyor", requestDate: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => { showToast("Talebiniz başarıyla alındı!", 'success'); });
    } 
}

function loadProductReviews(prodId) { 
    db.collection("products").doc(prodId).collection("reviews").orderBy("date", "desc").get().then((snap) => { 
        const container = document.getElementById('reviewsListContainer'); 
        const avgContainer = document.getElementById('averageRatingContainer'); 
        if(!container) return; 
        if(snap.empty) { 
            container.innerHTML = '<p class="text-xs text-brand-400">Henüz değerlendirme yapılmamış.</p>'; 
            if(avgContainer) avgContainer.innerText = ''; 
            return; 
        } 
        let html = ''; 
        let totalRating = 0; 
        let count = 0; 
        snap.forEach(doc => { 
            let r = doc.data(); 
            let ratingVal = r.rating || 5; 
            totalRating += ratingVal; 
            count++; 
            let stars = '⭐'.repeat(ratingVal); 
            let textHtml = r.text ? `<div class="text-xs text-brand-600 mt-1">${r.text}</div>` : ''; 
            html += `<div class="bg-brand-50 p-4 rounded-xl border border-brand-200"><div class="font-bold text-xs text-brand-900 mb-1">${r.author || 'Müşteri'} <span class="text-amber-500 ml-2">${stars}</span></div>${textHtml}</div>`; 
        }); 
        container.innerHTML = html; 
        if(avgContainer && count > 0) { 
            let avg = (totalRating / count).toFixed(1); 
            avgContainer.innerText = `${avg} / 5.0`; 
        } 
    }).catch(e=>{}); 
}

async function submitProductReview() {
    if (!currentUser) { showToast("Yorum yapabilmek için giriş yapmalısınız.", 'error'); openModal(); return; }
    let ratingEl = document.getElementById('newReviewRating');
    let textEl = document.getElementById('newReviewText');
    let rating = ratingEl ? parseInt(ratingEl.value) : 5;
    let text = textEl ? textEl.value.trim() : "";

    try {
        const userOrdersSnap = await db.collection("orders").where("userId", "==", currentUser.uid).get();
        let hasPurchased = false;
        userOrdersSnap.forEach(doc => {
            const order = doc.data();
            if (order.status !== 'İptal Edildi' && Array.isArray(order.items)) {
                if(order.items.some(item => item.dbId === activeProductId)) { hasPurchased = true; }
            }
        });

        if (!hasPurchased) { showToast("Yalnızca satın almış olduğunuz ürünlere yorum yapabilirsiniz.", 'error'); return; }

        const uDoc = await db.collection("users").doc(currentUser.uid).get();
        let authorName = uDoc.exists ? (uDoc.data().name + " " + (uDoc.data().surname ? uDoc.data().surname[0] + "." : "")) : "Doğrulanmış Alıcı";

        await db.collection("products").doc(activeProductId).collection("reviews").add({
            userId: currentUser.uid, author: authorName, rating: rating, text: text, verifiedPurchase: true, date: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("Değerlendirmeniz başarıyla eklendi!", 'success');
        if (textEl) textEl.value = '';
        loadProductReviews(activeProductId);

    } catch (error) { showToast("Yorum gönderilirken hata oluştu.", 'error'); }
}

function addDetailedToCart(dbId, name, price, image) {
    let prod = allProducts.find(p => p.id === dbId);
    if(prod && prod.sizeStock && prod.sizeStock.trim() !== "") {
        if(parsedSizeStock[selectedSize] <= 0) { showToast("Seçtiğiniz beden tükenmiştir!", 'error'); return; }
    }
    let fullName = name + (selectedSize && selectedSize !== "Standart" ? ` (${selectedSize})` : '');
    addToCart(dbId, fullName, price, image, selectedSize);
}

function toggleCart() {
    const panel = document.getElementById('cartPanel');
    const overlay = document.getElementById('cartOverlay');
    if(!panel || !overlay) return;
    panel.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
    renderCart();
}

function addToCart(dbId, name, price, image, size = "Standart") { 
    cart.push({ cartId: Date.now(), dbId: dbId, baseName: name.split(' (')[0], name: name, price: price, image: image, size: size }); 
    localStorage.setItem('ballin_cart', JSON.stringify(cart)); 
    updateCartBadge(); 
    syncCartToFirebase(); 
    showToast(`"${name}" sepete eklendi.`, 'success'); 
}

function removeFromCart(cartId) { 
    cart = cart.filter(item => item.cartId !== cartId); 
    localStorage.setItem('ballin_cart', JSON.stringify(cart)); 
    renderCart(); 
    updateCartBadge(); 
    syncCartToFirebase();
}

function renderCart() { 
    const container = document.getElementById('cartItems'); const totalEl = document.getElementById('cartTotal'); 
    if(!container || !totalEl) return;
    container.innerHTML = ''; let total = 0; 
    if (cart.length === 0) { 
        container.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-cart-arrow-down text-4xl text-brand-200 mb-4"></i><p class="text-sm font-medium text-brand-500">Sepetiniz şu an boş.</p></div>'; 
        const progContainer = document.getElementById('cartShippingProgressContainer');
        if(progContainer) progContainer.classList.add('hidden');
    } else { 
        cart.forEach(item => { 
            total += (item.price || 0); 
            container.innerHTML += `<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="${item.image}" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1"><h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">${item.name}</h4><p class="text-xs text-brand-600 mt-2 font-medium">${(item.price||0).toLocaleString('tr-TR')} TL</p><button onclick="removeFromCart(${item.cartId})" class="text-[10px] text-red-500 font-bold uppercase mt-3 tracking-wider hover:underline">Sepetten Çıkar</button></div></div>`; 
        }); 
        
        const progContainer = document.getElementById('cartShippingProgressContainer');
        const progBar = document.getElementById('cartShippingBar');
        const progText = document.getElementById('cartShippingText');
        if(progContainer) progContainer.classList.remove('hidden');
        
        if(total >= FREE_SHIPPING_THRESHOLD) {
            if(progBar) progBar.style.width = '100%';
            if(progText) progText.innerHTML = '<i class="fa-solid fa-gift text-emerald-500 mr-1"></i> Tebrikler, kargo bedava!';
        } else {
            let percent = (total / FREE_SHIPPING_THRESHOLD) * 100;
            let remain = FREE_SHIPPING_THRESHOLD - total;
            if(progBar) progBar.style.width = percent + '%';
            if(progText) progText.innerHTML = `Ücretsiz kargoya <strong>${remain.toLocaleString('tr-TR')} TL</strong> kaldı!`;
        }
    } 
    totalEl.innerText = (total * (1 - appliedDiscountRate)).toLocaleString('tr-TR') + ' TL'; 
}

function updateCartBadge() { 
    const badge = document.getElementById('cartBadge'); 
    if(!badge) return;
    if (cart.length > 0) { 
        badge.classList.remove('hidden'); 
        badge.innerText = cart.length; 
        badge.classList.remove('badge-anim');
        void badge.offsetWidth; 
        badge.classList.add('badge-anim');
    } else { 
        badge.classList.add('hidden'); 
    } 
}

function applyPromoCode() {
    let codeEl = document.getElementById('promoCodeInput');
    let infoEl = document.getElementById('promoDiscountInfo');
    let code = codeEl ? codeEl.value.trim().toUpperCase() : "";
    if(!code) { showToast("Kupon kodu giriniz.", 'error'); return; }
    db.collection("coupons").where("code", "==", code).get().then((snap) => {
        if(snap.empty) { showToast("Geçersiz kupon kodu!", 'error'); return; }
        let cDoc = snap.docs[0]; let cData = cDoc.data();
        
        if(cData.usedCount >= cData.limit) { showToast("Bu kuponun kullanım limiti dolmuştur!", 'error'); return; }
        
        // Süre kontrolü
        if(cData.expiryDate) {
            let expDate = new Date(cData.expiryDate);
            expDate.setHours(23, 59, 59); // Günün sonuna kadar geçerli olsun
            if(expDate < new Date()) {
                showToast("Bu kuponun süresi dolmuştur!", 'error'); return;
            }
        }

        appliedDiscountRate = cData.discount / 100; appliedCouponCode = cDoc.id;
        if(infoEl) {
            infoEl.style.display = 'block'; 
            infoEl.innerText = `Kupon uygulandı: %${cData.discount} İndirim!`;
        }
        showToast(`İndirim uygulandı.`, 'success'); goToCheckout();
    }).catch(e=> showToast("Kupon uygulanırken hata!", 'error'));
}

function applyLoyaltyPoints() {
    if(!userData || !userData.points || userData.points <= 0) { showToast("Kullanılabilir puanınız bulunmuyor.", 'error'); return; }
    if(appliedPointsValue > 0) {
        appliedPointsValue = 0;
        if(document.getElementById('checkoutPointsText')) document.getElementById('checkoutPointsText').innerText = "Puan Kullan ("+userData.points+" Puan = "+userData.points+" TL)";
        showToast("Puan kullanımı iptal edildi.", 'success');
    } else {
        let rawTotal = cart.reduce((sum, item) => sum + (item.price||0), 0);
        let discountTotal = rawTotal * (1 - appliedDiscountRate);
        let maxUsable = Math.min(userData.points, discountTotal - 1);
        if(maxUsable <= 0) { showToast("Sepet tutarı puan kullanımına uygun değil.", 'error'); return; }
        appliedPointsValue = maxUsable;
        if(document.getElementById('checkoutPointsText')) document.getElementById('checkoutPointsText').innerText = appliedPointsValue + " Puan İndirimi İptal Et";
        showToast(`Sepetinize ${appliedPointsValue} TL değerinde puan indirimi uygulandı.`, 'success');
    }
    goToCheckout();
}

function loadProfileData() { 
    if(!currentUser) return; 
    db.collection("users").doc(currentUser.uid).get().then((doc) => { 
        if (doc.exists) { 
            userData = doc.data(); 
            if(document.getElementById('profName')) document.getElementById('profName').value = userData.name || ''; 
            if(document.getElementById('profSurname')) document.getElementById('profSurname').value = userData.surname || ''; 
            if(document.getElementById('profEmail')) document.getElementById('profEmail').value = currentUser.email || ''; 
            if(document.getElementById('profPhone')) document.getElementById('profPhone').value = userData.phone || ''; 
            if(document.getElementById('profAddress')) document.getElementById('profAddress').value = userData.address || ''; 
            
            if(userData.city && document.getElementById('profCity')) {
                document.getElementById('profCity').value = userData.city;
                populateDistricts('profCity', 'profDistrict');
                if(userData.district && document.getElementById('profDistrict')) document.getElementById('profDistrict').value = userData.district;
            }
            
            let pts = userData.points || 0;
            if(document.getElementById('profilePoints')) document.getElementById('profilePoints').innerText = pts;
            if(pts > 0 && document.getElementById('checkoutPointsArea')) {
                document.getElementById('checkoutPointsArea').style.display = 'block';
                if(appliedPointsValue === 0 && document.getElementById('checkoutPointsText')) document.getElementById('checkoutPointsText').innerText = "Puan Kullan ("+pts+" Puan = "+pts+" TL)";
            }
        } 
    }).catch(e=>{}); 
}

function goToCheckout() { 
    if (cart.length === 0) { showToast("Sepetiniz boş!", 'error'); return; } 
    const cartPanel = document.getElementById('cartPanel');
    if(cartPanel && !cartPanel.classList.contains('translate-x-full')) toggleCart();
    switchPage('checkout'); 
    if(currentUser) {
        db.collection("users").doc(currentUser.uid).get().then((doc) => { 
            if (doc.exists) { 
                userData = doc.data(); 
                if(document.getElementById('checkoutName')) document.getElementById('checkoutName').value = userData.name || ''; 
                if(document.getElementById('checkoutSurname')) document.getElementById('checkoutSurname').value = userData.surname || ''; 
                if(document.getElementById('checkoutEmail')) document.getElementById('checkoutEmail').value = currentUser.email || ''; 
                if(document.getElementById('checkoutPhone')) document.getElementById('checkoutPhone').value = userData.phone || ''; 
                if(document.getElementById('checkoutAddress')) document.getElementById('checkoutAddress').value = userData.address || ''; 
                
                if(userData.city && document.getElementById('checkoutCity')) {
                    document.getElementById('checkoutCity').value = userData.city;
                    populateDistricts('checkoutCity', 'checkoutDistrict');
                    if(userData.district && document.getElementById('checkoutDistrict')) document.getElementById('checkoutDistrict').value = userData.district;
                }

                if((userData.points||0) > 0 && document.getElementById('checkoutPointsArea')) {
                    document.getElementById('checkoutPointsArea').style.display = 'block';
                    if(appliedPointsValue === 0 && document.getElementById('checkoutPointsText')) document.getElementById('checkoutPointsText').innerText = "Puan Kullan ("+userData.points+" Puan = "+userData.points+" TL)";
                }
            } 
        }).catch(e=>{}); 
    }
    
    const sumContainer = document.getElementById('checkoutSummaryItems'); 
    if(!sumContainer) return;
    let total = 0; sumContainer.innerHTML = ''; 
    cart.forEach(item => { total += (item.price||0); sumContainer.innerHTML += `<div class="flex justify-between border-b border-brand-100 pb-2"><span>1x ${item.name}</span> <span class="font medium">${(item.price||0).toLocaleString('tr-TR')} TL</span></div>`; }); 
    
    let discountTotal = total * (1 - appliedDiscountRate);
    let finalTotal = discountTotal - appliedPointsValue;
    if(finalTotal < 0) finalTotal = 0;

    let shipCost = (finalTotal >= FREE_SHIPPING_THRESHOLD || finalTotal === 0) ? 0 : SHIPPING_FEE;
    finalTotal += shipCost;

    if(document.getElementById('checkoutSubtotal')) document.getElementById('checkoutSubtotal').innerText = total.toLocaleString('tr-TR') + ' TL';
    let shipText = shipCost === 0 ? '<span class="text-emerald-500 font-bold">Ücretsiz</span>' : shipCost + ' TL';
    if(document.getElementById('checkoutShippingCost')) document.getElementById('checkoutShippingCost').innerHTML = shipText;
    if(document.getElementById('checkoutSummaryTotal')) document.getElementById('checkoutSummaryTotal').innerText = finalTotal.toLocaleString('tr-TR') + ' TL'; 
}

// --- YENİ: Eş Zamanlı Stok Güncelleme ve Race Condition Koruması ---
async function processPayment() { 
    const address = document.getElementById('checkoutAddress') ? document.getElementById('checkoutAddress').value : ""; 
    const city = document.getElementById('checkoutCity') ? document.getElementById('checkoutCity').value : "";
    const district = document.getElementById('checkoutDistrict') ? document.getElementById('checkoutDistrict').value : "";
    const cName = document.getElementById('checkoutName') ? document.getElementById('checkoutName').value : "";
    const cEmail = currentUser ? currentUser.email : (document.getElementById('checkoutEmail') ? document.getElementById('checkoutEmail').value : "");
    
    if(!address || !cName || !cEmail || !city || !district) { 
        showToast("Ad, İl, İlçe, Açık Adres ve E-posta alanları zorunludur!", 'error'); 
        return; 
    } 

    const checkTerms = document.getElementById('checkTerms');
    const checkKvkk = document.getElementById('checkKvkk');
    if((checkTerms && !checkTerms.checked) || (checkKvkk && !checkKvkk.checked)) {
        showToast("Lütfen Mesafeli Satış Sözleşmesi ve KVKK metinlerini onaylayınız.", 'error');
        return;
    }
    
    const btn = document.getElementById('btnCompletePayment'); 
    if(btn) { btn.innerText = "İşlem Yapılıyor..."; btn.disabled = true; }
    
    let total = cart.reduce((sum, item) => sum + (item.price||0), 0);
    let discountTotal = total * (1 - appliedDiscountRate);
    let finalTotal = discountTotal - appliedPointsValue;
    if(finalTotal < 0) finalTotal = 0;
    let shipCost = (finalTotal >= FREE_SHIPPING_THRESHOLD || finalTotal === 0) ? 0 : SHIPPING_FEE;
    finalTotal += shipCost;
    
    let earnedPoints = Math.floor(finalTotal * 0.05);

    try {
        await db.runTransaction(async (transaction) => {
            let productDocs = [];
            for (let item of cart) {
                let productRef = db.collection("products").doc(item.dbId);
                let pDoc = await transaction.get(productRef);
                if (!pDoc.exists) throw "Ürün bulunamadı: " + item.name;
                productDocs.push({ ref: productRef, data: pDoc.data(), cartItem: item });
            }

            for (let pd of productDocs) {
                 if (pd.data.stock <= 0) throw `Üzgünüz, '${pd.cartItem.name}' ürünü tükendi.`;
                 if (pd.cartItem.size && pd.cartItem.size !== "Standart" && pd.data.sizeStock) {
                     let sizeStockMap = {};
                     pd.data.sizeStock.split(',').forEach(part => {
                        let [sz, st] = part.split(':');
                        if (sz && st) sizeStockMap[sz.trim().toUpperCase()] = parseInt(st.trim()) || 0;
                     });
                     if (sizeStockMap[pd.cartItem.size.toUpperCase()] !== undefined && sizeStockMap[pd.cartItem.size.toUpperCase()] <= 0) {
                         throw `Üzgünüz, '${pd.cartItem.name}' ürününün '${pd.cartItem.size}' bedeni tükendi.`;
                     }
                 }
            }

            for (let pd of productDocs) {
                let newTotalStock = pd.data.stock - 1;
                let updatedSizeStock = pd.data.sizeStock || "";

                if(pd.cartItem.size && pd.cartItem.size !== "Standart" && updatedSizeStock !== "") {
                    let parts = updatedSizeStock.split(',').map(part => {
                        let [sz, st] = part.split(':');
                        if(sz && st && sz.trim().toUpperCase() === pd.cartItem.size.toUpperCase()) {
                            let nextSt = Math.max(0, (parseInt(st.trim()) || 0) - 1);
                            return `${sz.trim()}:${nextSt}`;
                        } return part.trim();
                    });
                    updatedSizeStock = parts.join(', ');
                }
                transaction.update(pd.ref, { stock: newTotalStock, sizeStock: updatedSizeStock });
            }
        }); 

        const orderData = { 
            userId: currentUser ? currentUser.uid : 'guest_' + Date.now(), 
            userEmail: cEmail, 
            shippingInfo: { name: cName, surname: document.getElementById('checkoutSurname') ? document.getElementById('checkoutSurname').value : "", phone: document.getElementById('checkoutPhone') ? document.getElementById('checkoutPhone').value : "", city: city, district: district, address: address }, 
            items: cart, 
            totalAmount: finalTotal, 
            usedPoints: appliedPointsValue, 
            earnedPoints: earnedPoints, 
            status: "Hazırlanıyor", 
            trackingNumber: "", 
            orderDate: firebase.firestore.FieldValue.serverTimestamp() 
        }; 

        const docRef = await db.collection("orders").add(orderData);
        sendOrderConfirmationEmail({ ...orderData, orderId: docRef.id });

        if(appliedCouponCode) { db.collection("coupons").doc(appliedCouponCode).update({ usedCount: firebase.firestore.FieldValue.increment(1) }).catch(e=>{}); }
        
        if(currentUser && !currentUser.isAnonymous) {
            let pUpdate = firebase.firestore.FieldValue.increment(earnedPoints - appliedPointsValue);
            db.collection("users").doc(currentUser.uid).update({ points: pUpdate, cartData: [] }).catch(e=>{});
        }

        showToast("Siparişiniz başarıyla alındı!", 'success'); 
        cart = []; appliedDiscountRate = 0; appliedCouponCode = ""; appliedPointsValue = 0; localStorage.removeItem('ballin_cart'); updateCartBadge(); 
        if(btn) { btn.innerText = "Ödemeyi Tamamla"; btn.disabled = false; }
        if(currentUser && !currentUser.isAnonymous) { switchPage('profile'); loadUserOrders(); } else { switchPage('home'); }
        loadProducts(); 

    } catch (error) {
        showToast(error, 'error'); 
        if(btn) { btn.innerText = "Ödemeyi Tamamla"; btn.disabled = false; }
    }
}

let isLoginMode = true;
function openModal() { const m = document.getElementById('authModal'); if(m) m.classList.remove('hidden'); } 
function closeModal() { const m = document.getElementById('authModal'); if(m) m.classList.add('hidden'); }
function toggleAuthMode() { 
    isLoginMode = !isLoginMode; 
    const t = document.getElementById('modalTitle'), b = document.getElementById('modalActionBtn'), s = document.getElementById('switchAuthText'), rf = document.getElementById('registerFields'), fp = document.getElementById('forgotPassWrapper'); 
    if(!t || !b || !s || !rf || !fp) return;
    if (isLoginMode) { t.innerText = "Giriş Yap"; b.innerText = "Giriş Yap"; s.innerHTML = 'Hesabınız yok mu? <span class="text-brand-900 underline font-bold">Kayıt Olun</span>'; rf.style.display = "none"; fp.style.display = "block"; } 
    else { t.innerText = "Kayıt Ol"; b.innerText = "Kayıt Ol"; s.innerHTML = 'Zaten hesabınız var mı? <span class="text-brand-900 underline font-bold">Giriş Yapın</span>'; rf.style.display = "block"; fp.style.display = "none"; } 
}
function sendPasswordReset() { 
    const email = document.getElementById('emailInput') ? document.getElementById('emailInput').value : ""; 
    if(!email) { showToast("Lütfen e-posta alanını doldurun.", 'error'); return; } 
    firebase.auth().sendPasswordResetEmail(email).then(() => { showToast("Sıfırlama bağlantısı gönderildi.", 'success'); closeModal(); }).catch(e => { showToast("Hata: " + e.message, 'error'); }); 
}

// --- YENİ: Misafir Olarak Devam Etme Fonksiyonu ---
function continueAsGuest() {
    firebase.auth().signInAnonymously()
        .then(() => {
            closeModal();
            showToast("Misafir olarak devam ediyorsunuz.", "success");
            if (cart && cart.length > 0) goToCheckout();
        })
        .catch(() => showToast("Misafir girişi yapılamadı.", "error"));
}

function handleAuth() { 
    const email = document.getElementById('emailInput') ? document.getElementById('emailInput').value : "";
    const password = document.getElementById('passwordInput') ? document.getElementById('passwordInput').value : ""; 
    if (isLoginMode) { 
        if(!email || !password) { showToast("Tüm alanları doldurunuz.", 'error'); return; }
        firebase.auth().signInWithEmailAndPassword(email, password).then(() => { closeModal(); showToast("Başarıyla giriş yapıldı.", 'success'); }).catch(e => showToast("Giriş Başarısız: E-posta veya şifre hatalı.", 'error')); 
    } else { 
        const name = document.getElementById('authName') ? document.getElementById('authName').value : ""; 
        const surname = document.getElementById('authSurname') ? document.getElementById('authSurname').value : ""; 
        const phone = document.getElementById('authPhone') ? document.getElementById('authPhone').value : "";
        if(!email || !password || !name || !surname || !phone) { showToast("Tüm alanları doldurmalısınız.", 'error'); return; }
        firebase.auth().createUserWithEmailAndPassword(email, password).then((cred) => {
            return db.collection("users").doc(cred.user.uid).set({ name: name, surname: surname, phone: phone, address: '', points: 0, cartData: [], lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
        }).then(() => { closeModal(); showToast("Aramıza hoş geldiniz!", 'success'); }).catch(e => showToast("Kayıt Hatası: Şifre en az 6 karakter olmalıdır.", 'error')); 
    } 
}

function handleGoogleLogin() { 
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
    .then((result) => {
        const user = result.user;
        db.collection("users").doc(user.uid).get().then(doc => {
            if (!doc.exists) {
                let nameParts = (user.displayName || "").split(" ");
                let name = nameParts[0] || "";
                let surname = nameParts.slice(1).join(" ") || "";
                db.collection("users").doc(user.uid).set({ name: name, surname: surname, phone: user.phoneNumber || "", address: '', points: 0, cartData: [], lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
            }
        });
        closeModal(); showToast("Google ile başarıyla giriş yapıldı.", 'success'); 
    }).catch(() => showToast("Giriş iptal edildi veya hata oluştu.", 'error')); 
}

async function saveProfile() { 
    if(!currentUser) return; 
    const newEmail = document.getElementById('profEmail') ? document.getElementById('profEmail').value.trim() : "";
    try {
        if(newEmail && newEmail !== currentUser.email) await currentUser.updateEmail(newEmail);
        const profileData = { 
            name: document.getElementById('profName') ? document.getElementById('profName').value : "", surname: document.getElementById('profSurname') ? document.getElementById('profSurname').value : "", phone: document.getElementById('profPhone') ? document.getElementById('profPhone').value : "", city: document.getElementById('profCity') ? document.getElementById('profCity').value : "", district: document.getElementById('profDistrict') ? document.getElementById('profDistrict').value : "", address: document.getElementById('profAddress') ? document.getElementById('profAddress').value : "", lastUpdated: firebase.firestore.FieldValue.serverTimestamp() 
        }; 
        await db.collection("users").doc(currentUser.uid).set(profileData, { merge: true });
        showToast("Bilgileriniz başarıyla güncellendi.", 'success');
    } catch(error) {
        if(error.code === 'auth/requires-recent-login') showToast("E-posta değiştirmek için lütfen çıkış yapıp tekrar giriş yapınız.", 'error');
        else showToast("Güncelleme Hatası: " + error.message, 'error');
    }
}

function updatePasswordSecure() { 
    let newPass = document.getElementById('newPasswordInput') ? document.getElementById('newPasswordInput').value : ""; 
    if(!newPass || newPass.length < 6) { showToast("Şifre en az 6 karakter olmalıdır.", 'error'); return; } 
    if(currentUser) {
        currentUser.updatePassword(newPass).then(() => { showToast("Şifreniz değiştirildi.", 'success'); if(document.getElementById('newPasswordInput')) document.getElementById('newPasswordInput').value = ''; }).catch(e => { showToast("Hata: Yeniden giriş yapmanız gerekebilir.", 'error'); }); 
    }
}

function logout() { if(confirm("Çıkış yapmak istediğinize emin misiniz?")) { firebase.auth().signOut(); showToast("Çıkış yapıldı.", 'success'); } }

firebase.auth().onAuthStateChanged((user) => {
    const authBtn = document.getElementById('account-status-text'); 
    const adminBtn = document.getElementById('adminButton');
    if (user && user.email) { 
        currentUser = user; 
        if (!user.isAnonymous) {
            if(authBtn) authBtn.innerText = user.email.split('@')[0]; 
            loadWishlistFromFirebase(user.uid);
        } else {
            if(authBtn) authBtn.innerText = "Misafir";
        }
        
        loadProfileData(); loadUserOrders(); 
        if(adminBtn) {
            if(user.email === ADMIN_EMAIL) { adminBtn.style.display = "inline-block"; } else { adminBtn.style.display = "none"; } 
        }
    } else { 
        currentUser = null; 
        if(authBtn) authBtn.innerText = "Giriş Yap"; 
        if(adminBtn) adminBtn.style.display = "none"; 
    }
});

// --- YENİ: İade Reddi Müşteri Ekranı (Not Görünümü) ---
function loadUserOrders() { 
    const container = document.getElementById('ordersList'); 
    if(!container || !currentUser) return; 
    db.collection("orders").where("userId", "==", currentUser.uid).get().then((snap) => { 
        if(snap.empty) { container.innerHTML = '<p class="text-xs text-brand-400">Henüz siparişiniz bulunmuyor.</p>'; return; } 
        let orders = []; snap.forEach((doc) => { let d = doc.data(); d.id = doc.id; orders.push(d); }); 
        orders.sort((a, b) => { let tA = (a.orderDate && typeof a.orderDate.toMillis === 'function') ? a.orderDate.toMillis() : 0; let tB = (b.orderDate && typeof b.orderDate.toMillis === 'function') ? b.orderDate.toMillis() : 0; return tB - tA; });
        let html = ''; 
        orders.forEach(order => { 
            let dStr = (order.orderDate && typeof order.orderDate.toDate === 'function') ? order.orderDate.toDate().toLocaleString('tr-TR') : "Tarih Yok"; 
            let itemsStr = (order.items||[]).map(i => `1x ${i.name}`).join(', '); 
            let trackingHTML = order.trackingNumber ? `<div class="mt-3 text-xs bg-brand-50 p-3 rounded-lg border border-brand-100 flex items-center gap-2"><i class="fa-solid fa-truck-fast text-brand-600 text-lg"></i><div><span class="block text-brand-500 font-bold mb-1">Kargo Takip No</span><a href="https://www.araskargo.com.tr" target="_blank" class="text-blue-600 font-bold underline text-sm">${order.trackingNumber}</a></div></div>` : ''; 
            let cancelHTML = order.status === 'Hazırlanıyor' ? `<button onclick="cancelMyOrder('${order.id}')" class="mt-4 text-xs text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 font-bold uppercase tracking-wider transition-colors"><i class="fa-solid fa-ban mr-1"></i> Siparişi İptal Et</button>` : '';
            let returnHTML = order.status === 'Tamamlandı' ? `<button onclick="requestReturn('${order.id}')" class="mt-4 text-xs border border-brand-300 text-brand-700 px-4 py-2 rounded-xl hover:bg-red-50 font-bold uppercase tracking-wider transition-colors"><i class="fa-solid fa-arrow-rotate-left mr-1"></i> İade Talebi Oluştur</button>` : '';
            
            let returnNoteHtml = "";
            if (order.status === "İade Onaylanmadı" && order.returnNote) {
                returnNoteHtml = `<div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"><strong><i class="fa-solid fa-circle-info mr-1"></i> İade Reddedildi:</strong> ${order.returnNote}</div>`;
            }

            // Timeline UI
            let isCanceled = order.status === 'İptal Edildi' || order.status.includes('İade');
            let progressWidth = order.status === 'Hazırlanıyor' ? '0%' : (order.status === 'Kargoya Verildi' ? '50%' : '100%');
            
            let timelineHTML = isCanceled ? `<div class="text-center font-bold text-red-600 my-4 text-sm">${order.status}</div>` : `
            <div class="relative flex items-center justify-between w-full mt-8 mb-8 px-4 sm:px-8">
                <div class="absolute left-4 right-4 sm:left-8 sm:right-8 top-4 transform -translate-y-1/2 h-1.5 bg-brand-100 z-0 rounded-full"></div>
                <div class="absolute left-4 sm:left-8 top-4 transform -translate-y-1/2 h-1.5 bg-brand-900 z-0 transition-all duration-700 rounded-full" style="width: calc(${progressWidth} - 2rem)"></div>
                
                <div class="flex flex-col items-center z-10 w-16">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md font-bold text-xs ${order.status === 'Hazırlanıyor' || order.status === 'Kargoya Verildi' || order.status === 'Tamamlandı' ? 'bg-brand-900 text-white' : 'bg-white text-brand-300 border border-brand-200'}"><i class="fa-solid fa-box"></i></div>
                    <span class="text-[10px] font-bold mt-2 uppercase tracking-widest text-center ${order.status === 'Hazırlanıyor' || order.status === 'Kargoya Verildi' || order.status === 'Tamamlandı' ? 'text-brand-900' : 'text-brand-400'}">Hazırlanıyor</span>
                </div>
                <div class="flex flex-col items-center z-10 w-16">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md font-bold text-xs ${order.status === 'Kargoya Verildi' || order.status === 'Tamamlandı' ? 'bg-brand-900 text-white' : 'bg-white text-brand-300 border border-brand-200'}"><i class="fa-solid fa-truck-fast"></i></div>
                    <span class="text-[10px] font-bold mt-2 uppercase tracking-widest text-center ${order.status === 'Kargoya Verildi' || order.status === 'Tamamlandı' ? 'text-brand-900' : 'text-brand-400'}">Kargoda</span>
                </div>
                <div class="flex flex-col items-center z-10 w-16">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md font-bold text-xs ${order.status === 'Tamamlandı' ? 'bg-emerald-500 text-white' : 'bg-white text-brand-300 border border-brand-200'}"><i class="fa-solid fa-check"></i></div>
                    <span class="text-[10px] font-bold mt-2 uppercase tracking-widest text-center ${order.status === 'Tamamlandı' ? 'text-emerald-600' : 'text-brand-400'}">Teslim Edildi</span>
                </div>
            </div>`;

            html += `<div class="bg-white p-6 md:p-8 rounded-3xl border border-brand-200 shadow-sm"><div class="flex justify-between items-start mb-4 border-b border-brand-100 pb-4"><div class="flex flex-col gap-1"><span class="font-bold text-sm text-brand-900 font-serif">Sipariş #${order.id.slice(0,8).toUpperCase()}</span><span class="text-xs text-brand-500">${dStr}</span></div></div>
            
            ${timelineHTML}
            
            <p class="text-sm font-medium text-brand-700 leading-relaxed mb-4 mt-2"><strong>Ürünler:</strong> ${itemsStr}</p><div class="flex justify-between items-center bg-brand-50 p-4 rounded-xl border border-brand-100"><span class="text-xs font-bold text-brand-600 uppercase tracking-widest">Ödenen Tutar</span><span class="text-lg font-bold text-brand-900">${(order.totalAmount||0).toLocaleString('tr-TR')} TL</span></div>${trackingHTML}${cancelHTML}${returnHTML}${returnNoteHtml}</div>`; 
        }); 
        container.innerHTML = html; 
    }).catch(e=>{}); 
}

function cancelMyOrder(orderId) {
    if(!confirm("Siparişi iptal etmek istediğinize emin misiniz?")) return;
    db.collection("orders").doc(orderId).get().then(doc => {
        if(doc.exists) {
            let oData = doc.data();
            if(oData.status === 'Hazırlanıyor') {
                (oData.items||[]).forEach(item => {
                    let productRef = db.collection("products").doc(item.dbId);
                    productRef.get().then(pDoc => {
                        if(pDoc.exists) {
                            let pData = pDoc.data();
                            let newTotalStock = (pData.stock || 0) + 1;
                            let updatedSizeStock = pData.sizeStock || "";
                            if(item.size && item.size !== "Standart" && updatedSizeStock !== "") {
                                let parts = updatedSizeStock.split(',').map(part => {
                                    let [sz, st] = part.split(':');
                                    if(sz && st && sz.trim().toUpperCase() === item.size.toUpperCase()) { return `${sz.trim()}:${(parseInt(st.trim()) || 0) + 1}`; }
                                    return part.trim();
                                });
                                updatedSizeStock = parts.join(', ');
                            }
                            productRef.update({ stock: newTotalStock, sizeStock: updatedSizeStock });
                        }
                    }).catch(e=>{});
                });
                db.collection("orders").doc(orderId).update({ status: "İptal Edildi" }).then(() => { showToast("Sipariş iptal edildi, stoklar iade edildi.", 'success'); loadUserOrders(); });
            } else { showToast("Bu sipariş iptal edilemez.", 'error'); }
        }
    }).catch(e=>{}); 
}

function requestReturn(orderId) { db.collection("orders").doc(orderId).update({ status: "İade Talebi Alındı" }).then(() => { showToast("İade talebiniz iletildi.", 'success'); loadUserOrders(); }).catch(e=>{}); }

// --- YENİ: İade Reddetme ve Müşteriye Not Eklenmesi ---
function rejectReturn(orderId) {
    let note = prompt("İade reddedilme nedenini yazınız (Bu notu müşteri de görecektir):");
    if (note !== null && note.trim() !== "") {
        db.collection("orders").doc(orderId).update({
            status: "İade Onaylanmadı",
            returnNote: note.trim()
        }).then(() => {
            showToast("İade reddedildi ve müşteriye not bırakıldı.", "success");
            loadAdminOrders(); 
        }).catch(e => showToast("Bir hata oluştu.", "error"));
    }
}

function openAdminPanel() { switchPage('admin'); loadAdminOrders(); loadOrdersAndCalculateStats(); renderBulkTable(); loadCouponsAdmin(); loadCustomersCRM(); loadAbandonedCarts(); }

function addNewProduct() { 
    if(!isStaffNow(currentUser)) return; 
    const name = document.getElementById('adminProdName') ? document.getElementById('adminProdName').value.trim() : ""; 
    const price = document.getElementById('adminProdPrice') ? parseFloat(document.getElementById('adminProdPrice').value) : NaN; 
    const category = document.getElementById('adminProdCategory') ? document.getElementById('adminProdCategory').value : "Giyim"; 
    let stock = document.getElementById('adminProdStock') ? (parseInt(document.getElementById('adminProdStock').value) || 10) : 10; 
    const description = document.getElementById('adminProdDesc') ? document.getElementById('adminProdDesc').value : ""; 
    const sizeStock = document.getElementById('adminProdSizeStock') ? document.getElementById('adminProdSizeStock').value.trim() : "";
    
    const urlImg1 = document.getElementById('adminProdImg1') ? document.getElementById('adminProdImg1').value.trim() : "";
    const urlImg2 = document.getElementById('adminProdImg2') ? document.getElementById('adminProdImg2').value.trim() : "";
    const urlImg3 = document.getElementById('adminProdImg3') ? document.getElementById('adminProdImg3').value.trim() : "";
    const urlImg4 = document.getElementById('adminProdImg4') ? document.getElementById('adminProdImg4').value.trim() : "";

    let finalImages = [];
    for (let i = 0; i < 4; i++) {
        let img = uploadedImages[i];
        if (!img) {
            if (i === 0 && urlImg1) img = urlImg1;
            if (i === 1 && urlImg2) img = urlImg2;
            if (i === 2 && urlImg3) img = urlImg3;
            if (i === 3 && urlImg4) img = urlImg4;
        }
        if (img) finalImages.push(img);
    }

    if(!name || isNaN(price) || finalImages.length === 0) { 
        showToast("Lütfen ürün adı, fiyat ve en az 1 görsel ekleyin!", 'error'); 
        return; 
    } 

    const btn = document.getElementById('btnUploadProduct'); 
    if(btn) { btn.innerText = "Kaydediliyor..."; btn.disabled = true; } 
    
    db.collection("products").add({ 
        name: name, price: price, category: category, stock: stock, description: description, sizeStock: sizeStock, images: finalImages, createdAt: firebase.firestore.FieldValue.serverTimestamp() 
    }).then(() => { 
        showToast("Ürün eklendi!", 'success'); 
        if(document.getElementById('adminProdName')) document.getElementById('adminProdName').value = ''; 
        if(document.getElementById('adminProdPrice')) document.getElementById('adminProdPrice').value = ''; 
        if(document.getElementById('adminProdStock')) document.getElementById('adminProdStock').value = '10'; 
        if(document.getElementById('adminProdDesc')) document.getElementById('adminProdDesc').value = ''; 
        if(document.getElementById('adminProdSizeStock')) document.getElementById('adminProdSizeStock').value = ''; 
        
        for(let i = 1; i <= 4; i++) {
            if(document.getElementById(`adminProdImg${i}`)) document.getElementById(`adminProdImg${i}`).value = '';
            if(document.getElementById(`fileSlot_${i}`)) document.getElementById(`fileSlot_${i}`).value = '';
            if(document.getElementById(`previewSlot_${i-1}`)) document.getElementById(`previewSlot_${i-1}`).classList.add('hidden');
        }
        uploadedImages = ["", "", "", ""];
        loadProducts(); 
        if(btn) { btn.innerText = "Kataloğa Ekle"; btn.disabled = false; } 
    }).catch(e => { showToast("Hata: " + e.message, 'error'); if(btn) { btn.innerText = "Kataloğa Ekle"; btn.disabled = false; } }); 
}

// --- YENİ: İade Reddi Admin Panel Görünümü ---
function loadAdminOrders() { 
    if(!isStaffNow(currentUser)) return; 
    const container = document.getElementById('adminOrdersContainer'); 
    if(!container) return;
    db.collection("orders").orderBy("orderDate", "desc").get().then((snap) => { 
        if(snap.empty) { container.innerHTML = '<p class="text-xs text-brand-400">Henüz sipariş yok.</p>'; return; } 
        let orders = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; orders.push(d); }); 
        
        let filtered = orders.filter(o => { if(currentOrderFilter === 'all') return true; return o.status === currentOrderFilter; });
        if(filtered.length === 0) { container.innerHTML = '<p class="text-xs text-brand-400">Bu filtreye uygun sipariş yok.</p>'; return; }

        let html = ''; 
        filtered.forEach(order => { 
            let dStr = (order.orderDate && typeof order.orderDate.toDate === 'function') ? order.orderDate.toDate().toLocaleString('tr-TR') : "Belirsiz"; 
            let itemsStr = (order.items||[]).map(i => `1x ${i.baseName || i.name} (${i.size||'Standart'})`).join('<br>'); 
            let isReturn = order.status === 'İade Talebi Alındı';
            let shipInfo = order.shippingInfo || {};

            let returnNoteHtml = "";
            if (order.status === "İade Onaylanmadı" && order.returnNote) {
                returnNoteHtml = `<div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 w-full"><strong><i class="fa-solid fa-circle-info mr-1"></i> Müşteriye İletilen Not:</strong> ${order.returnNote}</div>`;
            }

            html += `<div class="bg-white p-5 rounded-2xl border border-brand-200 shadow-sm flex flex-col md:flex-row gap-6 flex-wrap">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-3"><input type="checkbox" class="order-checkbox accent-amber-500 w-4 h-4 cursor-pointer" value="${order.id}"><span class="font-bold font-serif text-sm text-amber-600 uppercase tracking-widest">#${order.id.slice(0,8)} ${isReturn ? '<span class="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] ml-2">İADE!</span>' : ''}</span></div>
                    <p class="text-[10px] text-brand-400 uppercase tracking-widest mb-3">${dStr}</p>
                    <div class="bg-brand-50 p-3 rounded-xl border border-brand-100 mb-3"><p class="text-xs font-medium text-brand-900 mb-1"><i class="fa-solid fa-user text-brand-400 w-4"></i> ${shipInfo.name||''} ${shipInfo.surname||''} <span class="text-brand-400 font-normal">(${order.userEmail||''})</span></p><p class="text-xs text-brand-700 mb-1"><i class="fa-solid fa-phone text-brand-400 w-4"></i> ${shipInfo.phone||''}</p><p class="text-xs text-brand-700"><i class="fa-solid fa-location-dot text-brand-400 w-4"></i> ${shipInfo.address||''} - <strong>${shipInfo.district||''}/${shipInfo.city||''}</strong></p></div>
                    <p class="text-xs text-brand-700 font-medium leading-relaxed bg-brand-50 p-3 rounded-xl border border-brand-100 mb-3"><strong>Ürünler:</strong><br>${itemsStr}</p>
                    <p class="text-sm font-bold text-brand-900 border-t border-brand-100 pt-3">Toplam Tutar: ${(order.totalAmount||0).toLocaleString('tr-TR')} TL</p>
                </div>
                <div class="w-full md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l border-brand-100 md:pl-6 pt-4 md:pt-0 shrink-0">
                    <button onclick="printInvoice('${order.id}')" class="w-full mb-4 bg-white border border-brand-300 text-brand-800 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-50 transition-colors shadow-sm"><i class="fa-solid fa-print mr-2"></i> Fatura / Barkod Çıktısı</button>
                    ${isReturn ? `<button onclick="rejectReturn('${order.id}')" class="w-full mb-4 bg-red-100 border border-red-300 text-red-800 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors shadow-sm"><i class="fa-solid fa-xmark mr-2"></i> İadeyi Reddet (Not Ekle)</button>` : ''}
                    <label class="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">Durum Güncelle</label>
                    <select id="adminStatus_${order.id}" class="w-full bg-brand-50 border border-brand-200 rounded-xl p-2.5 text-xs mb-3 font-medium text-brand-800 outline-none focus:border-brand-900 transition-colors"><option value="Hazırlanıyor" ${order.status === 'Hazırlanıyor' ? 'selected' : ''}>Hazırlanıyor</option><option value="Kargoya Verildi" ${order.status === 'Kargoya Verildi' ? 'selected' : ''}>Kargoya Verildi</option><option value="Tamamlandı" ${order.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option><option value="İade Onaylandı" ${order.status === 'İade Onaylandı' ? 'selected' : ''}>İade Onaylandı</option><option value="İade Onaylanmadı" ${order.status === 'İade Onaylanmadı' ? 'selected' : ''}>İade Onaylanmadı</option><option value="İptal Edildi" ${order.status === 'İptal Edildi' ? 'selected' : ''}>İptal Edildi</option></select>
                    <label class="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">Kargo Takip No</label>
                    <input type="text" id="adminTrack_${order.id}" value="${order.trackingNumber || ''}" placeholder="Örn: 987654321" class="w-full bg-brand-50 border border-brand-200 rounded-xl p-2.5 text-xs mb-4 font-medium outline-none focus:border-brand-900 transition-colors">
                    <button onclick="updateAdminOrder('${order.id}')" class="w-full bg-amber-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors shadow-lg"><i class="fa-solid fa-floppy-disk mr-2"></i> Kaydet ve Bildir</button>
                </div>
                ${returnNoteHtml}
            </div>`; 
        }); 
        container.innerHTML = html; 
    }).catch(e=>{}); 
}

function updateAdminOrder(orderId) { 
    const statusEl = document.getElementById(`adminStatus_${orderId}`);
    const trackEl = document.getElementById(`adminTrack_${orderId}`);
    const newStatus = statusEl ? statusEl.value : "Hazırlanıyor"; 
    const newTrack = trackEl ? trackEl.value : ""; 
    db.collection("orders").doc(orderId).update({ status: newStatus, trackingNumber: newTrack }).then(() => { 
        showToast("Sipariş güncellendi!", 'success'); 
        let order = allOrders.find(o => o.id === orderId);
        if(order && newStatus === 'Kargoya Verildi' && newTrack) {
            sendShippingUpdateEmail(orderId, order.userEmail, (order.shippingInfo ? order.shippingInfo.name : 'Müşteri'), newTrack, order.items);
        }
        loadAdminOrders(); loadOrdersAndCalculateStats(); 
    }).catch(e=> showToast("Güncelleme hatası: " + e.message, 'error')); 
}

window.handleAccountClick = function() {
    if (currentUser && !currentUser.isAnonymous && currentUser.email) { switchPage('profile'); } 
    else { openModal(); }
};

function toggleAI() { 
    const box = document.getElementById('aiChatBox');
    if(box) box.classList.toggle('hidden'); 
}

// --- YENİ ADMIN PANEL TAB SİSTEMİ ---
function switchAdminTab(tabId, el) {
    // Tüm sekmeleri gizle
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    
    // Menü aktif durumlarını ayarla
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    // Başlığı güncelle
    const titles = {
        'dashboard': 'Genel Bakış', 'orders': 'Siparişler', 'products': 'Ürün Yönetimi', 
        'customers': 'Müşteriler & Terk', 'coupons': 'Kupon Yönetimi', 'settings': 'Vitrin & Ayarlar'
    };
    if(document.getElementById('adminPageTitle')) document.getElementById('adminPageTitle').innerText = titles[tabId];

    // Sekmeye özel verileri tetikle
    if(tabId === 'orders') loadAdminOrders();
    if(tabId === 'customers') { loadCustomersCRM(); loadAbandonedCarts(); }
    if(tabId === 'products') renderBulkTable();
    if(tabId === 'coupons') loadCouponsAdmin();
}

// updateDashboardStats fonksiyonunu YENİ UI elemanlarını dolduracak şekilde yakalıyoruz
const originalUpdateDashboardStats = updateDashboardStats;
updateDashboardStats = function() {
    originalUpdateDashboardStats(); // Eski hesaplamaları çalıştır (Ciro vb. hesaplar)
    
    // YENİ KPI'LARI GÜNCELLE
    let pendingCount = 0; let returnCount = 0;
    allOrders.forEach(o => { 
        if(o.status === 'Hazırlanıyor') pendingCount++; 
        if(o.status === 'İade Talebi Alındı') returnCount++;
    });
    
    let totalRev = document.getElementById('statTotalRevenue') ? document.getElementById('statTotalRevenue').innerText : "0 TL";
    let totalOrders = document.getElementById('statTotalOrders') ? document.getElementById('statTotalOrders').innerText : "0";
    let critStock = document.getElementById('statCriticalStock') ? document.getElementById('statCriticalStock').innerText : "0";

    if(document.getElementById('kpiRevenue')) document.getElementById('kpiRevenue').innerText = '₺' + totalRev.replace(' TL', '');
    if(document.getElementById('kpiOrders')) document.getElementById('kpiOrders').innerText = totalOrders;
    if(document.getElementById('kpiPending')) document.getElementById('kpiPending').innerText = pendingCount;
    if(document.getElementById('kpiLowStock')) document.getElementById('kpiLowStock').innerText = critStock;
    
    if(document.getElementById('navBadgeOrders')) document.getElementById('navBadgeOrders').innerText = pendingCount;
    
    // SON 5 SİPARİŞİ YENİ TABLOYA YAZ
    const tbody = document.getElementById('ordersTable');
    if(tbody) {
         let html = '';
         allOrders.slice(0, 5).forEach(o => {
             let sClass = o.status === 'Hazırlanıyor' ? 's-hazir' : (o.status === 'Kargoya Verildi' ? 's-kargo' : (o.status === 'Tamamlandı' ? 's-bitti' : (o.status.includes('İade') ? 's-iade' : 's-yeni')));
             let tutar = (o.totalAmount || 0).toLocaleString('tr-TR');
             html += `<tr><td>#${o.id.slice(0,6).toUpperCase()}</td><td>${o.shippingInfo?.name || 'Misafir'}</td><td>₺${tutar}</td><td><span class="status ${sClass}">${o.status}</span></td><td><button class="btn-ghost" onclick="switchAdminTab('orders', document.querySelectorAll('.nav-item')[1]); setOrderFilter('all', document.getElementById('adminOrderFilters').children[0])">Detay</button></td></tr>`;
         });
         if(html === '') html = '<tr><td colspan="5" style="color:var(--mute)">Sipariş bulunamadı.</td></tr>';
         tbody.innerHTML = html;
    }

    // STOK UYARISI LİSTESİ (En düşük 3 ürün)
    const stockContainer = document.getElementById('lowStockListHTML');
    if(stockContainer) {
        let lowProducts = allProducts.filter(p => p.stock <= 5).sort((a,b) => a.stock - b.stock).slice(0,3);
        let sHtml = '';
        lowProducts.forEach(p => {
            sHtml += `<div class="row"><span>${p.name}</span><b style="color:var(--accent)">${p.stock} adet</b></div>`;
        });
        if(sHtml === '') sHtml = '<p style="color:var(--mute)">Stok sorunu yok.</p>';
        stockContainer.innerHTML = sHtml;
    }
};

// Eski setOrderFilter fonksiyonundaki buton renklerini dark temaya uydurma
const originalSetOrderFilter = setOrderFilter;
setOrderFilter = function(status, btnEl) {
    originalSetOrderFilter(status, btnEl);
    // Dark temaya uygun buton aktif/pasif state
    document.querySelectorAll('#adminOrderFilters button').forEach(b => { 
        b.style.borderColor = 'var(--line)'; b.style.color = 'var(--txt)'; 
    });
    if(btnEl) { btnEl.style.borderColor = 'var(--txt)'; btnEl.style.color = 'var(--txt)'; }
};



function sendAIMessage() {
    const input = document.getElementById('aiInput'); 
    if(!input) return;
    const msg = input.value.trim(); if(!msg) return;
    const chatBox = document.getElementById('aiMessages');
    if(!chatBox) return;
    chatBox.innerHTML += `<div class="flex justify-end"><div class="bg-brand-900 text-white rounded-2xl px-4 py-2">${msg}</div></div>`;
    input.value = ''; chatBox.scrollTop = chatBox.scrollHeight;
    setTimeout(() => {
        chatBox.innerHTML += `<div class="flex items-start"><div class="bg-brand-200 text-brand-900 rounded-2xl px-4 py-2">Size yardımcı olmaktan mutluluk duyarım. Hangi ürünlerimiz hakkında bilgi istersiniz?</div></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 800);
}

window.addEventListener('DOMContentLoaded', () => {
    initLocationDropdowns();
    loadCategories();
    loadProducts();
});

// --- KAYAN YAZI (MARQUEE) DİNAMİK KARGO LİMİTİ GÜNCELLEMESİ ---
(function() {
    function updateMarquee(limit) {
        if (!limit || limit === '0') return;
        const formattedLimit = Number(limit).toLocaleString('tr-TR');
        const newText = `${formattedLimit} TL ÜZERİ ÜCRETSİZ KARGO & KOLAY İADE - TÜM SİPARİŞLERDE`;
        
        // 1. Orijinal kayan yazı elemanı
        const mainSpan = document.getElementById('marqueeShippingText');
        if (mainSpan) mainSpan.innerText = newText;
        
        // 2. Kesintisiz döngü için oluşturduğumuz klon eleman
        const cloneSpan = document.querySelector('.ntui-marquee-track div[aria-hidden="true"] span:first-child');
        if (cloneSpan) cloneSpan.innerText = newText;
    }

    // Sayfa ilk açıldığında veritabanından gelen değeri yakala
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        const inputEl = document.getElementById('cmsFreeShippingLimit');
        if (inputEl && inputEl.value && inputEl.value !== "") {
            updateMarquee(inputEl.value);
            clearInterval(checkInterval); // Değeri bulduğunda dinlemeyi bırak
        }
        if (++checkCount > 20) clearInterval(checkInterval); // 10 sn sonra pes et
    }, 500);

    // Admin panelinde "Ayarları Güncelle" butonuna basıldığında anında yakala
    if (typeof saveCMSBanner === 'function') {
        const originalSave = saveCMSBanner;
        saveCMSBanner = async function() {
            await originalSave(); // Sizin mevcut kaydetme kodunuzu çalıştırır
            const currentLimit = document.getElementById('cmsFreeShippingLimit').value;
            updateMarquee(currentLimit);
        };
    }
})();
// --- ÜRÜN DÜZENLEME (GÖRSEL VE AÇIKLAMA GÜNCELLEME) YÖNETİMİ ---

// Mevcut toplu işlem tablosunun sonuna "Düzenle" butonu yerleştiriyoruz
if (typeof renderBulkTable === 'function') {
    const originalRenderBulkTable = renderBulkTable;
    renderBulkTable = function() {
        originalRenderBulkTable(); 
        
        const rows = document.querySelectorAll('#bulkTableBody tr');
        rows.forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if(checkbox) {
                const prodId = checkbox.value;
                const actionTd = row.lastElementChild;
                
                // Butonu tabloya ekle
                if(actionTd && !actionTd.innerHTML.includes('openEditModal')) {
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Düzenle';
                    editBtn.className = "btn-ghost ml-2";
                    editBtn.style.padding = "4px 10px";
                    editBtn.style.fontSize = "11px";
                    editBtn.style.color = "var(--accent)";
                    editBtn.style.borderColor = "var(--accent)";
                    editBtn.onclick = () => openEditModal(prodId);
                    actionTd.appendChild(editBtn);
                }
            }
        });
    };
}

// Düzenleme formunu ürün verileriyle doldur
window.openEditModal = function(id) {
    const product = allProducts.find(p => p.id === id);
    if(!product) return;
    
    document.getElementById('editProdId').value = product.id;
    document.getElementById('editProdName').value = product.name || '';
    document.getElementById('editProdPrice').value = product.price || 0;
    document.getElementById('editProdStock').value = product.stock || 0;
    document.getElementById('editProdDesc').value = product.description || '';
    document.getElementById('editProdSizeStock').value = product.sizes ? Object.entries(product.sizes).map(([k,v]) => `${k}:${v}`).join(', ') : '';
    
    // Kategori seçeneklerini doldur
    const catSelect = document.getElementById('editProdCategory');
    if(window.categories && window.categories.length > 0) {
        catSelect.innerHTML = window.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    catSelect.value = product.category || 'Giyim';

    // Mevcut görselleri URL alanlarına yaz (Kullanıcı cihazdan seçmezse bunlar geçerli olacak)
    document.getElementById('editProdImg1').value = product.images?.[0] || '';
    document.getElementById('editProdImg2').value = product.images?.[1] || '';
    document.getElementById('editProdImg3').value = product.images?.[2] || '';
    document.getElementById('editProdImg4').value = product.images?.[3] || '';
    
    // Dosya seçimlerini sıfırla
    for(let i=1; i<=4; i++) document.getElementById(`editFile_${i}`).value = '';
    
    document.getElementById('editProductModal').classList.remove('hidden');
};

window.closeEditModal = function() {
    document.getElementById('editProductModal').classList.add('hidden');
};

// Değişiklikleri Base64'e dönüştürüp Firebase'e kaydet
window.saveEditedProductData = async function(btn) {
    const id = document.getElementById('editProdId').value;
    
    // Bedenleri objeye çevir (S:5, M:2 formatı)
    const sizeStr = document.getElementById('editProdSizeStock').value;
    let sizes = {};
    if (sizeStr) {
        sizeStr.split(',').forEach(s => {
            const [k, v] = s.split(':');
            if (k && v) sizes[k.trim()] = Number(v.trim());
        });
    }
    
    // Resimleri analiz et
    let finalImages = [];
    const files = [
        document.getElementById('editFile_1').files[0], document.getElementById('editFile_2').files[0],
        document.getElementById('editFile_3').files[0], document.getElementById('editFile_4').files[0]
    ];
    const urls = [
        document.getElementById('editProdImg1').value, document.getElementById('editProdImg2').value,
        document.getElementById('editProdImg3').value, document.getElementById('editProdImg4').value
    ];

    const readAsBase64 = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = error => rej(error);
        reader.readAsDataURL(file);
    });

    const originalText = btn.innerText;
    btn.innerText = "Kaydediliyor...";
    btn.disabled = true;

    try {
        for (let i = 0; i < 4; i++) {
            if (files[i]) {
                // Eğer o slota bilgisayardan YENİ fotoğraf seçilmişse onu Base64 yapıp kullan
                const base64 = await readAsBase64(files[i]);
                finalImages.push(base64);
            } else if (urls[i] && urls[i].trim() !== '') {
                // Bilgisayardan fotoğraf seçilmemişse, eski görsel URL'sini/Base64'ünü aynen koru
                finalImages.push(urls[i].trim());
            }
        }
        
        // Firestore'u güncelle
        await db.collection("products").doc(id).update({
            name: document.getElementById('editProdName').value,
            price: Number(document.getElementById('editProdPrice').value),
            category: document.getElementById('editProdCategory').value,
            stock: Number(document.getElementById('editProdStock').value),
            description: document.getElementById('editProdDesc').value,
            sizes: sizes,
            images: finalImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (typeof showToast === 'function') showToast("Ürün bilgileri ve görseller güncellendi!");
        closeEditModal();
        if (typeof loadProducts === 'function') loadProducts(); // Sayfayı arka planda yenile
        
    } catch (error) {
        console.error("Güncelleme hatası: ", error);
        alert("Ürün güncellenirken hata oluştu.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
;
/* BALLIN patch.js (Aşama 1) — index.html'de script.js'ten HEMEN SONRA yükle:
   <script src="script.js"></script>
   <script src="patch.js"></script>                                              */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.esc = esc;
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const FV = firebase.firestore.FieldValue;
  const isAdm = () => isStaffNow(currentUser);
  const sizeKey = i => (i.size && i.size !== 'Standart') ? String(i.size).toUpperCase() : null;
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b) m[a.trim().toUpperCase()] = parseInt(b) || 0; }); return m; };
  const joinSS = m => Object.entries(m).map(([a, b]) => a + ':' + b).join(', ');
  const groupCart = items => { const n = {}; items.forEach(i => { const g = n[i.dbId] = n[i.dbId] || { t: 0, s: {} }; g.t++; const z = sizeKey(i); if (z) g.s[z] = (g.s[z] || 0) + 1; }); return n; };

  // Kargo takip adresleri: kullandığın firmaların güncel takip linkini kontrol et, gerekirse düzelt
  const CARRIERS = {
    'Aras Kargo': 'https://kargotakip.araskargo.com.tr/mainpage.aspx?code=',
    'Yurtiçi Kargo': 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=',
    'MNG Kargo': 'https://www.mngkargo.com.tr/gonderi-takip/?takipNo=',
    'PTT Kargo': 'https://gonderitakip.ptt.gov.tr/Track/Verify?q=',
    'Sürat Kargo': 'https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=',
    'HepsiJet': 'https://www.hepsijet.com/gonderi-takibi/'
  };

  /* ---------- Oturum ---------- */
  firebase.auth().onAuthStateChanged(u => {
    if (u && u.isAnonymous) currentUser = u;                       // misafir oturumu artık "çıkış yapmış" sayılmaz
    else if (u && u.email) db.collection('users').doc(u.uid).set({ email: u.email }, { merge: true }).catch(() => {});
  });
  async function ensureAuth() { if (!currentUser) currentUser = (await firebase.auth().signInAnonymously()).user; return currentUser; }

  // Admin dışı ziyaretçiler için gereksiz/yetkisiz sorguları kapat
  ['loadOrdersAndCalculateStats', 'loadCustomersCRM', 'loadAbandonedCarts', 'loadCouponsAdmin'].forEach(n => {
    const o = window[n]; window[n] = function () { if (isAdm()) return o.apply(this, arguments); };
  });

  window.syncCartToFirebase = function () {
    if (!currentUser || currentUser.isAnonymous) return;
    db.collection('users').doc(currentUser.uid).set({
      cartData: cart.map(i => ({ ...i, image: String(i.image || '').startsWith('data:') ? '' : (i.image || '') })),
      lastUpdated: FV.serverTimestamp()
    }, { merge: true }).catch(() => {});
  };

  /* ---------- Ödeme / sipariş (tek transaction: stok + sipariş + puan + kupon) ---------- */
  window.processPayment = async function () {
    const v = id => ($(id) && $(id).value || '').trim();
    const name = v('checkoutName'), surname = v('checkoutSurname'), phone = v('checkoutPhone'),
      city = v('checkoutCity'), district = v('checkoutDistrict'), address = v('checkoutAddress');
    const email = (currentUser && currentUser.email) || v('checkoutEmail');
    if (!name || !surname || !phone || !city || !district || !address || !/^\S+@\S+\.\S+$/.test(email))
      return showToast('Ad, soyad, telefon, geçerli e-posta, il, ilçe ve adres zorunludur.', 'error');
    if (!$('checkTerms').checked || !$('checkKvkk').checked) return showToast('Lütfen sözleşme ve KVKK metinlerini onaylayın.', 'error');
    if (!cart.length) return showToast('Sepetiniz boş!', 'error');
    const btn = $('btnCompletePayment'); btn.disabled = true; btn.innerText = 'İşlem yapılıyor...';
    try {
      await ensureAuth();
      const uid = currentUser.uid, named = !currentUser.isAnonymous;
      let rate = 0, code = '', pts = 0;
      if (appliedCouponCode) {
        if (!named) throw new Error('Kupon için hesabınızla giriş yapın.');
        const cr = db.collection('coupons').doc(appliedCouponCode);
        const [cs, us] = await Promise.all([cr.get(), cr.collection('uses').doc(uid).get()]);
        const c = cs.exists && cs.data();
        if (!c || us.exists || (c.usedCount || 0) >= c.limit || (c.expiryDate && new Date(c.expiryDate + 'T23:59:59') < new Date()))
          throw new Error('Kupon artık geçerli değil. Kuponu kaldırıp tekrar deneyin.');
        rate = c.discount / 100; code = cs.id;
      }
      if (named && appliedPointsValue > 0) {
        const ud = await db.collection('users').doc(uid).get();
        pts = Math.min(Math.floor(appliedPointsValue), (ud.data() || {}).points || 0);
      }
      const need = groupCart(cart), ids = Object.keys(need), oref = db.collection('orders').doc();
      let order;
      await db.runTransaction(async tx => {
        const snaps = await Promise.all(ids.map(id => tx.get(db.collection('products').doc(id))));
        const price = {}, writes = [];
        snaps.forEach((s, k) => {
          const n = need[ids[k]];
          if (!s.exists) throw new Error('Sepetteki bir ürün artık satışta değil.');
          const p = s.data(); price[ids[k]] = Number(p.price) || 0;
          if ((p.stock || 0) < n.t) throw new Error('"' + p.name + '" için yeterli stok yok.');
          let ss = p.sizeStock || '';
          if (ss && Object.keys(n.s).length) {
            const m = parseSS(ss);
            Object.keys(n.s).forEach(z => { if (m[z] === undefined || m[z] < n.s[z]) throw new Error('"' + p.name + '" ' + z + ' bedeni yeterli değil.'); m[z] -= n.s[z]; });
            ss = joinSS(m);
          }
          writes.push([s.ref, { stock: p.stock - n.t, sizeStock: ss }]);
        });
        const items = cart.map(i => ({ cartId: i.cartId, dbId: i.dbId, baseName: i.baseName, name: i.name, size: i.size, price: price[i.dbId], image: String(i.image || '').startsWith('data:') ? '' : (i.image || '') }));
        const disc = items.reduce((s, i) => s + i.price, 0) * (1 - rate);
        const use = Math.min(pts, Math.max(0, Math.floor(disc - 1)));
        let fin = Math.max(0, disc - use); fin += (fin >= FREE_SHIPPING_THRESHOLD || fin === 0) ? 0 : SHIPPING_FEE;
        order = { userId: uid, userEmail: email, shippingInfo: { name, surname, phone, city, district, address }, items, productIds: ids,
          totalAmount: Math.round(fin * 100) / 100, usedPoints: use, status: 'Hazırlanıyor', trackingNumber: '', carrier: '', couponCode: code, orderDate: FV.serverTimestamp() };
        writes.forEach(([r, d]) => tx.update(r, d));
        tx.set(oref, order);
        if (use > 0) tx.update(db.collection('users').doc(uid), { points: FV.increment(-use) });
        if (code) {
          const cr = db.collection('coupons').doc(code);
          tx.update(cr, { usedCount: FV.increment(1) });
          tx.set(cr.collection('uses').doc(uid), { at: FV.serverTimestamp() });
        }
      });
      sendOrderConfirmationEmail({ ...order, orderId: oref.id });
      showToast('Siparişiniz alındı!', 'success');
      if (!named) alert('Sipariş numaranız:\n' + oref.id + '\n\nLütfen saklayın.');
      cart = []; appliedDiscountRate = 0; appliedCouponCode = ''; appliedPointsValue = 0;
      localStorage.removeItem('ballin_cart'); updateCartBadge(); syncCartToFirebase();
      if (named) { switchPage('profile'); loadUserOrders(); } else switchPage('home');
      loadProducts();
    } catch (e) { showToast(e.message || String(e), 'error'); }
    btn.disabled = false; btn.innerText = 'Ödemeyi Tamamla';
  };

  // Müşteri iptali: sadece durum değişir; stok ve puan iadesini admin paneli yapar
  window.cancelMyOrder = function (id) {
    if (!confirm('Siparişi iptal etmek istediğinize emin misiniz?')) return;
    db.collection('orders').doc(id).update({ status: 'İptal Edildi' })
      .then(() => { showToast('Sipariş iptal edildi. Stok ve puan iadesi kısa süre içinde yansıtılır.', 'success'); loadUserOrders(); })
      .catch(() => showToast('Bu sipariş artık iptal edilemez.', 'error'));
  };

  /* ---------- Kuponlar (belge ID = kod) ---------- */
  window.addNewCoupon = function () {
    const g = id => $(id) ? $(id).value.trim() : '';
    const ids = ['newCouponCode', 'newCouponDiscount', 'newCouponLimit', 'newCouponExpiry'];
    const code = g(ids[0]).toUpperCase(), discount = parseInt(g(ids[1])), limit = parseInt(g(ids[2])) || 100, expiryDate = g(ids[3]);
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !(discount >= 1 && discount <= 100)) return showToast('Kod (3-30 harf/rakam) ve %1-100 indirim girin.', 'error');
    db.collection('coupons').doc(code).set({ code, discount, limit, expiryDate, usedCount: 0, createdAt: FV.serverTimestamp() })
      .then(() => { showToast('Kupon oluşturuldu.', 'success'); ids.forEach(i => { if ($(i)) $(i).value = ''; }); loadCouponsAdmin(); })
      .catch(e => showToast('Hata: ' + e.message, 'error'));
  };
  window.applyPromoCode = async function () {
    const code = ($('promoCodeInput').value || '').trim().toUpperCase();
    if (!code) return showToast('Kupon kodu giriniz.', 'error');
    if (!currentUser || currentUser.isAnonymous) { showToast('Kupon için hesabınızla giriş yapın.', 'error'); return openModal(); }
    try {
      const cr = db.collection('coupons').doc(code);
      const [cs, us] = await Promise.all([cr.get(), cr.collection('uses').doc(currentUser.uid).get()]);
      if (!cs.exists) return showToast('Geçersiz kupon kodu!', 'error');
      const c = cs.data();
      if (us.exists) return showToast('Bu kuponu daha önce kullandınız.', 'error');
      if ((c.usedCount || 0) >= c.limit) return showToast('Kuponun kullanım limiti dolmuş!', 'error');
      if (c.expiryDate && new Date(c.expiryDate + 'T23:59:59') < new Date()) return showToast('Kuponun süresi dolmuş!', 'error');
      appliedDiscountRate = c.discount / 100; appliedCouponCode = cs.id;
      const i = $('promoDiscountInfo'); i.style.display = 'block'; i.innerText = 'Kupon uygulandı: %' + Number(c.discount) + ' indirim!';
      showToast('İndirim uygulandı.', 'success'); goToCheckout();
    } catch (e) { showToast('Kupon uygulanamadı.', 'error'); }
  };

  /* ---------- Yorumlar ---------- */
  window.submitProductReview = async function () {
    if (!currentUser || currentUser.isAnonymous) { showToast('Yorum yapmak için hesabınızla giriş yapın.', 'error'); return openModal(); }
    const rating = Math.min(5, Math.max(1, parseInt($('newReviewRating') ? $('newReviewRating').value : 5) || 5));
    const text = ($('newReviewText') ? $('newReviewText').value.trim() : '').slice(0, 500);
    try {
      const os = await db.collection('orders').where('userId', '==', currentUser.uid).get();
      const o = os.docs.find(d => { const x = d.data(); return x.status !== 'İptal Edildi' && (x.productIds || []).includes(activeProductId); });
      if (!o) return showToast('Yalnızca satın aldığınız ürünlere yorum yapabilirsiniz.', 'error');
      const u = await db.collection('users').doc(currentUser.uid).get(), d = u.exists ? u.data() : {};
      const author = ((d.name || 'Müşteri') + ' ' + (d.surname ? d.surname[0] + '.' : '')).trim().slice(0, 60);
      await db.collection('products').doc(activeProductId).collection('reviews').doc(currentUser.uid)
        .set({ userId: currentUser.uid, author, rating, text, verifiedPurchase: true, orderId: o.id, date: FV.serverTimestamp() });
      showToast('Değerlendirmeniz eklendi!', 'success'); if ($('newReviewText')) $('newReviewText').value = ''; loadProductReviews(activeProductId);
    } catch (e) { showToast('Yorum gönderilemedi (ürün başına tek yorum yapılabilir).', 'error'); }
  };
  window.loadProductReviews = function (pid) {
    db.collection('products').doc(pid).collection('reviews').orderBy('date', 'desc').get().then(snap => {
      const c = $('reviewsListContainer'), a = $('averageRatingContainer'); if (!c) return;
      if (snap.empty) { c.innerHTML = '<p class="text-xs text-brand-400">Henüz değerlendirme yapılmamış.</p>'; if (a) a.innerText = ''; return; }
      let t = 0, h = '';
      snap.forEach(d => { const r = d.data(), n = Math.min(5, Math.max(1, parseInt(r.rating) || 5)); t += n;
        h += '<div class="bg-brand-50 p-4 rounded-xl border border-brand-200"><div class="font-bold text-xs text-brand-900 mb-1">' + esc(r.author || 'Müşteri') +
          ' <span class="text-amber-500 ml-2">' + '⭐'.repeat(n) + '</span></div>' + (r.text ? '<div class="text-xs text-brand-600 mt-1">' + esc(r.text) + '</div>' : '') + '</div>'; });
      c.innerHTML = h; if (a) a.innerText = (t / snap.size).toFixed(1) + ' / 5.0';
    }).catch(() => {});
  };

  /* ---------- Admin: iade/iptal/puan mutabakatı ---------- */
  async function reconcile(orders) {
    for (const o of orders) {
      try {
        const orf = db.collection('orders').doc(o.id), uref = db.collection('users').doc(o.userId);
        if (['İptal Edildi', 'İade Onaylandı'].includes(o.status) && !o.refundDone) {
          const need = groupCart(o.items || []);
          for (const id of Object.keys(need)) {
            await db.runTransaction(async tx => {
              const r = db.collection('products').doc(id), s = await tx.get(r); if (!s.exists) return;
              const p = s.data(); let ss = p.sizeStock || '';
              if (ss) { const m = parseSS(ss); Object.keys(need[id].s).forEach(z => { if (m[z] !== undefined) m[z] += need[id].s[z]; }); ss = joinSS(m); }
              tx.update(r, { stock: (p.stock || 0) + need[id].t, sizeStock: ss });
            });
          }
          const us = await uref.get();
          const delta = (o.usedPoints || 0) - (o.pointsCredited ? (o.creditedPoints || 0) : 0);
          if (us.exists && delta) await uref.update({ points: FV.increment(delta) });
          await orf.update({ refundDone: true });
        } else if (o.status === 'Tamamlandı' && !o.pointsCredited) {
          const pts = Math.floor((o.totalAmount || 0) * 0.05), us = await uref.get();
          if (us.exists && pts > 0) await uref.update({ points: FV.increment(pts) });
          await orf.update({ pointsCredited: true, creditedPoints: us.exists ? pts : 0 });
        }
      } catch (e) { console.warn('mutabakat', o.id, e.message); }
    }
  }

  /* ---------- Admin: siparişler ---------- */
  window.loadAdminOrders = async function () {
    if (!isAdm()) return;
    const box = $('adminOrdersContainer'); if (!box) return;
    try {
      const snap = await db.collection('orders').orderBy('orderDate', 'desc').get();
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id })); allOrders = all;
      const list = all.filter(o => currentOrderFilter === 'all' || o.status === currentOrderFilter);
      const pids = [...new Set(all.filter(o => o.status === 'Hazırlanıyor').flatMap(o => (o.items || []).map(i => i.dbId)))];
      const cur = {};
      await Promise.all(pids.map(id => db.collection('products').doc(id).get().then(s => { if (s.exists) cur[id] = s.data().price; }).catch(() => {})));
      const opt = (arr, sel) => arr.map(x => '<option ' + (x === sel ? 'selected' : '') + '>' + esc(x) + '</option>').join('');
      box.innerHTML = list.length ? list.map(o => {
        const si = o.shippingInfo || {}, id = esc(o.id);
        const bad = o.status === 'Hazırlanıyor' && (o.items || []).some(i => cur[i.dbId] !== undefined && cur[i.dbId] !== i.price);
        const d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleString('tr-TR') : '-';
        const states = ['Hazırlanıyor', 'Kargoya Verildi', 'Tamamlandı', 'İade Onaylandı', 'İade Onaylanmadı', 'İptal Edildi'].concat(o.status === 'İade Talebi Alındı' ? ['İade Talebi Alındı'] : []);
        return '<div class="bg-white p-5 rounded-2xl border border-brand-200 flex flex-col md:flex-row gap-6 flex-wrap">' +
          '<div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-3"><input type="checkbox" class="order-checkbox" value="' + id + '"><b>#' + esc(o.id.slice(0, 8)) + '</b>' +
          (o.status === 'İade Talebi Alındı' ? ' <span class="bg-red-100 text-red-600 px-2 rounded text-[10px]">İADE TALEBİ</span>' : '') +
          (bad ? ' <span class="bg-amber-100 text-amber-700 px-2 rounded text-[10px]">⚠ Güncel fiyattan farklı, kontrol et</span>' : '') + '</div>' +
          '<p class="text-[10px] mb-3">' + esc(d) + '</p>' +
          '<div class="p-3 rounded-xl border border-brand-100 mb-3 text-xs">' + esc(si.name) + ' ' + esc(si.surname) + ' (' + esc(o.userEmail) + ')<br>' + esc(si.phone) + '<br>' + esc(si.address) + ' - <b>' + esc(si.district) + '/' + esc(si.city) + '</b></div>' +
          '<div class="p-3 rounded-xl border border-brand-100 mb-3 text-xs"><b>Ürünler:</b><br>' + (o.items || []).map(i => '1x ' + esc(i.baseName || i.name) + ' (' + esc(i.size || 'Standart') + ') - ' + tl(i.price) + ' TL').join('<br>') + '</div>' +
          '<p class="text-sm font-bold">Toplam: ' + tl(o.totalAmount) + ' TL' + (o.usedPoints ? ' (puan: -' + tl(o.usedPoints) + ')' : '') + (o.couponCode ? ' · kupon: ' + esc(o.couponCode) : '') + '</p>' +
          (o.returnNote ? '<p class="mt-2 text-xs text-red-700">Not: ' + esc(o.returnNote) + '</p>' : '') + '</div>' +
          '<div class="w-full md:w-64 flex flex-col justify-center shrink-0 gap-2">' +
          '<button onclick="printInvoice(\'' + id + '\')" class="btn-ghost">Sipariş / Kargo Fişi</button>' +
          (o.status === 'İade Talebi Alındı' ? '<button onclick="rejectReturn(\'' + id + '\')" class="btn-ghost" style="color:#ff7a7a">İadeyi Reddet (Not)</button>' : '') +
          '<select id="adminStatus_' + id + '">' + opt(states, o.status) + '</select>' +
          '<select id="adminCarrier_' + id + '"><option value="">Kargo firması seç</option>' + opt(Object.keys(CARRIERS), o.carrier) + '</select>' +
          '<input type="text" id="adminTrack_' + id + '" value="' + esc(o.trackingNumber || '') + '" placeholder="Takip no">' +
          '<button onclick="updateAdminOrder(\'' + id + '\')" class="btn-primary">Kaydet ve Bildir</button></div></div>';
      }).join('') : '<p class="text-xs">Bu filtreye uygun sipariş yok.</p>';
      reconcile(all);
    } catch (e) { showToast('Siparişler yüklenemedi: ' + e.message, 'error'); }
  };
  window.updateAdminOrder = async function (id) {
    if (!isAdm()) return;
    const status = $('adminStatus_' + id).value, carrier = $('adminCarrier_' + id).value, track = $('adminTrack_' + id).value.trim();
    if (status === 'Kargoya Verildi' && (!carrier || !track)) return showToast('Kargoya vermek için firma ve takip numarası girin.', 'error');
    try {
      const o = allOrders.find(x => x.id === id) || {};
      await db.collection('orders').doc(id).update({ status, carrier, trackingNumber: track, trackingUrl: carrier && track ? (CARRIERS[carrier] || '') + encodeURIComponent(track) : '' });
      if (status === 'Kargoya Verildi' && (o.status !== status || o.trackingNumber !== track)) sendShippingUpdateEmail(id, o.userEmail, (o.shippingInfo || {}).name || 'Müşteri', track, o.items);
      showToast('Sipariş güncellendi!', 'success'); loadAdminOrders(); loadOrdersAndCalculateStats();
    } catch (e) { showToast('Güncelleme hatası: ' + e.message, 'error'); }
  };
  const _bulk = window.bulkUpdateOrderStatus;
  window.bulkUpdateOrderStatus = function (s) { return s === 'Kargoya Verildi' ? showToast('Kargolamak için her siparişte firma ve takip no girin.', 'error') : _bulk.apply(this, arguments); };

  window.printInvoice = function (id) {
    const o = allOrders.find(x => x.id === id); if (!o) return;
    const si = o.shippingInfo || {}, w = window.open('', '_blank'); if (!w) return showToast('Açılır pencere engellendi.', 'error');
    const d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleDateString('tr-TR') : '-';
    w.document.write('<!doctype html><meta charset="utf-8"><title>Sipariş Fişi</title><style>body{font:14px sans-serif;padding:30px;max-width:720px;margin:auto}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.box{border:2px dashed #000;padding:14px;margin-top:20px}</style>' +
      '<h2>BALLIN - Sipariş ve Kargo Fişi</h2><p>Sipariş No: <b>' + esc(o.id) + '</b><br>Tarih: ' + esc(d) + '</p>' +
      '<p><b>Alıcı:</b> ' + esc(si.name) + ' ' + esc(si.surname) + '<br>' + esc(si.phone) + '<br>' + esc(si.address) + '<br>' + esc(si.district) + ' / ' + esc(si.city) + '</p>' +
      '<table><tr><th>Ürün</th><th>Beden</th><th>Fiyat</th></tr>' + (o.items || []).map(i => '<tr><td>' + esc(i.baseName || i.name) + '</td><td>' + esc(i.size || 'Standart') + '</td><td>' + tl(i.price) + ' TL</td></tr>').join('') + '</table>' +
      '<p><b>Toplam: ' + tl(o.totalAmount) + ' TL</b></p><div class="box">Kargo: ' + esc(o.carrier || '-') + '<br>Takip No: ' + esc(o.trackingNumber || '-') + '</div>' +
      '<p style="font-size:11px;color:#666">Bu belge resmi fatura yerine geçmez.</p><script>onload=function(){print()}<\/script>');
    w.document.close();
  };

  /* ---------- Admin: müşteriler, terk edilen sepetler, dashboard ---------- */
  window.loadCustomersCRM = function () {
    if (!isAdm()) return;
    db.collection('users').get().then(s => { const b = $('adminCustomersContainer'); if (!b) return;
      b.innerHTML = s.empty ? '<p class="text-xs">Müşteri yok.</p>' : '<table><thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Puan</th><th>Şehir</th></tr></thead><tbody>' +
        s.docs.map(d => { const u = d.data(); return '<tr><td>' + esc(u.name) + ' ' + esc(u.surname) + '</td><td>' + esc(u.email || '-') + '</td><td>' + esc(u.phone || '-') + '</td><td>' + tl(u.points) + '</td><td>' + esc(u.city ? u.city + '/' + (u.district || '') : '-') + '</td></tr>'; }).join('') + '</tbody></table>'; }).catch(() => {});
  };
  window.loadAbandonedCarts = function () {
    if (!isAdm()) return;
    db.collection('users').get().then(s => { const b = $('adminAbandonedContainer'); if (!b) return;
      const h = s.docs.filter(d => (d.data().cartData || []).length).map(d => { const u = d.data(), c = u.cartData;
        return '<div class="row"><span>' + esc(u.name) + ' ' + esc(u.surname) + ' · ' + esc(u.email || '') + '</span><span>' + c.length + ' ürün · ' + tl(c.reduce((t, i) => t + (i.price || 0), 0)) + ' TL</span></div>'; }).join('');
      b.innerHTML = h || '<p class="text-xs">Terk edilmiş sepet yok.</p>'; }).catch(() => {});
  };
  window.updateDashboardStats = function () {
    const live = allOrders.filter(o => !['İptal Edildi', 'İade Onaylandı'].includes(o.status));
    const pend = allOrders.filter(o => o.status === 'Hazırlanıyor').length;
    const set = (id, v) => { if ($(id)) $(id).innerText = v; };
    set('kpiRevenue', '₺' + tl(live.reduce((s, o) => s + (o.totalAmount || 0), 0)));
    set('kpiOrders', allOrders.length); set('kpiPending', pend); set('navBadgeOrders', pend);
    set('kpiLowStock', allProducts.filter(p => p.stock <= 3).length);
    const cnt = {}; live.forEach(o => (o.items || []).forEach(i => { const n = i.baseName || i.name || '?'; cnt[n] = cnt[n] || { q: 0, r: 0 }; cnt[n].q++; cnt[n].r += i.price || 0; }));
    const top = Object.keys(cnt).sort((a, b) => cnt[b].q - cnt[a].q).slice(0, 5);
    if ($('topProductsContainer')) $('topProductsContainer').innerHTML = top.length ? '<div class="space-y-2">' + top.map((n, k) => '<div class="flex justify-between text-xs border-b border-brand-100 pb-2"><span><strong>#' + (k + 1) + '</strong> ' + esc(n) + '</span><span>Satış: <strong>' + cnt[n].q + '</strong> | Ciro: <strong>' + tl(cnt[n].r) + ' TL</strong></span></div>').join('') + '</div>' : '<p class="text-xs">Satış verisi yok.</p>';
    if ($('ordersTable')) $('ordersTable').innerHTML = allOrders.slice(0, 5).map(o => {
      const sc = o.status === 'Hazırlanıyor' ? 's-hazir' : o.status === 'Kargoya Verildi' ? 's-kargo' : o.status === 'Tamamlandı' ? 's-bitti' : String(o.status).includes('İade') ? 's-iade' : 's-yeni';
      return '<tr><td>#' + esc(o.id.slice(0, 6).toUpperCase()) + '</td><td>' + esc((o.shippingInfo || {}).name || 'Misafir') + '</td><td>₺' + tl(o.totalAmount) + '</td><td><span class="status ' + sc + '">' + esc(o.status) + '</span></td><td></td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--mute)">Sipariş bulunamadı.</td></tr>';
    if ($('lowStockListHTML')) $('lowStockListHTML').innerHTML = allProducts.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 3)
      .map(p => '<div class="row"><span>' + esc(p.name) + '</span><b style="color:var(--accent)">' + p.stock + ' adet</b></div>').join('') || '<p style="color:var(--mute)">Stok sorunu yok.</p>';
  };
})();

;
/* BALLIN patch2.js (Aşama 2) — patch.js'ten SONRA yükle:
   <script src="script.js"></script> <script src="patch.js"></script> <script src="patch2.js"></script> */
(function () {
  'use strict';
  const UPLOAD_URL = 'https://ballin-upload.ballinworldw.workers.dev';   // <-- Worker adresini yaz
  const $ = id => document.getElementById(id);
  const FV = firebase.firestore.FieldValue;
  const isAdm = () => isStaffNow(currentUser);
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b && !isNaN(parseInt(b))) m[a.trim().toUpperCase()] = parseInt(b); }); return m; };
  const sum = m => Object.values(m).reduce((a, b) => a + b, 0);

  /* ---------- Stil: mobil admin, tablo taşması, sahte asistanı gizle ---------- */
  const st = document.createElement('style');
  st.textContent = 'body table{min-width:0}#page-admin table{min-width:560px}#page-admin{overflow-y:auto}' +
    '#aiChatBox,button[onclick="toggleAI()"]{display:none!important}' +
    '.toast-notification{z-index:20000!important}.compare-checkbox,.compare-bar{display:none!important}' +
    '@media(max-width:820px){.admin-layout{flex-direction:column;height:auto;min-height:100vh}' +
    '.admin-sidebar{width:100%;flex-direction:row;overflow-x:auto;padding:10px;border-right:0;border-bottom:1px solid var(--line)}' +
    '.admin-main{padding:16px;overflow:visible}.kpis{grid-template-columns:repeat(2,1fr)}.grid-2{grid-template-columns:1fr}' +
    '.admin-main table{display:block;overflow-x:auto}}';
  document.head.appendChild(st);

  /* Karşılaştırma özelliği kaldırıldı */
  window.toggleCompare = function (id, e) { if (e) e.stopPropagation(); };

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
  async function toWebp(src, max = 1200) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Görsel okunamadı.')); i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/webp', 0.82));
  }
  const NO_WORKER = UPLOAD_URL.includes('BURAYA');
  async function upload(src) {
    if (NO_WORKER) { const bl = await toWebp(src, 800); return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(bl); }); }
    const blob = await toWebp(src), tok = await currentUser.getIdToken();
    let r;
    try { r = await fetch(UPLOAD_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': blob.type }, body: blob }); }
    catch (e) { throw new Error('Worker\'a ulaşılamadı: adres yanlış, Worker yayında değil veya ALLOWED_ORIGIN bu site adresiyle birebir aynı değil.'); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch (e) {} throw new Error('Görsel yüklenemedi (' + r.status + (m ? ': ' + m : '') + ')'); }
    return (await r.json()).url;
  }
  const toUrl = s => String(s).startsWith('data:') ? upload(s) : Promise.resolve(s);   // base64 ise yükle, URL ise aynen bırak

  /* ---------- Yeni ürün ---------- */
  window.addNewProduct = async function () {
    if (!isAdm()) return showToast('Yönetici hesabıyla (doğrulanmış e-posta) giriş yapmalısınız.', 'error');
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
    if (NO_WORKER) return showToast('Önce patch2.js içindeki UPLOAD_URL satırına Worker adresini yazın.', 'error');
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

;
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
      H('4. Aktarım') + P('Verileriniz; kargo firmalarına, e-posta ve barındırma/altyapı hizmeti sağlayıcılarına (Google Firebase, Cloudflare, Resend gibi, bunların bir kısmı yurt dışında yer alabilir), yetkili kamu kurumlarına ve hizmetin gerektirdiği ölçüde iş ortaklarına aktarılabilir.') +
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

;
/* BALLIN patch4.js — sepette adet, kartta "Sepete Ekle", beden seçimi. patch3.js'ten SONRA yükle:
   <script src="patch4.js"></script> */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const parseSS = s => { const m = {}; String(s || '').split(',').forEach(x => { const [a, b] = x.split(':'); if (a && b && !isNaN(parseInt(b))) m[a.trim().toUpperCase()] = parseInt(b); }); return m; };
  const prodOf = id => allProducts.find(p => p.id === id);
  const limitFor = (p, size) => { const m = parseSS(p.sizeStock); return Object.keys(m).length ? (m[String(size).toUpperCase()] || 0) : (p.stock || 0); };
  const countIn = (id, size) => cart.filter(i => i.dbId === id && i.size === size).length;
  const cover = p => (p.images && p.images[0]) || p.image || 'https://placehold.co/600x800/f1f3f5/a3a3a3?text=BALLIN';

  /* Stok sınırını aşan eklemeyi engelle (ürün sayfası dahil) */
  const _add = window.addToCart;
  window.addToCart = function (dbId, name, price, image, size) {
    size = size || 'Standart';
    const p = prodOf(dbId);
    if (p && countIn(dbId, size) >= limitFor(p, size)) return showToast('Bu üründen stokta yeterli adet yok.', 'error');
    return _add.call(this, dbId, name, price, image, size);
  };

  /* Ürün kartı: favori kalbi + hızlı "Sepete Ekle" */
  window.createProductCard = function (prod) {
    const out = prod.stock <= 0, fav = wishlist.includes(prod.id);
    const badge = out ? '<span class="absolute top-3 right-3 bg-red-600 text-white px-2.5 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Tükendi</span>'
      : (prod.stock <= 5 ? '<span class="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-[10px] font-bold rounded shadow-md z-10 uppercase tracking-widest">Son ' + prod.stock + ' Ürün</span>' : '');
    return '<div class="group relative flex flex-col cursor-pointer bg-brand-50 rounded-2xl p-4 overflow-hidden border border-brand-100 hover:border-brand-300 transition-all hover:shadow-xl" onclick="openProductDetail(\'' + prod.id + '\')">' + badge +
      '<div class="absolute top-3 left-3 z-10"><button onclick="toggleWishlist(\'' + prod.id + '\', event)" aria-label="Favorilere ekle" class="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center transition-colors ' + (fav ? 'text-red-500' : 'text-brand-400 hover:text-red-500') + '"><i class="fa-solid fa-heart"></i></button></div>' +
      '<div class="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-4 bg-white">' + (prod.oldPrice > prod.price ? '<span class="absolute top-12 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded z-10">%' + Math.round((1 - prod.price / prod.oldPrice) * 100) + ' İNDİRİM</span>' : '') + '<img loading="lazy" alt="' + E(prod.name) + '" src="' + E(cover(prod)) + '" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ' + (out ? 'grayscale brightness-50' : '') + '">' +
      '<button ' + (out ? 'disabled' : 'onclick="quickAdd(\'' + prod.id + '\', event)"') + ' class="absolute bottom-2 left-2 right-2 ' + (out ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-900 hover:bg-black') + ' text-white text-xs font-bold py-2.5 rounded-lg shadow-lg z-10">' + (out ? 'Tükendi' : '<i class="fa-solid fa-bag-shopping mr-1"></i> Sepete Ekle') + '</button></div>' +
      '<div class="flex justify-between items-start mt-2"><div><h3 class="text-sm font-medium text-brand-900 font-serif line-clamp-1">' + E(prod.name) + '</h3><p class="text-[10px] text-brand-400 uppercase mt-1 tracking-wider">' + E(prod.category || 'Diğer') + '</p></div>' +
      '<p class="text-sm font-bold text-brand-900 text-right">' + (prod.oldPrice > prod.price ? '<span class="block text-[10px] text-brand-400 line-through font-normal">' + tl(prod.oldPrice) + ' TL</span>' : '') + tl(prod.price) + ' TL</p></div></div>';
  };

  function addSize(p, size) { addToCart(p.id, p.name + (size && size !== 'Standart' ? ' (' + size + ')' : ''), p.price, cover(p), size); }

  window.quickAdd = function (id, ev) {
    if (ev) ev.stopPropagation();
    const p = prodOf(id); if (!p) return;
    const m = parseSS(p.sizeStock), sizes = Object.keys(m);
    if (!sizes.length) return addSize(p, 'Standart');                       // beden yok: direkt ekle
    if (sizes.length === 1) return m[sizes[0]] > 0 ? addSize(p, sizes[0]) : showToast('Ürün tükendi.', 'error');   // tek beden: direkt ekle
    closePick();
    const o = document.createElement('div'); o.id = 'sizePickModal';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    o.onclick = e => { if (e.target === o) closePick(); };
    o.innerHTML = '<div style="background:#fff;width:100%;max-width:420px;border-radius:20px 20px 0 0;padding:22px 20px 26px">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><img src="' + E(cover(p)) + '" style="width:56px;height:70px;object-fit:cover;border-radius:10px"><div style="flex:1"><div style="font-weight:700;font-size:14px">' + E(p.name) + '</div><div style="font-size:13px;color:#666">' + tl(p.price) + ' TL</div></div><button onclick="closePick()" style="font-size:22px;border:0;background:none;cursor:pointer">&times;</button></div>' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Beden seçin</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      sizes.map(z => { const n = m[z], dis = n <= 0 || countIn(id, z) >= n; return '<button ' + (dis ? 'disabled' : 'onclick="pickSize(\'' + id + '\',\'' + E(z) + '\')"') + ' style="min-width:52px;padding:10px 14px;border-radius:10px;border:1px solid ' + (dis ? '#ddd' : '#212529') + ';background:#fff;color:' + (dis ? '#bbb' : '#212529') + ';font-weight:700;' + (dis ? 'text-decoration:line-through;cursor:not-allowed' : 'cursor:pointer') + '">' + E(z) + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(o);
  };
  function closePick() { const o = $('sizePickModal'); if (o) o.remove(); }
  window.closePick = closePick;
  window.pickSize = function (id, size) { const p = prodOf(id); if (p) { addSize(p, size); closePick(); } };

  /* Sepet: aynı ürün + beden tek satırda, adet +/- */
  const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const save = () => { localStorage.setItem('ballin_cart', JSON.stringify(cart)); renderCart(); updateCartBadge(); syncCartToFirebase(); };
  window.cartPlus = function (id, size) {
    const line = cart.find(i => i.dbId === id && i.size === size); if (!line) return;
    const p = prodOf(id); if (p && countIn(id, size) >= limitFor(p, size)) return showToast('Stok sınırına ulaştınız.', 'error');
    cart.push({ ...line, cartId: uid() }); save();
  };
  window.cartMinus = function (id, size) {
    const k = cart.map(i => i.dbId === id && i.size === size).lastIndexOf(true);
    if (k > -1) { cart.splice(k, 1); save(); }
  };
  window.cartRemoveGroup = function (id, size) { cart = cart.filter(i => !(i.dbId === id && i.size === size)); save(); };

  window.renderCart = function () {
    const box = $('cartItems'), totalEl = $('cartTotal'); if (!box || !totalEl) return;
    let total = 0;
    if (!cart.length) {
      box.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-cart-arrow-down text-4xl text-brand-200 mb-4"></i><p class="text-sm font-medium text-brand-500">Sepetiniz şu an boş.</p></div>';
      if ($('cartShippingProgressContainer')) $('cartShippingProgressContainer').classList.add('hidden');
    } else {
      const g = {}; cart.forEach(i => { const k = i.dbId + '|' + i.size; (g[k] = g[k] || { it: i, n: 0 }).n++; total += i.price || 0; });
      box.innerHTML = Object.values(g).map(({ it, n }) => {
        const a = "'" + E(it.dbId) + "','" + E(it.size) + "'", b = 'style="width:28px;height:28px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-weight:700"';
        return '<div class="flex gap-4 items-center border-b border-brand-100 pb-4"><img src="' + E(it.image) + '" class="w-20 h-24 object-cover rounded-xl border border-brand-100"><div class="flex-1">' +
          '<h4 class="font-serif font-bold text-sm text-brand-900 leading-tight">' + E(it.baseName || it.name) + '</h4>' +
          '<p class="text-[11px] text-brand-400 mt-1">' + (it.size && it.size !== 'Standart' ? 'Beden: ' + E(it.size) + ' · ' : '') + tl(it.price) + ' TL</p>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button ' + b + ' onclick="cartMinus(' + a + ')">−</button><b style="min-width:18px;text-align:center">' + n + '</b><button ' + b + ' onclick="cartPlus(' + a + ')">+</button>' +
          '<span class="text-sm font-bold text-brand-900" style="margin-left:auto">' + tl((it.price || 0) * n) + ' TL</span></div></div>' +
          '<button onclick="cartRemoveGroup(' + a + ')" aria-label="Sil" class="text-brand-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>';
      }).join('');
      const pc = $('cartShippingProgressContainer'), bar = $('cartShippingBar'), tx = $('cartShippingText');
      if (pc) pc.classList.remove('hidden');
      if (total >= FREE_SHIPPING_THRESHOLD) { if (bar) bar.style.width = '100%'; if (tx) tx.innerHTML = '<i class="fa-solid fa-gift text-emerald-500 mr-1"></i> Tebrikler, kargo bedava!'; }
      else { if (bar) bar.style.width = (total / FREE_SHIPPING_THRESHOLD * 100) + '%'; if (tx) tx.innerHTML = 'Ücretsiz kargoya <strong>' + tl(FREE_SHIPPING_THRESHOLD - total) + ' TL</strong> kaldı!'; }
    }
    totalEl.innerText = tl(total * (1 - appliedDiscountRate)) + ' TL';
  };
  renderCart(); updateCartBadge();
  if (typeof renderMainGrid === 'function') { try { renderMainGrid(); filterAndSortProducts(); renderNewGrid(); renderWishlistGrid(); } catch (e) {} }
})();

;
/* BALLIN patch5.js — ürün sıralama, sipariş sorgulama sayfası, müşteri tarafı doğru kargo takip linki.
   patch4.js'ten SONRA yükle: <script src="patch5.js"></script> */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => (window.esc ? window.esc(s) : String(s));
  const tl = n => (Number(n) || 0).toLocaleString('tr-TR');

  /* 1) Ürün sıralama: fiyat artan/azalan, isim */
  const SORTS = { 'price-asc': (a, b) => (a.price || 0) - (b.price || 0), 'price-desc': (a, b) => (b.price || 0) - (a.price || 0), name: (a, b) => String(a.name).localeCompare(String(b.name), 'tr') };
  const _f = window.filterAndSortProducts;
  window.filterAndSortProducts = function () {
    const s = $('sortSelect'), cmp = s && SORTS[s.value];
    if (!cmp) return _f.apply(this, arguments);
    const orig = allProducts; allProducts = [...orig].sort(cmp);
    try { return _f.apply(this, arguments); } finally { allProducts = orig; }
  };
  const pr = $('filterPriceRange');
  if (pr && !$('sortSelect')) {
    const s = document.createElement('select'); s.id = 'sortSelect'; s.className = pr.className;
    s.innerHTML = '<option value="default">Sırala: Yeni</option><option value="price-asc">Fiyat: Artan</option><option value="price-desc">Fiyat: Azalan</option><option value="name">İsim: A-Z</option>';
    s.onchange = () => filterAndSortProducts(); pr.insertAdjacentElement('afterend', s);
  }

  /* 2) Siparişlerim: doğru kargo firması + takip linki (Aras'a sabit link yerine) */
  const trk = {};
  const refreshTrk = () => (!currentUser || currentUser.isAnonymous) ? Promise.resolve() :
    db.collection('orders').where('userId', '==', currentUser.uid).get()
      .then(s => s.forEach(d => { const o = d.data(); if (o.trackingNumber) trk[o.trackingNumber] = { url: o.trackingUrl || '', carrier: o.carrier || '' }; })).catch(() => {});
  function fixLinks() {
    const c = $('ordersList'); if (!c) return;
    c.querySelectorAll('a[href*="araskargo"]').forEach(a => {
      const no = Object.keys(trk).find(n => a.textContent.includes(n));
      if (!no || !trk[no].url) return;
      a.href = trk[no].url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const lab = a.parentNode.querySelector('span');
      if (lab && trk[no].carrier) lab.textContent = trk[no].carrier + ' · Takip No';
    });
  }
  const _lo = window.loadUserOrders;
  window.loadUserOrders = function () { _lo.apply(this, arguments); refreshTrk().then(fixLinks); };
  const oc = $('ordersList'); if (oc) new MutationObserver(fixLinks).observe(oc, { childList: true, subtree: true });

  /* 3) Sipariş sorgula sayfası (misafirler için): sipariş no + e-posta */
  window.lookupOrder = async function () {
    const id = ($('lkId').value || '').trim(), mail = ($('lkMail').value || '').trim().toLowerCase(), out = $('lkResult');
    const notFound = '<p class="text-red-600">Sipariş bulunamadı veya e-posta eşleşmiyor.</p>';
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !/^\S+@\S+\.\S+$/.test(mail)) { out.innerHTML = notFound; return; }
    out.innerHTML = '<p>Sorgulanıyor...</p>';
    try {
      const s = await db.collection('orders').doc(id).get();
      if (!s.exists || String(s.data().userEmail || '').toLowerCase() !== mail) { out.innerHTML = notFound; return; }
      const o = s.data(), d = o.orderDate && o.orderDate.toDate ? o.orderDate.toDate().toLocaleString('tr-TR') : '-';
      const trackLine = o.trackingNumber ? '<p><b>Kargo:</b> ' + E(o.carrier || '') + ' · Takip No: ' + (o.trackingUrl ? '<a class="underline font-bold" target="_blank" rel="noopener noreferrer" href="' + E(o.trackingUrl) + '">' + E(o.trackingNumber) + '</a>' : E(o.trackingNumber)) + '</p>' : '';
      out.innerHTML = '<div class="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-2"><p><b>Sipariş:</b> #' + E(id.slice(0, 8)) + ' · ' + E(d) + '</p><p><b>Durum:</b> ' + E(o.status) + '</p>' + trackLine +
        '<p><b>Ürünler:</b> ' + (o.items || []).map(i => E(i.baseName || i.name) + (i.size && i.size !== 'Standart' ? ' (' + E(i.size) + ')' : '')).join(', ') + '</p><p><b>Toplam:</b> ' + tl(o.totalAmount) + ' TL</p></div>';
    } catch (e) { out.innerHTML = notFound; }
  };
  function init() {
    const ref = $('page-destek-merkezi'); if (!ref || $('page-siparis-sorgula')) return;
    const el = document.createElement('section'); el.id = 'page-siparis-sorgula'; el.className = 'page-section hidden max-w-4xl mx-auto px-4 py-16';
    const inp = 'class="w-full border border-brand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-900"';
    el.innerHTML = '<h1 class="font-serif text-3xl text-brand-900 mb-6 border-b pb-3">Sipariş Sorgula</h1><div class="text-sm text-brand-600 leading-relaxed space-y-4">' +
      '<p>Sipariş onay e-postanızdaki sipariş numarası ve sipariş verirken kullandığınız e-posta ile siparişinizin durumunu görebilirsiniz.</p>' +
      '<input id="lkId" ' + inp + ' placeholder="Sipariş numarası"><input id="lkMail" type="email" ' + inp + ' placeholder="E-posta">' +
      '<button onclick="lookupOrder()" class="bg-brand-900 text-white px-6 py-3 rounded-xl text-sm font-bold">Sorgula</button><div id="lkResult"></div></div>';
    ref.parentNode.insertBefore(el, ref);
    const fl = document.querySelector('footer a[onclick*="kargo-teslimat"]');
    if (fl && fl.closest('ul')) fl.closest('ul').insertAdjacentHTML('beforeend', '<li><a onclick="switchPage(\'siparis-sorgula\'); return false;" class="hover:text-white cursor-pointer transition-colors">Sipariş Sorgula</a></li>');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

;
/* BALLIN patch6.js — Haber Ver sekmesi, ürün durumu/eski fiyat, işlem günlüğü, puan düzeltme, kupon min. sepet,
   e-posta doğrulama, hesap silme/veri indirme, vitrin. patch5.js'ten SONRA yükle: <script src="patch6.js"></script> */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = s => window.esc(s), tl = n => (Number(n) || 0).toLocaleString('tr-TR');
  const FV = firebase.firestore.FieldValue;
  const isAdm = () => isStaffNow(currentUser);
  const log = (action, detail) => db.collection('admin_logs').add({ action, detail: String(detail).slice(0, 300), by: currentUser.email, at: FV.serverTimestamp() }).catch(() => {});
  const vis = p => isAdm() || (!p.status || p.status === 'published');
  const dt = x => x && x.toDate ? x.toDate().toLocaleString('tr-TR') : (x || '-');

  /* Taslak/arşiv ürünler vitrinde görünmez (yönetici hepsini görür) */
  ['renderMainGrid', 'filterAndSortProducts', 'renderNewGrid', 'renderWishlistGrid'].forEach(n => {
    const o = window[n]; if (!o) return;
    window[n] = function () { const orig = allProducts; allProducts = orig.filter(vis); try { return o.apply(this, arguments); } finally { allProducts = orig; } };
  });

  /* ---------- Vitrin: son ürünler + kategori kartları ---------- */
  function showcase() {
    const g = $('mainProductGrid'); if (!g) return;
    let w = $('showcaseWrap'); if (!w) { w = document.createElement('div'); w.id = 'showcaseWrap'; g.parentNode.insertAdjacentElement('beforebegin', w); }
    const list = allProducts.filter(vis); if (!list.length) { w.innerHTML = ''; return; }
    const img = p => (p.images && p.images[0]) || p.image || '';
    const cats = [...new Set(list.map(p => p.category).filter(Boolean))].slice(0, 4), tile = 'relative rounded-2xl overflow-hidden cursor-pointer group bg-brand-100';
    w.innerHTML = '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16"><h2 class="font-serif text-3xl md:text-4xl text-brand-900 mb-8 text-center">Yeni Gelenler</h2><div class="grid grid-cols-2 lg:grid-cols-4 gap-4">' +
      list.slice(0, 4).map(p => '<div class="' + tile + ' aspect-[4/5]" onclick="openProductDetail(\'' + p.id + '\')"><img loading="lazy" alt="' + E(p.name) + '" src="' + E(img(p)) + '" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"><div class="absolute inset-x-0 bottom-0 p-3 text-white" style="background:linear-gradient(transparent,rgba(0,0,0,.7))"><div class="text-sm font-serif line-clamp-1">' + E(p.name) + '</div><div class="text-xs font-bold">' + tl(p.price) + ' TL</div></div></div>').join('') + '</div>' +
      (cats.length > 1 ? '<h2 class="font-serif text-3xl md:text-4xl text-brand-900 mt-16 mb-8 text-center">Kategoriler</h2><div class="grid grid-cols-2 lg:grid-cols-4 gap-4">' + cats.map((c, i) => '<div class="' + tile + ' aspect-[16/10]" data-cat="' + i + '"><img loading="lazy" alt="' + E(c) + '" src="' + E(img(list.find(x => x.category === c))) + '" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"><div class="absolute inset-0 flex items-center justify-center text-white font-serif text-xl" style="background:rgba(0,0,0,.35)">' + E(c) + '</div></div>').join('') + '</div>' : '') + '</div>';
    w.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => goCat(cats[el.dataset.cat]));
  }
  window.goCat = function (c) { switchPage('collection'); const b = [...document.querySelectorAll('.cat-btn')].find(x => x.textContent.trim() === c); if (b) setCategoryFilter(c, b); };
  const _rm = window.renderMainGrid; window.renderMainGrid = function () { const r = _rm.apply(this, arguments); try { showcase(); } catch (e) {} return r; };

  /* ---------- Admin sekmeleri ---------- */
  const T = { pstatus: 'Ürün Durumu', alerts: 'Haber Ver Talepleri', logs: 'İşlem Günlüğü' };
  function adminUI() {
    const last = $('tab-coupons'); if (!last || $('tab-alerts')) return;
    const nav = [...document.querySelectorAll('.nav-item')].find(n => n.textContent.includes('Kuponlar'));
    if (nav) nav.insertAdjacentHTML('afterend', '<a class="nav-item" onclick="switchAdminTab(\'pstatus\', this)">Ürün Durumu</a><a class="nav-item" onclick="switchAdminTab(\'alerts\', this)">Haber Ver</a><a class="nav-item" onclick="switchAdminTab(\'logs\', this)">İşlem Günlüğü</a>');
    last.insertAdjacentHTML('afterend', ['pstatus|Ürün Durumu ve Eski Fiyat', 'alerts|Haber Ver Talepleri', 'logs|Son İşlemler'].map(x => { const [i, t] = x.split('|'); return '<div id="tab-' + i + '" class="admin-tab"><div class="card"><p class="card-title">' + t + '</p><div id="' + i + 'List"></div></div></div>'; }).join(''));
    const gr = $('adminCouponExpiry') && $('adminCouponExpiry').closest('.grid');
    if (gr && !$('adminCouponMin')) gr.insertAdjacentHTML('beforeend', '<div><label class="block text-xs mb-1" style="color:var(--mute)">Min. Sepet (TL)</label><input type="number" id="adminCouponMin" class="w-full" /></div>');
  }
  const _sw = window.switchAdminTab;
  window.switchAdminTab = function (id) {
    _sw.apply(this, arguments);
    if (T[id] && $('adminPageTitle')) $('adminPageTitle').innerText = T[id];
    if (id === 'pstatus') loadPStatus(); if (id === 'alerts') loadAlerts(); if (id === 'logs') loadLogs();
  };
  async function loadPStatus() {
    const b = $('pstatusList'); b.innerHTML = 'Yükleniyor...';
    const s = await db.collection('products').get(), op = (st, v, t) => '<option value="' + v + '"' + (st === v ? ' selected' : '') + '>' + t + '</option>';
    b.innerHTML = '<table><thead><tr><th>Ürün</th><th>Fiyat</th><th>Eski fiyat</th><th>Durum</th><th></th></tr></thead><tbody>' + s.docs.map(d => { const p = d.data(), st = p.status || 'published';
      return '<tr><td>' + E(p.name) + '</td><td>' + tl(p.price) + ' TL</td><td><input type="number" id="op_' + d.id + '" value="' + (p.oldPrice || '') + '" style="width:90px"></td><td><select id="st_' + d.id + '">' + op(st, 'published', 'Yayında') + op(st, 'draft', 'Taslak') + op(st, 'archived', 'Arşiv') + '</select></td><td><button class="btn-primary" onclick="savePStatus(\'' + d.id + '\')">Kaydet</button></td></tr>'; }).join('') + '</tbody></table>';
  }
  window.savePStatus = async function (id) {
    const o = parseFloat($('op_' + id).value), st = $('st_' + id).value;
    try { await db.collection('products').doc(id).update({ oldPrice: isNaN(o) ? FV.delete() : o, status: st }); log('ürün durumu', id + ' → ' + st + (isNaN(o) ? '' : ', eski fiyat ' + o)); showToast('Kaydedildi.', 'success'); loadProducts(); }
    catch (e) { showToast(e.message, 'error'); }
  };
  async function loadAlerts() {
    const b = $('alertsList'); b.innerHTML = 'Yükleniyor...';
    const s = await db.collection('stock_alerts').limit(200).get();
    b.innerHTML = s.empty ? '<p class="text-xs">Talep yok.</p>' : '<table><thead><tr><th>Ürün</th><th>Beden</th><th>E-posta</th><th>Tarih</th><th></th></tr></thead><tbody>' + s.docs.map(d => { const a = d.data();
      const mail = 'mailto:' + encodeURIComponent(a.email || '') + '?subject=' + encodeURIComponent('BALLIN: ' + (a.productName || 'Ürün') + ' stokta!') + '&body=' + encodeURIComponent('Merhaba, haber vermemizi istediğiniz ürün tekrar stokta: ' + (a.productName || '') + ' ' + (a.size || ''));
      return '<tr><td>' + E(a.productName) + '</td><td>' + E(a.size || '-') + '</td><td>' + E(a.email) + '</td><td>' + E(dt(a.requestDate)) + '</td><td><a class="btn-ghost" href="' + E(mail) + '">E-posta yaz</a> <button class="btn-ghost" onclick="delAlert(\'' + d.id + '\')">Sil</button></td></tr>'; }).join('') + '</tbody></table>';
  }
  window.delAlert = async function (id) { await db.collection('stock_alerts').doc(id).delete().catch(e => showToast(e.message, 'error')); loadAlerts(); };
  async function loadLogs() {
    const b = $('logsList'); b.innerHTML = 'Yükleniyor...';
    const s = await db.collection('admin_logs').orderBy('at', 'desc').limit(100).get();
    b.innerHTML = s.empty ? '<p class="text-xs">Kayıt yok.</p>' : '<table><thead><tr><th>Tarih</th><th>İşlem</th><th>Detay</th><th>Yönetici</th></tr></thead><tbody>' + s.docs.map(d => { const l = d.data(); return '<tr><td>' + E(dt(l.at)) + '</td><td>' + E(l.action) + '</td><td>' + E(l.detail) + '</td><td>' + E(l.by) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* Müşteriler: puan düzeltme (günlüğe yazılır) */
  window.loadCustomersCRM = function () {
    if (!isAdm()) return;
    db.collection('users').get().then(s => { const b = $('adminCustomersContainer'); if (!b) return;
      b.innerHTML = s.empty ? '<p class="text-xs">Müşteri yok.</p>' : '<table><thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Puan</th><th>Şehir</th><th></th></tr></thead><tbody>' +
        s.docs.map(d => { const u = d.data(); return '<tr><td>' + E(u.name || '') + ' ' + E(u.surname || '') + '</td><td>' + E(u.email || '-') + '</td><td>' + E(u.phone || '-') + '</td><td>' + tl(u.points) + '</td><td>' + E(u.city ? u.city + '/' + (u.district || '') : '-') + '</td><td><button class="btn-ghost" onclick="adjustPoints(\'' + d.id + '\')">Puan düzelt</button></td></tr>'; }).join('') + '</tbody></table>'; }).catch(() => {});
  };
  window.adjustPoints = async function (uid) {
    const n = parseInt(prompt('Puan değişimi (ör. 50 veya -50):')); if (!n) return; const why = prompt('Gerekçe:') || '';
    try { await db.collection('users').doc(uid).update({ points: FV.increment(n) }); log('puan düzeltme', uid + ' ' + n + ' (' + why + ')'); showToast('Puan güncellendi.', 'success'); loadCustomersCRM(); } catch (e) { showToast(e.message, 'error'); }
  };

  /* Kuponlar: doğru form alanları + minimum sepet (önceki yamadaki yanlış alan adlarını düzeltir) */
  window.addNewCoupon = async function () {
    if (!isAdm()) return;
    const v = id => $(id) ? $(id).value.trim() : '';
    const code = v('adminCouponCode').toUpperCase(), discount = parseFloat(v('adminCouponDiscount')), limit = parseInt(v('adminCouponLimit')), expiry = v('adminCouponExpiry'), min = parseFloat(v('adminCouponMin')) || 0;
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !(discount >= 1 && discount <= 100) || !(limit >= 1)) return showToast('Kod (3-30 harf/rakam/-/_), %1-100 indirim ve kişi sınırı girin.', 'error');
    try {
      const ref = db.collection('coupons').doc(code); if ((await ref.get()).exists) return showToast('Bu kupon kodu zaten var.', 'error');
      await ref.set({ code, discount, limit, expiryDate: expiry, minCart: min, usedCount: 0, createdAt: FV.serverTimestamp() });
      log('kupon oluşturuldu', code + ' %' + discount + (min ? ', min ' + min + ' TL' : '')); showToast('Kupon oluşturuldu.', 'success');
      ['adminCouponCode', 'adminCouponDiscount', 'adminCouponLimit', 'adminCouponExpiry', 'adminCouponMin'].forEach(i => { if ($(i)) $(i).value = ''; }); loadCouponsAdmin();
    } catch (e) { showToast(e.message, 'error'); }
  };
  window.applyPromoCode = async function () {
    const code = ($('promoCodeInput').value || '').trim().toUpperCase();
    if (!code) return showToast('Kupon kodu giriniz.', 'error');
    if (!currentUser || currentUser.isAnonymous) { showToast('Kupon için hesabınızla giriş yapın.', 'error'); return openModal(); }
    try {
      const cr = db.collection('coupons').doc(code), [cs, us] = await Promise.all([cr.get(), cr.collection('uses').doc(currentUser.uid).get()]);
      if (!cs.exists) return showToast('Geçersiz kupon kodu!', 'error');
      const c = cs.data(), sub = cart.reduce((s, i) => s + (i.price || 0), 0);
      if (us.exists) return showToast('Bu kuponu daha önce kullandınız.', 'error');
      if ((c.usedCount || 0) >= c.limit) return showToast('Kuponun kullanım limiti dolmuş!', 'error');
      if (c.expiryDate && new Date(c.expiryDate + 'T23:59:59') < new Date()) return showToast('Kuponun süresi dolmuş!', 'error');
      if (c.minCart && sub < c.minCart) return showToast('Bu kupon için minimum sepet tutarı ' + tl(c.minCart) + ' TL.', 'error');
      appliedDiscountRate = c.discount / 100; appliedCouponCode = cs.id;
      const i = $('promoDiscountInfo'); i.style.display = 'block'; i.innerText = 'Kupon uygulandı: %' + Number(c.discount) + ' indirim!';
      showToast('İndirim uygulandı.', 'success'); goToCheckout();
    } catch (e) { showToast('Kupon uygulanamadı.', 'error'); }
  };
  const _uo = window.updateAdminOrder;
  window.updateAdminOrder = async function (id) { const st = $('adminStatus_' + id) ? $('adminStatus_' + id).value : ''; await _uo.apply(this, arguments); log('sipariş güncellendi', id.slice(0, 8) + ' → ' + st); };

  /* ---------- E-posta doğrulama (hesaplı müşteriler: sipariş ve yorum için şart) ---------- */
  const unverified = u => u && !u.isAnonymous && u.email && !u.emailVerified && u.providerData.some(p => p.providerId === 'password');
  function banner() {
    const pg = $('page-profile'); if (!pg) return; let b = $('verifyBanner');
    if (!unverified(currentUser)) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'verifyBanner'; b.className = 'bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 text-xs mb-6'; pg.insertBefore(b, pg.firstChild); }
    b.innerHTML = 'E-posta adresiniz doğrulanmadı. Sipariş vermek ve yorum yapmak için doğrulama e-postasındaki bağlantıya tıklayın. <button class="underline font-bold" onclick="resendVerify()">Tekrar gönder</button> · <button class="underline font-bold" onclick="refreshVerify()">Doğruladım</button>';
  }
  window.resendVerify = () => currentUser.sendEmailVerification().then(() => showToast('Doğrulama e-postası gönderildi.', 'success')).catch(() => showToast('Çok sık denediniz, biraz bekleyin.', 'error'));
  window.refreshVerify = async () => { await currentUser.reload(); await currentUser.getIdToken(true); banner(); showToast(currentUser.emailVerified ? 'E-posta doğrulandı.' : 'Henüz doğrulanmamış görünüyor.', currentUser.emailVerified ? 'success' : 'error'); };
  firebase.auth().onAuthStateChanged(u => {
    if (unverified(u)) { const k = 'ballin_ver_' + u.uid; try { if (!localStorage.getItem(k)) { u.sendEmailVerification().catch(() => {}); localStorage.setItem(k, '1'); } } catch (e) {} }
    setTimeout(banner, 300);
  });
  ['processPayment', 'submitProductReview'].forEach(n => { const o = window[n];
    window[n] = function () { if (unverified(currentUser)) return showToast('Bu işlem için e-posta adresinizi doğrulayın (Hesabım sayfası).', 'error'); return o.apply(this, arguments); }; });

  /* ---------- Hesabım: verilerimi indir / hesabı sil ---------- */
  window.downloadMyData = async function () {
    if (!currentUser || currentUser.isAnonymous) return;
    const u = await db.collection('users').doc(currentUser.uid).get(), os = await db.collection('orders').where('userId', '==', currentUser.uid).get();
    const data = { hesap: { email: currentUser.email, uid: currentUser.uid }, profil: u.exists ? u.data() : {}, siparisler: os.docs.map(d => ({ id: d.id, ...d.data() })) };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'ballin-verilerim.json'; a.click();
  };
  window.deleteMyAccount = async function () {
    const u = firebase.auth().currentUser; if (!u || u.isAnonymous) return;
    if (!confirm('Hesabınız ve profil verileriniz kalıcı olarak silinecek. Siparişler yasal saklama yükümlülüğü nedeniyle korunur. Devam edilsin mi?')) return;
    try {
      if (u.providerData.some(p => p.providerId === 'password')) { const pw = prompt('Doğrulama için şifrenizi girin:'); if (!pw) return; await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw)); }
      else await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      await db.collection('users').doc(u.uid).delete(); await u.delete();
      localStorage.removeItem('ballin_cart'); localStorage.removeItem('ballin_wishlist'); showToast('Hesabınız silindi.', 'success'); setTimeout(() => { location.href = '/'; }, 1200);
    } catch (e) { showToast('Silinemedi: ' + (/wrong-password|invalid-credential/.test(e.code || '') ? 'şifre hatalı.' : e.message), 'error'); }
  };
  function init() {
    adminUI();
    const lo = document.querySelector('#page-profile button[onclick="logout()"]');
    if (lo && !$('btnMyData')) lo.parentNode.insertAdjacentHTML('beforeend', '<button id="btnMyData" onclick="downloadMyData()" class="border border-brand-300 text-brand-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-50 transition-colors">Verilerimi İndir</button><button onclick="deleteMyAccount()" class="border border-red-200 text-red-600 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">Hesabımı Sil</button>');
    if (typeof allProducts !== 'undefined' && allProducts.length) { try { renderMainGrid(); } catch (e) {} }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
