# ADR 0007 — `main` koruması: merge kuralları repo ayarıyla, diğer kurallar süreçle zorlanıyor

- Status: Superseded by ADR 0008
- Date: 2026-10-03

ADR 0006'nın yerine geçer. Güncel kararın tamamı bu ADR'dedir; ADR 0006 yalnızca tarihsel kayıttır.

## Context
`docs/git.md`, `main` için PR zorunluluğu, zorunlu check'ler (`doctor --strict`, `scripts/check`,
`scripts/security-check`), force push yasağı ve squash-merge öngörüyor. Repo **private** ve hesap
ücretsiz planda; GitHub API branch protection ve rulesets için `403 — Upgrade to GitHub Pro or make
this repository public to enable this feature` döndürüyor (2026-10-03'te doğrulandı). Repoyu şimdilik
public yapmak istenmiyor.

ADR 0006 bu sınırı kabul etmişti. PR #6'nın bağımsız review'ı ADR 0006'da şu doğruluk sorunlarını
buldu: squash-only kuralı repo ayarıyla zorlanabildiği halde süreç kuralı olarak bırakılmıştı; merge
öncesi head CI doğrulaması "bugün var olan" bir kontrol gibi sunulmuştu; default branch'in
silinmesine dair ifade yanlıştı; agent kurallarının kaynağı yanlış gösterilmiş ve mevcut tooling
atlanmıştı; alıntılanan ilke repoda yoktu. Ayrıca 2026-10-03'te repo merge ayarları değiştirildi
(spec 0002). Doküman, uygulanmayan bir kuralı uygulanıyormuş gibi anlatmamalı (AGENTS.md invariant
4 ve 8).

## Decision
Branch protection ve rulesets kullanılamadığı bilinçli olarak kabul edilir. Repo ayarıyla
zorlanabilen kurallar repo ayarıyla zorlanır (yalnızca squash-merge, merge sonrası branch silme);
kalan kurallar süreçle uygulanır. Bu kararla bir süreç kuralı getirilir: **her PR merge'ünden önce
(Dependabot dahil) üç zorunlu check PR'ın güncel head SHA'sında yeşil olmalı ve merge o SHA'ya
sabitlenmelidir.** Merge kararı insanındır; agent yalnızca insan onayıyla ve doğrulanmış head
SHA'ya sabitlenmiş merge yapar (`gh pr merge --squash --match-head-commit <sha>`).

## Consequences
- **GitHub tarafından zorlananlar:**
  - Repo ayarı (2026-10-03'ten beri): merge commit ve rebase merge kapalı; GitHub yalnızca squash
    merge'e izin verir.
  - Repo ayarı (2026-10-03'ten beri): merge edilen PR'ın head branch'i GitHub tarafından otomatik
    silinir.
  - Platform davranışı: `main` default branch olduğu sürece GitHub onu silmez. GitHub dokümanı: *"If the branch you
    want to delete is the repository's default branch, choose a new default branch first."*
    ([Managing branches within your repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-and-deleting-branches-within-your-repository))
- **Zorlanmayanlar (GitHub izin verir):**
  - `main`'e doğrudan commit/push ve force push.
  - Check'leri kırmızı ya da bekleyen bir PR'ın merge edilmesi.
  - Default branch başka bir branch'e çevrildikten sonra `main`'in silinmesi.
- **Telafi edici kontroller:**
  - CI her push ve PR'da üç check'i çalıştırır; kırmızı sonuç görünürdür ama merge'i engellemez.
  - Universal current-head CI kuralı (bu kararla getirildi): kaynağı `docs/git.md`; feature ve
    change-request workflow'larının SHIP adımında merge öncesi adım olarak yer alır; normal PR'larda
    görünür kaydı PR template'teki gate maddesidir. Kural template'e bağlı değildir, template
    kullanmayan Dependabot PR'larında da geçerlidir.
  - Bağımsız review ve PR şablonundaki gate kayıtları (`workflows/segments.md`).
  - Agent kuralları: kaynağı `docs/git.md` "Forbidden" (default branch'e doğrudan commit yok, force
    push yok). Kısmi tooling desteği: `.claude/settings.json` içindeki `git push --force` ve
    `git push -f` deny kuralları. Sınırları: yalnızca Claude Code için geçerli; `git push origin +main`
    ya da sonda `--force` gibi varyantları yakalamaz; agent'ın `main`'e commit atmasını engelleyen bir
    hook yok.
- **Maliyet:** `docs/conventions.md` ilkesi "her kural ya tooling ile zorlanır (tercih edilen) ya da
  review'da kontrol edilir" der. Zorlanmayan kurallar için bilinçli olarak ikinci yol seçilir: bir hata
  (yanlış branch'e push, kırmızı check'le merge) teknik olarak engellenmez, ancak CI, review ve PR
  kayıtlarıyla sonradan fark edilir.

## Alternatives considered
- **Repoyu public yapmak:** ücretsiz ve protection hemen açılabilir; kod ve dokümanlar herkese
  açılır. Şimdilik istenmiyor.
- **GitHub Pro / Team:** private kalır, protection açılabilir; ücretli. Şimdilik seçilmedi.
- **Her şeyi süreç kuralına bırakmak (ADR 0006):** repo ayarıyla bedavaya zorlanabilen squash-only ve
  branch silme kurallarını tooling dışında bırakıyordu; reddedildi.

## Revisit triggers
Git/süreç konusu bu ADR ve spec 0002 ile kapalı kabul edilir. Yalnızca şu durumlarda yeniden açılır:
- Repo public yapılırsa veya Pro/Team planına geçilirse → protection/rulesets açılır, bu ADR superseded olur.
- İkinci bir geliştirici aktif olursa (ayrıca ADR 0005 strict tetikleyicisi).
- Bir incident: `main`'e doğrudan commit/force push veya check'leri head SHA'da yeşil olmayan bir merge.
- Gerçek bir davranış problemi: yukarıdaki repo ayarlarından birinin değiştiğinin ya da çalışmadığının görülmesi.
