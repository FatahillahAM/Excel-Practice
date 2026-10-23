# Reconciliation — v0 references vs UX spines

Read-only check of the three v0 templates (`imports/*.zip`, extracted copies) against `DESIGN.md`, `EXPERIENCE.md` and `.memlog.md`. Status: **yes** = in the spines · **partial** = idea landed, concrete detail missing · **replaced** = superseded by a memlog decision or by the chosen render (direction A/B/C) · **dropped** = silently missing · **n/a** = defect in the reference, not to copy.

Spine locations: D = `DESIGN.md`, E = `EXPERIENCE.md` (section names after the letter).

## 1. Login — v0 "Sign In with X" (`app/page.tsx`, `components/login-button.tsx`, `components/welcome-message.tsx`, `app/globals.css`)

User constraint: look only; username + password, no OAuth (memlog decision).

| # | Idea / detail (reference) | Landed? | Where | Recommendation |
|---|---|---|---|---|
| L1 | One centred column `max-w-md`, vertically centred in `min-h-screen` | yes | D Components → Login Card; E Inspiration | — |
| L2 | Small logo on top (32px, `w-8 h-8`) | yes | D Login Card ("logo") | Size not set; use 32px app tile. |
| L3 | Title `text-3xl` bold + grey `text-sm` subtitle | yes | D Login Card (`headline` + muted-foreground) | — |
| L4 | Vertical rhythm: `space-y-8`, title `mt-4`, form `mt-8`, separator `my-8`, footer links `space-x-12` | dropped | — | Low. Adopt 32px stack gap if the builder needs a number. |
| L5 | One button `w-64`, centred | yes | D Login Card ("w-64 → full on phone") | — |
| L6 | Pending: 16px ring spinner (`border-2 border-current border-t-transparent animate-spin`) + label swap ("Connecting...") | yes | E Login Card + State Patterns ("Signing in…") | — |
| L7 | Button `disabled` while pending (no double submit) | yes | E State Patterns (inputs disabled) | State the button is disabled too, so a second Enter doesn't fire twice. |
| L8 | Error text under the button, centred, `text-sm`, red | yes | D Login Card; E State Patterns | Centre-align it, as the reference does. |
| L9 | Error **cleared when the user retries** (`setError(null)` on click) | dropped | — | **Add:** clear the error on resubmit (and when either field is edited). |
| L10 | Cause-specific messages, **all shown in the same inline slot** (auth fail, service fail, popup blocked) | dropped | E Toast rule sends network/server errors to a Toast | **Add:** on Login, show network/server failures inline under the button too, with their own Indonesian message. Login has no app shell, and a toast there gets missed. |
| L11 | User cancelled → no error shown | replaced | OAuth only (CAP-17) | — |
| L12 | Full-width hairline separator | yes | D Login Card | — |
| L13 | Small muted footer links (`text-xs` grey-400 → grey-600 on hover) | partial | D Login Card ("small footer link") | The link **target is never named**. Decide it (e.g. app version or Setup Guide) or remove it. |
| L14 | "How it works" modal: scrim black/50, `Esc` + click-outside close, body scroll lock | dropped | — | Not needed (single user). |
| L15 | Two-layer entrance: column `fade-in` 0.5s ease-in-out with 10px rise; action block `slide-up` 20px 0.4s ease-out | partial | E J0 step 1 ("fades and slides up") | **Add timings:** column 0.5s with 10px rise, form block 0.4s with 20px rise. Use the *cinematic* easing (D Brand & Style); Login has none assigned. |
| L16 | After login the same page swaps to a Welcome card | replaced | memlog: Login → Dashboard; E IA | — |
| L17 | Signed-in visitor sees the welcome state, not the form | dropped | E has only "signed out → redirect to Login" | **Add:** `/login` with a valid session redirects to Dashboard. |
| L18 | "Welcome back, *name*" greeting | dropped | — | Optional: use it as the Dashboard subtitle ("Welcome back, El Zavier"). It fits the Duolingo tone. |
| L19 | OAuth X popup flow | replaced | memlog decision (CAP-17) | — |
| L20 | Monochrome black/white, light background | replaced | Theme 5 Dark Excel | — |
| L21 | Inter/Arial; button radius 4px | replaced | D Typography (system stacks), `rounded.md` 12px | — |
| L22 | Sign out as a quiet text link | replaced | E Sidebar General → Log out | — |

