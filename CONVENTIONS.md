# Building pages in this repo

Read this before writing a page. The Rootpanther design brief is the source of truth for what each screen contains. This file is the source of truth for how to build it.

## Layout of the repo

- `packages/ui`: the Deep Space design system. Tokens in `theme.css`, every shared component, hooks, types, formatters. Import everything from `@rootpanther/ui`. The xterm wrapper is a separate entry: `import { TerminalPane } from "@rootpanther/ui/terminal"`.
- `apps/app`: the learner app (`app.rootpanther.com`), dev server `http://127.0.0.1:5173` (`npm run dev:app`).
- `apps/portal`: the operator portal (`portal.rootpanther.com`), dev server `http://127.0.0.1:5174` (`npm run dev:portal`).

If a shared component is missing something a page needs, add it to `packages/ui` rather than building a page-local copy, so every page gets it. Keep runtime dependencies to the short list in the README.

## Reference implementation

`apps/app/src/pages/home/HomePage.tsx` and `home.css` show the expected quality, structure and state handling. Read them first. Read the component sources in `packages/ui/components/*.tsx` and `packages/ui/product/*.tsx` for exact props before using them.

## Page structure

- Every page file `export default`s its component, lazily routed from the app's `App.tsx`.
- Wrap content in `<Page>` (`width="reading"` for reading pages at 1080px max, `"full"` for tables, dashboards and editors).
- Start with `<PageHeader title=... actions=... crumbs=... meta=...>`. No subtitle sentence under the title. `meta` is only for facts (counts, dates, status).
- Group content with `<Card title actions>` and `<Section title actions>`. Use `Split`, `KeyValue`, `DataTable`, `Tabs`, `Disclosure`, `Callout` and the product components before inventing new ones.
- Page-specific CSS lives next to the page (`labs.css`, imported by the page) with a short class prefix unique to the page (`lb-`, `ct-`, `rb-` and so on). Use only `var(--token)` values from `theme.css` for colour, radius (`--r-sm/md/lg/xl`, or `calc(var(--r-sm) / 2)` for thin bars), shadow and motion. Spacing may use px values on the 4px grid.
- Responsive: desktop first at 1440, check 1280 and 1024. Pages marked [Responsive required] in the brief must work at 768 and 390. Breakpoints: `@media (max-width: 1023px)` and `@media (max-width: 767px)`. No horizontal page scroll; wide tables scroll inside their own container.

## Data and states

- Mock data lives in `src/mock/`, one file per section. Shared mocks (`scenarios.ts`, `account.ts`, `time.ts`) are used across pages, so keep IDs and figures consistent with them. Use the helpers in `mock/time.ts` for dates so relative times stay realistic.
- Sample security content stays at the level of a UI mock: tool names, targets and short output summaries. Exploitation commands appear as redacted placeholders, and secrets as `[redacted]`.
- Components are presentational: page files import mock data and pass it down as props. No fetch calls.
- Every data surface designs all of its states. Read the review state with `useDataState()` from `../../review/review` (values `default | loading | empty | error | denied`, driven by `?state=` in the URL and the Review panel). For each card, table or list on your page:
  - `loading`: skeletons shaped like the real content (`Skeleton`, `SkeletonText`, `DataTable loading`, `KpiTile loading`, `ScenarioCardSkeleton`). Never a lone page spinner.
  - `empty`: one factual line and the single action that fixes it (`EmptyState`).
  - `error`: what failed in plain words and a retry (`ErrorState` with `onRetry`). If a lab failed to provision, say the learner was not charged lab hours.
  - `denied`: for learner pages, a plan-required prompt (`PlanRequired`) that states exactly what the plan includes. For portal pages, a permission-denied state naming the role required.
- Learner review flags (`useReview().flags`): `lab` (`active | none`), `user` (`returning | new`), `role`, `banner`. Respect `lab` wherever an active session matters.

## Shared IDs and URLs

