# Veritas AI

Veritas AI is a university demonstration project for examining news text and article URLs. It combines explainable stylistic risk signals with separate experimental English and Albanian machine learning classifiers, presented through a React interface with saved analysis history and analytics.

**Veritas AI does not independently verify facts.** A low heuristic score, a `REAL` label or a high model probability does not establish that an article is true. Use the output to guide further source checking, not as a factual verdict.

## Architecture

```text
React + Vite (:5173)
        | /api/v1 (Vite development proxy)
        v
Laravel API (:8001) ------> MySQL (analysis history and request logs)
        | FASTAPI_URL
        v
FastAPI (:5001)
        +-- Heuristic text/URL analysis
        +-- English TF-IDF + logistic regression (V1)
        +-- Albanian TF-IDF + logistic regression
```

| Component | Responsibility |
| --- | --- |
| [`veritas-frontend/`](veritas-frontend/README.md) | React 19, Vite 8, Tailwind CSS and Recharts; scanner, results, History and Analytics |
| [`veritas-backend/`](veritas-backend/README.md) | Laravel 13 API; validation, Python service calls, MySQL persistence and aggregated queries |
| [`ai-python-service/`](ai-python-service/) | FastAPI, Beautiful Soup article extraction, heuristic signals and two saved scikit-learn pipelines |
| [`docs/ENGLISH_V1_DIAGNOSTICS.md`](docs/ENGLISH_V1_DIAGNOSTICS.md) | English V1 diagnostic methodology, reproducibility details and documented limitations |

The active Laravel endpoints are defined in `veritas-backend/routes/web.php`. The separate `routes/api.php` is not registered by the current bootstrap configuration.

## Features and output

- Text analysis with heuristic risk levels (`LOW`, `UNCERTAIN`, `HIGH`), explanations, word/sentence counts, a short extractive summary and source-checking suggestions.
- HTTP/HTTPS article URL analysis with HTML paragraph extraction and basic domain signals. URL input receives heuristic analysis only.
- Optional English or Albanian ML classification for text containing at least eight words. The language is selected by the user. A missing or failing ML service does not deliberately block the main heuristic analysis.
- Searchable History with status filtering and ten records per page. **History CSV exports only the current loaded page**, respecting its active filters; it is not a complete database export.
- A current-result report can be copied or downloaded as a **plain-text `.txt` file**. **PDF export is unavailable.**
- Analytics based on saved heuristic results, including the seven most recent dates that have analyses, which need not be seven consecutive calendar days.

Heuristic scores measure implemented warning signals, not factual accuracy or ML confidence. The legacy `REAL`/`FAKE` database fields summarize heuristic output. ML probabilities are a separate experimental output, returned with the current analysis and not saved in History. Analytics therefore do not measure ML accuracy.

## Local setup

### Prerequisites

- PHP 8.3 or later compatible with `veritas-backend/composer.lock`, Composer 2, and the PHP extensions required by Composer. The application also uses `pdo_mysql` and `mbstring`.
- A local MySQL installation, a database and a dedicated database user. XAMPP can supply PHP/MySQL on Windows; use the database server available in your installation.
- Node.js compatible with the installed Vite 8 packages (Node 22.21.0 was used for the publication checks) and npm.
- Python with binary packages available for the pinned ML dependencies. The earlier model diagnostics record Python 3.15.2; the publication-check host provides Python 3.12.10. The original complete training environment is not locked, so installation alone is not proof of model compatibility.

The examples below use PowerShell and start each component from the repository root in a separate terminal. On macOS/Linux, use your usual Python launcher and `source .venv/bin/activate` for virtual environment activation.

### 1. Python analysis service

```powershell
cd ai-python-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
python -m uvicorn main:app --host 127.0.0.1 --port 5001
```

If PowerShell activation is restricted, invoke `.\.venv\Scripts\python.exe` directly in place of `python`. FastAPI documentation is available at <http://127.0.0.1:5001/docs>.

Keep both existing model files at their current paths:

- `ai-python-service/english_fake_news_pipeline_v1.pkl`
- `ai-python-service/albanian_fake_news_pipeline.pkl`

Both artifacts record scikit-learn `1.9.1`. `requirements.txt` pins that version and the previously documented joblib `1.6.0`; it declares NumPy for inference/diagnostics and pandas for training/optional dataset diagnostics. Other dependencies use bounded version ranges, not a complete reproducible lock. The original NumPy, SciPy and pandas versions are not recorded. Scikit-learn advises matching the persistence environment and only loading trusted artifacts: see its [model persistence documentation](https://scikit-learn.org/stable/model_persistence.html).

The publication pass successfully installed these requirements in an isolated Python 3.12.10 environment with NumPy 2.5.4, SciPy 1.18.1 and pandas 2.3.3. Dependency consistency checks, both model loads and in-process prediction/validation checks passed. This verifies that tested environment, not every version permitted by the ranges or a reconstruction of the original training environment.

**Do not run training scripts to install or start the application.** They are research utilities, and the Albanian trainer writes to the active model path. The English trainer currently produces a V3 artifact, while the application serves V1. Training CSVs are local, ignored by Git and unnecessary for inference. If either model fails to load, its ML endpoint returns 503; check startup messages and dependency compatibility instead of replacing or retraining it.

### 2. Laravel API and local MySQL

```powershell
cd veritas-backend
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

For a **fresh local installation**, edit your own `.env` and replace `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` placeholders with the database/user you provisioned. The example uses MySQL at `127.0.0.1:3306`, `APP_URL=http://127.0.0.1:8001` and `FASTAPI_URL=http://127.0.0.1:5001`. It deliberately contains no usable credentials or application key. Never commit your real `.env`.

For a new installation only, generate an application key, then initialize the intended local database:

```powershell
php artisan key:generate
php artisan migrate
php artisan config:clear
php artisan route:list --path=api/v1
php artisan serve --host=127.0.0.1 --port=8001
```

These are setup instructions: migrations change the selected database. Review the connection before running them. For an existing demonstrated installation, preserve its `.env`, key and database; do not rerun initialization blindly. Avoid `composer run setup` for preservation checks because it generates a key and runs migrations.

The backend's own Vite assets are separate from the React application. Their optional build is described in the [backend README](veritas-backend/README.md).

### 3. React frontend

```powershell
cd veritas-frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to Laravel at `http://127.0.0.1:8001`; the client defaults to `/api/v1`. `VITE_API_URL` can override the API base at build time. Never put secrets in `VITE_*` variables because they are included in browser assets.

The existing `start-veritas.bat` is a convenience launcher for an already configured Windows installation. It explicitly requires `py -3.15` and uses that interpreter's packages, rather than the virtual environment above. It is not a dependency installer; a busy port is not proof that a service is healthy. Use the manual commands if its interpreter is unavailable.

## Checks and testing

Run from the indicated component directories. These commands do not intentionally modify application data:

```powershell
# veritas-frontend
npm run build
npm run lint

# veritas-backend
composer validate --strict --no-check-publish
composer check-platform-reqs
php artisan route:list --path=api/v1
php vendor/bin/phpunit --do-not-cache-result

# ai-python-service, using the installed Python environment
python -m pip check
python -X utf8 tests/test_edge_cases.py
python -X utf8 tests/test_english.py --model v1
python -X utf8 tests/test_albanian.py
python -X utf8 tests/diagnostics/evaluate_english_v1.py
```

The edge-case script uses FastAPI's in-process TestClient and asserts validation, URL rejection and heuristic behavior without a running server or database. The English/Albanian sample scripts print diagnostic predictions; a successful exit does not mean all examples were classified correctly. Select `--model v1` explicitly: the English sample script defaults to an unversioned local duplicate that is ignored by Git.

The English V1 evaluator runs offline, verifies the model hash and reports performance on its fixed diagnostic cases. Its optional WELFake holdout audit requires the separate local CSV; see the [diagnostics documentation](docs/ENGLISH_V1_DIAGNOSTICS.md) before interpreting those results. Neither diagnostic is an independent, representative fact-checking benchmark.

The publication checks passed all 24 edge-case assertions and nine additional in-process OpenAPI/ML endpoint checks. English sample diagnostics reported two correct and two incorrect classifications; the fixed V1 evaluator reproduced its documented production-threshold matrices. These results demonstrate execution and existing limitations, not verified accuracy. The installed Starlette emits a non-blocking deprecation warning for its httpx-based TestClient; the current tests still pass.

The Laravel tests are starter examples, not full API coverage. Their configuration uses in-memory SQLite with array-backed cache/sessions. The existing feature test expects `/` to return 200, but no root route is registered, so it currently fails with 404. Frontend lint currently reports effect-state errors in `History.jsx` and `AnalyticsDashboard.jsx`, plus an unused React import in `Navbar.jsx`; the frontend production build succeeds. There is no dedicated frontend test script.

Read-only dependency audits can be run with `composer audit --locked` in the backend and `npm audit --package-lock-only` in each JavaScript component. On November 9, 2026, Composer reported 30 advisories affecting eight locked packages, including a critical Laravel advisory. npm reported 18 affected frontend dependency entries (12 high, five moderate, one low) and eight backend dependency entries (two critical, five high, one low). These reports include development tooling and transitive dependencies; they are not proof of exploitability in this application. No automatic dependency updates were applied. Review and remediate these findings before public deployment.

A complete browser/API integration test would create analysis and request-log rows. Such testing must use a disposable database; it is separate from checks that preserve the demonstrated database.

## Known limitations

- Both classifiers are experimental statistical models. Thresholds and probabilities are not independently validated truth assessments. Source/style shortcuts and performance drops on unfamiliar topics or publishers are documented for English V1.
- URL extraction depends on accessible static HTML paragraphs; blocked, JavaScript-rendered or unusual pages may fail. The summary is an extract, not generated research or source corroboration.
- The input limit is 20,000 characters, while saved content is truncated to 5,000 characters. History cannot reconstruct the full original result, explanations or ML output. URL sentence counts may describe the returned sample rather than the complete article.
- History and Analytics are shared across the installation. There are no user accounts or per-user access controls on the active endpoints.
- Dependency ranges are not a full Python environment lock. Preserve trusted model artifacts and verify both load and predict in the environment you install.

## GitHub publication and public deployment

**Publishing source code on GitHub is distinct from deploying a secure public web application.** This repository documents a local university demonstration; uploading it does not supply hosting, authentication, HTTPS, service isolation or production monitoring. GitHub Pages alone cannot run Laravel, MySQL and FastAPI.

Before source publication, review the actual staged files and repository history for credentials and personal data. Existing ignore rules exclude real `.env` files, dependency folders, local datasets and archives, but ignore rules do not remove previously committed material. Confirm permission to distribute the saved model artifacts and any research data. No project-wide license or dataset/model redistribution grant has been established by this pass; third-party dependency licenses do not license the whole project.

Public deployment remains blocked on a separate security review and implementation:

- Active routes have no authentication, authorization or configured application rate limit. The throttle declared in the unregistered `routes/api.php` does not protect them. API routes are exempt from CSRF validation, and CORS currently allows all origins.
- History exposes stored content; request logs include IP addresses and user agents. Establish access controls, retention and privacy handling before public use.
- Keep MySQL and FastAPI private, terminate HTTPS at a production server and restrict outbound article fetching. The current URL checks reject private addresses and recheck redirects, but DNS validation and the subsequent HTTP connection resolve separately; they do not guarantee resistance to DNS rebinding.
- Configure production secrets and a dedicated database user, disable debug output, review dependencies and use production process supervision. `FASTAPI_SETUP.txt` records a previous application-key disclosure; replace affected deployment credentials with a migration plan for encrypted data. Do not publish or reuse disclosed secrets.

The development servers and Vite proxy are local conveniences. A production frontend build needs a real API routing/reverse-proxy plan, and a successful build alone does not resolve the blockers above.
