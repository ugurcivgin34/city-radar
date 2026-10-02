# Architecture

> Karar verilmiş mimari — hedef değil. Agent'lar plan yapmadan önce bu dosyayı okur.
> Bootstrap: 2026-10-02. Gerekçe: ADR 0004.

## System overview

City Radar, bir **mobil istemci** (React Native + Expo + TypeScript) ve bir **backend API**'den
(ASP.NET Core, .NET 10 LTS) oluşan bir **monorepo**'dur. Backend bir **modüler monolit**tir:
dış sağlayıcılardan (İSPARK, İBB trafik) veriyi background service ile periyodik çeker,
normalize eder, abstraction arkasındaki in-memory snapshot store'da tutar ve normalize edilmiş
API contract'larıyla sunar. Mobil istemci yalnızca City Radar API ile konuşur. Seçimin tek satırlık
gerekçesi: v1 için servis ayrımı operasyon yükü getirir; modül sınırları kod ve derleyici ile
korunur (ADR 0004).

```
backend/   src/{CityRadar.Shared, .Parking, .Traffic, .Infrastructure, .Api} · tests/
mobile/    src/api/ (tek HTTP sınırı; src/api/generated/) · src/localization/tr.ts · app/ (Expo Router)
docs/  specs/  workflows/  prompts/  scripts/
```

Temel akış (v1, mümkün olduğunca basit):
`Provider → Adapter → Normalize → Snapshot Store → API → Mobile`

### v1 kabulleri
- Backend tek instance çalışır.
- Restart sonrası memory store boş başlayabilir; ilk başarılı provider fetch'e kadar API kontrollü
  "veri alınamıyor" durumu döner (`503` + ProblemDetails).
- Historical analytics kapsam dışı olduğu için persistence (veritabanı) yok.
- Multi-instance ihtiyacı doğarsa store implementasyonu shared bir store (ör. Redis) ile ADR
  üzerinden değiştirilebilir olmalı — bu yüzden iş modülleri yalnızca store port'unu bilir.

### Resilience (dış sağlayıcı çağrıları)
- Timeout, cancellation, kontrollü (sınırlı, backoff'lu) retry ve uygun resilience politikaları
  zorunlu; sonsuz veya agresif retry yasak.
- Sağlayıcı erişilemezse BR-5: son başarılı snapshot zaman bilgisiyle kullanılır.
- Yeni veri yalnızca başarılı parse + normalize sonrası store'u **atomik** günceller.

## Modules / components and ownership

| Module | Single responsibility | Owns |
|---|---|---|
| `CityRadar.Shared` | Gerçekten iki modülce ortak kullanılan, business ownership'i olmayan küçük primitive'ler: Coordinate, Radius, Distance, Geo/İstanbul kapsamı kuralları, Freshness policy/configuration abstraction. **Dumping ground değildir** — Parking'e veya Traffic'e özgü model buraya taşınmaz. | Veri yok (saf tipler) |
| `CityRadar.Parking` | İSPARK verisinin normalize modeli, otopark/doluluk snapshot'ları, yakın otopark sorgusu. Kendi port'larını tanımlar (`IParkingProvider`, `IParkingSnapshotStore`). | Otopark ve doluluk snapshot'ları |
| `CityRadar.Traffic` | İBB trafik verisinin normalize modeli ve trafik snapshot'ları. Kendi port'larını tanımlar (`ITrafficProvider`, `ITrafficSnapshotStore`). | Trafik snapshot'ları |
| `CityRadar.Infrastructure` | Dış sağlayıcı HTTP client'ları ve adapter'lar (`Providers.Ispark`, `Providers.IbbTraffic`), provider DTO → normalize model dönüşümü, background polling, snapshot store implementasyonları (ör. `InMemoryParkingSnapshotStore`), resilience, teknik configuration. | Provider DTO'ları (internal) |
| `CityRadar.Api` | HTTP endpoint'leri, API contract DTO'ları (`Contracts.*`), input validation, ProblemDetails hata cevapları, koordinat redaksiyonu, rate limiting. Composition root. | API contract'ları |
| `mobile` | Harita ekranı, katmanlar (kullanıcı konumu, İSPARK, İBB trafik), durum ekranları. `src/api/` tek HTTP ve contract sınırı. | UI durumu (kalıcı konum yok) |

Proje referans yönü (derleyici ile zorlanır):
`Shared ← Parking`, `Shared ← Traffic`, `Parking/Traffic/Shared ← Infrastructure`, `hepsi ← Api`.

## Communication rules

- Mobile **yalnızca** City Radar Backend API ile konuşur; Mobile → İBB / İSPARK doğrudan erişim yasak.
- Mobil içinde akış: `screen/component → query hook (TanStack Query) → src/api client → City Radar API`.
- Parking ve Traffic birbirini çağırmaz; birbirlerinin internal tiplerine ve store'larına erişmez.
- Modüller arası erişim yalnızca public arayüz/port üzerinden; Infrastructure port'ları implemente eder.
- Kavramsal bağımlılık yönü: `External Provider → Infrastructure Adapter → Parking/Traffic → API → Mobile`.
  Dış sağlayıcının JSON şeması uygulamanın domain/API contract'ına taşınmaz.
- API, domain nesnesini doğrudan serialize etmez: `Domain model → (mapping) → API contract DTO → JSON → Mobile`.
  Contract DTO yalnızca gerçek API sınırında oluşturulur; gereksiz katman/model çoğaltılmaz.
- OpenAPI, ilk backend endpoint'iyle birlikte API contract'ının source of truth'u olur:
  `ASP.NET Core → OpenAPI → generated TS types (mobile/src/api/generated/) → handwritten client/hooks`.
  Generated kod UI'da doğrudan kullanılmaz. (İlk endpoint feature'ının planına dahil edilir.)

