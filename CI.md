# CI / Production Deploy Gate

GitHub Actions workflow: [`.github/workflows/ci.yaml`](./.github/workflows/ci.yaml)

## What runs on every PR and push to `main`

| Job | Checks |
|-----|--------|
| **frontend** | `npm ci` → `npm run typecheck` → `npm run build` |
| **backend** | `pip install` → `compileall` → import `backend.main` |
| **agent-service** | `pip install` → `compileall` → import `agent_service.main` |

All three jobs must pass before production deploy can proceed.

---

## Gate production deploys (recommended setup)

### Step 1 — Disable Render auto-deploy

On **each** Render service (`neurolearn-api`, `neurolearn-agent`, `neurolearn-web`):

1. **Settings** → **Build & Deploy**
2. Turn **Auto-Deploy** → **Off**

Render will only deploy when the CI workflow triggers a deploy hook (after all checks pass).

### Step 2 — Add Render deploy hooks to GitHub Secrets

For each Render service:

1. Render → service → **Settings** → **Deploy Hook** → copy URL
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| GitHub secret | Render service |
|---------------|----------------|
| `RENDER_DEPLOY_HOOK_API` | `neurolearn-api` (or `neurolearn-api-k19o`) |
| `RENDER_DEPLOY_HOOK_AGENT` | `neurolearn-agent` |
| `RENDER_DEPLOY_HOOK_WEB` | Frontend static site |

### Step 3 — Protect `main` branch

GitHub repo → **Settings** → **Branches** → **Add branch protection rule** for `main`:

- [x] **Require a pull request before merging**
- [x] **Require status checks to pass before merging**
  - Select: `Frontend (TypeScript + Vite)`
  - Select: `Backend API (Python)`
  - Select: `Agent Service (Python)`
- [x] **Require branches to be up to date before merging** *(recommended)*

After this, code only reaches `main` when CI passes on the PR. The **Deploy to Render** job runs on push to `main` and triggers deploy hooks.

### Step 4 — (Optional) GitHub `production` environment

The deploy job uses `environment: production`. You can add approval rules under **Settings** → **Environments** → **production** if you want a manual approve step before Render deploys.

---

## Flow diagram

```
PR opened → CI runs (frontend + backend + agent)
                ↓ all pass
         Merge to main
                ↓
    CI runs again on main
                ↓ all pass
    deploy-production job → POST Render deploy hooks
                ↓
         Render builds & deploys
```

---

## Without deploy hooks (simpler, weaker gate)

If you leave **Auto-Deploy ON** in Render and only use branch protection:

- CI must pass on the PR before merge
- Render still auto-deploys immediately when `main` updates

This works if you always merge via PR and never push directly to `main`. For a strict gate, use deploy hooks + auto-deploy off.

---

## Local parity

Run the same checks locally before pushing:

```bash
npm ci && npm run typecheck && npm run build
pip install -r backend/requirements.txt -r agent_service/requirements.txt
python -m compileall backend agent_service
python -c "from backend.main import app; from agent_service.main import app; print('OK')"
```
