# Conventions

> Yalnızca gerçek kurallar: her kural ya tooling ile zorlanır (tercih edilen) ya da review'da
> kontrol edilir. Bootstrap: 2026-10-02.

## Language
- Chat language (interviews, sessions): Türkçe (`tr`)
- Document language (docs/, specs, plans, ADRs, review and verify reports): Türkçe (`tr`)
- Always English (protocol, not prose): ANEW core files, template headings and field labels,
  `Status:` values (Draft / Approved / In progress / Shipped), `Approved by / on:`, `Source:`.
- Code identifiers, branch names, commit messages: kod tanımlayıcıları ve branch adları
  **İngilizce**; commit mesajları Conventional Commits — `type(scope)` İngilizce, açıklama
  **Türkçe** (`docs/git.md`).
- Kullanıcıya gösterilen metinler **Türkçe**; dağınık string literal değil, merkezi kaynak:
  `mobile/src/localization/tr.ts`. v1'de i18n kütüphanesi yok; büyürse feature bazlı bölünebilir.

## Language & framework versions
- **Backend:** .NET 10 LTS (SDK `global.json` ile pinlenir), `Nullable=enable`,
  `TreatWarningsAsErrors=true`, .NET analyzers açık (ortak `Directory.Build.props`).
- **Mobil:** React Native + Expo, TypeScript `strict: true`, Expo Router, TanStack Query,
  MapLibre React Native.
- **Node:** Expo SDK ile uyumlu **kesin Node major sürümü** ilk mobil setup feature'ında repoda
  pinlenir (ör. `.nvmrc` + `package.json` `engines`). Expo SDK da o feature'da kesin sürümle sabitlenir.
- Dependency ve runtime **major** upgrade'leri plansız yapılmaz (ayrı plan maddesi + açık onay).

## Naming
- **C#:** standart .NET naming conventions.
- **Testler:** sınıf `<Unit>Tests`; metot adı senaryoyu ve beklenen davranışı açıkça söyler —
  ör. `StaleSnapshot_IsMarkedStale`, `MissingMeasuredAt_UsesRetrievedAtForFreshnessEvaluation`.
  Okunabilirliği bozan katı bir şablon dayatılmaz.
- **TypeScript:** bileşen `ComponentName.tsx`, hook `useSomething.ts`, diğerleri `camelCase.ts`;
  Expo Router route dosyaları framework convention'ına uyar.

## Error handling
- Backend hata cevapları **RFC 9457 ProblemDetails**.
- Client'a asla dönmez: stack trace, raw exception message, provider'ın ham hata cevabı,
  internal URL/host detayları.
- Beklenen business/application durumları exception ile kontrol akışına dönüştürülmez; açık
  sonuç değerleriyle modellenir. Exception beklenmeyen durumlar içindir.
- Geçersiz girdi → `400` + ProblemDetails (geçersiz latitude/longitude, desteklenmeyen radius,
  contract validation hatası).
- **Veri durumu — hibrit model:**

  | Durum | HTTP | Gövde |
  |---|---|---|
  | Güncel veri var | `200` | `{ "dataStatus": "available", "retrievedAt": "…", "data": [...] }` |
  | Sağlayıcı erişilemez, kullanılabilir son snapshot var (BR-5) | `200` | `{ "dataStatus": "stale", "retrievedAt": "…", "data": [...] }` |
  | Kullanılabilir hiçbir snapshot yok | `503` | ProblemDetails + kontrollü extension'lar: `code` (ör. `parking_data_unavailable`), gerekirse `retryable` |

  `unavailable` başarılı envelope'un bir varyantı değildir. Mobil: `available` → normal göster;
  `stale` → veriyi göster + "güncel değil" uyarısı; `503` → "veri şu anda alınamıyor" ekranı.

## Data rules
- **Zaman:** backend'de `DateTimeOffset`; sistem içi timestamp'ler UTC'ye normalize; API ISO 8601
  UTC (`Z`). `retrievedAt` zorunlu, `measuredAt` nullable; `measuredAt` yoksa `retrievedAt`
  onun adıyla gösterilmez. Yerel saat gösterimi yalnızca mobil UI'da.
- **Saat kaynağı:** zamana bağlı mantık `TimeProvider` kullanır; `DateTime.UtcNow` /
  `DateTimeOffset.UtcNow` doğrudan kullanılmaz (`docs/testing.md`).
- **Koordinat:** WGS84 ondalık derece; API contract'larında açık alanlar (`latitude`,
  `longitude`). Genel contract'larda `[lon, lat]` / `[lat, lon]` tuple kullanılmaz. GeoJSON
  yalnızca harita adapter/rendering sınırında üretilir ve standardın `[longitude, latitude]`
  sırasına uyar.
- **Mesafe / yarıçap:** API ve domain'de tamsayı metre (500, 1000, 3000).
- **Bilinmeyen değer:** `null`. Yasak sentinel'ler: `-1`, `0`, `"unknown"`. `0` gerçek bir domain
  değeriyse (ör. boş kapasite 0) kullanılır — kural: `0` "bilinmiyor" anlamında kullanılmaz.
- **JSON:** camelCase; enum'lar string. Provider'ın naming convention'ı API contract'ına taşınmaz.
- **Configuration:** Options pattern + startup validation (`ValidateOnStart`); geçersiz
  configuration'da backend fail-fast. Koda magic number olarak gömülmez: radius seçenekleri,
  freshness threshold'ları, polling interval, timeout, retry, rate limit. Aşırı granular ayar
  üretilmez — yalnızca operasyonda değiştirilmesi anlamlı değerler configuration'a taşınır.

## Enforced by tooling
`scripts/check` tek giriş noktasıdır; CI ve lokal aynı adımları çalıştırır (`scripts/check.conf`).
- **Backend** (`backend/` içinde çalışır; `backend/global.json` SDK'yı ve test runner'ı —
  Microsoft.Testing.Platform — pinler): restore · build (`TreatWarningsAsErrors`, nullable,
  analyzers, saat kuralı = `BannedApiAnalyzers` RS0030) · `dotnet format --verify-no-changes` ·
  test (architecture testleri dahil). Paket sürümleri yalnızca `backend/Directory.Packages.props`'ta (CPM).
- **Mobil:** lockfile doğrulamalı install (`npm ci`) · `tsc --noEmit` · ESLint (FD-5, FD-6, FD-8
  dahil) · Prettier check · testler (oluşturulduğunda).
- **Güvenlik:** dependency vulnerability taraması ayrı giriş noktasında — `scripts/security-check`
  (`docs/security.md`); CI ikisini de çalıştırır.
- Backend adımları hiçbir zaman `SKIP` etmez. Mobil adımların araçları (ESLint kuralları, FD-7
  deny-list) mobil setup feature'ında oluşturulur; o zamana kadar `check.conf` onları görünür
  şekilde `SKIP` eder.
