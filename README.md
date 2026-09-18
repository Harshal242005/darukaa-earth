# Darukaa.Earth

> Full-stack geospatial analytics platform for managing and visualising carbon and biodiversity projects.

[![CI/CD](https://github.com/Harshal242005/darukaa-earth/actions/workflows/ci.yml/badge.svg)](https://github.com/Harshal242005/darukaa-earth/actions/workflows/ci.yml)

| | |
|---|---|
| **Live demo** | https://darukaa-earth-gules.vercel.app |
| **API docs (Swagger)** | https://darukaa-api-5e9l.onrender.com/docs |
| **Demo login** | `demo@darukaa.earth` / `demo1234` |

> **Note on first load:** the API runs on Render's free tier, which sleeps after 15 minutes of inactivity. The first request may take up to ~50 seconds while the service wakes. Subsequent requests are fast.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [High-Level Architecture](#high-level-architecture)
- [Database Schema](#database-schema)
- [Local Setup](#local-setup)
- [CI/CD Pipeline](#cicd-pipeline)
- [Code Quality](#code-quality)
- [API Reference](#api-reference)
- [Data Sources & Assumptions](#data-sources--assumptions)
- [Trade-offs](#trade-offs)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Repository Structure](#repository-structure)

---

## Overview

Darukaa.Earth is a dashboard for environmental project teams who need to track carbon sequestration and biodiversity outcomes across geographically distributed sites.

An administrator can create a project, define its physical sites by drawing polygons directly on a satellite map, and then drill into any site to see how its vegetation health, biomass, carbon stock, and species richness have moved over the past 24 months.

The three core user stories from the brief map directly onto the interface:

| User story | Where it lives |
|---|---|
| Create a project and add multiple geographical sites | Dashboard → **+ New Project** → Project detail → **+ Add Site** |
| View all projects and sites on an interactive map | Dashboard map (all sites, all projects) |
| Click a site to view detailed analytics over time | Project detail → click any polygon → analytics panel |

---

## Features

- **JWT authentication** — registration, login, and a `/me` endpoint, with bcrypt-hashed passwords and token expiry
- **Project management** — create and list projects, each showing aggregated site counts and total hectares
- **Geospatial site creation** — draw polygons on a Mapbox satellite basemap; PostGIS computes true geodesic area on save
- **Time-series analytics** — 24 months of per-site metrics covering carbon (tCO₂e), NDVI, above-ground biomass, and species richness
- **Interactive visualisation** — area, line, and column charts rendered with Highcharts, with summary stat cards for totals and trend
- **Spatial querying** — GiST-indexed geometry column supporting fast bounding-box and intersection queries
- **Automated code quality** — Husky + lint-staged run Prettier and Ruff on every commit before it lands
- **Full CI/CD** — GitHub Actions runs lint → test → build, and deploys both halves only when everything passes on `main`

---

## High-Level Architecture

```mermaid
graph LR
  A[React SPA<br/>Vite · Vercel] -->|JWT / REST| B[FastAPI<br/>Docker · Render]
  B --> C[(PostgreSQL 16<br/>+ PostGIS 3.4<br/>Render)]
  A -->|vector tiles| D[Mapbox GL JS]
  E[GitHub Actions] -->|deploy hook| B
  E -->|vercel --prod| A
```

The application is split into a stateless REST API and a single-page frontend. The frontend deploys to Vercel's edge CDN; the backend runs as a container on Render alongside a managed PostGIS instance. The two communicate only over JSON, authenticated by a bearer token.

### Request lifecycle — "draw a polygon, see charts"

This is the path that exercises most of the system:

1. The user clicks **+ Add Site**, which activates Mapbox Draw on the satellite map.
2. They draw a polygon. Mapbox emits a GeoJSON `Polygon`, which is posted to `POST /api/projects/{id}/sites`.
3. FastAPI validates the payload with Pydantic, rejecting any geometry that isn't a polygon.
4. The GeoJSON is converted to a PostGIS geometry and inserted with SRID 4326.
5. PostGIS computes geodesic area via `ST_Area(geom::geography) / 10000`, stored on the row as `area_hectares`.
6. Twenty-four months of deterministic metrics are generated from the site's geometry and inserted into `site_metrics`.
7. The response returns the persisted site with its geometry and centroid; React pushes it into the map's GeoJSON source and the polygon renders immediately.
8. Clicking that polygon calls `GET /api/sites/{id}/analytics`, and Highcharts renders the returned series.

### Why these choices

**FastAPI over Django or Flask.** The service is REST-only with no server-rendered views, so Django's admin, templating, and forms would be dead weight. FastAPI gives automatic OpenAPI documentation at `/docs` — which matters here, since reviewers can inspect and exercise the full API contract without running the frontend — plus Pydantic validation at the boundary and native async support for when Earth Engine calls are added later.

**PostGIS over storing GeoJSON in a JSON column.** Geometry needs to be queryable, not just retrievable. PostGIS provides geodesic area calculation, spatial indexing, and intersection operators that would otherwise have to be reimplemented in application code — badly.

**SPA plus REST API over a monolith.** Separating the two lets each scale and deploy independently, keeps the API reusable for a future mobile client, and makes the contract between layers explicit rather than implicit.

---

## Database Schema

Four tables, deliberately kept minimal.

```
users
  id               SERIAL        PRIMARY KEY
  email            VARCHAR(255)  UNIQUE NOT NULL   -- indexed
  hashed_password  VARCHAR(255)  NOT NULL
  full_name        VARCHAR(255)
  created_at       TIMESTAMPTZ   DEFAULT now()

projects
  id               SERIAL        PRIMARY KEY
  name             VARCHAR(255)  NOT NULL
  description      TEXT
  project_type     VARCHAR(50)                     -- 'carbon' | 'biodiversity' | 'mixed'
  owner_id         INT           FK → users.id ON DELETE CASCADE
  created_at       TIMESTAMPTZ   DEFAULT now()

sites
  id               SERIAL        PRIMARY KEY
  project_id       INT           FK → projects.id ON DELETE CASCADE
  name             VARCHAR(255)  NOT NULL
  geom             GEOMETRY(Polygon, 4326)  NOT NULL
  area_hectares    DOUBLE PRECISION          -- computed at insert
  created_at       TIMESTAMPTZ   DEFAULT now()
  INDEX gix_sites_geom USING GIST (geom)

site_metrics
  id               SERIAL        PRIMARY KEY
  site_id          INT           FK → sites.id ON DELETE CASCADE   -- indexed
  recorded_at      DATE          NOT NULL
  ndvi             DOUBLE PRECISION
  biomass_tonnes   DOUBLE PRECISION
  carbon_tco2e     DOUBLE PRECISION
  species_count    INT
  UNIQUE (site_id, recorded_at)
```

### Relationships

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ SITES : contains
    SITES ||--o{ SITE_METRICS : measured_by
```

### Design decisions

**SRID 4326 (WGS84).** This is the coordinate system Mapbox and GeoJSON both speak natively, so geometry passes through the stack without a reprojection step in either direction. Area calculations cast to `geography` at query time to get metres rather than degrees.

**Denormalised `area_hectares`.** Computing geodesic area on every read would repeat identical work, since geometry is immutable once a site is created. Paying the cost once at write time keeps the dashboard's aggregate queries cheap. If sites become editable, this moves to a trigger or a generated column.

**GiST index on `geom`.** Spatial indexing is what makes bounding-box and intersection queries scale. Without it, every map viewport query degrades to a sequential scan over all geometry.

**`site_metrics` as a separate table rather than JSON on `sites`.** Time series belong in rows. A separate table keeps `(site_id, recorded_at)` indexable, supports range queries and aggregation in SQL, and lets the metric set grow without rewriting site records.

**Cascading deletes throughout.** Deleting a project should not orphan its sites or their metrics. The cascade is declared at the schema level rather than handled in application code, so it holds regardless of how rows are removed.

---

## Local Setup

### Prerequisites

- Docker Desktop (for the PostGIS container)
- Python 3.11+
- Node.js 20+
- Git
- A Mapbox public access token — free at [account.mapbox.com](https://account.mapbox.com)

### 1. Clone and start the database

```bash
git clone https://github.com/Harshal242005/darukaa-earth.git
cd darukaa-earth
docker compose up -d
```

This starts PostgreSQL 16 with PostGIS 3.4 on port 5432.

### 2. Backend

```bash
cd backend
python -m venv .venv

# macOS / Linux
source .venv/bin/activate
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs are then at http://localhost:8000/docs.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
# add your VITE_MAPBOX_TOKEN to .env.local
npm run dev
```

The app runs at http://localhost:5173.

### 4. Install the git hooks

```bash
# from the repository root
npm install
```

This installs Husky and registers the pre-commit hook. Also install Ruff so the Python side of the hook resolves:

```bash
pip install ruff
```

### Environment variables

**`backend/.env`**

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostGIS connection string | `postgresql://darukaa:darukaa@localhost:5432/darukaa` |
| `JWT_SECRET` | Signing key for access tokens | a long random string |
| `JWT_ALGORITHM` | Signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `1440` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |

**`frontend/.env.local`**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend |
| `VITE_MAPBOX_TOKEN` | Mapbox public (`pk.`) token |

### Running the tests

```bash
cd backend
pytest -q
```

---

## CI/CD Pipeline

The workflow lives at `.github/workflows/ci.yml` and runs on every push to `main` and on every pull request targeting it. It is structured as three jobs, with deployment gated behind the first two.

```mermaid
graph LR
  A[Push / PR] --> B[Backend<br/>lint · migrate · test]
  A --> C[Frontend<br/>lint · build]
  B --> D{Both pass<br/>and on main?}
  C --> D
  D -->|yes| E[Deploy<br/>Render + Vercel]
  D -->|no| F[Stop]
```

### Job 1 — Backend

Spins up a `postgis/postgis:16-3.4` service container with a health check, so tests run against real PostGIS rather than a mock or SQLite stand-in. Then:

- installs Python 3.11 with pip caching keyed on `requirements.txt`
- runs `ruff check .` and `ruff format --check .`
- applies migrations with `alembic upgrade head`, which also verifies the migration chain is valid
- runs the pytest suite

Running migrations in CI is deliberate: it catches a broken or non-applying migration before it reaches production, where the same command runs on container start.

### Job 2 — Frontend

- installs Node 20 with npm caching keyed on `package-lock.json`
- verifies formatting with `prettier --check`
- runs ESLint with `--max-warnings=0`, so warnings fail the build rather than accumulating
- runs the production Vite build, which surfaces type and import errors that a dev server would tolerate

### Job 3 — Deploy

Guarded by `needs: [backend, frontend]` and `if: github.ref == 'refs/heads/main'`, so it runs only when both checks pass on a push to the default branch — never on a pull request.

- **Backend:** calls Render's deploy hook, which pulls the new commit, rebuilds the Docker image, and runs `alembic upgrade head` on start before handing over to Uvicorn.
- **Frontend:** deploys to Vercel production via the CLI.

Render's own auto-deploy is switched off so that GitHub Actions remains the single path to production. A commit that fails lint or tests cannot reach the live site.

### Required repository secrets

| Secret | Used for |
|---|---|
| `RENDER_DEPLOY_HOOK` | Triggering the backend deploy |
| `VERCEL_TOKEN` | Vercel CLI authentication |
| `VERCEL_ORG_ID` | Vercel target organisation |
| `VERCEL_PROJECT_ID` | Vercel target project |
| `VITE_API_URL` | Injected into the frontend build |
| `VITE_MAPBOX_TOKEN` | Injected into the frontend build |

---

## Code Quality

Quality is enforced at two points: locally before a commit is created, and again in CI before anything deploys.

### Pre-commit hooks

Husky registers a `pre-commit` hook that runs `lint-staged` against staged files only:

```sh
# .husky/pre-commit
npx lint-staged
```

```json
{
  "frontend/**/*.{js,jsx}": ["prettier --write", "eslint --fix --max-warnings=0"],
  "backend/**/*.py": ["ruff format", "ruff check --fix"],
  "**/*.{json,css,md,yml,yaml}": ["prettier --write"]
}
```

Formatting is applied automatically and re-staged; genuine lint errors abort the commit. Because this operates on staged files rather than the whole tree, it stays fast enough that it never becomes something a developer wants to bypass.

The same checks run in CI in `--check` mode. Local hooks catch problems early and cheaply; CI is the backstop that holds even if someone commits with `--no-verify` or clones without running `npm install`.

### Tooling

| Concern | Tool |
|---|---|
| Python formatting and linting | Ruff (`E`, `F`, `I`, `B`, `UP`, `N`, `SIM` rule sets) |
| JavaScript formatting | Prettier |
| JavaScript linting | ESLint with React and React Hooks plugins |
| Python tests | pytest with FastAPI's `TestClient` |
| Schema migrations | Alembic |

---

## API Reference

All endpoints except registration and login require an `Authorization: Bearer <token>` header. The full interactive specification is at [`/docs`](https://darukaa-api-5e9l.onrender.com/docs).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account, returns an access token |
| `POST` | `/api/auth/login` | Exchange credentials for an access token |
| `GET` | `/api/auth/me` | Current authenticated user |
| `GET` | `/api/projects` | List the caller's projects with site counts and total hectares |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/{id}` | Fetch a single project |
| `DELETE` | `/api/projects/{id}` | Delete a project and cascade to its sites |
| `GET` | `/api/projects/{id}/sites` | Sites belonging to a project, as GeoJSON |
| `POST` | `/api/projects/{id}/sites` | Create a site from a GeoJSON polygon |
| `GET` | `/api/sites` | Every site the caller owns — powers the dashboard map |
| `GET` | `/api/sites/{id}/analytics` | Summary statistics plus the 24-month series |
| `GET` | `/health` | Liveness probe |

Every endpoint scopes its query by the authenticated user's ID, so one account cannot read or modify another's projects.

---

## Data Sources & Assumptions

**The analytics in this application are synthetic, and that is a deliberate choice.**

Each site receives 24 months of metrics generated from a deterministic seed derived from `sha256(site_id:area_hectares)`. The generator applies a sinusoidal seasonal component and a slow upward growth trend to a base NDVI value, then derives biomass from NDVI and site area, carbon from biomass using a 0.47 carbon fraction and the 3.67 CO₂-to-carbon molar ratio, and species richness as a function of vegetation density.

The result is stable across reloads — the same site always produces the same chart — and plausible in shape, without claiming to describe any real ecosystem. Absolute values are illustrative and are not calibrated against field measurements.

In production, NDVI would come from Sentinel-2 imagery through Google Earth Engine, clipped to each site's polygon. The generation logic is isolated behind a single function in `app/analytics.py`, so a real Earth Engine client can replace it without touching the routers, schemas, or frontend. That boundary was the point of structuring it this way.

---

## Trade-offs

**JWT in `localStorage` rather than httpOnly cookies.** The frontend and API sit on different domains (Vercel and Render), which makes cookie-based sessions awkward without a custom domain and shared parent. `localStorage` keeps the auth flow simple and the deployment independent. The cost is XSS exposure — a successful script injection can read the token. For production I would move to httpOnly, `SameSite=Strict` cookies behind a shared domain, with CSRF tokens on mutating requests.

**Synthetic metrics rather than live satellite data.** Real Earth Engine integration requires a service account, quota management, tile caching, and asynchronous job handling for anything beyond a trivial area — realistically a multi-week effort on its own. Within a hackathon timebox, a clean swappable interface demonstrates more architectural judgement than a half-finished integration.

**Denormalised area rather than computed on read.** Discussed under schema design: a write-time cost traded for read-time speed, valid because geometry never changes after creation.

**Monorepo rather than separate repositories.** One repository gives a single coherent commit history, one CI configuration, and the ability to make atomic changes across the stack — useful when an API change and its frontend consumer land together. Separate repositories would make more sense once distinct teams own each half and want independent release cadences.

**No caching layer.** Redis would add operational surface for no benefit at this data volume; the analytics query reads at most 24 rows per site behind an index. The threshold for revisiting would be metric aggregation crossing roughly 100k rows, or P95 latency on analytics endpoints exceeding 500 ms.

**Append-only sites.** Site editing and deletion were scoped out to protect time for the core draw-to-chart flow, which is what the brief's user stories actually describe. The main consequence is the denormalised area assumption above.

---

## Known Limitations

- **Cold starts.** Render's free tier sleeps after 15 minutes idle; the first request afterwards takes roughly 50 seconds.
- **Sites cannot be edited or deleted** once created — they are append-only.
- **The Mapbox token is unrestricted.** In production it would be URL-restricted to the deployed frontend domain in the Mapbox dashboard.
- **The demo account is shared.** Anyone using `demo@darukaa.earth` sees and can add to the same data.
- **Desktop-optimised layout.** The split map-and-panel view on the project detail page does not reflow well below roughly 1024px.
- **Access tokens are long-lived** (24 hours) with no refresh token rotation.

---

## Roadmap

1. Site editing and deletion, with area recomputed by a database trigger
2. Real NDVI ingestion from Sentinel-2 via Google Earth Engine, with a tile cache
3. Multi-user projects with role-based access control
4. Short-lived access tokens plus refresh token rotation
5. Project-level aggregate analytics — carbon across all sites, not just per-site
6. CSV and GeoJSON export for reporting
7. Responsive layout for tablet and mobile

---

## Repository Structure

```
darukaa-earth/
├── .github/workflows/ci.yml      # CI/CD pipeline
├── .husky/pre-commit             # Git hook entry point
├── .prettierrc                   # Shared formatting rules
├── docker-compose.yml            # Local PostGIS
├── package.json                  # Root: Husky + lint-staged only
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, router registration
│   │   ├── config.py             # Pydantic settings from environment
│   │   ├── database.py           # SQLAlchemy engine and session factory
│   │   ├── models.py             # ORM models including PostGIS geometry
│   │   ├── schemas.py            # Pydantic request/response schemas
│   │   ├── security.py           # Password hashing and JWT handling
│   │   ├── analytics.py          # Deterministic metric generation
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── projects.py
│   │       ├── sites.py          # GeoJSON ↔ PostGIS conversion
│   │       └── analytics.py
│   ├── alembic/                  # Migrations, including PostGIS extension
│   ├── tests/                    # pytest suite
│   ├── Dockerfile                # Render deployment image
│   ├── pyproject.toml            # Ruff configuration
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/client.js         # Axios instance with auth interceptors
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── MapView.jsx       # Mapbox GL JS + Draw
    │   │   ├── SiteCharts.jsx    # Highcharts time series
    │   │   ├── StatCard.jsx
    │   │   ├── NewProjectModal.jsx
    │   │   ├── NameSiteModal.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx     # Project list + global map
    │   │   └── ProjectDetail.jsx # Draw sites + analytics panel
    │   └── main.jsx
    ├── vercel.json               # SPA rewrite rules
    ├── vite.config.js
    └── package.json
```

---

Built by Harshal for the Darukaa.Earth Full-Stack Developer Hackathon.