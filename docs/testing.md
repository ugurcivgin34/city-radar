# Testing

> Bootstrap: 2026-10-02.

## The contract
- Every acceptance criterion maps to at least one test (criterion ↔ test map lives in the plan).
- Tests assert **behavior**, not implementation details or mere status codes.
- The whole suite runs inside `scripts/check` — one command, everywhere.

Her feature planında kabul kriteri ↔ test eşlemesi açıkça görünür (ör. `AC-1 → ParkingServiceTests.…`,
`AC-2 → ParkingApiTests.…`, `AC-3 → NearbyParkingScreenTests.…`). İsim birebir böyle olmak
zorunda değil; amaç hangi kriterin hangi testle doğrulandığının görülebilmesi.

## Frameworks & layout

**Backend**
- xUnit + xUnit'in kendi `Assert` API'si. Ek assertion kütüphanesi yalnızca gerçek ihtiyaçta
  (lisans politikası: `docs/security.md`).
- Test projeleri modül sınırlarını yansıtır (`backend/tests/`): `CityRadar.Shared.Tests`,
  `CityRadar.Parking.Tests`, `CityRadar.Traffic.Tests`, `CityRadar.Infrastructure.Tests`,
  `CityRadar.Api.Tests`, `CityRadar.Architecture.Tests`. Proje var diye doldurulmaz; yalnızca
  gerçek davranış test edilir.
- **API testleri:** `WebApplicationFactory` ile gerçek ASP.NET Core pipeline (routing → validation
  → endpoint → module → serialization). Yalnızca dış provider ve teknik store gibi boundary'ler
  test double ile değiştirilir. Gövdenin contract yapısı ve zorunlu alanları da doğrulanır.
- **Provider adapter testleri:** gerçek sağlayıcı araştırıldıktan sonra (OD-1) kayıtlı JSON
  fixture'larıyla. Fixture'lar gerçek formatı temsil eder, network gerektirmez, küçük/minimal
  tutulur ve hangi provider/şema örneğinden üretildiği anlaşılır.
- **Zaman:** `TimeProvider` + testlerde fake zaman (`FakeTimeProvider`). Üretim kodunda
  `DateTime.Now/UtcNow/Today` ve `DateTimeOffset.Now/UtcNow` derleyici hatasıdır
  (`BannedApiAnalyzers`, `backend/BannedSymbols.txt`); test projeleri muaftır.
- **Runner:** Microsoft.Testing.Platform (`backend/global.json`); komut
  `cd backend && dotnet test --solution CityRadar.slnx`. Sıfır test çalıştıran proje hata verir
  (exit code 8).
- **Zero-test istisnası:** yalnızca bilerek boş bırakılan `CityRadar.{Shared,Parking,Traffic,Infrastructure}.Tests`
  projelerinde `--ignore-exit-code 8` bulunabilir; `CityRadar.Api.Tests` ve
  `CityRadar.Architecture.Tests` bu istisnayı hiçbir zaman almaz. Bu projelerden birine ilk testi
  ekleyen feature'ın planı istisnanın kaldırılmasını açık bir madde/kabul kriteri olarak yazar;
  `ZeroTestExceptionTests` istisna ile kod bir arada durduğu sürece check'i kırar.

**Mobil**
- `jest-expo` + React Native Testing Library.
- Component ve hook testlerinde network doğrudan mock'lanmaz; **`mobile/src/api` boundary'si**
  test double olur (`Screen → useNearbyParking → api boundary ← test double`). API client'ın
  kendi testinde fetch/transport mock'lanabilir.
- Native MapLibre implementation mock'lanır. Test edilen: marker verisinin doğru hazırlanması,
  traffic layer modelinin doğru üretilmesi, loading/error/stale UI state'leri, etkileşimin doğru
  callback'i tetiklemesi. Haritanın gerçek render'ı unit test ile ispatlanmaya çalışılmaz.
- Görsel regression/snapshot altyapısı ve E2E (Detox/Maestro) v1'de yok; kritik uçtan uca akışlar
  çoğalırsa ADR ile yeniden değerlendirilir.

## What must be tested
1. BR-1–BR-6'nın her biri bir test veya uygun otomatik doğrulamayla eşleşir.
2. FD-1–FD-8 mümkün olan en güçlü tooling katmanında enforce edilir (`docs/architecture.md`).
3. API sonuçları ayrı ayrı: `200 available`, `200 stale`, `400` ProblemDetails, `503` ProblemDetails.
4. **Koordinat redaksiyonu (BR-4):** test sırasında yakalanan application loglarında
   latitude/longitude değerleri bulunmaz — request logging, exception logging, structured logs,
   provider logs. Reverse proxy / hosting access log'ları bu testin kapsamı **dışındadır** ve
   deployment security requirement olarak ayrıca doğrulanır (`docs/security.md`); test yalnızca
   kontrol edebildiği sınırı kanıtlar.
5. **Freshness sınırları:** threshold'dan hemen önce, tam eşit (`age <= threshold → available`),
   hemen sonra (`→ stale`); `measuredAt == null` ayrı senaryo; `retrievedAt` hiçbir zaman
   `measuredAt` olarak yeniden adlandırılmaz.
6. **Provider adapter:** normal response · eksik nullable alan · boş liste · beklenmeyen/opsiyonel
   ekstra alan (parser kırılmamalı) · bozuk veya desteklenmeyen response. Zorunlu kabul edilen
   alan değişirse test kırılır (schema drift görünür olur). Provider DTO → normalize model
   mapping'i özellikle test edilir. Bozuk cevap son iyi snapshot'ı silmez.
7. **Mobil durumlar:** normal · stale · unavailable (`503`) · konum izni reddedildi (BR-3).

## Network
`scripts/check`, CI, unit ve integration testlerinin hiçbiri canlı İBB/İSPARK servisine bağımlı
değildir. Canlı sağlayıcı smoke testi ayrı ve açıkça manuel bir komuttur (ileride
`scripts/smoke-provider`); CI gate'i değildir.

## Coverage
Coverage yüzdesi merge/build gate'i değildir; rapor bilgi amaçlı üretilebilir. Öncelik: business
rule coverage, acceptance criteria coverage, failure-path coverage, boundary coverage. Yüksek
line coverage'a sahip ama kritik failure senaryolarını test etmeyen suite başarılı sayılmaz.

## Protected-tests rule
Weakening asserts, deleting, or skipping tests to reach green is forbidden. A red test triggers
`prompts/recovery/red-test.md` (R-02) — first decide what is wrong: code, test, or spec.

## Characterization tests
Before refactoring untested code (`workflows/refactor.md`) and for brownfield change requests
(`workflows/change-request.md`, Preserved behavior), pin the current behavior first — warts
included. They are written from observation, not from what the code "should" do.

## Evidence for UI criteria
A screenshot is evidence for a UI criterion; for change requests, before/after screenshots that
also show the preserved behavior. Harita kriterleri için gerçek cihaz/emülatör üzerinde manuel
ekran görüntüsü kanıtı kullanılır.

## Determinism
Flaky tests are fixed, not retried or skipped — see R-03. Evidence of a fix: 5 consecutive green runs.
