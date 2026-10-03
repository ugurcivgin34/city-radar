# ADR 0009 — npm audit: Expo CLI build araçlarındaki yamasız iki advisory için süreli istisna

- Status: Accepted
- Date: 2026-10-03

## Context
`docs/security.md` ve spec 0003 (AC-15): `scripts/security-check` production bağımlılıklarındaki
high/critical zafiyette RED olmalı. Mobil temel kurulumunda Expo SDK'nın en güncel sürümüyle
(`expo` 57.0.26) `npm audit --omit=dev` 2026-10-03'te iki high advisory raporladı:

| Advisory | Paket | Etkilenen | Yamalı sürüm | Yol |
|---|---|---|---|---|
| GHSA-vfj7-8cjw-p6xm — stack-exhaustion DoS | `braces` | ≤ 3.0.3 | Yok (en son sürüm 3.0.3) | `expo` → `@expo/cli` → `@expo/metro-file-map` → `micromatch` → `braces` |
| GHSA-86w9-cpqp-85rv — RSA PKCS#1 v1.5 imza doğrulama | `node-forge` | ≤ 1.4.0 | Yok (en son sürüm 1.4.0) | `expo` → `@expo/cli` (doğrudan bağımlılık) ve `@expo/cli` → `@expo/code-signing-certificates` → `node-forge` |

npm bunları production sayar, çünkü `expo` paketi `@expo/cli`'ye doğrudan bağımlıdır. Her iki yol da
geliştirici makinesinde ve CI'da çalışan build/CLI araçlarıdır. `braces` Metro dosya eşlemesinde
kullanılır. `node-forge`'u `@expo/cli` iki yerde kullanır: `expo run:ios` kod imzalama
(`run/ios/codeSigning`) ve geliştirme sunucusunun manifest imzalaması — `expo start`, istemci
`expo-expect-signature` başlığı gönderdiğinde manifest'i imzalar (`utils/codesigning`,
`ExpoGoManifestHandlerMiddleware`). Üretilen uygulama paketinde (`expo export` çıktısı ve
metadata'sı) bu paketlere referans yoktur (spec 0003 review'ında `.hbc` içinde 0 eşleşme). npm'in önerdiği "düzeltme" (`expo` 44'e inmek) geçerli
değildir. Yamalı sürüm olmadığı için bugün bağımlılık değişikliğiyle kapatılamaz.

## Decision
Bu iki advisory, **yalnızca GHSA kimlikleri ve paket adlarıyla** ve **2026-12-31 son tarihiyle**
`mobile/audit-exceptions.json` dosyasında istisna olarak kaydedilir. `scripts/npm-audit.mjs`:
- istisna dışındaki her high/critical advisory'de RED verir;
- son tarihi geçmiş bir istisnayı RED sayar;
- istisnaya giren advisory'leri her çalıştırmada görünür biçimde raporlar;
- artık raporlanmayan bir istisnayı "kaldırılabilir" diye uyarır.

## Consequences
- `security-check` bugün yeşil olur; aynı paketlerde **yeni** bir advisory ya da başka herhangi bir
  high/critical zafiyet yine RED verir.
- Maliyet: bilinen iki zafiyet geliştirici/CI araçlarında süre sonuna kadar kabul edilmiş olur.
  `braces` DoS'u build sırasında kötü niyetli glob deseni gerektirir. `node-forge` açığı imza
  *doğrulama*yla ilgilidir; CLI'ın kullandığı yollar geliştirme sırasında imza *üretir* (manifest,
  iOS kod imzalama). Bu proje `expo-updates` kod imzalaması, EAS ya da development code signing
  kullanmıyor; uygulama paketinde node-forge yok.
- İstisnanın kaldırılması bir sonraki Expo SDK yükseltmesinin ya da yamalı sürümün işidir.

## Alternatives considered
- **Eşiği `critical`'a çekmek:** gelecekteki tüm high zafiyetleri sessizce geçirir; reddedildi.
- **`npm overrides` ile başka sürüme zorlamak:** yamalı sürüm yok; reddedildi.
- **npm adımını SKIP etmek:** spec 0003 AC-15'e ve fail-closed ilkesine aykırı; reddedildi.

## Revisit triggers
- 2026-12-31 son tarihi (istisna otomatik olarak RED'e döner).
- `braces` veya `node-forge` için yamalı sürüm yayımlanması ya da Expo SDK yükseltmesi.
- Projede `expo-updates` kod imzalamanın, EAS projectId'nin ya da development code signing'in
  devreye girmesi (node-forge açığı o zaman imza doğrulama akışına girebilir; istisna derhal
  yeniden değerlendirilir).
