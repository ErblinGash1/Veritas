# Veritas AI backend

This Laravel 13 component is the API and persistence layer for the Veritas AI university demonstration. The React application is maintained separately in [`../veritas-frontend`](../veritas-frontend/README.md); FastAPI performs the heuristic and experimental ML analysis.

## Request flow and routes

The active routes are closures in `routes/web.php`, registered by `bootstrap/app.php`:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/v1/analyze` | Validate content/type/language, call FastAPI `/predict`, optionally call `/predict-ml-sq` or `/predict-ml-en`, save heuristic output and a request log |
| GET | `/api/v1/history` | Newest-first heuristic records, ten per page; accepts `page`, `search` (up to 200 characters), and legacy `status=REAL` or `status=FAKE` |
| GET | `/api/v1/analytics` | Saved heuristic counts, average heuristic score and the seven most recent dates with analyses |
| GET | `/up` | Laravel framework health endpoint; not a database or ML readiness check |

`routes/api.php` is not currently registered. Its `throttle:10,1` declaration and the controller/request/NLP utility classes do not describe the active analysis flow. The root `/` has no registered page.

Example analysis JSON:

```json
{
  "content": "Paste an article containing at least eight words here.",
  "type": "text",
  "language": "en"
}
```

`type` accepts `text` or `url`; `language` accepts `sq` (default) or `en`. Content must be nonempty and at most 20,000 characters. ML is requested only for eligible text with at least eight words, using the selected language. URL analysis uses heuristics only. A failed optional ML call leaves its result null while the main analysis can still succeed. FastAPI and MySQL must be available for the complete analysis workflow.

The response contains `nlp_analysis`, `ml_sq_analysis` and `ml_en_analysis`. Heuristic output is persisted in `news_analyses`, with content truncated to 5,000 characters. `user_logs` stores the request IP, user agent, endpoint, elapsed time and analysis ID. ML probabilities, explanations and the complete live result are not saved. History cannot reconstruct them.

**All predictions are experimental signals, not verified facts.** Legacy `REAL`/`FAKE`, `is_fake` and `confidence_score` database fields refer to heuristic output; their names do not establish factual truth or classifier accuracy. History and Analytics use that stored heuristic data.

## Local installation

Requirements: PHP compatible with `composer.lock` (the project requires PHP `^8.3`), Composer 2, MySQL, `pdo_mysql`, `mbstring` and the extensions checked by Composer. PHPUnit additionally needs the platform requirements in the development lockfile. Start the Python service at `127.0.0.1:5001` as described in the [root setup guide](../README.md).

From this directory in PowerShell:

```powershell
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Provision a local database and dedicated user, then replace the `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` placeholders in your local `.env`. The example selects MySQL at `127.0.0.1:3306`, `APP_URL=http://127.0.0.1:8001` and `FASTAPI_URL=http://127.0.0.1:5001`. These are local defaults, not production credentials. The FastAPI service entry is top-level in `config/services.php`, accessed as `services.fastapi.url`.

For a new installation only:

```powershell
php artisan key:generate
php artisan migrate
php artisan config:clear
php artisan route:list --path=api/v1
php artisan serve --host=127.0.0.1 --port=8001
```

Migrations initialize the selected database and therefore change data/schema. Review the connection first. Preserve an existing installation's `.env`, key and database. Do not use `composer run setup` as a harmless check: it generates a key and runs migrations. The database-backed session, cache and queue defaults also rely on the supplied migrations.

Use the React frontend on port 5173. Its Vite proxy forwards `/api` to this server on port 8001.

## Checks

```powershell
composer validate --strict --no-check-publish
composer check-platform-reqs
php artisan route:list --path=api/v1
php vendor/bin/phpunit --do-not-cache-result
```

The PHPUnit configuration selects in-memory SQLite and array-backed sessions/cache. Tests are starter examples and do not cover analysis, History or Analytics integration. The unit example passes; the feature example expects `/` to return 200 and currently receives 404 because no root route exists. Use a disposable MySQL database for future end-to-end analysis tests, since the analysis endpoint writes records.

Syntax-check an individual PHP file with `php -l path/to/file.php`. Check dependency/platform compatibility before changing locked versions.

Read-only audits are available with `composer audit --locked` and `npm audit --package-lock-only`. The November 9, 2026 check reported 30 Composer advisories across eight packages (including critical Laravel findings), plus eight affected backend npm dependency entries (two critical). Review these separately before public deployment; the publication pass does not update the lockfiles.

## Backend asset tooling

This directory retains its own `package.json` and `vite.config.js`, separate from the React UI. Its configured scripts are `npm run dev` and `npm run build`; they are not required to serve the active JSON API. To inspect this optional asset build, run `npm ci` followed by `npm run build`.

The retained backend Vite configuration imports `@vitejs/plugin-react`, which is absent from the backend package manifest, and has a development proxy targeting port 8000. This tooling is not the supported React frontend setup. Resolving that optional build configuration is outside the minimal publication pass; use `../veritas-frontend` for the demonstrated UI.

## Publication and deployment limitations

History CSV generation belongs to the React client and exports only its current loaded page. Current-result report downloads are plain text; PDF export is unavailable.

Publishing these files to GitHub does not deploy a secure API. The active endpoints have no authentication, authorization or configured application rate limit; History and Analytics are shared across the installation. CORS permits all origins, and the API paths are exempt from CSRF validation. Do not assume that the throttle in the unregistered API route protects these endpoints.

Before public hosting, implement access and abuse controls, configure HTTPS and production process supervision, disable debug output, isolate FastAPI/MySQL, review URL-fetch egress and define privacy/retention rules for submitted text, IP addresses and user agents. Replace any previously disclosed deployment credentials; the existing `FASTAPI_SETUP.txt` records an earlier application-key disclosure. Keep the real `.env` private. See the [root README](../README.md) for the source-publication and deployment distinction and remaining model limitations.