## Forbidden dependencies (make them testable)

Zorlama sırası: **compiler → architecture test → lint/check → (en son) code review.** Enforce
edilebilen hiçbir kural yalnızca dokümana veya hafızaya bırakılmaz.

| # | Kural | Zorlayan |
|---|---|---|
| FD-1 | `Parking` ve `Traffic` birbirine referans vermez. | `.csproj` referans yönü + `ProjectReferenceTests` (csproj, birebir izinli küme) + `ModuleDependencyTests` (IL) |
| FD-2 | `Parking`, `Traffic`, `Shared`; `CityRadar.Infrastructure`, `CityRadar.Api`, ASP.NET Core, `Microsoft.Extensions.Caching.*`, `HttpClient`/`System.Net.Http` tabanlı provider erişimine bağımlı olmaz. Yalnızca gerçekten business katmanına ait olmayan teknik bağımlılıklar yasaktır; sırf framework bağımlılığını sıfırlamak için anlamsız abstraction üretilmez (YAGNI). | `ProjectReferenceTests` (Sdk, FrameworkReference, PackageReference) + `ModuleDependencyTests` (IL) |
| FD-3 | Provider DTO'ları `CityRadar.Infrastructure.Providers.<Provider>.Dtos` altında yaşar ve `internal`'dır. Api, Parking ve Traffic hiçbir `CityRadar.Infrastructure.Providers.*` tipine bağımlı olmaz; dönüşüm adapter sınırında yapılır. Api, Infrastructure'ı yalnızca `Providers.*` dışındaki composition yüzeyi üzerinden kullanır. (`Providers.*` altındaki DTO dışı tiplerin internal olması zorunlu değildir; seçilirse ayrıca kararlaştırılır.) | `ModuleDependencyTests` (IL) |
| FD-4 | Api contract'ları (`CityRadar.Api.Contracts.*`) Shared/Parking/Traffic tiplerine **hiçbir şekilde** (public yüzey, internal üye, method gövdesi) bağımlı olmaz; domain → contract mapping `Contracts` namespace'i dışında yapılır. *Spec 0001 ile bilinçli olarak sıkılaştırıldı (insan kararı, review F-2, 2026-10-02).* | `ModuleDependencyTests` (IL) |
| FD-5 | Mobilde HTTP (`fetch`, `axios` veya seçilecek client) yalnızca `mobile/src/api/` içinde kullanılır. | ESLint (`no-restricted-globals` / `no-restricted-imports`) |
| FD-6 | Mobil kaynakta provider endpoint/host bilgisi (`ibb.gov.tr`, İSPARK host'ları) bulunmaz. Kontrol URL/host'a odaklanır; UI'da "İSPARK" metni serbesttir. | ESLint + `scripts/check` (defense-in-depth) |
| FD-7 | `react-native-maps`, `@rnmapbox/maps` ve Google/Mapbox native map SDK bağımlılıkları eklenmez (MapLibre serbest). Değişiklik yalnızca ADR ile. | `scripts/check` deny-list |
| FD-8 | Mobil API contract tipleri yalnızca `mobile/src/api/` sınırından kullanılır. | ESLint (`no-restricted-imports`) |

Architecture test kütüphanesi: **ArchUnitNET** (`TngTech.ArchUnitNET.xUnitV3`) — tek kütüphane;
gerekçe plan 0001'de (OD-3). Kurallar namespace/assembly tabanlıdır; yeni tipler otomatik kapsanır.
Saat kuralı (`TimeProvider`) derleyici seviyesindedir: `Microsoft.CodeAnalysis.BannedApiAnalyzers`
+ `backend/BannedSymbols.txt`, yalnızca `backend/src` üretim projelerinde.

## Harita mimarisi

`OpenStreetMap data → Tile/Style Provider → MapLibre React Native → City Radar Map (+ İSPARK Layer + İBB Traffic Layer + User Location)`

- Harita motoru: **MapLibre React Native**; harita verisi OpenStreetMap tabanlı.
- OSM public tile sunucuları production'da sınırsız ücretsiz tile servisi gibi kullanılmaz.
- Tile/style sağlayıcısı ilk harita implementasyonundan önce ADR ile seçilir (açık karar OD-2).
- Google Maps veya Mapbox başlangıç bağımlılığı değildir.
- Harita sağlayıcısının hazır trafik katmanı kullanılmaz; trafik katmanı City Radar API'sinin
  normalize trafik verisinden çizilir.
- MapLibre nedeniyle Expo Go'ya bağlı geliştirme varsayılmaz; gerektiğinde development build kullanılır.
- Global state management kütüphanesi başlangıçta yok; gerçek ihtiyaç çıkarsa eklenir.

## Prensipler

1. **Provider Isolation.** Dış sağlayıcı bağımlılıkları adapter arkasındadır; bir dış endpoint'in
   veya response modelinin değişmesi mümkün olduğunca Mobile'ı ve City Radar API contract'ını etkilemez.
2. **YAGNI.** v1 ihtiyacı olmayan teknoloji "ileride gerekebilir" diye eklenmez. Başlangıçta
   zorunlu **değil**: microservice, message broker, Kafka/RabbitMQ, CQRS, event bus, repository
   pattern, Unit of Work, Redis, PostgreSQL/PostGIS. Gerçek ihtiyaç doğarsa ADR ile eklenir.

## Deliberately out of scope

v1'de yok: kullanıcı hesabı, authentication, bildirimler, rota/navigasyon, rezervasyon, ödeme,
historical analytics, web client, background location, E2E test altyapısı.

## Açık kararlar

- **OD-1 — Sağlayıcı verisi.** İSPARK ve İBB trafik verisinin endpoint, response schema,
  güncelleme sıklığı, kullanım/lisans koşulları ve hata davranışları varsayılmaz; ayrı araştırma +
  ADR ile doğrulanır. Backend temel kurulumuyla paralel yürüyebilir, fakat **ilk provider
  implementation başlamadan önce ADR tamamlanmış olmalıdır.** Freshness threshold'ları ve trafik
  normalizasyon kuralları araştırma yapılmadan tahmin edilmez.
- **OD-2 — Tile/style sağlayıcısı.** Mobil harita feature'ı başlamadan önce ADR; OSM public tile
  sunucusuna production bağımlılığı kurulmaz. En az şu kriterler:
  lisans, attribution zorunlulukları, ücretsiz kullanım limiti, production maliyeti, Android ve
  iOS desteği, Expo uyumluluğu, marker desteği, custom layer desteği, GeoJSON/vector layer
  desteği, traffic overlay çizme yeteneği, vendor lock-in riski.
- ~~OD-3 — Architecture test kütüphanesi.~~ **Kapandı (2026-10-02, plan 0001):** ArchUnitNET —
  aktif bakım (NetArchTest.Rules'ın son sürümü 2021) ve xUnit v3 entegrasyonu.

## Setup feature'larına devredilenler
- ~~Backend setup~~ — **yapıldı (spec 0001):** NU1900–NU1904 `WarningsNotAsErrors`; diğer tüm
  warning'ler hata; vulnerability enforcement `scripts/security-check`.
- **Mobil setup:** paket yöneticisi **npm**; `package-lock.json` source control'a girer, CI ve
  `scripts/check` `npm ci` kullanır.
- **Dependabot:** NuGet + GitHub Actions eklendi (spec 0001); npm mobil setup feature'ında eklenir.
- **README:** City Radar README'si yazıldı (spec 0001); mobil setup feature'ı mobil bölümlerini doldurur.
- **Release requirement (v1'i bloklamaz, store yayınını bloklar):** gizlilik politikası, KVKK
  bilgilendirmeleri, app store privacy declarations (`docs/security.md`).
- **Remote / branch protection:** `docs/git.md` açık aksiyonları.
