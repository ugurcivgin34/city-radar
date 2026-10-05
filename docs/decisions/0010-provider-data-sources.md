# ADR 0010 — Sağlayıcı verisi: İSPARK liste servisi ve İBB Trafik Yoğunluk Haritası segment servisi (OD-1)

- Status: Accepted
- Date: 2026-10-05

## Context
`docs/architecture.md` OD-1, ilk provider implementasyonundan önce İSPARK ve İBB trafik
verisinin endpoint, şema, güncelleme sıklığı, lisans ve hata davranışının doğrulanmasını şart
koşar; freshness eşikleri ve trafik normalizasyonu araştırmasız tahmin edilmez. Araştırma
2026-10-05'te (21:05–21:25 TSİ) birincil kaynaklar ve canlı çağrılarla yapıldı. Ürün ihtiyacı:
haritada yalnızca "İstanbul trafik indeksi %X" değil, **konumsal** trafik yoğunluğu göstermek.

**İSPARK — bulgular**
- `GET https://api.ibb.gov.tr/ispark/Park` ([dataset](https://data.ibb.gov.tr/dataset/ispark-otopark-listesi-web-servisi)):
  auth yok; 247 park, ~56 KB, ~0,3 sn. Alanlar: `parkID`, `parkName`, `lat`/`lng` (**string**),
  `capacity`, `emptyCapacity`, `workHours`, `parkType`, `freeTime`, `district`, `isOpen`.
  **Zaman damgası yok.**
- `GET …/ispark/ParkDetay?id={id}` ([dataset](https://data.ibb.gov.tr/dataset/ispark-otopark-detay-bilgileri-web-servisi)):
  ek olarak `updateDate` (`dd.MM.yyyy HH:mm:ss`, saat dilimi yok), adres, tarife (düz metin),
  `areaPolygon` (WKT). 247 parkın 53'ünde `updateDate` null; bazı parklar saatlerce bayat
  (en eski 12,6 sa; çoğu `isOpen=0`, ama açık parklarda da 109 ve 272 dk görüldü).
- Güncellik: açık parklarda `updateDate` yaşı 0–4,8 dk (sunucu `Date` header'ına göre, n=50)
  → kaynak döngüsü **~5 dk**. Tek akşam penceresi; yoğun saat ve günler arası ölçülmedi.
- Resmî kullanım dokümanı ([PDF v1.0](https://data.ibb.gov.tr/dataset/82232f39-e04c-4807-a067-41d578a5db8a/resource/f9f191cb-9e44-47a7-bbc6-527c5cfe82e7/download/tr_ispark-web-servis-kullanm-dokuman_v1.0.pdf))
  gerçek cevapla uyuşmuyor: alan adları, tipler ve polygon biçimi farklı, belgedeki `Distance`
  alanı yok. Şemanın kaynağı canlı cevaptır, belge değil.
- Hata davranışı: olmayan id → **`200` + sahte nesne** (`parkID:0`, `capacity:1`,
  `emptyCapacity:1`, boş string'ler). Sayısal olmayan id → `400`. Bilinmeyen path → `500` +
  SOAP `Policy Falsified` (Layer7 gateway). Koordinat hassasiyeti düzensiz (ör. `"41"`, `"28.79"`).

**İBB trafik — bulgular**
- `TrafficIndexHistory` ([dataset](https://data.ibb.gov.tr/dataset/trafik-indeks-degeri-web-servisi),
  [yardım](https://api.ibb.gov.tr/tkmservices/Help/Api/GET-api-TrafficData-v1-TrafficIndexHistory-day-period)):
  belgeli, ama **yalnızca şehir geneli** 1–99 indeks, 5 dk'lık kovalarla. `TrafficIndex_Sc1_Cont`
  en fazla Avrupa/Anadolu ayrımı verir. Konumsal ihtiyacı karşılamaz.
- Belgeli `SegmentData` v1 ([yardım](https://api.ibb.gov.tr/tkmservices/Help/Api/GET-api-TrafficData-v1-SegmentData))
  login arkasında (`302 → /Web/login.aspx`), herkese açık değil.
- [Trafik Yoğunluk Haritası](https://uym.ibb.gov.tr/yharita6/)'nın JS bundle'ı
  `https://tkmservices.ibb.gov.tr/web` altındaki şu endpoint'leri kullanıyor; hepsi auth'suz
  erişilebilir:
  - `GET /api/TrafficData/v4/SegmentData` → `{"Date":"…+03:00","Data":[{"T","S","V","C","D"}…]}`.
    ~11.800 segment; 532 KB (gzip ile ~61 KB). `Date` **~60 sn'de bir** ilerliyor; harita da
    60 sn'de bir sorguluyor. `D` yalnızca `HH:mm` (tarih yok) ve ~2 dk geride.
  - `GET /api/TrafficData/v3/Segments/{1..5}` → zoom kademesine göre polyline geometri
    `{"S","G":"[[lat,lng],…]","Z":"İLÇE"}` (kademe 1: 8.801 segment, ~3 MB).
  - `GET /api/IntensityMap/v1/StaticLayerVersion` → `SEG` geometri sürümü (2026-10-05'te
    `11078`, tarih 2024-07-04).
  - `C` kodunun haritadaki anlamı (bundle'daki stil dizisi ve lejant): 1 Serbest, 2 Açık,
    3 Akıcı, 4 Yoğun, 5 Çok Yoğun; veride olmayan segment "Veri Yok".
- Bu endpoint'ler açık veri portalında **belgelenmemiş**. Harita, portalda `ibb-license` ile
  listeleniyor ([dataset](https://data.ibb.gov.tr/dataset/traffic-density-map)), ama kaynak
  olarak yalnızca HTML sayfası gösteriliyor. UYM sitesinin altbilgisinde ise "tüm hakları …
  Trafik Müdürlüğü'ne aittir" yazıyor. **Lisansın bu API'yi kapsadığı doğrulanamadı.** v1'in
  login arkasına alınması ve v3/v4'e duyurusuz geçilmesi, stabilitenin de garanti olmadığını
  gösteriyor.
- `api.ibb.gov.tr` gateway'i origin'in 4xx cevaplarını `200` + `text/html` olarak dönüyor;
  origin `tkmservices.ibb.gov.tr` doğru durum kodlarını veriyor.
- [Hourly Traffic Density](https://data.ibb.gov.tr/dataset/hourly-traffic-density-data-set):
  geohash6 çözünürlüklü aylık CSV (~141 MB/ay); son veri Ocak 2025. Canlı değil, tarihsel.

**Lisans ve koşullar** — [İBB Açık Veri Lisansı v1.0](https://data.ibb.gov.tr/license): ticari
kullanım serbest. Kaynağa atıf ve mümkünse lisans linki zorunlu; sağlayıcı ifade vermemişse
belirtilen varsayılan atıf metni kullanılır. Resmî durum veya onay ima edilemez. Veri "olduğu
gibi" verilir; sürekli sunum garanti edilmez. [Kullanım Koşulları](https://data.ibb.gov.tr/terms_of_use):
doğrulanmadan güvenilmemeli; eski sürümler saklanmaz. Rate limit, kota, SLA veya timeout hiçbir
resmî kaynakta yayımlanmamış.

## Decision
1. **İSPARK v1:** yalnızca `GET https://api.ibb.gov.tr/ispark/Park` kullanılır. `measuredAt = null`;
   freshness `retrievedAt` üzerinden değerlendirilir (BR-2). `ParkDetay` taraması kapsam dışıdır.
2. **Konumsal trafik (T2):** İBB Trafik Yoğunluk Haritası'nın arka uç servisi kullanılır:
   `https://tkmservices.ibb.gov.tr/web` altında `v4/SegmentData`, `v3/Segments/{n}` ve
   `v1/StaticLayerVersion`. Geliştirme bu kaynakla ilerler. **Production/store yayını, İBB'den bu
   servisin yeniden kullanımı için alınacak yazılı teyide bağlı bir release requirement'tır;**
   teyit geliştirmeyi bloklamaz.
3. **Normalizasyon:** domain'in 4 seviyeli modeli korunur. `C1`+`C2` → akıcı, `C3` → orta,
   `C4` → yoğun, `C5` → çok yoğun; `C0`, bilinmeyen kod veya veride olmayan segment → bilinmiyor.
4. **Başlangıç configuration'ı:** İSPARK polling 5 dk, `stale` eşiği `retrievedAt` yaşı > 15 dk.
   Trafik polling 60 sn, `stale` eşiği `measuredAt` yaşı > 5 dk. Bu değerler ölçülen kaynak
   döngüsüne (~5 dk / ~60 sn) dayalı başlangıç politikalarıdır; tolerans katsayıları ölçüm değil,
   seçimdir. Gerçek gözlemle yalnızca configuration üzerinden ayarlanır; değer değişikliği yeni
   ADR gerektirmez.
5. **Trafik `measuredAt`:** SegmentData'nın top-level `Date` alanı (saat dilimi içerir), trafik
   snapshot'ının `measuredAt` kaynağıdır. Segmentlerdeki `D` (`HH:mm`) ana freshness saati olarak
   kullanılmaz; gerekirse yalnızca adapter içinde segment metadata'sı olarak değerlendirilir.
6. **FD-6 host deny-list'i:** mevcut kök kural (`ibb.gov.tr`, `ibb.istanbul`, `ispark.istanbul`
   ve alt alan adları) korunur. Araştırmada bulunan bütün sağlayıcı host'ları `ibb.gov.tr`
   altındadır. `api.ibb.gov.tr` ve `tkmservices.ibb.gov.tr` için açık test vakaları ilk provider
   spec'inde/change request'inde eklenir. Bu ADR kod veya test değiştirmez.

## Consequences
**Kazanımlar**
- OD-1 kapanır; provider implementasyonu spec/plan sürecine girebilir.
- Ürün fikri teknik olarak karşılanır: ~11.800 yol segmenti, polyline geometri ve ~60 sn
  güncellik, İBB'nin kendi verisi (domain invariant'ı: trafiğin tek doğruluk kaynağı İBB).
- İSPARK tarafında polling başına tek, ~56 KB'lık çağrı yapılır. Rate limit'i bilinmeyen bir
  servise kibar bir yük biner.
- Normalize model sağlayıcıdan bağımsız kalır; İBB'nin 5 sınıfı ve kodları domain'e veya API
  contract'ına sızmaz.
- Eşikler configuration olduğu için gözleme dayalı ayar mimari karar gerektirmez.

**Bedeller ve riskler**
- **Lisans riski (T2):** yeniden kullanım hakkı doğrulanmadı. İBB teyit vermez veya reddederse
  konumsal trafik katmanı yayınlanamaz; yatırımın trafik adapter'ı kısmı boşa gider. Domain ve
  API contract'ı etkilenmez, ama ürün vaadinin bir ayağı eksik kalır.
- **Stabilite riski (T2):** belgesiz, sürümlü iç endpoint'ler duyurusuz değişebilir veya auth
  arkasına alınabilir (v1 alındı). Bu durumda BR-5 devreye girer: son başarılı snapshot varsa
  bayat olarak sunulur; yalnızca hiç snapshot yoksa (ör. restart sonrası boş in-memory store)
  `503` döner. Kaynak değişikliği adapter'la sınırlıdır.
- **İSPARK doğruluk sınırı:** `measuredAt` null olduğundan park başına bayatlık görünmez. Kaynakta
  saatlerce güncellenmemiş bir park, bizim taze `retrievedAt`'imizle "available" görünür. Kabul
  edilen bir v1 kısıtıdır; kullanıcıya gösterilen zaman "alınma zamanı" olarak etiketlenir,
  asla ölçüm zamanı olarak değil.
- **Untrusted input yükü:** ilk provider spec'i, adapter doğrulamalarını bu araştırmanın
  bulgularına dayanarak tanımlar. Bu ADR doğrulama kurallarını kilitlemez; spec'in ele alması
  gereken gözlemler şunlardır:
  - olmayan `ParkDetay` id'sine `200` ile dönen sahte nesne (`parkID:0`, boş ad/koordinat);
  - string ve düzensiz hassasiyette koordinatlar;
  - kapasite ve boş kapasite tutarlılığı;
  - gateway'in hata durumlarında `200` ile döndüğü HTML/SOAP gövdeleri.
- **Normalizasyonda isim çakışması:** İBB'nin "Akıcı" (C3, turuncu) sınıfı bizde "orta" olur.
  İBB haritasıyla karşılaştıran kullanıcı farklı kelime görür.
- **Yük ve boyut:** trafik geometrisi büyüktür (kademe 1 ~3 MB). Yalnızca `StaticLayerVersion.SEG`
  değiştiğinde yeniden çekilir. SegmentData 60 sn'de bir ~0,5 MB'tır (gzip istenir).
- **Yeni release requirement'lar:**
  - İBB'den yazılı yeniden kullanım teyidi (production/store yayınını bloklar; geliştirmeyi
    bloklamaz).
  - Lisans gereği uygulama içinde veri kaynağı atfı ve lisans linki gösterilir; resmî durum
    veya onay ima edilmez.
  - City Radar politikası olarak, resmî ilişki veya onay izlenimi vermemek için İBB/İSPARK
    logosu kullanılmaz.
- Eşikler tek bir akşam ölçümüne dayanır; başlangıç değerleri yanlış çıkabilir (bkz. revisit).

## Alternatives considered
- **İSPARK liste + kademeli `ParkDetay` taraması:** park başına gerçek `updateDate` verir. Ancak
  247 çağrı/döngü (sürekli ~1 istek/sn) limiti bilinmeyen bir servise yük bindirir. Liste ile
  detay farklı anlarda okunduğu için doluluk detaydan alınmak zorunda kalır. Buna rağmen 53
  parkta `updateDate` zaten null. Maliyet doğruluğu garanti etmiyor; v1 için reddedildi,
  revisit trigger'ı olarak duruyor.
- **Yalnızca belgeli `TrafficIndexHistory` / `TrafficIndex_Sc1_Cont` (T1):** lisans ve belge
  açısından en temizi, ama yalnızca şehir veya yaka seviyesinde. Haritada konumsal trafik ürün
  ihtiyacını karşılamaz; reddedildi. İleride şehir özeti olarak eklenebilir.
- **Hourly Traffic Density (T3):** konumsal (geohash6), ama canlı değil (son veri Ocak 2025).
  Historical analytics ve persistence v1 kapsamı dışında; reddedildi.
- **Ticari trafik sağlayıcısı (TomTom/HERE vb., T4):** canlı ve belgeli, ama "trafiğin tek
  doğruluk kaynağı İBB" domain invariant'ını ve "harita sağlayıcısının hazır trafik katmanı
  kullanılmaz" kuralını ihlal eder. Domain değişikliği ve ayrı ADR gerektirir; fiyatlandırması
  araştırılmadı. Reddedildi; T2'nin lisans teyidi çıkmazsa değerlendirilecek yedek.
- **Domain'i İBB'nin 5 sınıfına hizalamak:** İBB haritasıyla kelime tutarlılığı sağlar, ama
  sağlayıcı detayını domain'e taşır ve domain değişikliği gerektirir; reddedildi.
- **`D` alanını segment başına `measuredAt` yapmak:** daha ince taneli, ama yalnızca `HH:mm`
  içerir. Gece yarısı devri ve tarih çıkarımı gerektirir; reddedildi.
- **Gateway (`api.ibb.gov.tr/tkmservices`) üzerinden trafik çağrısı:** aynı veri, ama 4xx
  durumlarını `200` + `text/html` olarak maskeliyor. Hata tespitini zorlaştırdığı için origin
  host tercih edildi.

## Revisit triggers
- İBB yeniden kullanımı reddeder ya da teyit production/store yayınına kadar gelmez → T1'e
  daralma veya T4 için yeni ADR.
- T2 endpoint'leri 404/302/401 dönmeye başlar, sürüm değişir (ör. v5) ya da şema değişir.
- İBB, belgeli ve herkese açık bir konumsal trafik API'si yayınlar → T2 yerine o kullanılır.
- İSPARK resmî rate limit veya yeni bir endpoint yayınlar, ya da liste cevabı değişir.
- Gözlenen kaynak döngüsü 5 dk / 60 sn'den belirgin şekilde sapar. Sapma yalnızca eşik
  değerini etkiliyorsa configuration değişir; polling modelini etkiliyorsa bu ADR açılır.
- `updateDate` null oranı veya açık parklardaki bayatlık kullanıcıyı yanıltacak düzeye çıkar →
  `ParkDetay` taraması yeniden değerlendirilir.
- Multi-instance'a geçiş (polling yükü instance sayısıyla katlanır).
