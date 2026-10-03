# ADR 0006 — `main` branch protection GitHub tarafından zorlanmıyor; süreçle telafi ediliyor

- Status: Superseded by ADR 0007
- Date: 2026-10-03

## Context
`docs/git.md`, `main` için branch protection öngörüyordu: PR zorunlu, zorunlu check'ler
(`doctor --strict`, `scripts/check`, `scripts/security-check`), force push kapalı, branch silme
kısıtlı. Repo **private** ve hesap ücretsiz planda; GitHub API branch protection ve rulesets için
`403 — Upgrade to GitHub Pro or make this repository public to enable this feature` döndürüyor
(2026-10-03'te doğrulandı). Repoyu şimdilik public yapmak istenmiyor. Doküman, uygulanmayan bir
kuralı uygulanıyormuş gibi anlatmamalı (AGENTS.md invariant 4 ve 8).

## Decision
`main` branch protection'ın GitHub tarafından **zorlanmadığı** bilinçli olarak kabul edilir.
Kurallar geçerliliğini korur ama süreçle uygulanır; `docs/git.md` neyin zorlanmadığını ve
neyin telafi ettiğini açıkça yazar.

## Consequences
- **Zorlanmayanlar (GitHub izin verir):** `main`'e doğrudan commit/push, force push, `main`'in
  silinmesi, check'leri kırmızı veya bekleyen bir PR'ın merge edilmesi.
- **Telafi edici kontroller (bugün gerçekten var olanlar):**
  - CI her push ve PR'da `doctor --strict`, `scripts/check`, `scripts/security-check`'i çalıştırır;
    kırmızı sonuç görünürdür ama merge'i engellemez.
  - Merge kuralı: yalnızca PR ile, squash-merge, PR head commit'inde üç check de yeşil olduktan
    sonra. Merge eden kişi/agent bunu merge öncesi doğrular (ör. `gh pr merge --match-head-commit`
    ile doğrulanan commit'e sabitlenmiş merge).
  - Agent kuralları: agent `main`'e commit atmaz, force push yapmaz; gate'lerde durur
    (`AGENTS.md`, `docs/git.md`).
  - Bağımsız review ve PR şablonundaki gate kayıtları (`workflows/segments.md`).
- **Maliyet:** "Prose is advice, tooling is law" ilkesinden bilinçli bir sapma; bir hata (yanlış
  branch'e push, kırmızı check'le merge) teknik olarak engellenmez, ancak sonradan fark edilir.

## Alternatives considered
- **Repoyu public yapmak:** ücretsiz ve protection hemen açılabilir; kod ve dokümanlar herkese
  açılır. Şimdilik istenmiyor.
- **GitHub Pro / Team:** private kalır, protection açılabilir; ücretli. Şimdilik seçilmedi.

## Revisit triggers
- Repo public yapılırsa veya Pro/Team planına geçilirse → protection hemen açılır, bu ADR superseded olur.
- İkinci bir geliştirici aktif olursa (ayrıca ADR 0005 strict tetikleyicisi).
- Bir olay: `main`'e doğrudan commit/force push veya check'leri yeşil olmayan bir merge.
