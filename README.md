# Rootpanther frontend

Two applications on two origins, one design system.

| Package | Serves | Dev server |
| --- | --- | --- |
| `apps/app` | Learner App, `app.rootpanther.com`, plus the public pricing, auth and checkout screens | `npm run dev:app`, port 5173 |
| `apps/portal` | Rootpanther Portal, `portal.rootpanther.com`, operators only | `npm run dev:portal`, port 5174 |
| `packages/ui` | Deep Space: tokens, base styles, every shared component, icons, types | imported as `@rootpanther/ui` |

The apps build and deploy independently (`npm run build -w @rootpanther/app`, `npm run build -w @rootpanther/portal`, each to its own `dist`). Neither app defines a colour. Neither app imports the other.

## Quick start

```
npm install
npm run dev:app
npm run dev:portal
npm run typecheck
npm run check:rules
```

React 18, TypeScript, Vite, React Router 6. No CSS framework, no CSS-in-JS, no component library. Runtime dependencies beyond React: `@xterm/xterm` (terminal), `qrcode` (WireGuard and TOTP QR codes). Fonts are vendored in `packages/ui/fonts` (Geist and Geist Mono, variable woff2).

Build switches, all optional:

| Variable | Effect |
| --- | --- |
| `VITE_ROUTER=hash` | Hash routing, for static previews that cannot rewrite paths |
| `VITE_REVIEW=0` | Removes the Review controls (set this for production) |
| `VITE_BASE` | Asset base path |
| `VITE_PORTAL_URL`, `VITE_APP_URL` | Cross-links between the two apps |

## Every page runs standalone

Pages read mock data from `src/mock/` and pass it to presentational components as props. Components never fetch. To wire the real API, replace the mock imports in a page with your data layer; component props and `packages/ui/types.ts` stay the same.

### Component kit

`/kit` in the learner app renders every primitive and product component in `@rootpanther/ui` from props, in both themes. It is linked from the Review panel and is not part of the product navigation.

### Review controls

Development and preview builds show a dashed **Review** button in the bottom right. It is tooling, not product UI, and `VITE_REVIEW=0` removes it. It switches:

- Theme (dark, light).
- Page data state: data, loading, empty, error, plan required (portal: permission denied). The same values work as `?state=loading` and so on in any URL.
- Learner: active lab or none, returning or new learner (Home onboarding variant), operator or learner role (Portal link in the avatar menu), and the impersonation and dunning banners.
- Portal: idle-lock warning and the incident banner.

## Deep Space tokens

`packages/ui/theme.css` is the only file that contains colour values.

- **Section A** is the brief, verbatim: dark on `:root`, light on `[data-theme="light"]`, chrome tokens, spacing, radius, layout.
- **Section B** holds derived tokens the build needs and the brief does not define. They are listed below so they can be reviewed.

| Token | Dark | Light | Why |
| --- | --- | --- | --- |
| `--focus` | `--primary` | `--primary` | Section 12 references `--focus` but section 3 does not define it |
| `--primary-ink` | `--primary` | `#0369a1` | Link text: light `--primary` is 4.1:1 on white |
| `--on-premium` | `--bg-void` | `--on-solid` | White on dark-theme orange is 3.0:1. Dark text is 5.9:1 |
| `--cta-hover` | orange mixed toward `--text-header` | `--premium-hover` | Dark `--premium-hover` with dark text is 4.4:1 |
| `--on-crit`, `--crit-ink` | dark text, lighter crit | white, `--crit` | Danger buttons and danger menu text pass AA |
| Light `--info --med --high --crit` | | `#46618c #7a5700 #9a4507 #b42318` | Inheriting the dark values fails on white |
| Light `--primary-hover --primary-muted --premium-hover`, tints, shadows | | defined | Unset in the brief's light block |
| `--tier-1` to `--tier-4` | `--info --primary --med --high` | same | Path tiers need colour (section 3.5, rule 2); needs confirmation |
| `--chart-1/2/3`, `--chart-grid` | primary, `#a78bfa`, `#94a3b8`, divider | primary, `#7c3aed`, `#64748b`, divider | Categorical series that stay distinct (sky, violet, slate) and clear 3:1 on cards; needs confirmation |
| `--logo-tile --logo-edge --logo-from --logo-to` | | | The mark keeps its dark tile and full gradient on navy chrome |
| `--term-*` | | | The terminal stays dark in both themes |
| `--brand-*` | | | Google, Microsoft, GitHub and Stripe marks keep official colours (section 3.6) |
| `--scrim --hover-wash --press-wash --tint-success --tint-crit --tint-med --shadow-control` | | | Overlays and states |

Contrast for every text and control pair in both themes is computed by `npm run check:contrast` and written to `docs/contrast.md`. `--text-muted` fails AA on dark cards, so it is reserved for placeholders, disabled controls and keyboard hints; secondary information uses `--text-main`.

## The rules, and how they are enforced

The five hard rules from section 3.5, together with the ten non-negotiables in section 0:

1. No glow, neon, pulse or shine, and nothing pill-shaped. Depth comes from the surface ramp and the neutral shadow tokens. Status is a small dot plus coloured text.
2. Colour means something: severity, status, Path tier and one primary CTA. Everything else is neutral.
3. Green is earned: `--success` marks verified or completed states only.
4. Orange is the single warm accent: one primary CTA per surface, and the active-nav accent in light mode.
5. No colour values outside `theme.css`.

