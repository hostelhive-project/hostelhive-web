# HostelHive Admin Web

React, TypeScript and Vite admin portal for HostelHive. Data is loaded through the existing Redux Toolkit / RTK Query API modules.

## Development

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env` for local configuration. `VITE_API_BASE_URL` points to the backend API, including `/api`; without it the app uses `http://localhost:5000/api`. Vite public variables are visible in the browser; keep server secrets in the backend environment.

## Production deployment

```bash
npm ci
npm run build
```

Set the production `VITE_API_BASE_URL` in the build environment before building. Deploy **only the generated `dist/` directory** to the static host. Configure its SPA fallback to serve `index.html` for application routes such as `/dashboard` and `/rooms`.

The bundle contains reachable application code and assets. Project source, tests, audit reports, AI-tool settings, local caches, `node_modules` and `.env` files are not files to upload to the static hosting directory.

`npm run preview` previews a local build; production hosting should serve `dist/` directly.

## GitHub CI and Vercel deployment

`.github/workflows/web-ci.yml` runs lint and the TypeScript/Vite production build on pushes and pull requests to `main`, and supports manual dispatch. It uses Node 22.22.0 and the committed npm lockfile. The CI API URL is only a build fixture; CI does not call the backend or deploy its output.

`vercel.json` configures Vite, the `dist/` output and SPA deep links. Each Vercel build also runs lint before compiling. Link this repository to Vercel, keep `main` as the production branch, and add **Web checks** as a required GitHub Deployment Check in the Vercel project. Future merges/pushes then run CI and Vercel's native deployment flow without a Vercel token in GitHub.

See [`docs/VERCEL_DEPLOYMENT.md`](./docs/VERCEL_DEPLOYMENT.md) for first deployment, the temporary UI-only release before the backend is hosted, and production API configuration. `.vercel/` and local environment files are excluded from Git and CLI uploads.
