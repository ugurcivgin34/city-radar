# ADR 0008 — `main` koruması GitHub branch protection ile zorlanıyor

- Status: Accepted
- Date: 2026-10-03

ADR 0007'nin yerine geçer. Güncel kararın tamamı bu ADR'dedir.

## Context
ADR 0007, repo private ve ücretsiz planda olduğu için branch protection'ın kullanılamadığını kabul
etmiş ve "repo public yapılırsa protection açılır, bu ADR superseded olur" revisit trigger'ını
koymuştu. 2026-10-03'te repo **public** yapıldı ve `main` için klasik branch protection açıldı.
Dokümanlar artık zorlanan kuralları "zorlanmıyor" diye anlatıyordu; doküman gerçeği anlatmalı
(AGENTS.md invariant 4 ve 8).

`gh api repos/ugurcivgin34/city-radar/branches/main/protection` ile okunan ayarlar (2026-10-03):
zorunlu check'ler `doctor`, `check`, `security-check` (`strict: false`); PR zorunlu, gereken onay
sayısı 0; `enforce_admins: true`; `required_linear_history: true`; `allow_force_pushes: false`;
`allow_deletions: false`; `required_conversation_resolution: true`. Rulesets yok.

## Decision
`main`'in korunması GitHub branch protection ve repo ayarlarıyla zorlanır. Süreç kuralı olarak
yalnızca şunlar kalır: merge kararı insanındır ve merge, doğrulanan head SHA'ya sabitlenir
(`gh pr merge <n> --squash --match-head-commit <sha>`).

## Consequences
- **GitHub tarafından zorlananlar:**
  - `main`'e yalnızca PR ile girilir; doğrudan push reddedilir. Admin'ler, yani repo sahibi de dahil.
  - Üç zorunlu check, PR'ın head commit'inde geçmeden merge yapılamaz.
  - Force push ve `main`'in silinmesi reddedilir; linear history zorunlu.
  - Çözülmemiş review konuşması merge'ü bloklar.
  - Repo ayarı: yalnızca squash merge; merge edilen PR branch'i otomatik silinir.
- **Bilinçli olarak açık bırakılanlar:**
  - Gereken onay sayısı 0: repo tek geliştiricili; bağımsız review ANEW sürecinde yapılır
    (`docs/git.md` "Pull requests").
  - `strict: false`: merge öncesinde branch'in `main` ile güncel olması zorunlu değil.
- **Süreçle kalanlar:** merge kararının insanda olması ve merge'ün doğrulanan head SHA'ya sabitlenmesi.
- **Maliyet:** `enforce_admins` nedeniyle acil bir düzeltme de PR ve yeşil check'lerle yapılır;
  protection'ı geçici olarak kapatmak bu ADR'yi yeniden açar.
- **Public repo güvenliği (2026-10-03'te kontrol edildi):** secret scanning ve push protection açık;
  git geçmişinde bilinen token kalıbı yok; takip edilen `.env`/secret dosyası yok; workflow token'ı
  read-only ve CI secret kullanmıyor.

## Alternatives considered
- **Rulesets:** aynı korumayı sağlar; mevcut klasik protection yeterli olduğu için değiştirilmedi.
- **Repoyu private'a geri almak:** ücretsiz planda protection uygulanmaz, ADR 0007 durumuna dönülür.

## Revisit triggers
Git/süreç konusu kapalıdır; yalnızca şu durumlarda yeniden açılır:
- Repo yeniden private yapılırsa (ücretsiz planda protection uygulanmaz).
- Protection ayarları değiştirilir ya da geçici olarak kapatılırsa.
- İkinci bir geliştirici aktif olursa (gereken onay sayısı; ayrıca ADR 0005 strict tetikleyicisi).
- Bir incident: korumanın beklenen şekilde çalışmadığının görülmesi.
