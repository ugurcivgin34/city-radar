# Spec 0001 — Backend temel kurulumu

- Status: In progress
- Mode: lite
- Plan: `specs/plans/0001-plan.md`

## Intent
City Radar'ın geliştiricisi, ilk gerçek backend davranışını (yakın otopark sorgusu) yazmadan önce
mimari sınırların **kendiliğinden korunduğu** bir backend iskeleti istiyor: `docs/architecture.md`
içindeki modüller ve bağımlılık yönü, bir kural ihlal edildiğinde `scripts/check`'i kırmızıya
çevirmeli — review'da hatırlanmaya bırakılmamalı. Başarı: `scripts/check` backend adımlarını
artık atlamadan gerçekten çalıştırır ve yeşildir; FD-1–FD-4 ihlalleri check'i kırar. Bilerek
yapılmayan: hiçbir iş davranışı, endpoint, sağlayıcı entegrasyonu, domain tipi veya mobil kurulum.

## Requirements
- R-1 — Backend, `docs/architecture.md`'deki beş modülden (Shared, Parking, Traffic,
  Infrastructure, Api) ve modülleri yansıtan altı test projesinden oluşan tek bir solution olarak
  derlenir; modüller arası referans yönü mimari dokümandaki yönle birebir aynıdır.
- R-2 — Repo somut bir .NET 10 SDK sürümü pinler (`global.json`, `rollForward: latestFeature`);
  local ve CI aynı `global.json` roll-forward politikasına uyar. Başka major sürüme sessiz geçiş
  yapılmaz.
- R-3 — Tüm projelerde ortak derleme kuralları tek yerden uygulanır: nullable açık, analyzer'lar
  açık, warning'ler hata. İstisna: NuGet vulnerability uyarıları (NU1901–NU1904) görünür kalır ama
  build'i kırmaz; vulnerability enforcement `scripts/security-check`'tedir.
- R-4 — FD-1–FD-4, `docs/architecture.md`'deki zorlama sırasıyla (önce derleyici, sonra
  architecture test) otomatik doğrulanır ve `scripts/check` içinde çalışır.
- R-5 — Saat kaynağı kuralı otomatik doğrulanır ve `scripts/check` içinde çalışır: üretim
  kodunda `DateTime.Now`, `DateTime.UtcNow`, `DateTime.Today`, `DateTimeOffset.Now`,
  `DateTimeOffset.UtcNow` doğrudan kullanılmaz; zamana bağlı kod `TimeProvider` üzerinden çalışır
  (`docs/testing.md`). Test projeleri bu kontrolden muaftır.
- R-6 — Api projesi çalıştırılabilir bir host olarak ayağa kalkar; bu spec'te hiçbir iş
  endpoint'i, diagnostic endpoint'i veya OpenAPI UI eklenmez.
- R-7 — `scripts/check` ve `scripts/security-check` backend adımlarını `SKIP` etmeden çalıştırır;
  CI aynı adımları pinlenmiş SDK ile çalıştırır. `scripts/security-check` fail-open değildir:
  zafiyet yok → GREEN; zafiyet bulundu → RED; advisory/registry erişimi başarısız → RED, açıkça
  infrastructure/security-check failure olarak. `scripts/check` bundan bağımsız ve deterministik kalır.
