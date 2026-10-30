---
title: 'App shell: tema Dark Excel, sidebar, header, dan toggle tema'
type: 'feature'
ticket: '8'
created: '2026-10-30'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '5c2e7583ce0d90d8609fc6a903b9ac32990a3bad'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-dashboard.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Setelah login hanya ada halaman placeholder tanpa navigasi, tema terang belum ada, dan Log out hanya ada di `/`. B4 menuntut app shell DESIGN.md (App Sidebar, Mobile Drawer, Header Bar, Theme Toggle) dengan preferensi tema dan Reduce motion per perangkat yang dibaca server sebelum first paint (spine Conventions › Preferences, AD-12).

**Approach:** Token warna lengkap (gelap default + terang) di `globals.css` lewat `data-theme`, layout bersama untuk semua permukaan yang butuh login (sidebar ≥ lg, drawer < lg, header sticky dengan Theme Toggle dan menu avatar), cookie `theme` dan `reduce_motion` yang dibaca di server untuk atribut `<html>`, hook `useMotionPreference()`, halaman placeholder untuk setiap menu, dan halaman Settings minimal.

**Decisions (user, 2026-10-30):**
- Semua menu sidebar tampil; route yang isinya belum dibangun mendapat halaman placeholder dengan judul permukaan yang benar.
- Settings minimal ikut dibangun: Theme Toggle, switch Reduce motion, zona waktu (read-only dari `profiles`), "Signed in as" dan Log out.
- Footer progres sidebar dan badge level di Level Map disembunyikan sampai epic Progres (bersama Streak Chip).
- Plan dipertahankan utuh walau di atas 1600 token.

## Boundaries & Constraints

**Always:** chrome berbahasa Inggris (`<html lang="en">`), user tampil sebagai El Zavier / EZ; nilai warna, ukuran, radius, dan font persis dari DESIGN.md; aksesibilitas EXPERIENCE.md (fokus 2px `ring` offset 3px, target ≥24px dan ≥44px di HP, `aria-current="page"`, Theme Toggle dua tombol `aria-pressed` dalam `role="group" aria-label="Theme"`, drawer "Open menu" dengan focus trap dan `Esc`); motion hanya CSS (AD-12), mati bila OS meminta atau switch Reduce motion menyala; tema tersimpan di cookie dan langsung berlaku tanpa reload; data lewat adapter dan sesi user (AD-9).

**Never:** Streak Chip, footer progres, badge level, isi Dashboard atau permukaan lain; `next-themes`, framer-motion atau library animasi; mengubah alur login, route publik, atau route macro.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kunjungan pertama | tanpa cookie `theme` | gelap, tanpa kedip tema | — |
| Pilih terang | klik Light | langsung terang; cookie `theme=light`; reload tetap terang | — |
| Cookie rusak | `theme=xyz` | gelap | abaikan nilai |
| Reduce motion | switch on, atau OS reduce | `data-motion="reduce"` / media query; transisi shell mati; `useMotionPreference()` → reduce | — |
| Reduce motion default | tanpa cookie | ikuti OS | — |
| Lebar HP/tablet | < 1024px | sidebar tersembunyi; top bar dengan "Open menu"; drawer kiri 286px | `Esc`, scrim, navigasi menutup drawer |
| Menu aktif | di `/history` | item History `aria-current="page"` | — |
| Log out | sidebar General atau menu avatar | sesi berakhir → `/login` | — |
| Settings tanpa profil | `profiles` kosong | zona waktu "Not set" | — |

</frozen-after-approval>

## Code Map

