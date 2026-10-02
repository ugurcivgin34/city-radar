# ADR 0005 — Lite çalışma modu ve strict'e geçiş tetikleyicileri

- Status: Accepted
- Date: 2026-10-02

## Context
City Radar şu aşamada tek geliştiricili, düşük/orta riskli bir proje: public read-only API,
authentication yok, ödeme yok. En hassas alan konum gizliliği; bu da BR-4, testler ve review
lens'iyle tooling'e bağlandı. Strict mod "her rol ayrı oturum" disiplini ister; tek geliştirici
için orantısız maliyet.

## Decision
ANEW çalışma modu **lite**'tır (`AGENTS.md`). Lite modda şu kapılar korunur:
- Spec insan onayı olmadan implementation başlamaz.
- Plan insan onayı olmadan build başlamaz.
- Independent review atlanamaz.
- `scripts/check` ile doğrulama yapılmadan iş tamamlanmış sayılmaz.
- Mevcut testlerin silinmesi veya zayıflatılması normal implementation yolu olarak kullanılamaz.

## Consequences
- Kazanç: tek oturumda `/new-feature` zinciri, her gate'te insan onayı; düşük tören maliyeti.
- Maliyet: roller aynı oturum zincirinde çalışır; "strict" gate'lerde agent varsayımını yazıp
  itiraz yoksa devam eder — bu yüzden insanın gate'lerde dikkatli olması gerekir.

## Alternatives considered
- **strict:** rol ayrımı en güçlü hali; tek geliştirici için her feature en az beş oturum demek.
  Aşağıdaki tetikleyiciler oluşana kadar maliyeti faydasını aşıyor.

## Revisit triggers
Aşağıdakilerden biri oluşursa strict mod yeniden değerlendirilir:
- Birden fazla geliştirici aktif olarak projede çalışmaya başlarsa.
- Authentication / kullanıcı hesabı eklenirse.
- Ödeme veya finansal işlem eklenirse.
- Kullanıcıya ait kalıcı kişisel veri saklanmaya başlanırsa.
- Background location veya sürekli konum takibi eklenirse.
- Kritik operasyonel entegrasyonlar ortaya çıkarsa.
- Güvenlik veya regülasyon riski belirgin şekilde artarsa.
