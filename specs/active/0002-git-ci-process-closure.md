# Spec 0002 — Git & CI Process Closure (mini)

- Status: In progress
- Spec approved by / on: Uğur Okan Çivgin, 2026-10-03
- Mode: lite
- Plan: `specs/plans/0002-plan.md`
- Source: PR #6 bağımsız review bulguları 1–6 + Dependabot PR #2, #3, #4 + kullanıcı kararı "Git & CI Process Closure" (2026-10-03)
- Supersedes: — (shipped spec davranışı değişmiyor; ADR 0006'nın yerini ADR 0007 alır)

## Intent
Ürün feature'larına geçmeden önce Git/CI tarafındaki gerçek borçlar kapatılır: repo ayarları
dokümanda yazılanı gerçekten zorlar, merge edilmiş PR'ların review kanıtları dürüst ve eksiksiz
kayıtlıdır, ADR'deki yanlış ya da abartılı iddialar düzeltilir, merge öncesi current-head CI
doğrulaması süreçte görünür bir gate olur ve bekleyen CI action major yükseltmeleri doğrulanarak
alınır. Bu iş ship edildiğinde Git/süreç konusu kapanır; yeniden açılma sebebi yalnızca gerçek bir
davranış problemi, bir incident ya da repo koşullarının değişmesidir (ADR 0007 revisit triggers).

## Changed behavior
- [ ] CB-1 — **Merge ayarları:** Repo yalnızca squash merge'e izin verir; merge commit ve rebase
  merge GitHub tarafından reddedilir. Merge edilen PR'ın head branch'i GitHub tarafından otomatik
  silinir. *(Ayar 2026-10-03'te insan onayıyla, bu spec'ten önce uygulandı; kanıt VERIFY'da repo
  ayarlarının geri okunmasıyla verilir.)*
- [ ] CB-2 — **Branch hijyeni:** Ship anında remote'ta yalnızca `main` ve açık PR'lara ait
  branch'ler bulunur; merge edilmiş branch kalmaz. `docs/git.md`, merge sonrası branch'in nasıl
  temizlendiğini (otomatik silme + lokal temizlik) ve elle silmenin ancak içeriğin `main`'de
  bulunduğu doğrulandıktan sonra yapıldığını yazar.
- [ ] CB-3 — **Review kanıt kayıtları (geçmiş yeniden yazılmaz):**
  - PR #6: kayıt "review pre-merge yapıldı, kayıt post-merge eklendi" olarak yazılır. Bağımsız
    review raporu yorum olarak eklenir; yorum gerçek zaman çizelgesini verir (review başlangıç/bitiş,
    review anındaki CI durumu, merge zamanı ve merge edilen head SHA).
  - PR #5: merge sonrasında yapılan read-only review raporu, başlığı açıkça
    **"POST-MERGE RETROSPECTIVE"** olan bir yorumla kaydedilir.
  - Eski gate'ler sonradan yapılmış ya da merge öncesinde yapılmış gibi gösterilmez; merge edilmiş
    PR'ların açıklamaları ve checklist'leri düzenlenmez, kanıt yalnızca yeni yorumlarla eklenir.
- [ ] CB-4 — **ADR 0007:** ADR 0006'nın yerini alır ve güncel kararın tamamını içerir. PR #6 review
  bulguları 1–5'i karşılar:
  1. squash-only artık repo ayarıyla zorlanır;
  2. current-head CI doğrulaması bu kararla getirilen bir süreç kuralıdır ("bugün var olan kontrol"
     diye sunulmaz) ve merge kararı insanındır; agent yalnızca insan onayıyla, doğrulanmış head
     SHA'ya sabitlenmiş merge yapar;
  3. default branch'in silinmesine dair ifade GitHub'ın gerçek davranışıyla örtüşür;
  4. agent kurallarının kaynağı doğru gösterilir (`docs/git.md` "Forbidden") ve mevcut Claude Code
     deny kuralları, sınırlarıyla birlikte telafi kontrolü olarak listelenir;
  5. ilke atfı repodaki kaynağa (`docs/conventions.md`) yapılır.
  Revisit triggers Git/süreç konusunun hangi koşullarda yeniden açılacağını içerir. ADR 0006'da
  yalnızca `Status` satırı `Superseded by ADR 0007` olarak değişir.
- [ ] CB-5 — **`docs/git.md` tutarlılığı:** Branch protection bölümü ADR 0007 ile aynı şeyi söyler;
  "zorlanan" ve "zorlanmayan" listeleri repo ayarlarının gerçek durumuyla eşleşir. Bulgu 6'daki
  sarkan "5. adım" referansı kalmaz.
- [ ] CB-6 — **Universal current-head CI gate:**
  - Kural: her PR merge'ünden önce (Dependabot PR'ları dahil) üç zorunlu check (`doctor --strict`,
    `scripts/check`, `scripts/security-check`) PR'ın **güncel head SHA'sında** yeşildir ve merge o
    SHA'ya sabitlenir.
  - Kuralın kaynağı `docs/git.md`'dir ve bütün PR merge'lerine uygulanır;
    `workflows/feature-development.md` ve `workflows/change-request.md` SHIP adımları bu doğrulamayı
    merge'den önce gelen bir adım olarak listeler.
  - PR template'teki gate maddesi, bu kuralın normal PR'lardaki görünür kaydıdır; kuralın kendisi
    template'e bağlı değildir (template kullanmayan Dependabot PR'larında da geçerlidir).
