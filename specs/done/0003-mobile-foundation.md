# Spec 0003 — Mobil temel kurulumu

- Status: Shipped
- Spec approved by / on: Uğur Okan Çivgin, 2026-10-03
- Mode: lite
- Plan: `specs/plans/0003-plan.md`

## Intent
City Radar'ın geliştiricisi, ilk mobil ekranı (harita, yakın otoparklar) yazmadan önce mimari
kuralların **kendiliğinden korunduğu**, sürümleri sabitlenmiş bir mobil iskelet istiyor:
`docs/architecture.md`'deki mobil yasak bağımlılıklar (FD-5–FD-8) ihlal edildiğinde
`scripts/check` kırmızıya dönmeli; review'da hatırlanmaya bırakılmamalı. Başarı: `scripts/check`
ve `scripts/security-check` mobil adımlarını artık atlamadan gerçekten çalıştırır ve yeşildir;
uygulama tek bir Türkçe başlangıç ekranıyla açılır. Bilerek yapılmayan: harita, konum, sağlayıcı
verisi, API çağrısı ve hiçbir iş davranışı.

## Requirements
- R-1 — `mobile/` altında Expo + TypeScript (`strict: true`) + Expo Router ile tek bir mobil
  uygulama bulunur. Uygulama açıldığında tek bir başlangıç ekranı uygulama adını ve kısa bir
  açıklamayı Türkçe gösterir; kullanıcıya görünen metinler yalnızca `mobile/src/localization/tr.ts`
  merkezi kaynağından gelir. Bu kural, uygun ve bakımlı bir lint kuralı varsa tooling ile, yoksa
  review'da kontrol edilir (karar PLAN'da).
- R-2 — Sürümler sabittir: Expo SDK 57, kesin sürümle; Node sürümü repoda (`.nvmrc` ve
  `package.json` `engines`) Expo SDK 57'nin gerektirdiği aralıkta (Node 22.13.x ve üzeri; somut
  sürüm PLAN'da pinlenir); paket yöneticisi npm,
  `package-lock.json` source control'dadır ve kurulum lockfile'a göre deterministiktir (`npm ci`).
  Local ve CI aynı Node sürümünü kullanır.
- R-3 — `scripts/check` mobil adımlarını (lockfile doğrulamalı kurulum, typecheck, lint, format,
  test ve `expo export --platform android` ile Android production bundle/export) `SKIP` etmeden
  çalıştırır. Mobil proje var
  olduktan sonra bir mobil adımın `SKIP` etmesi kusurdur; görünür bir hata üretir.
