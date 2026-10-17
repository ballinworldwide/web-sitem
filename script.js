const firebaseConfig = { apiKey: "AIzaSyAiwyFOinP5FQc3npY0S34k1OrLG6u7Elo", authDomain: "ballinww.firebaseapp.com", projectId: "ballinww", storageBucket: "ballinww.firebasestorage.app", messagingSenderId: "460665379220", appId: "1:460665379220:web:b162c760e1b06bfbc2d781" };
const ADMIN_EMAIL = "ballinworldw@gmail.com"; 

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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return;
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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return;
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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return;
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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return;
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

async function sendOrderConfirmationEmail(orderData) {
    try {
        let itemsHTML = await generateEmailItemsHTML(orderData.items);
        emailjs.send("service_8a23cbj", "template_2pyabzf", {
            to_email: orderData.userEmail,
            customer_name: orderData.shippingInfo.name,
            order_id: orderData.orderId,
            total_amount: orderData.totalAmount + " TL",
            shipping_address: orderData.shippingInfo.address + " " + (orderData.shippingInfo.district || '') + "/" + (orderData.shippingInfo.city || ''),
            order_items_html: itemsHTML
        });
    } catch(e) { console.log("Email gönderilemedi:", e); }
}

async function sendShippingUpdateEmail(orderId, email, name, trackNo, items) {
    try {
        let itemsHTML = await generateEmailItemsHTML(items);
        emailjs.send("service_8a23cbj", "template_492t2tn", {
            to_email: email,
            customer_name: name,
            order_id: orderId.slice(0, 8).toUpperCase(),
            tracking_number: trackNo,
            order_items_html: itemsHTML
        });
    } catch(e) { console.log("Kargo bildirim maili gönderilemedi:", e); }
}

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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return;
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
        if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return; 
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
    if(!currentUser || currentUser.email !== ADMIN_EMAIL) return; 
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
