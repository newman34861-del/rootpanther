# Rootpanther frontend deploy

Staging preview of the designer delivery (rootpanther-frontend_v1.zip). Mock data, no
backend yet. Deployed via the Loadstar jump (sealed container has no npm registry).

## Build

Source: design/rootpanther (monorepo, npm workspaces: packages/ui, apps/app, apps/portal).

- npm install: clean (4 dev-tooling audit advisories, not shipped code)
- check-rules.mjs: 174 files clean
- typecheck (tsc): 0 errors
- vite build: app 1.7M, portal 1.1M, main bundle 74 kB gzip

## Azure

Subscription: "Azure subscription 1", tenant 571bd553-fd21-41ae-91ef-7026114bd348.
Resource group: rg-rootpanther-web (westeurope). SEPARATE from lab infra so a lab
teardown can never take the site down. Lab teardown touches lab RGs only.

| App | SWA name | SKU | Default hostname |
|---|---|---|---|
| Learner app | swa-rp-app | Free | jolly-island-05c492203.5.azurestaticapps.net |
| Operator portal | swa-rp-portal | Free | salmon-sand-01b460103.6.azurestaticapps.net |

Each dist carries staticwebapp.config.json: SPA navigationFallback + X-Robots-Tag
noindex,nofollow. Both verified HTTP 200 with the noindex header.

## Pending

- Custom domains: app.rootpanther.com / portal.rootpanther.com. Add CNAMEs to the SWA
  default hostnames, then `az staticwebapp hostname set`. TLS auto-issued.
- Invite-only auth gate applied when custom domains activate (guessable host).
- Rebuild/redeploy on content change: push source to Loadstar, npm run build,
  swa deploy each dist with its token.

Cost posture: Free tier, $0. Lean-first, scales with revenue.
