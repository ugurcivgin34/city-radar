# City Radar

İstanbul'da yaşayan vatandaşların şehir içindeki güncel durumları tek bir mobil harita üzerinden
hızlıca görmesini sağlayan uygulama. İlk sürüm (v1): kullanıcının konumu, yakındaki İSPARK
otoparkları ve doluluk bilgileri, harita üzerinde trafik yoğunluğu.

> Durum: backend iskeleti (spec 0001) ve mobil iskelet (spec 0003) kuruldu. İş davranışları,
> sağlayıcı entegrasyonları ve harita henüz yok; uygulama tek bir başlangıç ekranıyla açılır.

## Repo yapısı

| Yol | İçerik |
|---|---|
| `backend/` | ASP.NET Core (.NET 10) modüler monolit: `src/` altında `CityRadar.Shared`, `.Parking`, `.Traffic`, `.Infrastructure`, `.Api`; `tests/` altında modülleri yansıtan test projeleri ve mimari testler |
| `mobile/` | Expo SDK 57 + React Native + TypeScript (`strict`) + Expo Router: `app/` route'lar, `src/` ekranlar, `src/localization/tr.ts` metinler, `src/api/` tek HTTP sınırı, `tooling/` mimari kontroller |
| `docs/` | Mimari, domain, konvansiyonlar, test, güvenlik, git kuralları ve ADR'ler |
| `specs/` | Spec'ler ve planlar (`active/`, `plans/`, `done/`) |
| `workflows/`, `prompts/` | Geliştirme süreci (ANEW): spec → plan → build → bağımsız review → verify |
| `scripts/` | `check` (tek doğrulama komutu), `security-check`, `doctor` |

Kurallar ve süreç için giriş noktası: [`AGENTS.md`](AGENTS.md).

## Prerequisites

- **.NET SDK 10.0.401 veya aynı 10.0 hattında daha yeni bir feature band** — `backend/global.json`
  ile pinli (`rollForward: latestFeature`). Başka bir major sürüme geçilmez.
- **POSIX shell** — `scripts/*` için; Windows'ta Git Bash.
- **Git.**
- **Node.js 22.13+ (CI ve önerilen: 22.23.3)** — `mobile/.nvmrc` ile pinli, `mobile/package.json`
  `engines` `>=22.13.0 <23`; `mobile/.npmrc` `engine-strict=true` olduğundan farklı bir Node ile
  `npm ci` hata verir. Windows'ta örnek: `winget install Schniz.fnm` → `fnm install 22.23.3`;
  PowerShell profilinize `fnm env --use-on-cd | Out-String | Invoke-Expression` ekleyin.
- **npm** (Node ile gelir) — `mobile/package-lock.json` source control'dadır, kurulum `npm ci`.

## Local setup

**Telemetri kapalı çalışın (minimum data, [`docs/security.md`](docs/security.md)).** `scripts/check`,
`scripts/security-check` ve CI bunu zaten yapıyor; `dotnet` komutlarını doğrudan çalıştırırken
aynı iki değişkeni kendi shell'inizde ayarlayın:

```sh
# bash / Git Bash
export DOTNET_CLI_TELEMETRY_OPTOUT=1 TESTINGPLATFORM_TELEMETRY_OPTOUT=1
```

```powershell
# PowerShell (kalıcı yapmak için profilinize ekleyin)
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"; $env:TESTINGPLATFORM_TELEMETRY_OPTOUT = "1"
```

```sh
git clone https://github.com/ugurcivgin34/city-radar.git
cd city-radar

# Backend komutları backend/ içinde çalışır; böylece backend/global.json SDK'yı seçer.
cd backend
dotnet --version                      # 10.0.4xx (veya aynı hatta daha yeni)
dotnet restore CityRadar.slnx
dotnet build CityRadar.slnx
dotnet run --project src/CityRadar.Api   # API host'u; henüz endpoint yok (her yol 404)
```

Mobil uygulama (`mobile/` içinde; Expo telemetrisi için `EXPO_NO_TELEMETRY=1` önerilir):

```sh
cd mobile
node --version                        # v22.13+ (CI: .nvmrc → 22.23.3)
npm ci
cp .env.example .env                  # EXPO_PUBLIC_API_BASE_URL — yalnızca public configuration
npm start                             # Expo dev server; Expo Go veya emülatörle açın
```

`EXPO_PUBLIC_*` değerleri uygulamaya gömülür ve kullanıcı tarafından görülebilir; buraya hiçbir
zaman secret yazılmaz ([`docs/security.md`](docs/security.md)).

## Check ve test komutları

Repo kökünden:

```sh
./scripts/check            # backend + mobil: build/typecheck, format, lint, test, Android export — CI ile aynı
./scripts/security-check   # bağımlılık zafiyet taraması (fail-closed); CI'da ayrı job
./scripts/doctor           # çalışma alanı ve spec/plan gate sağlığı
```

Yalnızca backend testleri (Microsoft.Testing.Platform):

```sh
cd backend
dotnet test --solution CityRadar.slnx
```

Yalnızca mobil (`mobile/` içinde):

```sh
npm run typecheck        # tsc --noEmit (strict)
npm run lint             # ESLint, FD-5 / FD-6 / FD-8 kuralları dahil
npm run format:check     # Prettier
npm run check:forbidden  # FD-7 yasak harita SDK'ları + FD-6 sağlayıcı host taraması
npm run check:expo-sdk   # kurulu paketler Expo SDK'nın beklediği sürümlerde mi (npm ci sonrası)
npm test                 # Jest (jest-expo + React Native Testing Library)
npm run test:tooling     # mimari kuralların gerçekten tetiklendiğinin testleri (node:test)
npm run export:android   # Android production bundle/export (cihaz ve ağ gerekmez)
```

Mimari kurallar (backend FD-1–FD-4, mobil FD-5–FD-8), proje referans yönü ve saat kuralı bu
komutlarla otomatik doğrulanır; ihlal `scripts/check`'i kırmızıya çevirir.

## Dokümanlar

- [Mimari ve modül sınırları](docs/architecture.md) · [Domain ve iş kuralları](docs/domain.md)
- [Konvansiyonlar](docs/conventions.md) · [Test](docs/testing.md) · [Güvenlik](docs/security.md) · [Git](docs/git.md)
- [Kararlar (ADR)](docs/decisions/)

## Lisans

[LICENSE](LICENSE)