## 2. Dashboard — v0 "Tasko/Donezo" (`app/page.tsx`, `app/globals.css`, `components/dashboard/*.tsx`)

User constraint: structure replaced by Level Journey + big streak (memlog decision). Tasko only defines the shadcn layout and motion vocabulary.

| # | Idea / detail (reference) | Landed? | Where | Recommendation |
|---|---|---|---|---|
| T1 | Fixed 256px sidebar, `border-r`, full height, scrolls on its own | yes | D Layout, `sidebar-width` | — |
| T2 | Groups "Menu"/"General" with 10px uppercase tracked labels | yes | D App Sidebar (`label`) | — |
| T3 | Active item filled primary + coloured shadow (`shadow-primary/20`) | yes | D App Sidebar (`glow-strong` halo) | — |
| T4 | Inactive hover: `bg-secondary` + text to foreground | yes | D App Sidebar (hover `muted`) | — |
| T5 | **Inactive hover nudge `translate-x-1` (4px), 300ms** | dropped | memlog event noted "hover geser kanan"; the spines don't have it | **Add** to E Motion: nav item hover shifts 4px right, 300ms. Skip it for the active item. |
| T6 | Logo hover scale 1.10 | dropped | — | Low; optional. |
| T7 | Nav count badge with `animate-pulse` | replaced | E App Sidebar ("L3", static); pulse kept for the active node and Risk Pill | Keep "L3" static. |
| T8 | Mobile: `Sheet` from the left reusing the same `<Sidebar/>`, `lg:hidden` trigger, `sr-only` "Open menu", scrim black/50 | yes | E Mobile Drawer; D Mobile Drawer (286px from render) | Add the accessible name "Open menu" to the menu button (E Accessibility). |
| T9 | Sheet timing asymmetry: open 500ms / close 300ms | partial | E Motion (Drawer: open 0.4s bouncy) | Make close faster than open (~0.25s, no bounce). |
| T10 | Header search with `⌘F` kbd hint; focus adds primary/10 glow | partial | E Open Questions (Ctrl K scope) | Leave it open. If kept, use the same focus glow token. |
| T11 | Mail + Bell icons, red pulsing notification dot | replaced | memlog: no notifications | — |
| T12 | Header icon buttons hover scale 1.10 | dropped | — | Low; can apply to the Theme Toggle and avatar. |
| T13 | Avatar ring primary/20 → /40 on hover; name + email beside it ≥ sm | replaced | D Header Bar (initials tile "EZ") | — |
| T14 | Page header = title + one-line description + action row | partial | D Typography `headline` | The description line is dropped. Optional greeting or subline per page. |
| T15 | Actions stack full width on phone (`flex-col`, `w-full sm:w-auto`) | partial | Phone Dock 52px, Login w-64 → full | Make this the rule for any Primary Button below `sm`, beyond Dashboard and Login. |
| T16 | Primary button hover scale 1.05 + `shadow-primary/30`, 300ms | replaced | E Motion (lift 2px + 1.03 + glow-soft; press edge) | — |
| T17 | 4 stat cards, first one filled primary as the hero | replaced | memlog: Streak Hero is the hero; 2-up Stat Cards | — |
| T18 | Stat card hover: scale 1.05 + `shadow-2xl`; **arrow chip ↗ rotates 45°** | dropped (arrow); scale replaced | memlog event lists "ikon panah berputar 45°"; the spines don't have it | **Add** the ↗ chip, rotating 45° on hover, to *clickable* cards only (Records Card, History "View all"). It marks navigation; read-only Stat Cards stay without it. |
| T19 | **Hover depends on size:** big content cards = shadow only, no scale; small cards scale; nested items scale 1.02 | dropped | E Motion applies "lift 2px + scale 1.02" to all Cards | **Add:** no scale on large containers (Level Path card, Streak Hero, Results panels). Use the glow border only, because a 640px card at 1.02 jumps. |
| T20 | **One page-wide stagger in reading order:** header 0 → stats 0/100/200/300 → chart 400 → reminders 500 → team 600 → list 700 → progress 800 → app card 900 → timer 1000ms; `slideInUp` 20px 0.5s ease-out | partial | E Motion (24px, 0.55s bouncy, 80ms per item) | **Add orchestration:** one timeline across the header, Level Path (trail draw + node pop) and the rail in rail order, capped at ~1s total. Right now three entrance systems (cards, Streak Hero cinematic, trail) have no defined relative start. |
| T21 | `animation: … forwards` + `animationDelay`: delayed cards flash visible, then jump | n/a (defect) | — | Specify `animation-fill-mode: both` (or start hidden) for every staggered item. |
| T22 | Grid 2/3 + 1/3 | replaced | D Layout (640px map + 1fr rail) | — |
| T23 | Responsive tiers: 1 col → `sm`/`md` 2 col → `lg` 3–4 col | partial | E Responsive ("below lg → one column") | **Add a tablet tier** (`md`–`lg`): rail cards 2-up instead of one long column. |
| T24 | Compact density: page p-3/4/5, gap 12–16, card p-4/p-6, `h-9` buttons, `space-y-0.5` nav | replaced | D spacing tokens from renders (32/20/16, 44px button) | — |
| T25 | Radius base 1rem (cards 16) | yes | D `rounded.lg` 16 | — |
| T26 | Weekly bar chart: 7 bars, radius 12 all corners, `maxBarSize` 60, green gradient | yes | D/E Activity Chart | — |
| T27 | Bar grow `scaleY 0→1` | yes | E Motion "Chart grow" 60ms stagger | — |
| T28 | Hovered bar: `brightness(1.2)` + green drop-shadow | dropped | E Activity Chart (tooltip only) | **Add:** hovered/focused bar brightens with the glow. |
| T29 | Inverted tooltip (foreground bg / background text): bold value + **full day name**; `cursor: transparent` (no grey band) | partial | E Activity Chart ("count tooltip") | **Add:** full day name + count; turn off Recharts' default grey hover band, which shows up on dark. |
| T30 | **Chart footer summary: "Average" + "Peak" (peak in green)** | dropped | — | **Add** a footer line such as "Avg 1.4/day · Peak Wed 4". It's cheap and fits the "dashboard info" decision. |
| T31 | Legend dot in card header; dashed grid; y ticks 0–100 | dropped | — | Low. A count chart needs no y-axis; skip it. |
| T32 | Progress ring counting 0 → 41%, stroke 1000ms ease-out, hatched "pending" legend | replaced | Level Path + Practice Pips (hatch kept for the "next" pip and the UC hatch) | — |
| T33 | Count-up = +1 every 30ms (duration grows with the value) | partial | E Count-up (Streak ~2.2s; others unspecified) | **Add:** a fixed duration (~1s cinematic) for every count-up whatever the value. Never per-step, because a score of 100 would take 3s. |
| T34 | Inverted card (`bg-foreground text-background`) with big mono `HH:MM:SS` | replaced (render) | D Records Card (accent → primary-foreground gradient, mono digits, primary colon) | In light mode the tokens give `#E3F6EB → #FFFFFF`, a near-white card, so the inversion is gone. Keep the dark gradient in light mode, or stop calling it "inverted". |
| T35 | Decorative wave lines at 15% primary on inverted cards | replaced | D Spreadsheet DNA (grid motif) | — |
| T36 | **List rows:** hover `bg-secondary`, icon tile scale 1.1 + rotate 12°, pointer | dropped | E History List / Records / Level Detail rows have no hover | **Add:** clickable rows get a `muted` bg on hover plus a small icon scale. Skip the rotation (playful, optional). |
| T37 | Status pills on soft tints (Completed/In progress/Pending) | yes | D `*-soft` roles, Badge "passed" | — |
| T38 | **Secondary pages** (Tasks, Settings, Help…) enter with one quick `fade-in` 0.2s, 8px drop, no stagger | dropped | E Motion covers Dashboard only | **Add:** History, Records, Tips & Tricks, Setup Guide and Settings use a 0.2s fade. The full stagger is for Dashboard only. |
| T39 | Logout goes through a confirm card (Cancel / Logout) | dropped | E: Log out → Login directly | Optional: confirm only while an attempt is active. This ties to the "Active attempt" Open Question. |
| T40 | Theme persisted (next-themes `storageKey`) | yes | E Theme Toggle ("persists") | — |
| T41 | Light theme default | replaced | memlog: dark default | — |
| T42 | Geist / Geist Mono | replaced | D Typography (system stacks, mono for numbers) | — |
| T43 | Content modules (Reminders, Team, Mobile-app card, Project list, timer controls) | replaced | memlog: own dashboard data | — |