- R-4 — Mobil yasak bağımlılıklar tooling ile zorlanır ve ihlalleri `scripts/check`'i kırar:
  FD-5 (HTTP yalnızca `mobile/src/api/` içinde), FD-6 (mobil kaynakta bilinen sağlayıcı host'u yok;
  liste OD-1 yapılmadan eksiksiz kabul edilmez ve OD-1 ADR'siyle güncellenir), FD-7
  (yasak harita SDK'ları yok), FD-8 (API contract tipleri yalnızca `mobile/src/api/` sınırından).
  Kuralların gerçekten tetiklendiği otomatik olarak kanıtlanır; kontroller vakum olarak geçemez.
- R-5 — `mobile/src/api/` tek HTTP ve contract sınırı olarak vardır. API base URL yalnızca public
  configuration'dan (`EXPO_PUBLIC_*`) okunur; `.env.example` repodadır, gerçek `.env` git dışında
  kalır; eksik ya da geçersiz değer anlaşılır bir configuration hatası üretir. Sınır yalnızca bu
  configuration'ı içerir; istek atan bir client yazılmaz ve bu feature'da hiçbir ağ isteği yapılmaz.
- R-6 — Mobil testler `jest-expo` + React Native Testing Library ile `scripts/check` içinde
  çalışır; sıfır testle geçmek mümkün değildir.
- R-7 — `scripts/security-check` npm adımını `SKIP` etmeden çalıştırır; production
  bağımlılıklarındaki high/critical zafiyet görünür failure üretir. Dependabot npm (`mobile/`)
  ekosistemini kapsar.
- R-8 — CI, Node'u pinlenmiş sürümden kurar ve mobil adımları gerçekten çalıştırır. Mobile
  Foundation'a devredilen `actions/setup-node` major yükseltmesi (Dependabot #4, v4 → v7) bu
  feature'da, Node adımı gerçekten çalışırken ayrı plan maddesi ve açık insan onayıyla yapılır.
- R-9 — README'nin mobil bölümleri gerçek komutlarla doldurulur: önkoşullar (Node sürümü),
  kurulum, uygulamayı çalıştırma, doğrulama komutları.
- R-10 — Eklenen her runtime ve anlamlı dev/test bağımlılığı plan'da paket, gerekçe, alternatif ve
  lisans ile listelenir (`docs/security.md`).

## Constraints & out of scope
- **Kapsam dışı (insan kararı):** harita ve MapLibre (OD-2 ADR'si bekleniyor), konum ve konum izni,
  sağlayıcı verisi, API client çağrıları ve ekranları, iş davranışı.
- **Kapsam dışı (YAGNI, ilgili feature'a kalır):** TanStack Query (ilk veri feature'ı), OpenAPI'den
  üretilen tipler (`src/api/generated/`, ilk endpoint feature'ı), global state, i18n kütüphanesi.
- **Kapsam dışı (build/dağıtım):** EAS, development build, store yayını, uygulama ikonu/splash
  tasarımı, iOS/Android native build; native paket kimlikleri (bundle id / package name) ilk
  development build gerektiren feature'da belirlenir. Geliştirici makinesi Windows olduğu için iOS
  çalıştırma kanıtı beklenmez.
- **Kapsam dışı:** E2E ve görsel regression altyapısı (`docs/testing.md`), telemetri/analytics.
- **Kısıtlar:** backend değişmez ve backend adımları/testleri aynen yeşil kalır. `scripts/check`,
  CI ve testler ağdaki canlı bir City Radar API'sine veya sağlayıcıya bağımlı değildir. Mobilde
  gerçek secret yoktur (`docs/security.md`).

## Acceptance criteria
- [x] AC-1 — Temiz bir checkout'ta `./scripts/check` mobil adımlarının hiçbirini `SKIP` etmeden
  çalıştırır ve yeşildir. `mobile/` projesi eksikse mobil adımlar `SKIP` değil hata verir.
- [x] AC-2 — `mobile/` bir Expo + Expo Router projesidir; `tsconfig` `strict: true` içerir; Expo SDK
  kesin sürümle sabitlenmiştir ve Expo'ya bağlı paketler o SDK'nın beklediği sürümlerdedir;
  `package-lock.json` repodadır ve `npm ci` onu değiştirmeden kurulum yapar.
- [x] AC-3 — Node sürümü `mobile/.nvmrc` ve `package.json` `engines` alanında tutarlıdır ve Expo
  SDK 57'nin gerektirdiği aralıktadır (Node 22.13.x ve üzeri; somut sürüm PLAN'da); CI Node'u bu dosyadan kurar ve CI loglarında Node
  ile mobil adımlarının gerçekten çalıştığı görülür.
- [x] AC-4 — Başlangıç ekranı uygulama adını ve kısa açıklamayı Türkçe gösterir; test, ekranda
  görünen metinlerin `tr.ts`'teki değerler olduğunu doğrular (metin `tr.ts`'te değişirse test
  ekranın yeni değeri gösterdiğini görür).
- [x] AC-5 — Başlangıç ekranı render edilirken hiçbir ağ isteği yapılmaz ve konum izni istenmez;
  bağımlılık listesinde harita ve konum paketleri yoktur.
- [x] AC-6 — `expo export --platform android` Android production bundle/export'u ağ ve cihaz
  olmadan, `scripts/check` içinde hatasız üretir; çözülemeyen bir import export'u ve check'i kırar.
  Bu kriter export başarısını kanıtlar; uygulamanın bir cihazda açıldığının kanıtı değildir.
- [x] AC-7 (FD-5) — `mobile/src/api/` dışında `fetch`, `XMLHttpRequest` veya HTTP client
  kullanımı `./scripts/check`'i kırar; aynı kullanım `mobile/src/api/` içinde serbesttir.
- [x] AC-8 (FD-6) — Mobil kaynakta, kontrolün bilinen sağlayıcı host listesindeki bir host (ör.
  `ibb.gov.tr`) geçtiğinde `./scripts/check` kırılır; kullanıcı metnindeki "İSPARK" kelimesi
  serbesttir. Liste OD-1 yapılmadan eksiksiz kabul edilmez; kriter yalnızca listedeki host'ların
  yakalandığını kanıtlar.
- [x] AC-9 (FD-7) — `react-native-maps`, `@rnmapbox/maps` veya Google/Mapbox native harita SDK'sı
  mobil bağımlılıklarına eklendiğinde `./scripts/check` kırılır.
- [x] AC-10 (FD-8) — `mobile/src/api/` dışındaki bir dosya, API contract tiplerini `src/api`'nin
  public yüzeyi yerine iç yolundan import ettiğinde `./scripts/check` kırılır.
- [x] AC-11 — FD-5–FD-8 kontrolleri vakum olarak geçemez: her kural için ihlal örneğinin kuralı
  gerçekten tetiklediği ve izinli örneğin tetiklemediği otomatik olarak doğrulanır.
- [x] AC-12 — API base URL yalnızca `EXPO_PUBLIC_API_BASE_URL`'den okunur; değer eksik ya da geçerli
  bir `http(s)` URL'si değilse anlaşılır bir configuration hatası oluşur (test); `.env.example`
  repodadır, `.env` gitignored kalır.
- [x] AC-13 — Tip hatası ya da Prettier format ihlali `./scripts/check`'i kırar.
- [x] AC-14 — Mobil testler `./scripts/check` içinde çalışır; hiç test bulunamazsa check kırılır.
- [x] AC-15 — `./scripts/security-check` npm adımını `SKIP` etmeden çalıştırır; production
  bağımlılıklarında high/critical zafiyet → RED; npm advisory erişimi başarısız → RED (açıkça
  etiketli).
- [x] AC-16 — Dependabot yapılandırması npm (`/mobile`) ekosistemini içerir; CI'da
  `actions/setup-node` v7'dir, bu major yükseltmenin release notes değerlendirmesi ve açık insan
  onayı plan'da kayıtlıdır ve Node adımı gerçekten çalışırken CI yeşildir.
- [x] AC-17 — README mobil bölümleri (önkoşullar, kurulum, çalıştırma, doğrulama) repodaki gerçek
  komut ve sürümlerle aynıdır.
- [x] AC-18 — Eklenen her bağımlılık plan'da paket/gerekçe/alternatif/lisans ile listelenmiştir;
  GPL/AGPL veya proprietary lisanslı paket yoktur.
- [x] AC-19 — Backend etkilenmez: `backend/` altında değişiklik yoktur; backend adımları ve mevcut
  71 test aynen yeşildir.

## Definition of Done
- [x] Every acceptance criterion mapped to proof (test or reproducible observation)
- [x] `scripts/check` green
- [x] Independent review done; real findings fixed, noise rejected with written rationale
- [x] Docs / ADRs updated if behavior or architecture changed
- [x] Spec moved to `specs/done/` (it becomes immutable there)

## Scorecard (fill at ship — honest numbers make the process improvable)
| Metric | Value |
|---|---|
| Spec revisions | 1 (onay öncesi 4 netleştirme) |
| Fix rounds | 2 (review 1 fix round; VERIFY fix round) |
| Review findings: real / noise | 16 / 4 (review 1: 12 real, F-7 ve F-12 içindeki birer kısım noise; review 2: 1 real, 1 noise; VERIFY: 3 real, 1 noise) |
| Regressions introduced | 0 |
| Bugs escaped to production | 0 (henüz yayın yok) |

Ship kaydı (2026-10-04, Uğur Okan Çivgin): VERIFY — bağımsız QA, PR #9 head `8dd7974` — AC-1…AC-19
**19/19 Met**; kriter ↔ kanıt tablosu PR #9 yorumunda. Bağımsız review: review 1 (3 Medium, 7 Low,
2 Info), fix round 1 re-review (clean; 1 Low noise, 1 Info), VERIFY düzeltmeleri dar re-review
(clean); triage kayıtları `specs/plans/0003-plan.md`. BUILD/review sapmaları (R-07, insan onaylı):
`react-dom`/`react-test-renderer` 19.2.3 + `@types/jest`; ADR 0009 npm audit istisnası; Expo Router
native peer'ları SDK sürümlerinde. Expo Go/emülatör smoke testi şart koşulmadı (insan kararı); AC-6
export başarısını kanıtlar, cihazda açılmayı değil. Merge, son commit SHA'sına sabitlenmiş squash
ile yapılır; merge sonrası kanıt PR #9 yorumlarında.
