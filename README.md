# City Radar

İstanbul'da yaşayan vatandaşların şehir içindeki güncel durumları tek bir mobil harita üzerinden
hızlıca görmesini sağlayan uygulama. İlk sürüm (v1): kullanıcının konumu, yakındaki İSPARK
otoparkları ve doluluk bilgileri, harita üzerinde trafik yoğunluğu.

> Durum: backend iskeleti kuruldu (spec 0001). İş davranışları, sağlayıcı entegrasyonları ve
> mobil uygulama henüz yok.

## Repo yapısı

| Yol | İçerik |
|---|---|
| `backend/` | ASP.NET Core (.NET 10) modüler monolit: `src/` altında `CityRadar.Shared`, `.Parking`, `.Traffic`, `.Infrastructure`, `.Api`; `tests/` altında modülleri yansıtan test projeleri ve mimari testler |
| `mobile/` | React Native + Expo + TypeScript — **henüz kurulmadı** (mobil setup feature'ı) |
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
- Node.js — mobil kurulumla birlikte gelecek (sürüm repoda pinlenecek).

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

## Check ve test komutları

Repo kökünden:

```sh
./scripts/check            # build + format + test (+ mobil, kurulunca) — CI ile aynı adımlar
./scripts/security-check   # bağımlılık zafiyet taraması (fail-closed); CI'da ayrı job
./scripts/doctor           # çalışma alanı ve spec/plan gate sağlığı
```

Yalnızca backend testleri (Microsoft.Testing.Platform):

```sh
cd backend
dotnet test --solution CityRadar.slnx
```

Mimari kurallar (FD-1–FD-4), proje referans yönü ve saat kuralı bu komutlarla otomatik doğrulanır;
ihlal `scripts/check`'i kırmızıya çevirir.

## Dokümanlar

- [Mimari ve modül sınırları](docs/architecture.md) · [Domain ve iş kuralları](docs/domain.md)
- [Konvansiyonlar](docs/conventions.md) · [Test](docs/testing.md) · [Güvenlik](docs/security.md) · [Git](docs/git.md)
- [Kararlar (ADR)](docs/decisions/)

## Lisans

[LICENSE](LICENSE)
