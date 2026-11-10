# Veritas AI frontend

The React 19 interface for the Veritas AI university demonstration uses Vite 8, Tailwind CSS and Recharts. It calls the Laravel API; Laravel coordinates FastAPI and MySQL. See the [root README](../README.md) for complete installation and the limitations of the analysis.

## Application screens

- **Dashboard:** submit text or an article URL; choose Albanian or English for experimental text classification.
- **Result:** heuristic risk score and explanations, short extractive summary, text statistics, checking suggestions and an optional ML panel for the selected language. Copy the current report or download it as a plain-text `.txt` file. **PDF export is unavailable.**
- **History:** search and filter saved heuristic records, with ten records per page. **CSV exports only the current loaded page**, with the active search/status filters. It does not download all matching pages or the entire database. CSV fields are quoted and potentially executable spreadsheet formulas are escaped.
- **Analytics:** charts and aggregates from stored heuristic results. The dates are the seven most recent dates with analyses, not necessarily seven consecutive calendar days.

`src/App.jsx` handles screen state and lazy-loads the main screens; it does not use a URL router. `src/config.js` centralizes the API base URL, date formatting and heuristic risk presentation. The UI is primarily in Albanian.

## Local setup

Use Node.js compatible with the installed Vite 8 packages and npm; Node 22.21.0 was used for the publication checks. Start Laravel on `127.0.0.1:8001`, FastAPI on `127.0.0.1:5001` and the backend's configured MySQL server before submitting an analysis.

From this directory:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open <http://127.0.0.1:5173>. `vite.config.js` proxies `/api` to `http://127.0.0.1:8001`. The client defaults to `/api/v1`, so the local setup does not require a frontend environment file.

`VITE_API_URL` overrides the API base at build time. It must include the versioned path, for example `https://api.example.com/api/v1`. Values prefixed with `VITE_` are visible in browser assets and must not contain secrets. A frontend API URL is separate from Laravel's private `FASTAPI_URL`.

## Build and checks

```powershell
npm run build
npm run lint
npm run preview -- --host 127.0.0.1
```

The build produces ignored files in `dist/`. Preview serves the built frontend for inspection; the development `/api` proxy is not a production API routing solution. A standalone published build needs an accessible configured API base or a real reverse proxy routing `/api` to Laravel. The application has no dedicated frontend unit or browser test script.

The production build passes in the publication-check environment. Existing lint failures remain in `History.jsx` and `AnalyticsDashboard.jsx` (`react-hooks/set-state-in-effect`) and `Navbar.jsx` (unused `React` import). These findings were preserved to avoid changing the demonstrated application in a documentation/configuration pass.

`npm audit --package-lock-only` performs a read-only dependency audit. On November 9, 2026, it reported 18 affected dependency entries: 12 high, five moderate and one low, including build/development tooling. These findings need review before public deployment; no lockfile changes or automatic fixes were applied in this pass.

Manual integration checks should use a disposable database: submitting an analysis writes both analysis and request-log records. Exercise both text languages, invalid/short input, URL handling, History search/filter/pagination, current-page CSV and the Analytics charts. A successful build does not verify that these services are connected.

## Interpreting results

Heuristics detect implemented style/domain warning signals. A score of zero does not prove truth. The legacy `REAL`/`FAKE` fields in saved records are heuristic classifications, and Analytics does not measure factual accuracy.

The English and Albanian ML models are **experimental statistical classifiers, not fact-checkers**. Their probabilities are not verified facts or calibrated guarantees. ML runs only on eligible text containing at least eight words; URL analysis is heuristic only. If the optional ML result is unavailable, the main heuristic result can still be shown.

The backend does not persist ML output or the full current-result explanation. History is a limited view of saved heuristic fields, with content truncated to 5,000 characters; opening a saved record cannot restore the full live result.

## GitHub publication versus deployment

Publishing this source to GitHub is a code-sharing step. Serving `dist/` alone does not run Laravel, MySQL or FastAPI, and does not secure the API. Before public deployment, address the backend's missing access/rate controls, wildcard CORS, CSRF exemptions, privacy handling and private service isolation. Configure HTTPS and production API routing separately. See the [root deployment limitations](../README.md#github-publication-and-public-deployment).