- [ ] CB-7 — **CI action major yükseltmeleri (D-1, D-2):** Work item ship edildiğinde final state:
  - `main` üzerindeki CI `actions/checkout@v7` ve `actions/setup-dotnet@v6` kullanır.
  - Her iki yükseltme için release notes değerlendirmesi, açık insan onayı ve current-head CI
    doğrulaması (CB-6) tamamlanmış ve kayıtlıdır.
  - Yukarıdaki iki madde (v7/v6, release notes, açık onay, current-head CI) spec `Shipped` olmadan
    önce tamamlanır ve VERIFY'da doğrulanır.
  - Dependabot #2 ve #3, PR #7 merge olana kadar açık kalır (insan kararı, plan R-4). Kapanışları
    merge sonrası **ship-time housekeeping**'dir: otomatik kapandılarsa bu, kapanmadılarsa
    "superseded" yorumuyla kapatılmaları PR #7'ye yorumla kanıt olarak kaydedilir. Bu kısım VERIFY
    kriteri değildir. *(Review 1 M-2 ile düzeltildi — insan kararı, 2026-10-03.)*
- [ ] CB-8 — **setup-node devri:** Dependabot #4 merge edilmeden kapatılır. Gerekçe PR'da yazılır:
  Node adımı `mobile/.nvmrc` olmadan çalışmıyor; doğrulanmamış bir yükseltme alınmıyor.
  `actions/setup-node` major yükseltmesinin Mobile Foundation'a devredildiği repoda kalıcı bir yerde
  kayıtlıdır. CI'daki setup-node sürümü v4 olarak kalır.

## Preserved behavior
- [ ] PB-1 — `./scripts/check` ve `./scripts/doctor --strict` yeşil kalır; backend test sayısı
  baseline'ın (71) altına düşmez; hiçbir test zayıflatılmaz, silinmez ya da atlanmaz.
- [ ] PB-2 — CI'daki üç job (`doctor`, `check`, `security-check`) aynı adlarla, aynı tetikleyicilerle
  (her push ve PR) ve aynı komutlarla çalışmaya devam eder. Node adımının `mobile/.nvmrc` koşulu ve
  .NET'in `backend/global.json`'dan alınması korunur.
- [ ] PB-3 — `specs/done/` altındaki shipped spec ve ADR 0001–0005 değişmez. ADR 0006'da `Status`
  satırı dışında hiçbir satır değişmez.
- [ ] PB-4 — `docs/git.md`'deki trivial lane politikası, branch/commit adlandırma kuralları ve
  "Forbidden" kuralları anlam olarak değişmez.
- [ ] PB-5 — Backend ve mobil ürün kodu değişmez (`backend/` altında dosya değişikliği yok).

## Out of scope
- `actions/setup-node` major yükseltmesi → Mobile Foundation (CB-8 yalnızca devri kayda geçirir).
- GitHub branch protection / rulesets: ücretsiz private planda kullanılamıyor; ADR 0007'nin revisit
  triggers maddesine bağlıdır.
- PR #6 review'ındaki Info bulguları: 7 ("required checks" yorum satırları — git.md'deki süreç
  kuralına atıf yaptıkları için doğru, değişiklik yok) ve 8 (merge, head yeşil olduktan sonra
  SHA'ya sabitlenerek yapıldı — çözülmüş).
- `main`'e commit'i ya da force push'un tüm varyantlarını engelleyen yeni hook veya tooling; mevcut
  deny kuralları yalnızca belgelenir.
- `adapters/` kopyaları ve NuGet/npm Dependabot ayarları. (`workflows/segments.md`'deki SHIP handoff
  sırası review 1 M-1 ile kapsama alındı — insan kararı, 2026-10-03; dosyanın geri kalanı kapsam dışı.)
- Ürün feature'ları, OD-1, OD-2.

## Definition of Done
- [ ] `scripts/check` green
- [ ] Independent review done; real findings fixed, noise rejected with written rationale
- [ ] Criterion ↔ evidence table complete for CB-* **and** PB-* (UI: before/after screenshots)
- [ ] Spec moved to `specs/done/` (immutable there)