- Active lab session: `ses_4QmX9a` (Meridian). Lab view: `/lab/ses_4QmX9a`.
- Reports: `rep-basalt`, `rep-meridian`, `rep-kestrel`, `rep-halcyon` at `/reports/<id>`. Deep link to a section with `?section=<title>`.
- Debriefs: `deb-basalt`, `deb-meridian-1`, `deb-kestrel`, `deb-halcyon`, `deb-lattice` at `/reports/debriefs/<id>`.
- Catalogue filters in the URL: `?q=&type=&tier=&technique=&os=&status=&sort=` (`type`: `ad-set|standalone|exam-sim`; `tier`: `C1..C4`; `technique`: the `TechniqueFamily` ids). Scenario detail: `/catalogue/<slug>`, brief anchor `#brief`.
- Onyx: `/onyx` (mentor), `/onyx/primers`, `/onyx/drills`, `/onyx/playbooks`, `/onyx/history`. Primer deep link `/onyx/primers?primer=<id>` (ids include `kerberoasting`, `bloodhound`, `delegation`).
- Settings: `/settings/preferences`, `/settings/security`, `/settings/lab-defaults`. Profile: `/account/profile`.
- Billing: `/billing`, `/billing/payment-failed`, `/pricing`, `/checkout?plan=<id>&interval=month|year&mode=hosted|elements`, `/checkout/success`, `/checkout/cancelled`, `/checkout/processing`.
- Auth: `/signin`, `/signup`, `/verify`, `/reset`, `/reset/sent`, `/reset/new`, `/reset/done`, `/2fa`, `/onboarding?step=1|2|3`.
- Portal: `/`, `/users`, `/users/<id>`, `/billing`, `/fleet`, `/content`, `/onyx`, `/finance`, `/system`, `/signin`, `/signin/2fa`. User ids look like `usr_7Hk2pQ`; tenant ids like `rp-t-4qmx9a`.

## Non-negotiable rules (the brief, section 0)

1. No glow, neon, pulse or shine. Depth from the surface ramp and the neutral shadow tokens only.
2. No pills. Nothing fully rounded. Status is a small dot plus coloured text (`StatusDot`). Circles are allowed only for dots and radio buttons.
3. No em dashes or en dashes anywhere: copy, comments, mock data. Use a comma, colon, period or the word "to" for ranges ("2 to 3").
4. No decorative subtitles. If a line carries no information the user needs, delete it.
5. No marketing or AI-sounding copy. Never: seamlessly, effortlessly, unlock, empower, elevate, supercharge. No exclamation marks. Write like CLI help text.
6. Comments only for a non-obvious decision. No commented-out code, no TODOs, no banners.
7. No colour values outside `theme.css`. No hex, rgb(), hsl() or named colours in your files. Use tokens, or `color-mix()` of tokens.
8. One primary (orange) button per surface. Everything else `secondary` or `quiet`.
9. `--success` (green) only for verified or completed states.
10. Every state designed (see above).

Also:

- Secondary text uses `--text-main`. `--text-muted` is only for placeholders, disabled text and decoration, because it fails AA on cards in dark mode.
- Links use `--primary-ink`, not `--primary`.
- Mono (`rp-mono`, `Geist Mono`) for IPs, hostnames, commands, IDs, credentials, money and metric figures in the portal, and machine-value tags. Add `rp-num` for tabular figures.
- Every control is a real `<button>`, `<a>` or `<input>`, reachable by keyboard, with visible focus. Icon-only buttons use `IconButton` with a `label`. Tables have a caption (DataTable `caption`).
- Destructive actions use `ConfirmDialog` (`destructive`, and `requireText` for irreversible ones).
- Async results announce through `useToast()` or a live region.

## Verify your work

Run after every page:

```
npm run typecheck
npm run check:rules
```

Then look at it. With a dev server running, `scripts/shot.py` (Python Playwright) takes screenshots:

```
python3 scripts/shot.py "http://127.0.0.1:5173/labs" shots/labs.png --full
python3 scripts/shot.py "http://127.0.0.1:5173/labs" shots/labs-light.png --theme light --full
python3 scripts/shot.py "http://127.0.0.1:5173/labs?state=loading" shots/labs-loading.png
python3 scripts/shot.py "http://127.0.0.1:5173/labs" shots/labs-390.png --width 390 --height 844 --full
python3 scripts/shot.py "http://127.0.0.1:5174/fleet" shots/fleet.png --storage-key rp-portal-theme --full
```

Options: `--click "<css selector>"` (repeatable) clicks before the shot, `--press Escape` presses keys, `--review '{"lab":"none"}'` sets learner review flags. Console errors print to stdout. `scripts/capture_screens.py OUT_DIR` captures every screen in both apps at a given width and theme, reports horizontal overflow and console errors, and builds contact sheets. Check dark and light, 1440 and the smallest width the page must support, and every state.

## Theme

Learner app pages read and change the theme with `useAppTheme()` from `src/theme.tsx` (`resolved`, `preference`, `setPreference`, `toggle`). Do not call `useTheme()` from the UI package directly in learner pages. Auth screens are always dark: they remove `data-theme` while mounted and restore the stored preference on unmount.