Note: `float`, `shimmer` and `pulse-ring` keyframes exist in Tasko's CSS but nothing uses them, so nothing was lost there. shadcn `Skeleton` (E State Patterns) covers loading. Tasko has no loading, empty or error states at all, and the spines' versions are new.

## 3. Orbit — v0 "orbit animation" (`public/v0-orbit.svg`)

User constraint: orbit centred on the exam-in-progress screen (memlog decision; hint + upload below it).

| # | Idea / detail (reference) | Landed? | Where | Recommendation |
|---|---|---|---|---|
| O1 | 320px square, `viewBox 0 0 100 100` | yes | D `orbit-size` 320; E Orbit Loader | — |
| O2 | Centred on the page as the only focal point | yes | E Orbit Loader | — |
| O3 | Nothing else on screen | replaced | memlog decision: Hint + Upload (+ Timer) below (CAP-4/7/14) | — |
| O4 | 6 concentric hairline rings, stroke 0.3 units (≈1px at 320) | yes | D/E Orbit Loader | — |
| O5 | **Ring radii 49 / 40 / 30 / 20 / 15 / 10** (tighter spacing toward the centre) | dropped | — | **Add** the radii (as % of the 100 viewBox). |
| O6 | **Opacity rises inward:** 2% (r49), 3%, 4%, 4%, 8%, 10% (r10) | partial | "2–10% opacity" (range only) | **Add** the mapping. The centre is brightest, and that is what draws the eye to the logo. |
| O7 | **One dot per ring** | partial | "6 small dots on the rings" | Say one per ring. |
| O8 | **Period per ring:** r49 44s, r40 40s, r30 36s, r20 14s, r15 16s, r10 15s. The outer three are slow, the inner three fast and deliberately out of order so they never line up | partial | "14s–44s" (range only) | **Add** the exact mapping. |
| O9 | **Start angles spread:** 0°, 90°, 180°, 0°, 270°, 90° (no clump at t = 0) | dropped | — | **Add**, or the dots start in a line on first paint. |
| O10 | All clockwise, `linear`, infinite; no easing, no pulse | yes | E Orbit Loader ("no easing, no pulsing") | State "clockwise". |
| O11 | Dot = r 0.75 units (≈5px wide), **solid fill + 0.3 light-grey outline + faint drop shadow** (a pearl bead) | partial | D Orbit Loader ("small foreground dots") | **Add:** ~5px solid `foreground` dot with a `border`-colour hairline outline. Unlike the rings, dots are full opacity. |
| O12 | Centre mark is **tiny and monochrome**: 12×6 units (≈38×19px), static, inside the innermost ring (r10 ≈ 32px radius) | partial | D Orbit Loader (primary logo tile, no size) | **Add size:** logo tile ≤ 40px so it stays inside the r10 ring. The primary-colour tile is a fine adaptation. |
| O13 | Pure CSS inside the SVG, loaded as `<img>`, no JS | dropped | — | **Add implementation note:** inline the SVG as a component. An `<img>` SVG can't read app tokens or the class-based dark/light toggle, and its colours are hard-coded black/white. |
| O14 | `transform-origin: center` works because the transform box is the viewBox, so dots orbit the SVG centre | dropped | — | Keep the viewBox centred at 50,50 with `transform-box: view-box`. Under `fill-box` the dots spin in place and look frozen. |
| O15 | Dot radius set by CSS `r` property | n/a (defect) | — | Set `r` as an attribute. Older Safari ignores CSS `r`, and the dots vanish. |
| O16 | "Waiting room" meaning: calm, slow, minimal while something else works | yes | E Orbit Loader ("Excel is in charge now"); D Brand signature looks | — |

