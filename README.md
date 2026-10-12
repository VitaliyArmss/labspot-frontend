# LabSlot frontend

React + JavaScript + Vite. The app is published to GitHub Pages at:

`https://vitaliyarmss.github.io/labspot-frontend/`

The production API base URL is stored in `.env.production`:

`https://api.vitaliy-armss.ru/labspot/api`

The Vite base path is set to `/labspot-frontend/` by the GitHub Actions workflow. Local development keeps `/` as its base path.

## Local development

Requires Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The local API URL defaults to `http://localhost:5080/api`; override it with a root `.env` file if needed.

## Publish to GitHub Pages

1. Create a GitHub repository named `labspot-frontend` under `VitaliyArmss`.
2. Upload the contents of this directory to the repository root and push them to the `main` branch.
3. Open repository **Settings → Pages** and choose **GitHub Actions** as the build/deployment source.
4. The workflow in `.github/workflows/deploy.yml` builds `dist/` and publishes it. Each push to `main` triggers a new deployment.
5. Check **Actions** for a green `Deploy frontend to GitHub Pages` run, then open `https://vitaliyarmss.github.io/labspot-frontend/`.

No API secrets belong in the frontend: `VITE_*` variables are embedded in public JavaScript during build.
