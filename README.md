# openEO jobdb viewer

A static Vite + React + TypeScript web application for visualising STAC collection items that represent openEO jobs on an OpenLayers map.

## Local development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Default catalogue URL

The default catalogue URL is defined in `/src/state/hash.ts` as `EXAMPLE_COLLECTION_URL`.

## GitHub Pages deployment

This project is configured for GitHub Pages with `.github/workflows/deploy.yml`.

1. Push to `main` or trigger **Deploy static site** manually.
2. In GitHub, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.

The workflow builds with `VITE_BASE_PATH=/${REPOSITORY_NAME}/` so the generated `dist` works under both `/` and `/<repo-name>/`.

## CORS requirement

The target STAC API must send permissive CORS headers, including an `Access-Control-Allow-Origin` header that allows the GitHub Pages origin. Without that header the browser will block requests, and the static app cannot work around it client-side.
