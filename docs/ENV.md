# Environment Configuration

Complete reference for configuring Waste Buddy Tracker in any environment.

---

## Environment Files

| File | Purpose | Committed? |
|---|---|---|
| `.env.local` | Local overrides (git-ignored) | No |
| `.env.example` | Template (commit this) | Yes |
| `.env.production` | Production overrides | No (set in CI) |

---

## Variables

### Required

| Variable | Description | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJhbGciOi...` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_ENV` | `development` | Environment name: `development`, `staging`, `production` |
| `VITE_APP_VERSION` | package.json version | App version string |
| `VITE_APP_NAME` | `Waste Buddy Tracker` | Display name |
| `VITE_APP_URL` | `http://localhost:8080` | App URL for redirects |
| `VITE_SENTRY_DSN` | (empty) | Sentry DSN for error tracking |
| `VITE_ANALYTICS_ID` | (empty) | Analytics tracking ID |
| `VITE_OFFLINE_ENABLED` | `true` | Enable offline mode |
| `VITE_PUSH_NOTIFICATIONS` | `true` | Enable push notifications |

---

## Setup Guide

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy the **Project URL** and **anon/public key**
4. Run database migrations from `supabase/migrations/`

### 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Then edit:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_APP_ENV=development
```

### 3. Verify

```bash
npm run dev
# App should connect to Supabase without errors
```

---

## Environment Detection

The app detects its environment at runtime:

```typescript
import { APP_CONFIG } from "@/lib/config";
// APP_CONFIG.env → "development" | "staging" | "production"
// APP_CONFIG.isDev → boolean
// APP_CONFIG.isProd → boolean
```

Development-only features (debug tools, verbose logging) are automatically hidden in production.

---

## Secrets Management

### Local Development
- Store secrets in `.env.local` (never commit)
- `.env.local` is in `.gitignore`

### Production (Vercel)
- Set variables in Vercel Dashboard → Settings → Environment Variables
- Use Preview and Production scopes appropriately

### CI/CD (GitHub Actions)
- Store in GitHub Secrets
- Reference in workflow YAML:
  ```yaml
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  ```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `VITE_SUPABASE_URL is not defined` | Ensure `.env.local` exists and the variable is set. Restart dev server. |
| `Invalid API key` | Verify the anon key matches your Supabase project. Check for extra whitespace. |
| RLS errors in dev | Ensure migrations are applied and RLS policies are active. |
| Offline not working | Check `VITE_OFFLINE_ENABLED=true`. Verify service worker is registered. |
| Push notifications not working | HTTPS required. Check browser permissions. |