- R-8 — NuGet bağımlılıkları ve GitHub Actions için Dependabot güncellemeleri tanımlıdır
  (mobil manifest henüz yok; mobil setup'ta eklenir).
- R-9 — ANEW README'si City Radar README'si ile değiştirilir: projenin amacı, repo yapısı,
  prerequisites, local setup, check/test komutları, mimari dokümanlara linkler. Mobil bölümü
  "henüz kurulmadı" olarak işaretlenir.

## Constraints & out of scope
- **Zero-test guard threat model** (R-06 re-spec, 2026-10-03, Uğur Okan Çivgin): zero-test guard'ın
  amacı **kazara drift**'i önlemektir — makul bir geliştiricinin bir hatayı çözmeye çalışırken
  yapabileceği normal configuration değişiklikleri (ör. MTP yardım metnindeki `--ignore-exit-code 8;9`
  önerisini eklemek). Guard'ın veya ilgili configuration'ın bilinçli/kasıtlı olarak değiştirilmesini
  tooling'in tek başına imkânsız kılması beklenmez; kasıtlı bypass girişimleri (karışık harfli env,
  obfuscation, property dolaylaması, guard'ı devre dışı bırakma) independent review, protected tests
  ve normal review/CI süreci tarafından yakalanır. Yeni bir kasıtlı bypass yüzeyi bulunması tek
  başına yeni tooling katmanı gerekçesi değildir.
- Architecture test kütüphanesi: ArchUnitNET **veya** NetArchTest'ten yalnızca biri; seçim plan
  içinde kısa karşılaştırma ve gerekçeyle yapılır (OD-3 kriterleri: FD-1–FD-4'ü sade ifade,
  .NET 10 uyumluluğu, bakım durumu, minimum ek karmaşıklık).
- Yeni her runtime/test dependency plan içinde paket, gerekçe, alternatifler ve lisansla yazılır
  (`docs/security.md`). Lisans politikası geçerlidir.
- Test kodu canlı ağ çağrısı yapmaz.
- Provider namespace convention'ı: provider DTO'ları `CityRadar.Infrastructure.Providers.<Provider>.Dtos`
  altında yaşar ve `internal`'dır. Api, Parking ve Traffic hiçbir `CityRadar.Infrastructure.Providers.*`
  tipine bağımlı olamaz; Api, Infrastructure'ı yalnızca `Providers.*` dışındaki composition yüzeyi
  üzerinden kullanır. `Providers.*` altındaki DTO dışı tiplerin (adapter'lar vb.) internal olması bu
  spec'te zorunlu **değildir**; bilinçli olarak seçilirse ayrıca architecture kararı olarak yazılır.
- FD-3/FD-4'ü veya diğer kuralları test etmek için production koduna sahte provider/API modeli
  eklenmez; negatif kanıt geçici, commit'lenmeyen ihlallerle sağlanır.
- YAGNI: spekülatif domain tipi (Coordinate, Radius, snapshot, port arayüzleri vb.) **eklenmez**;
  bunlar ilk gerçek davranışla gelir.
- **Kapsam dışı:** iş endpoint'leri, ProblemDetails/hata sözleşmesi altyapısı, OpenAPI, rate
  limiting, logging/redaksiyon, configuration/Options, background polling, snapshot store,
  provider entegrasyonu (OD-1 ADR'si bekleniyor), mobil kurulum, deployment. GitHub remote
  (`origin`) mevcuttur; bu feature remote configuration'ını değiştirmez. Branch protection ayrı
  aksiyondur (`docs/git.md`).

## Acceptance criteria
- [ ] AC-1 — Temiz bir checkout'ta `./scripts/check` backend adımlarının hiçbirini `SKIP` etmeden
  çalıştırır ve yeşil biter.
- [ ] AC-2 — Solution beş modül projesini ve altı test projesini (`CityRadar.Shared.Tests`,
  `.Parking.Tests`, `.Traffic.Tests`, `.Infrastructure.Tests`, `.Api.Tests`,
  `.Architecture.Tests`) içerir; modül referansları tam olarak şu yöndedir: Parking→Shared,
  Traffic→Shared, Infrastructure→{Parking, Traffic, Shared}, Api→{tüm modüller}; Shared hiçbir
  modüle referans vermez.
- [ ] AC-3 — `global.json` somut bir .NET 10 SDK sürümü ve `rollForward: latestFeature` içerir.
  Backend komutları çalıştırıldığında: pinlenen sürüm veya aynı 10.0 hattında daha yeni bir
  patch/feature band seçilir (`dotnet --version` bunu gösterir); bu koşulu sağlayan bir SDK yoksa
  (ör. pin geçici olarak kurulu olmayan daha yüksek bir sürüme çekildiğinde) `dotnet` açık bir
  hatayla durur; başka bir major sürüme (9.x, 11.x) geçilmez.
- [ ] AC-4 — Herhangi bir modül projesine bir compiler/analyzer warning'i üreten kod eklendiğinde
  `./scripts/check` kırmızı olur.
- [ ] AC-5 — Restore sırasında NU1901–NU1904 vulnerability uyarısı oluşsa bile build bu yüzden
  kırılmaz ve uyarı çıktıda görünür kalır.
- [ ] AC-6 (FD-1) — Parking'den Traffic'e (veya tersi) referans eklendiğinde `./scripts/check`
  kırmızı olur.
- [ ] AC-7 (FD-2) — Parking, Traffic veya Shared'e CityRadar.Infrastructure, CityRadar.Api,
  ASP.NET Core, `Microsoft.Extensions.Caching.*` veya `System.Net.Http` bağımlılığı eklendiğinde
  `./scripts/check` kırmızı olur.
- [ ] AC-8 (FD-3) — (a) `CityRadar.Infrastructure.Providers.<Provider>.Dtos` altında `public`
  bir tip tanımlandığında; (b) Api, Parking veya Traffic herhangi bir
  `CityRadar.Infrastructure.Providers.*` tipine bağımlı olduğunda `./scripts/check` kırmızı olur.
- [ ] AC-9 (FD-4) — `CityRadar.Api.Contracts.*` içindeki bir tip Parking, Traffic veya Shared
  tiplerine **herhangi bir şekilde** (public yüzey, internal üye veya method gövdesi) bağımlı
  olduğunda `./scripts/check` kırmızı olur. Mapping `Contracts` namespace'i dışında yapılır.
  (Review F-2 triage'ında insan kararıyla "public yüzeyinde" ifadesinden bilinçli olarak
  sıkılaştırıldı — 2026-10-02, Uğur Okan Çivgin.)
- [ ] AC-10 (saat kuralı) — Herhangi bir üretim projesinde `DateTime.Now`, `DateTime.UtcNow`,
  `DateTime.Today`, `DateTimeOffset.Now` veya `DateTimeOffset.UtcNow` doğrudan kullanıldığında
  `./scripts/check` kırmızı olur; test projelerinde aynı kullanım check'i kırmaz.
- [ ] AC-11 — Architecture testleri boş/vakum olarak geçemez: kontrol ettikleri assembly'ler
  yüklenemezse veya bulunamazsa testler başarısız olur.
- [ ] AC-12 — Api host'u başlar ve tanımsız bir yola yapılan istek 404 döner; hiçbir endpoint
  (iş, diagnostic, OpenAPI UI) yanıt vermez. Yalnızca status code doğrulanır (gövde kapsam dışı).
- [ ] AC-13 — `./scripts/security-check` NuGet adımını `SKIP` etmeden çalıştırır ve üç durumu
  ayırt eder: zafiyet yok → GREEN; zafiyet bulundu → RED; advisory/registry erişimi başarısız →
  RED ve çıktıda açıkça infrastructure/security-check failure olarak etiketli. Kanıt: geçici olarak
  eklenen bilinen zafiyetli bir paket (RED) ve erişilemeyen bir kaynakla çalıştırma (RED, infra).
- [ ] AC-14 — CI workflow'u pinlenmiş SDK'yı (`global.json`) kurar ve `scripts/check` ile
  `scripts/security-check`'i lokal ile aynı komutlarla çalıştırır. Kanıt: workflow incelemesi +
  aynı komutların lokal çıktısı + PR'daki CI koşusu.
- [ ] AC-15 — Dependabot yapılandırması NuGet (`backend/`) ve GitHub Actions ekosistemlerini
  kapsar; otomatik merge tanımlamaz.
- [ ] AC-16 — README R-9'daki altı başlığı içerir ve anlatılan komutlar repodaki gerçek
  komutlarla aynıdır.
- [ ] AC-17 — Eklenen her dependency plan'da paket/gerekçe/alternatif/lisans ile listelenmiştir
  ve hepsi lisans politikasına uyar.

AC-4 ve AC-6–AC-10 için kanıt: geçici, commit'lenmeyen bir ihlalle check'in kırmızıya döndüğünün
gösterilmesi ve geri alındıktan sonra yeşile dönmesi.

## Definition of Done
- [ ] Every acceptance criterion mapped to proof (test or reproducible observation)
- [ ] `scripts/check` green
- [ ] Independent review done; real findings fixed, noise rejected with written rationale
- [ ] Docs / ADRs updated if behavior or architecture changed
- [ ] Spec moved to `specs/done/` (it becomes immutable there)

## Scorecard (fill at ship — honest numbers make the process improvable)
| Metric | Value |
|---|---|
| Spec revisions | |
| Fix rounds | |
| Review findings: real / noise | |
| Regressions introduced | |
| Bugs escaped to production | |