- `src/app/layout.tsx` -- root layout sinkron `<html lang="en">`; tempat atribut `data-theme`/`data-motion` dari cookie. `next.config.ts` memakai `cacheComponents: true`, jadi akses `cookies()` di layout butuh batas `Suspense`/dinamis yang benar.
- `src/app/globals.css` -- token gelap sebagian (background, card, primary, …) di `:root` + `@theme inline`; keyframes login dengan override reduced-motion. Belum ada token terang, `ring`, `accent`, `chart-*`, `*-soft`, radius.
- `src/app/page.tsx` -- placeholder + form Log out sementara (`POST /auth/signout`); diganti redirect ke `/dashboard`.
- `src/app/login/` dan `src/app/auth/*` -- jangan diubah selain memakai token baru; default `next` setelah login tetap `/`.
- `src/adapters/supabase/server.ts` (`createClient`), `profiles.ts` -- baca `time_zone` milik user lewat sesi; `auth.ts` -- email dari sesi untuk "Signed in as".
- `src/adapters/supabase/auth-rules.ts` `isPublicPath` -- permukaan baru semuanya butuh sesi (tidak perlu diubah).
- `src/lib/utils.ts` `cn()`; `components.json` (new-york, lucide, alias `@/components/ui`). Registry shadcn tidak terjangkau dari container (proxy 403), jadi komponen `Sheet`, `Switch`, `DropdownMenu`, `Separator` ditulis tangan di `src/components/ui/` mengikuti sumber shadcn new-york v4 di atas paket `radix-ui` (npm 1.8.1). Ikon: `lucide-react` (npm 1.64.0), keduanya dipin persis.
- Mockup `key-dashboard.html` -- struktur shell (sidebar 256px, padding 22px 16px, header 68px, segmen tema 32×32, avatar 40×40 gradien `primary → chart-3`, phone top bar dengan menu 44px, judul, avatar) dan ikon per menu.
- Route (kebab-case): `/dashboard`, `/levels`, `/history`, `/records`, `/tips`, `/setup-guide`, `/settings`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- `radix-ui` 1.8.1, `lucide-react` 1.64.0 (dipin).
- [x] `src/app/globals.css` -- token lengkap gelap/terang dari DESIGN.md (`[data-theme="light"]` override, `color-scheme`), radius, focus ring, aturan reduced-motion (`@media` + `[data-motion="reduce"]`).
- [x] `src/lib/preferences.ts` (+ tes) -- parse/serialize cookie `theme` (`dark|light`, default dark) dan `reduce_motion` (`on|system`, default system); Server Action yang menulis cookie (1 tahun, `sameSite=lax`).
- [x] `src/app/layout.tsx` -- `data-theme`/`data-motion` dari cookie sebelum first paint.
- [x] `src/hooks/use-motion-preference.ts` (+ tes logika murni) -- gabungan `prefers-reduced-motion`, switch, dan opsi scene (`saveData`, `deviceMemory ≤ 4`).
- [x] `src/components/ui/` -- sheet, switch, dropdown-menu, separator.
- [x] `src/components/shell/` -- `AppSidebar`, `MobileDrawer`, `HeaderBar`, `ThemeToggle`, `AvatarMenu`, `Logo`, daftar menu (+ tes pemetaan path → item aktif).
- [x] `src/app/(app)/layout.tsx` + halaman placeholder tiap menu (judul `<title>` per permukaan) + `src/app/(app)/settings/page.tsx`; `src/app/page.tsx` → redirect `/dashboard`.

**Acceptance Criteria:**
- Given login di Production, when `/dashboard` dibuka, then shell gelap sesuai mockup (sidebar, header, tanpa isi).
- Given toggle ke Light, when halaman di-reload, then tetap terang tanpa kedip gelap.
- Given lebar HP, when "Open menu" ditekan, then drawer berisi menu yang sama dan Log out mengakhiri sesi.

## Implementation Notes

- `cacheComponents`: the root layout reads the cookies and exports `instant = false` (blocking root; Next 16 docs: an `<html>` attribute from a cookie has no child to wrap in `<Suspense>`). Every route is now `ƒ` (dynamic), including `/login` and `/health`.
- That streamed root turns a `redirect()` in `app/page.tsx` into a client-side redirect after a 200, so `next.config.ts` also answers `/` with a real 307 to `/dashboard`; `app/page.tsx` keeps the redirect as fallback.
- Server Actions live in `src/lib/preferences-actions.ts` (a `"use server"` file may only export async functions); the pure parse/serialize stays in `src/lib/preferences.ts`; `src/lib/preferences-server.ts` reads the cookies for both layouts. The actions check the session (`getSessionUser`, claims) before writing; cookies are `httpOnly`, `sameSite=lax`, 1 year, `secure` in production.
- Header toggle and Settings share `PreferencesProvider` (client context); a change sets `<html>` instantly, then the action stores the cookie and the refreshed root layout renders the same attribute.
- Adapters: `auth.ts` `getSessionUser()` / `getAccount()`, `profiles.ts` `readTimeZone()` (+ tests). Settings shows the first-load message + "Try again" when the read fails.
- Radius tokens override Tailwind `rounded-sm/md/lg/xl` (6/12/16/28px); Login button `rounded-xl` → `rounded-md` (still 12px), Health card → `rounded-lg`.
- Drawer, menu and secondary-page motion are CSS keyframes in `globals.css` (no `tw-animate-css`); the reduced-motion rule (`@media` + `[data-motion="reduce"]`) turns off every animation and transition, so Radix unmounts the drawer instantly.
- Phone top bar: Theme Toggle shows from `sm` up (mockup phone bar = menu, title, avatar); on phones it stays reachable in Settings.
- New copy: `shellMessages.firstLoadFailed` (message set, verbatim) and `preferenceSaveFailed` (illustrative).
- User 2026-10-30: on phones the Theme Toggle stays in Settings only (no top-bar toggle); `preferenceSaveFailed` text "Pengaturan belum tersimpan. Coba lagi, ya." accepted.