`npm run check:rules` (`scripts/check-rules.mjs`) fails the build on: em or en dashes in any source or doc, hex, rgb(), hsl() or named colours outside `theme.css`, radius literals and pill radii, glow shadows, text-shadow and pulse animations, banned marketing words, exclamation marks in UI copy, commented-out code and TODO noise. Run it in CI.

Radius lives on `--r-sm` 4, `--r-md` 8, `--r-lg` 12, `--r-xl` 16. Thin bars use `calc(var(--r-sm) / 2)` so they never become fully rounded. Circles appear only for status dots and radio buttons.

Motion follows section 3.4: 120ms micro-interactions, 90ms press, 180ms view fade, 280ms overlay reveal, 1.2s skeleton shimmer, 0.8s spinner. `prefers-reduced-motion: reduce` disables every animation and transition, and nothing depends on motion to work.

## Adding a page

1. Create `apps/<app>/src/pages/<section>/<Name>Page.tsx` with a default export, and `<section>.css` next to it with a short class prefix unique to the page.
2. Add a lazy route in that app's `App.tsx` inside the shell layout route (or the bare layout for full-screen screens).
3. Compose from `@rootpanther/ui`: `Page`, `PageHeader`, `Card`, `Section`, `DataTable`, the product components. Read props from the component source.
4. Put mock data in `src/mock/` and pass it in as props.
5. Design every state: read `useDataState()` and render loading skeletons, an empty state with its one fixing action, an error with retry, and plan-required or permission-denied where it applies.
6. Add the page to the command palette (`src/shell/commands.ts` in the learner app, `buildCommands` in `PortalShell.tsx`) and, if it is a top-level section, the sidebar.
7. Run `npm run typecheck`, `npm run check:rules`, and look at it in both themes at 1440, 1024 and 390.

`CONVENTIONS.md` has the full checklist used to build every page here.

## Brand assets

`python3 scripts/build_icons.py` regenerates everything in `packages/ui/brand/` from `theme.css` and the claw geometry in `packages/ui/components/Logo.tsx`, and copies favicons into both apps' `public/` folders:

- `lockup-dark.svg`, `lockup-light.svg`, `lockup-on-navy.svg` (wordmark outlined from Geist 600, no font dependency)
- `mark-dark.svg`, `mark-light.svg`, `mark-bare-*.svg`
- `favicon.svg`, `favicon-light.svg`, and PNGs at 16, 32, 180 and 512 for both
- `app-icon.svg`, `app-icon-512.png`, `app-icon-1024.png` (full bleed, for platform masking)

Do not edit generated assets by hand.

## Scripts

| Script | Does |
| --- | --- |
| `scripts/check-rules.mjs` | Enforces the non-negotiable rules across every source and doc |
| `scripts/contrast-report.mjs` | Computes contrast for every token pair in both themes, writes `docs/contrast.md` |
| `scripts/build_icons.py` | Regenerates the lockups, marks, favicons and app icons |
| `scripts/shot.py` | Screenshots one URL at a width, theme and review state |
| `scripts/capture_screens.py` | Captures every screen in both apps, flags overflow and console errors, builds contact sheets |
| `scripts/build_preview.py` | Builds single-file previews of both apps (memory router, everything inlined) for static hosting |

The Python scripts need Playwright with Chromium; `build_icons.py` also needs fonttools, brotli and uharfbuzz.

## Needs a product decision

The brief leaves these open. The build uses the values below as placeholders; confirm or replace them before launch.

- **Path tiers:** the C3 advancement criteria (5 criteria, 3 met in the mock) and the tier colours (`--tier-1` to `--tier-4`).
- **Teams:** the shell and billing support a Team plan ($45 per seat a month, minimum 3 seats, one invoice). Seat management screens are not built.
- **Free tier:** C1 primers, drills, playbooks and Onyx mentor mode at 10 messages a day, no labs.
- **Annual price:** $490 a year, shown as two months free. Trial: card required, first charge on day 8.
- **Fair use:** going past 60 hours costs nothing, never stops a running session, and new launches may queue at busy times. Hours do not roll over.
- **Session limits:** 30-minute idle shutdown, 4-hour maximum life, extendable by 30 or 60 minutes.
- **Dunning:** retries 3 and 6 days after a failure, lab launching pauses after 7 days, progress is always kept.
- **Retention offers:** pause for 1 to 3 months, or 25% off for 3 months. Cancellation takes effect at the end of the paid period.
- **Account security:** lockout after 5 failed attempts for 15 minutes, 30-minute reset links, 24-hour verification links, "trust this browser" for 30 days, 14-day grace before account deletion.
- **Portal:** 15-minute idle lock, IP allowlist shown on the sign-in screen, Walkthrough escalation target of 6%, Onyx latency SLO of 4 seconds.
- **Placeholder contacts and codes:** `billing@rootpanther.com`, coupon `RP-STUDY15`, Terms and Privacy URLs, the tax rate table.
- **Mobile lab view:** desktop only by design (1280px minimum); narrower windows get a notice with a way to continue.
- **Checkout:** the Elements variant uses Rootpanther inputs styled to match. Production should mount Stripe's own iframes in those slots.

## Known limits of the mocks

- Retry buttons clear the error state rather than refetching.
- Refund, delete, impersonation and entitlement changes in the portal change local state, write to the on-page audit trail and show a toast.
- The terminal is a canned shell. Sample security content is kept at the level of tool names, targets and short summaries, with exploitation steps redacted.