## Counts

| Reference | yes | partial | replaced | dropped | n/a | total |
|---|---|---|---|---|---|---|
| Login | 8 | 2 | 6 | 6 | 0 | 22 |
| Tasko | 10 | 8 | 13 | 11 | 1 | 43 |
| Orbit | 5 | 5 | 1 | 4 | 1 | 16 |

## Worth adding

1. **Login error lifecycle (L9):** clear the inline error on resubmit or field edit; keep the username, clear the password.
2. **Login failures inline (L10):** show network/server errors in the same slot under the button, not as a Toast. Add a distinct Indonesian message.
3. **Signed-in redirect (L17):** `/login` with a live session goes to Dashboard.
4. **Login entrance timings (L15):** column 0.5s fade with 10px rise, form 0.4s with 20px rise, cinematic easing. Also name the footer link or drop it (L13).
5. **Sidebar hover nudge (T5):** inactive nav item shifts 4px right, 300ms.
6. **Entrance orchestration (T20/T21):** one page timeline in reading order (header → Level Path → rail), capped at ~1s. Use `animation-fill-mode: both` so nothing flashes before its delay.
7. **Hover by size (T19):** scale only small clickable cards and nodes. Large containers (Level Path card, Streak Hero, Results) get the glow border only.
8. **↗ arrow chip rotating 45° (T18)** on cards that navigate (Records Card, History "View all").
9. **Row hover (T36):** `muted` bg on clickable History, Records and Level Detail rows.
10. **Activity Chart polish (T28–T30):** Average + Peak footer, tooltip with full day name, no grey hover band, hovered bar brightens.
11. **Fixed count-up duration (T33):** ~1s for every value, never per increment.
12. **Secondary-page entrance (T38):** single 0.2s fade with 8px drop. The stagger stays on Dashboard only.
13. **Tablet tier (T23):** `md`–`lg` shows rail cards 2-up.
14. **Records Card in light mode (T34):** keep the dark gradient so it still reads as inverted.
15. **Drawer close + label (T8/T9):** close ~0.25s with no bounce; menu button named "Open menu".
16. **Orbit geometry (O5–O9):** radii 49/40/30/20/15/10; opacity 2/3/4/4/8/10% (inner brightest); one dot per ring at 44/40/36/14/16/15s; start angles 0/90/180/0/270/90°; clockwise.
17. **Orbit dot + logo sizing (O11/O12):** ~5px solid foreground dots with a hairline outline; centre tile ≤ 40px, inside the r10 ring.
18. **Orbit implementation (O13–O15):** inline SVG component for theming and reduced motion, `transform-box: view-box`, `r` as an attribute.