## Plan Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Evidence | Route |
|---|------|---------|---------|----------|-------|
| 1 | blind-hunter, edge-case-hunter | A failed or unauthenticated preference save keeps the unsaved theme on screen; retrying the selected option is a no-op; an expired session loops on "Coba lagi" | medium | `PreferencesProvider` writes `<html>` and state first and never reverts; `UNAUTHENTICATED` is shown as a generic error | patch: revert on failure; send `UNAUTHENTICATED` to `/login?next=` |
| 2 | blind-hunter, edge-case-hunter | Settings: no session shows a retry loop, a thrown `getAccount` hits the error boundary, the failure branch hides Log out, the error block has no alert role | low | `AccountSections` treats `null` as a load failure and wraps nothing | patch |
| 3 | edge-case-hunter | Empty-string email shows a blank "Signed in as" | low | `auth.ts` keeps `""` | patch: normalize to null |
| 4 | blind-hunter | Fallback name "El Zavier" when no email | false | EXPERIENCE.md: the user is always shown as El Zavier / EZ | reject |
| 5 | blind-hunter, edge-case-hunter | Drawer overshoot strip clipped by `overflow-y-auto` | low | `::before` sits outside the scroll box | patch: scroll an inner wrapper |
| 6 | edge-case-hunter | Drawer stays open with scrim after widening to ≥ lg | low | No breakpoint listener | patch: close on `(min-width: 1024px)` |
| 7 | edge-case-hunter | Avatar Log out uses `requestSubmit` only | low | Older Safari lacks it | patch: fall back to `submit()` |
| 8 | blind-hunter | Radius tokens override Tailwind's sizes | false | Intended: DESIGN.md radii; Health card now 16px = DESIGN "cards lg" | reject |
| 9 | blind-hunter, intent-alignment | Root-layout cookie read makes every route dynamic | low | Required to set `<html>` attributes server-side before first paint (spine Preferences); single-user app, cost negligible | reject |
| 10 | blind-hunter | Comments in `next.config.ts` and `layout.tsx` contradict each other (streaming vs blocking) | low | Direct correction | patch |
| 11 | blind-hunter | Redundant login reduced-motion block; login button overrides the global focus ring | low | Global rule covers it | patch |
| 12 | blind-hunter | Default `next` after sign-in is `/`, adding a 307 hop to `/dashboard` | low | Fallbacks in `auth-rules.ts` and login card | patch: default `/dashboard` |
| 13 | blind-hunter | Path normalization duplicated in `nav-items.ts` | low | Two small helpers; no observed drift | reject |
| 14 | blind-hunter | `body` font-size in px ignores user font setting | low | Direct correction | patch: `0.875rem` |
| 15 | blind-hunter, edge-case-hunter | `useMotionPreference` misses `navigator.connection` change | low | Direct addition | patch |
| 16 | intent-alignment | Theme Toggle hidden from the phone header | maybe-false | Mockup phone top bar omits it; DESIGN Header Bar lists it; asked the user | reject (user 2026-10-30: Settings only on phones) |
| 17 | edge-case-hunter | Another tab's cookie leaves the toggle state stale | low | Single user; a reload fixes it; fix adds sync logic | reject |
| 18 | edge-case-hunter | `/health` link removed from UI | low | Ops page, reachable by URL | reject |
| 19 | edge-case-hunter | Reload mid-save repaints the old theme | low | Inherent to the async save; covered by #1 for failures | reject |
| 20 | verification-gap | `/` → `/dashboard` redirect untested | low | Pre-verified | patch: test `nextConfig.redirects()` against `NAV_ITEMS` |
| 21 | verification-gap | Client `<html>` writes and latest-save-wins untested | low | Pre-verified | patch: pure `applyPreferenceAttributes` + save-state step with tests |
| 22 | verification-gap | `secure` cookie flag untested at the action | low | Pre-verified | patch: env-stubbed tests |
| 23 | verification-gap | Settings "Not set"/failure rendering untested | low | No component harness; adapter output tested | defer |

## Design Notes

Tema berlaku instan: tombol mengubah `document.documentElement.dataset.theme` di klien lalu memanggil Server Action yang menulis cookie, sehingga reload berikutnya dirender server dengan atribut yang sama (tanpa skrip inline). Reduce motion: EXPERIENCE.md mematikan motion bila OS meminta **atau** switch menyala, jadi switch hanya bisa menambah reduksi: `on` menulis `data-motion="reduce"`, `system` (default, juga saat switch dimatikan) tidak menulis atribut dan media query `prefers-reduced-motion` yang bekerja. Footer, badge level, dan Streak Chip disisakan sebagai slot kosong untuk epic Progres.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih; CI hijau.

**Manual checks:**
- Preview lalu Production setelah login: shell gelap sesuai mockup; Light bertahan setelah reload; lebar < 1024px memakai drawer; Log out dari sidebar dan menu avatar; Settings menampilkan zona waktu dan akun.
