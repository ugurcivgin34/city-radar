# Git

> Bootstrap: 2026-10-02.

## Branching
- `feature/<spec-no>-<short-name>` — **no branch without a spec.**
- Fixes: `fix/<report-id>-<short-name>` (bug fixes carry a report, not a spec number);
  incidents: `incident/<date>-<short-name>`; trivial changes: `trivial/<short-name>` (see below).
- Branch adları İngilizce, lowercase kebab-case. Örnekler: `feature/0001-mobile-foundation`,
  `feature/0002-nearby-parking`, `fix/0042-stale-status`,
  `incident/2026-10-02-provider-outage`, `trivial/update-readme`.

## Commits
- Conventional Commits: `type(scope): Türkçe açıklama` — type ve scope İngilizce, açıklama Türkçe.
  Örnekler: `feat(parking): yakın otopark sorgusu eklendi`, `fix(api): bayat veri yanıtı düzeltildi`,
  `test(traffic): freshness sınır testleri eklendi`, `docs(architecture): provider sınırları güncellendi`.
- Başlangıç scope'ları: `shared`, `parking`, `traffic`, `infrastructure`, `api`, `mobile`,
  `docs`, `specs`, `ci`, `deps`. Kapalı bir enum değildir: yeni gerçek bir modül oluşursa
  mimari kararla (`docs/architecture.md`) yeni scope eklenir.
- Plan referansı: planlı bir work item içindeki implementasyon commit'lerinde tercih edilir —
  `feat(parking): yakın otopark sorgusu eklendi [plan 0002/3]`. Plansız trivial/docs/deps/ci
  commit'lerinde zorunlu değildir.
- Agent commits follow the same standard: the agent writes the message, the human approves.
  Commit atma ve history değiştirme workflow'daki insan onayı kurallarına tabidir.

## Forbidden
- Direct commits to the default branch.
- Force push, history rewriting on shared branches. Undo = `git revert` (see recovery R-11).
- Paylaşılan remote history immutable'dır. Lokal ve henüz paylaşılmamış kişisel branch'lerdeki
  düzenlemeler bu kuralla kısıtlanmaz.

### One-time repository bootstrap exception
Repo hiç commit içermediği için ANEW bootstrap sonucunu içeren **ilk commit** doğrudan `main`
üzerine yapılabilir: `chore: ANEW çalışma alanı bootstrap edildi`. Bu istisna yalnızca
repository initialization / ANEW bootstrap için bir kez geçerlidir; "gerektiğinde main'e commit
atılabilir" anlamına gelmez. Sonrasında tüm iş branch + PR ile yürür.

## Trivial changes
<!-- Applies only to requests the change-request triage rubric
     (workflows/change-request.md) classifies as TRIVIAL: no acceptance criterion changes, no shared code. -->
- Policy: **(1) PR + one reviewer, no spec** — tek geliştiriciye uyarlanmış hali:
  1. `trivial/<short-name>` branch'i; spec ve plan gerekmez.
  2. Değişiklik mümkün olduğunca tek ve dar bir commit.
  3. PR açılır; açıklamada neden TRIVIAL olduğu tek cümleyle yazılır (work item + triage gerekçesi).
  4. İkinci insan reviewer zorunlu değil; bağımsız read-only reviewer agent kullanılır.
  5. Normal CI kontrolleri: `doctor --strict`, `scripts/check`, `scripts/security-check`.
- **Ölçüt dosya sayısı değildir.** İkinci bir dosyaya dokunmak yalnızca rubric'i yeniden
  çalıştırma sinyalidir. Belirleyici sorular: kabul kriteri değişiyor mu · davranış değişiyor mu ·
  shared/business code etkileniyor mu · yeni test ihtiyacı doğuyor mu. Biri "evet" ise ya da
  kapsam büyürse trivial akışı durur ve iş yeniden triage edilir.
- Ayrım: yazım hatası / README / görsel olmayan küçük metin düzeltmesi → TRIVIAL. Kullanıcıya
  verilen bilginin **anlamını**, davranışı veya kabul kriterini değiştiren metin → TRIVIAL değil.
  `mobile/src/localization/tr.ts` içindeki tek bir girdinin yazım düzeltmesi shared code
  değişikliği sayılmaz; birden çok ekranda kullanılan bir metnin anlamı değişiyorsa CHANGE lane.
- `trivial/*` ürün davranışını veya mimariyi değiştiren işler için kullanılamaz; küçük görünse bile
  bunlar spec/plan akışına girer.

## Pull requests
- PR template checklist completed; `scripts/check` green in CI; squash-merge (main geçmişi work
  item başına temiz kalır).
- Merge için zorunlu CI kontrolleri: `doctor --strict`, `scripts/check`, `scripts/security-check`.
- PR ilgili spec ve plan referansını içerir; kabul kriteri ↔ test eşleşmesi PR açıklamasından veya
  plan dosyasından izlenebilir.
- Repo tek geliştiricili: ikinci insan reviewer zorunlu değil; bağımsız review ANEW workflow'unda
  zaten uygulanır. Ekip büyürse required human review eklenir (strict tetikleyicileri: ADR 0005).

## Branch protection (GitHub remote oluşturulduktan sonra)
`main` için: PR zorunlu · required checks zorunlu (yukarıdaki üçü) · force push kapalı · branch
deletion kısıtlı.

**Açık aksiyonlar (bootstrap sonrası, insan tarafından):**
1. GitHub repository oluştur. 2. `origin` remote ekle. 3. Bootstrap commit'ini push et.
4. CI workflow'larını etkinleştir. 5. `main` branch protection'ı aç.
6. Bundan sonra feature/fix çalışmalarını branch + PR üzerinden yürüt.
