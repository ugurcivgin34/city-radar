# Security

> Her plan ve review'da uyulması gereken temel kurallar. Bootstrap: 2026-10-02.
> Prensipler: minimum data · minimum privilege · minimum exposure · explicit validation ·
> safe failure · provider isolation · no secret in client.

## Secrets
- Secrets never enter the repo, specs, prompts, or chat. `.env` is gitignored; provide `.env.example`.
- Agents never print secret values, even when debugging.
- Backend: lokal geliştirmede `dotnet user-secrets`; deployment'ta environment variables veya
  platform secret store. `appsettings.json` içine gerçek değer yazılmaz; secret'lar loglanmaz ve
  API response'larına girmez.
- Mobilde gerçek secret yoktur. `EXPO_PUBLIC_*` değişkenlerinin kullanıcı tarafından görülebildiği
  varsayılır; yalnızca public configuration (ör. API base URL) içindir. Provider credential/API
  key'leri gerekiyorsa yalnızca backend'de tutulur.

## Input & output
- **İstemci girdisi:** `-90 <= latitude <= 90`, `-180 <= longitude <= 180`; radius yalnızca
  configuration'daki izinli değerlerden biri; request size limit uygulanır. Geçersiz girdi →
  `400` + ProblemDetails.
- **Provider cevapları untrusted input'tur:** timeout, cancellation, bounded response size,
  kontrollü parsing, gereken yerde schema validation, sınırlı retry/resilience. Bozuk veya parse
  edilemeyen cevap son başarılı snapshot'ı silmez; yeni veri ancak başarılı parse + normalize
  sonrası store'u atomik günceller. Yarım/doğrulanmamış veri iyi snapshot'ın üzerine yazılamaz.
- **Hata sızıntısı:** stack trace, raw exception message, provider'ın ham hata cevabı, internal
  URL/host detayları client'a dönmez (`docs/conventions.md`).
- **Konum taşıyan sorgular:** kesin koordinatın query string'e (ve dolayısıyla access log'lara)
  düşmemesi için gerektiğinde read-only `POST` sorgu endpoint'i kullanılır (ör.
  `POST /api/parking/nearby`, gövde `{ latitude, longitude, radiusMeters }`). Bu endpoint
  sunucu durumunu değiştirmez. Request body logging kapalı/redacted.

## AuthN / AuthZ
- v1'de kullanıcı hesabı / authentication yok. API public'tir ve yalnızca City Radar'ın ihtiyaç
  duyduğu read/query operasyonlarını sunar (default-deny: açıkça tanımlanmamış endpoint yok).
- Admin/debug/diagnostic endpoint'leri production'da public açılmaz; Swagger/OpenAPI UI yalnızca
  Development ortamında.
- **Rate limiting:** ASP.NET Core built-in rate limiting; limitler configuration'dan. API/
  infrastructure concern'üdür, business modüllerine girmez. IP rate limit'i kullanıcı kimliği
  değildir (NAT/VPN); v1 için basit koruma olarak yeterli.
- **Reverse proxy:** forwarded headers yalnızca trusted proxy'lerden kabul edilir; istemcinin
  gönderdiği sahte `X-Forwarded-For` değerlerine güvenilmez. TLS termination proxy/platformda
  ise ASP.NET Core forwarded headers ve HTTPS configuration'ı gerçek topolojiye göre yapılır.
- **HTTPS:** production trafiği yalnızca HTTPS; production'da HSTS.
- **CORS:** v1'de yalnızca native mobil istemci var; geniş CORS policy açılmaz
  (`AllowAnyOrigin + AllowAnyHeader + AllowAnyMethod` production varsayılanı yasak). Web client
  eklenirse CORS ayrı requirement olur.

## Konum ve kişisel veri (KVKK)
- Mobil yalnızca **while in use** konum izni ister; background location v1'de yasak.
- Kesin kullanıcı koordinatı: cihazda kalıcı saklanmaz, backend persistence'a yazılmaz,
  application log'a yazılmaz, analytics/telemetry event'ine eklenmez, exception context'e
  eklenmez. Yalnızca aktif "yakınımdaki" sorgusu için kısa süreli işlenir (BR-4).
- Client IP application log'larına kalıcı yazılmaz; rate limiter gibi teknik mekanizmalar yalnızca
  gerekli süre boyunca memory'de kullanabilir.
- **Deployment security requirement:** Nginx/load balancer/cloud access log'ları kullanılıyorsa
  query/body içindeki koordinatlar ve client IP'si loglanmaz veya redact edilir; deployment
  sırasında ayrıca doğrulanır (uygulama testlerinin kapsamı dışında).
- **Release requirement (açık):** store yayını öncesi gizlilik politikası, gerekli KVKK
  bilgilendirmeleri ve app store privacy declarations hazırlanır.

## Dependencies
- Yeni runtime dependency plan içinde açıkça yazılır — paket, neden gerekli, değerlendirilen
  alternatifler, lisans — ve plan onayıyla birlikte onaylanır. Anlamlı dev/test dependency'leri
  de belirtilir; her transitive dependency için insan onayı gerekmez.
- **Lisans:** MIT, Apache-2.0, BSD, ISC normal olarak kullanılabilir. GPL, AGPL ve
  proprietary/commercial otomatik eklenmez — kullanım etkisi ve dağıtım koşulları ADR ile
  değerlendirilir, açık onay gerekir. LGPL/MPL gibi ara durumlar gerektiğinde lisans
  değerlendirmesine bırakılır.
- **Bakım:** son bir yılda release/commit görmemiş paket bir warning/review sinyalidir, otomatik
  yasak değildir. Değerlendirme: son release, açık security issue'ları, maintainer aktivitesi,
  kullanım yaygınlığı, açık issue/PR durumu, framework'ün güncel sürümüyle uyumluluk.
- **Vulnerability scanning:** `scripts/security-check` (NuGet + npm). `scripts/check`'ten ayrıdır
  ki vulnerability database'e erişim sorunu test failure ile karışmasın; CI ikisini de çalıştırır.
  NuGet komutu pinlenen .NET SDK'nın desteklediği güncel syntax'la; npm'de high/critical
  production vulnerability'leri görünür failure üretir. İstisna sessiz ignore ile değil,
  gerekçeli ve mümkünse süreli bir karar/ADR ile yapılır.
- **Dependabot:** update PR'ları doğrudan merge edilmez, normal check'lerden geçer. Major version
  değişiklikleri ayrı plan maddesi ve açık onay gerektirir; security patch'ler daha hızlı ele
  alınabilir ama yine check doğrulamasından geçer.

## Review lens
Security is a mandatory dimension of every independent review (see `prompts/review.md`), not a
separate afterthought phase.
