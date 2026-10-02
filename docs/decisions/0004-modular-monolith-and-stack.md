# ADR 0004 — Monorepo, modüler monolit backend (.NET 10) ve Expo mobil istemci

- Status: Accepted
- Date: 2026-10-02

## Context
City Radar v1; İstanbul'daki vatandaşlara kullanıcı konumu, yakın İSPARK otoparkları + doluluk ve
trafik yoğunluğunu tek bir mobil haritada gösterecek. Tek geliştirici, Windows geliştirme
ortamı, dış sağlayıcıların (İSPARK, İBB) şeması ve güncelleme sıklığı henüz doğrulanmamış. Bir
feature çoğunlukla hem API'ye hem mobile dokunacak. Bootstrap mülakatında karar verildi.

## Decision
Tek monorepo (`backend/`, `mobile/`) kullanılır. Backend ASP.NET Core .NET 10 LTS üzerinde
modüler monolittir (Shared, Parking, Traffic, Infrastructure, Api); v1'de veritabanı yok, veri
background polling ile alınıp abstraction arkasındaki in-memory snapshot store'da tutulur.
Mobil React Native + Expo + TypeScript (Expo Router, TanStack Query, MapLibre React Native).
Ayrıntı: `docs/architecture.md`.

## Consequences
- Kazanç: tek spec/PR/`scripts/check` iki tarafı birlikte doğrular; modül sınırları derleyici +
  architecture testleriyle korunur; operasyon yükü minimum; Expo EAS ile Mac olmadan iOS build.
- Maliyet: tek instance varsayımı (restart'ta store boş başlar); API contract DTO mapping kodu;
  MapLibre nedeniyle Expo Go yerine development build gerekebilir; ileride ölçek için store
  implementasyonu değiştirilmeli.

## Alternatives considered
- **Mikroservisler:** v1 ihtiyacı için gereksiz dağıtık sistem maliyeti (YAGNI).
- **Veritabanı (PostgreSQL/PostGIS) ile başlamak:** birkaç yüz otopark için bellek içi yakınlık
  sorgusu yeterli; historical analytics kapsam dışı; konum saklamama kuralı (BR-4) daha basit korunur.
- **Flutter:** olgun bir seçenek, fakat Windows'ta iOS build için Mac/bulut CI gerekir; Expo EAS
  bunu hazır çözüyor ve TS ekosistemi OpenAPI'den tip üretimine uygun.
- **Google Maps / Mapbox SDK:** lisans/maliyet ve vendor lock-in riski; MapLibre + OSM tabanlı
  veri seçildi (tile sağlayıcısı ayrı ADR — OD-2).

## Revisit triggers
- Multi-instance / yatay ölçek ihtiyacı (shared store, ör. Redis).
- Geçmiş veri, analitik veya kalıcı kullanıcı verisi ihtiyacı (veritabanı).
- Web client ihtiyacı.
- Sağlayıcı araştırması (OD-1) polling/in-memory modelini geçersiz kılarsa.
