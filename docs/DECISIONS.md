# Rootpanther product decisions

Running log of decisions Abe has made, so build and design stay consistent. Newest first.

## 2026-10-16, later

- **Catalogue shows only built scenarios.** Trimmed to four: meridian, tamarack,
  granite, obsidian. The other ten were removed from mock data because the labs are not
  built. Home, Kit and three nav links were repointed so nothing dangles.
  OPEN: `mock/path.ts` (My Path) is still structured around removed scenarios
  (ironwood, kestrel, halcyon). Dead links, not crashes. Needs a demo-data pass.

- **Exam simulations are the prime shelf.** Every exam sim renders as a larger hero row
  at the top of the catalogue, with a premium left accent, so it is the first thing a
  visitor sees. Deliberately uncapped: more exam sims means a longer hero band, separated
  from the rest by a fog divider. (A 2-item cap was tried and rejected.)

- **Catalogue rows read as rack units.** Single-line dense rows, a status accent strip on
  the left edge (neutral / primary when running / success when completed), and a hover
  that slides the row out like pulling a file from a drawer. Honours reduced-motion.

- **Labs page is minimal.** Removed: the Destroyed/Kept panel, the Usage card, the
  Troubleshooting section, the four stat sublabels, the duplicate download. Stat numbers
  are large. Buttons read Download, Extend session, Open terminal, with only Open
  terminal in orange. Troubleshooting is now a small link beside Test connection.
  Open terminal only renders when a session is live.

- **Usage lives on Billing, not Labs.** The Billing usage card gained daily average and
  at-this-rate projection. The "When the allowance runs out" rules block was dropped.

- **OpenVPN switch is complete** across the app, the shared UI and the portal mocks. The
  WireGuard-only mobile QR was removed (an .ovpn with inline certs is too large for a QR).

## 2026-10-16

- **VPN: OpenVPN, full switch.** Drop WireGuard. Exam parity with OSCP is the reason:
  learners get the exact exam workflow (download a profile, `sudo openvpn <file>`).
  Implications: backend provisions an OpenVPN access point per lab (PKI, per-user certs,
  revoke on teardown). Frontend copy and mock data refactored off WireGuard. Loadstar
  lab provisioning targets OpenVPN (no live lab infra right now, so this is a design
  change not a migration).

- **Note feature: build native, do not embed an app.** Best external tool for OSCP+ is
  Obsidian (proprietary, cannot embed). Open-source note apps (Trilium, Joplin, Logseq,
  Standard Notes) are almost all AGPLv3, hostile to a commercial SaaS embed. Decision:
  build the in-product note panel on an MIT editor library (TipTap or Milkdown, or
  CodeMirror 6 for raw markdown), scoped per scenario and per host, with one-click flow
  into the existing Report builder. Store plain markdown so learners can round-trip with
  their own Obsidian vault. Spec folds into the backend/feature design pass.

- **Hosting: Azure Static Web Apps, free tier.** Two SWAs (app, portal) in a dedicated
  resource group rg-rootpanther-web, separate from lab infra. See DEPLOY.md.

- **Custom domains: wire now** (app.rootpanther.com / portal.rootpanther.com), with an
  invite-only auth gate applied when the guessable domains go live. Pending the DNS
  records (need to know where rootpanther.com DNS is managed).

- **UI: dashboards full-width, dense rows where lists are long.** Home is full-width.
  Catalogue is compact single-line rows (shared ScenarioRow component), filters kept.
  Four growing Portal tables paginate at 25 (Fleet running labs, Fleet failed launches,
  Content inventory, Solve board). Short/fixed tables left unpaginated.

## Standing principles

- **Lean infra, scales with revenue.** Free/consumption tiers, scale-to-zero, no idle
  burn before paying load.
- **Tenant isolation is non-negotiable in the backend.** Postgres with row-level
  security scoped by tenant_id, and per-tenant isolation of lab infrastructure.
- **no-AI copy rule is Lantern/OffSec only.** Rootpanther may reference AI spend (e.g.
  operator Portal finance).
