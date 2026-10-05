# Domain

> İş ve insanlar ile agent'lar arasındaki ortak dil. Burada olmayan bir terim için AI'ın kendi
> anlamını uyduracağını varsayın. Bootstrap: 2026-10-02.

City Radar, İstanbul'da yaşayan vatandaşların şehir içindeki güncel durumları tek bir mobil harita
üzerinden hızlıca görmesini sağlar. v1: kullanıcının konumu, yakındaki İSPARK otoparkları ve
doluluk bilgileri, harita üzerinde trafik yoğunluğu.

## Ubiquitous language

| Term | Meaning | Notes / not to be confused with |
|---|---|---|
| Konum (Location) | Kullanıcının cihazından gelen anlık koordinat (WGS84 enlem/boylam). | Kesin konum gizlilik açısından hassastır — BR-4. Harita merkezi ≠ kullanıcı konumu. |
| Otopark (Parking) | İSPARK tarafından sağlanan bir otopark noktası. Kimlik, ad, koordinat, kapasite ve sağlayıcı veriyorsa otopark tipi içerir. | Dış sağlayıcıdan gelmeyen alanlar **varsayılmaz**; yoksa `null`. |
| Doluluk (Occupancy) | Bir otoparka ait belirli bir zamandaki kapasite / boş kapasite durumu. | Her zaman zaman bilgisiyle birlikte: `measuredAt` ve/veya `retrievedAt`. |
| measuredAt | Veri kaynağının bildirdiği ölçüm zamanı. Kaynak vermiyorsa `null`. | `retrievedAt` ile **asla** karıştırılmaz; yerine konmaz, onun adıyla gösterilmez. |
| retrievedAt | City Radar'ın veriyi sağlayıcıdan aldığı zaman. Her snapshot'ta zorunlu. | Ölçüm zamanı değildir. |
| Trafik yoğunluğu (Traffic level) | Uygulamanın normalize edilmiş trafik seviyesi: `akıcı / orta / yoğun / çok yoğun` + `bilinmiyor/veri yok`. | Dönüşüm kuralı (ADR 0010, İBB segment renk sınıfı `C`): `C1`+`C2` → akıcı, `C3` → orta, `C4` → yoğun, `C5` → çok yoğun; `C0`, bilinmeyen kod veya verisi olmayan segment → bilinmiyor. İBB'nin "Akıcı" sınıfı (`C3`) bizde "orta"dır; sağlayıcının sınıf adları domain'e taşınmaz. Harita sağlayıcısının trafik katmanı değildir. |
| Veri kaynağı / Sağlayıcı (Provider) | Dış veri sağlayıcısı: v1 için İSPARK (otopark/doluluk) ve İBB trafik verisi. | Endpoint, şema, güncelleme sıklığı ve lisans ADR 0010'da doğrulandı. İSPARK liste servisi ölçüm zamanı vermez (`measuredAt = null`); trafik snapshot'ının `measuredAt`'i segment servisinin top-level `Date` alanıdır. |
| Veri Anlık Görüntüsü (Snapshot) | Bir dış kaynaktan belirli bir anda alınan otopark veya trafik durumunun normalize edilmiş hali. | Sağlayıcının ham cevabı (provider DTO) değildir. |
| Veri Güncelliği (Freshness) | Bir snapshot'ın, veri tipi ve sağlayıcı için belirlenen kabul edilebilir yaş sınırı (freshness threshold) içinde olup olmadığı. | Eşik configuration'dan gelir; sağlayıcı/veri tipi başına tanımlanır. |
| Bayat veri (Stale) | Veri tipine/sağlayıcıya ait freshness policy'yi aşan veri. | Gizlenmez; "güncel değil" olarak işaretlenerek gösterilir (BR-2, BR-5). |
| Yakınlık (Nearby) | Kullanıcı konumuna göre yarıçap tabanlı arama alanı. | Yarıçap tamsayı metre. |
| İstanbul kapsamı | City Radar'ın veri kapsamı: İstanbul il sınırları. | Uygulamanın kullanım kapsamı değildir — BR-6. |

## Business rules

- **BR-1 — Yakınlık yarıçapı.** Varsayılan yarıçap 1000 m; seçenekler 500 / 1000 / 3000 m.
  Varsayılan ve seçenekler configuration'dır (ürün kullanımına göre değişebilir); izinli liste
  dışındaki yarıçap geçersiz girdidir.
- **BR-2 — Doluluk zamanı.** Doluluk bilgisi her zaman veri zamanıyla birlikte gösterilir.
  Freshness threshold configuration üzerinden yönetilir. Başlangıç değeri (ADR 0010): İSPARK
  için yaş > 15 dk → stale (polling 5 dk; ölçülen kaynak döngüsü ~5 dk). Değer gerçek gözlemle
  yalnızca configuration'dan ayarlanır. İSPARK `measuredAt` vermediği için yaş `retrievedAt`'ten
  hesaplanır ve kullanıcıya gösterilen zaman "alınma zamanı"dır. Eşitlik kuralı:
  `age <= threshold → available`, `age > threshold → stale`. Yaş, `measuredAt` varsa ondan,
  yoksa `retrievedAt`'ten hesaplanır — ancak `retrievedAt` hiçbir zaman `measuredAt` olarak
  adlandırılmaz/gösterilmez.
- **BR-3 — Konum izni yok.** Konum izni olmaması normal bir uygulama durumudur: uygulama
  çökmez, harita İstanbul merkezli açılır, otoparklar haritanın görünen alanına göre listelenir.
- **BR-4 — Konum gizliliği.** Kullanıcının kesin konumu kalıcı olarak saklanmaz ve
  application/infrastructure loglarına, telemetry/analytics event'lerine veya exception
  context'ine yazılmaz. Yalnızca aktif "yakınımdaki" sorgusu için kısa süreli işlenir. API
  tasarımı koordinatların loglanmasını engeller/redact eder (gerektiğinde read-only `POST`
  sorgu endpoint'i — `docs/security.md`).
- **BR-5 — Sağlayıcı erişilemez.** Sağlayıcı erişilemezse son başarılı snapshot, veri kaynağı ve
  son güncellenme/alınma zamanı korunarak "bayat" olarak sunulur. Hiç snapshot yoksa açık bir
  "veri şu anda alınamıyor" durumu gösterilir (API: `503` — `docs/conventions.md`).
- **BR-6 — İstanbul kapsamı.** Veri kapsamı İstanbul'dur; İstanbul dışındaki kullanıcıya hata
  veya zorunlu boş sonuç verilmez, uygulama İstanbul haritasıyla kullanılmaya devam eder.
  Yalnızca "yakınımdaki" sorgular İstanbul kapsamındaki verilerle sınırlıdır.

## Key domain invariants

- `measuredAt` ve `retrievedAt` ayrı kavramlardır; biri diğerinin yerine geçmez.
- Bilinmeyen değer `null`'dır; `0`, `-1`, `"unknown"` bilinmeyen anlamında kullanılmaz
  (gerçek sıfır — ör. boş kapasite 0 — geçerli bir değerdir).
- Snapshot yalnızca başarıyla parse ve normalize edilmiş veriden oluşur; bozuk/yarım veri mevcut
  iyi snapshot'ın yerine geçemez.
- Trafik bilgisinin tek doğruluk kaynağı (source of truth), City Radar'ın normalize ettiği İBB
  trafik verisidir.
- Kullanıcının kesin konumu hiçbir kalıcı ortama (veritabanı, log, telemetry, cihaz deposu) yazılmaz.
