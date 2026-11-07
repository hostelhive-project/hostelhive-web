# HostelHive admin portal: Vercel and GitHub CI/CD

Prepared 7 November 2026 for the existing React/TypeScript/Vite SPA. Backend and mobile deployment are separate. Adding these files locally does not create a Vercel project, publish the site, change GitHub settings or connect an account.

## Initial deployment status (7 November 2026)

- The UI is deployed at **https://hostelhive-web.vercel.app** in the existing **Abu Hurar's projects** Hobby workspace, project `hostelhive-web`.
- Initial production deployment: `dpl_G95pz5AY3yxoddki7VCGgnLngSLa`, source commit `eaf1cfd`, status `READY`. Vercel ran the locked install, lint, TypeScript and Vite build successfully.
- Anonymous HTTP checks returned 200 with the SPA shell for `/`, `/login`, `/register`, `/rooms` and `/admin/stripe/complete`. The JavaScript asset returned 200 and contains the intended temporary API setting. These are hosting/routing checks, not authenticated browser journeys.
- Production and Preview currently use `VITE_API_BASE_URL=https://unconfigured-api.invalid/api`; backend-dependent features are unavailable until Render is deployed and this variable is replaced followed by a rebuild.
- The Vercel GitHub integration is connected to `hostelhive-project/hostelhive-web` with production branch `main`. The **Web checks** GitHub Deployment Check blocks production alias assignment, with a 20-minute deadline. The push of commit `a06ed98` was observed to trigger a production build automatically; check its build and CI outcomes in Vercel/GitHub before relying on a release.
- Build output reported the existing large main chunk and npm audit findings (10 moderate, 5 high). Dependency remediation and end-to-end API verification are not claimed by this deployment.

## First deployment

1. Commit and push the web changes, including `.github/workflows/web-ci.yml`, `vercel.json`, `.vercelignore` and the lint fixes, to this repository's `main` branch. Do not commit `.env`.
2. In GitHub **Actions**, wait for **Web CI / Web checks** to pass. CI installs locked dependencies, runs `npm run lint`, then `npm run build` (TypeScript and Vite). No automated tests currently exist in this web project; this setup does not claim test or browser coverage.
3. Connect the Vercel account and import `hostelhive-project/hostelhive-web` using Vercel's GitHub integration. Select the intended existing account/team without creating a paid plan.
4. Use these project settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework | Vite |
| Root directory | Repository root; this is a separate web repository |
| Node.js version | `22.x` (GitHub CI uses 22.22.0) |
| Install command | `npm ci --include=dev` |
| Build command | `npm run lint && npm run build` |
| Output directory | `dist` |

5. Configure the public `VITE_API_BASE_URL` build variable under Vercel's Production and intended Preview environments. It must be the backend's HTTPS URL including `/api`. Never import the backend `.env` into the web project; `VITE_*` values are publicly bundled into JavaScript.
6. Deploy, record the actual assigned production origin, and configure the CI gate below. Vercel names/domains must be taken from the created project, not assumed available.

### Hosting the UI before Render is ready

The user requested the first web deployment before hosting the backend. This can provide the actual HTTPS admin origin needed by the backend's production validation.

For that initial UI-only deployment, use `VITE_API_BASE_URL=https://unconfigured-api.invalid/api`. This is an intentionally non-resolving placeholder, not a real backend address. It avoids bundling the existing localhost development fallback. The UI can load, but login, registration, OTPs, payments and workspace data cannot function until the backend is connected. This release is not end-to-end verified or ready for real use.

After obtaining the real Vercel origin:

1. Set Render's `CLIENT_WEB_ORIGIN` to that exact origin, without a trailing slash or path.
2. Set Render's Stripe Connect callbacks to that origin plus `/admin/stripe/complete` and `/admin/stripe/refresh`.
3. Complete backend credential/configuration fixes and deploy Render. Keep webhook settlement authoritative.
4. Replace the temporary Vercel API variable with the actual Render HTTPS API URL ending `/api`, then redeploy the web app. Vite reads public variables at build time; changing the variable alone does not update an existing bundle.
5. Check login/registration, a protected direct link, OTP delivery, workspace data and Stripe callbacks against the deployed backend.

## Continuous integration and deployment

The GitHub workflow runs on every push to `main`, pull requests targeting `main`, and manual dispatch. It has a read-only repository token, bounded execution and cancellation of superseded runs. It uses a public placeholder API address only for compilation; it does not contact a backend or publish that CI artifact.

Vercel's connected GitHub integration owns deployment. In Vercel **Project Settings > Deployment Checks**, add the GitHub check named **Web checks** as required. Keep automatic production promotion enabled for `main`. If the check does not appear yet, first complete a GitHub run with this workflow. A manual Actions run runs checks only; pushes to the linked production branch trigger the native deployment flow.

```text
Push/merge to main
  -> GitHub: locked install, lint, TypeScript and Vite build
  -> Vercel: its own lint/build with Production environment
  -> Required Web checks pass
  -> Vercel promotes the production deployment
```

Vercel may build while GitHub checks run; the required Deployment Check controls production promotion. Independently, `vercel.json` runs lint before every Vercel build, so source lint failures also fail the hosting build. Do not add a second CLI/deploy-hook workflow alongside native Git deployment. No `VERCEL_TOKEN` or backend/provider secrets are needed in GitHub for this arrangement.

For pull requests, Vercel's Git integration can create preview deployments using Preview variables. A preview origin must be explicitly allowed by backend CORS before testing browser API calls there; do not allow every `*.vercel.app` origin. Native and GitHub checks do not prove backend reachability or external-provider delivery.

## Routing and deployment files

- `vercel.json` sends application deep links to `index.html`, including `/login`, `/register`, `/dashboard`, `/rooms`, `/legal/:kind` and the Stripe callback routes. Client authentication guards still apply.
- `.vercelignore` keeps local environment files, caches, Git data and development output out of CLI source uploads. `.gitignore` excludes `.vercel/` and `.env` files. Vercel builds source in its build environment and serves `dist/`.
- The current build emits a chunk-size warning for the main bundle. That warning does not fail the TypeScript/Vite build and is separate from deployment correctness.

## Official references

- [Vite on Vercel and SPA rewrites](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)
- [GitHub Deployment Checks on Vercel](https://vercel.com/docs/deployment-checks)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
