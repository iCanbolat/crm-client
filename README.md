# CRM Platformu — client

Vite + React 19 + TypeScript, shadcn/ui (Base UI), TanStack Router / Query, i18next (TR/EN), MSW ile mock API.
Fazlar ve batch'ler için: [`../.claude/frontend-plan.md`](../.claude/frontend-plan.md).

Bu klasör bağımsız bir repodur (kendi `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ve git geçmişi). `crm/` kök dizini yalnızca `client/` ve ileride `api/` repolarını bir arada tutar; kökte paket yöneticisi dosyası yoktur.

## Kurulum

```bash
nvm use        # Node 22 (.nvmrc)
pnpm install   # pnpm 10 (packageManager alanı)
pnpm dev
```

## Komutlar

| Komut                              | Açıklama                                                                |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                         | Geliştirme sunucusu (MSW açık, `.env`)                                  |
| `pnpm build`                       | Typecheck + production build (MSW kapalı, `.env.production`)            |
| `pnpm typecheck` / `pnpm lint`     | `tsc -b` / ESLint (mimari sınır kuralları dahil)                        |
| `pnpm test` / `pnpm test:coverage` | Vitest — `unit` (jsdom + MSW) ve `architecture` projeleri               |
| `pnpm e2e`                         | Playwright faz simülasyonları (`e2e/phase-N.spec.ts`, masaüstü + mobil) |
| `pnpm verify`                      | typecheck → lint → coverage → build → e2e                               |

## Oturum & demo hesapları (mock)

- Tüm ekranlar `/login` arkasındadır; korumalı bir adrese oturumsuz gidilirse `?redirect=` ile girişe yönlendirilir.
- Seed hesapları ve ortak demo şifresi `src/mocks/db/seed.ts` içindedir (`SEED_USERS`, `DEMO_PASSWORD`):
  `owner@acme.test`, `admin@…`, `manager@…`, `agent@…`, `viewer@acme.test` (Acme Lojistik) ve onboarding'i tamamlanmamış `selin@kuzey.test` (Kuzey Lojistik).
- En hızlısı: ekranın altındaki **MSW** rozeti → **Hızlı giriş** ile seed kullanıcılarından biri olarak oturum açın.
- Access token yalnız bellekte, refresh token `localStorage`'da (`auth:session`) tutulur; sayfa yenilense de oturum geri yüklenir.

## Mock API (MSW)

- Handler'lar feature içinde (`src/features/*/mocks/handlers.ts`), `src/mocks/handlers.ts` ile birleşir.
- Kimlik/tenant kontrolü: `src/mocks/auth/authenticate.ts` (`authenticate`, `authorize` — UI ile aynı `lib/rbac` politikası).
- Her handler `withScenario()` ile sarılır; senaryolar: `default`, `empty`, `error`, `slow`, `validation`. Oturum için kritik uçlar (`login`, `refresh`, `me`, `workspace`) `critical: true` ile yalnız gecikmeden etkilenir.
- Senaryo seçimi: dev toolbar veya `?msw-scenario=error` URL parametresi.
- Veri `src/mocks/db` altında seed'li (deterministik) in-memory koleksiyonlarda; sayfa yenilenince sıfırlanır. Toolbar'daki "Veriyi tarayıcıda sakla" ile kalıcı hale getirilebilir.

## CRM motoru (Faz 2)

- Liste, detay, form ve kanban ekranları nesne metadata'sından üretilir (`GET /api/meta/objects`); yeni bir nesne için kod gerekmez — `/o/<nesne>` adresinde listelenir.
- `src/engine/`: metadata şemaları, alan tipi registry'si (`toZod`, `Cell`, `Input`, `format`, `filterOperators`), `metadataToZod` / `metadataToColumns`, koşul değerlendirici. Motor feature import etmez; veri erişimi `FieldServicesProvider` ile enjekte edilir.
- Özelleştirme: **Ayarlar → Nesneler** (owner/admin) — özel alan, detay düzeni, liste kolonları, pipeline aşamaları ve aşama kapıları.
- Liste durumu (sayfa, sıralama, filtreler, kolonlar, görünüm) URL'dedir; paylaşılan link aynı görünümü açar.

## Yeni feature eklerken

`src/features/_example` klasörünü şablon olarak kopyalayın: `api/` (schemas → api → keys → queries → mutations), `components/`, `mocks/`, `__tests__/`, `index.ts` (public API).
Diğer katmanlar bir feature'a yalnızca `@/features/<ad>` (index.ts) üzerinden erişebilir; feature'lar sektör modüllerini (`src/modules/*`) doğrudan import edemez, `@/engine/modules` registry'sini kullanır — ESLint bunu zorunlu kılar.

Yetki kontrolü: arayüzde `<Can action resource target>` / `usePermission`, route'ta `requirePermission(context.auth, …)`, mock API'de `authorize(…)`.

shadcn bileşenleri: `pnpm dlx shadcn@latest add <bileşen>`.
