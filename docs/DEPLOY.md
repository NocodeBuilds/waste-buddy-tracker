# Deployment

Production deployment guide for Waste Buddy Tracker.

---

## Table of Contents

1. [Vercel (Recommended)](#vercel)
2. [Netlify](#netlify)
3. [Cloudflare Pages](#cloudflare-pages)
4. [Docker](#docker)
5. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Vercel (Recommended)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/NocodeBuilds/waste-buddy-tracker)

### Manual Setup

1. **Push to GitHub** (already done if you're reading this)

2. **Import in Vercel**
   ```bash
   npx vercel
   ```

3. **Add Environment Variables**
   
   In Vercel Dashboard → Your Project → Settings → Environment Variables:
   
   | Key | Value | Environment |
   |---|---|---|
   | `VITE_SUPABASE_URL` | Your Supabase URL | Production, Preview |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview |
   | `VITE_APP_ENV` | `production` | Production |
   | `VITE_APP_URL` | `https://your-app.vercel.app` | Production |

4. **Deploy**
   ```bash
   # Production deploy
   npx vercel --prod

   # Or push to main branch (auto-deploy if connected)
   git push origin main
   ```

### Vercel Configuration

The project includes `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ]
}
```

### Custom Domain

1. Vercel Dashboard → Project → Settings → Domains
2. Add your domain (e.g., `wastebuddy.app`)
3. Update DNS records as instructed
4. Vercel auto-provisions SSL certificate

---

## Netlify

### `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = true

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    Service-Worker-Allowed = "/"
```

### Deploy

```bash
netlify deploy --prod
```

---

## Cloudflare Pages

### Deploy

1. Connect GitHub repo in Cloudflare Dashboard
2. Build settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: `20`
3. Add environment variables in Dashboard → Settings → Environment Variables

### `_redirects` (placed in `public/`)

```
/*    /index.html   200
/sw.js    /sw.js   200
```

---

## Docker

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `nginx.conf`

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Service Worker
  location /sw.js {
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/";
  }

  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### Build & Run

```bash
docker build -t waste-buddy-tracker .
docker run -p 80:80 waste-buddy-tracker
```

---

## Post-Deployment Checklist

- [ ] App loads correctly at production URL
- [ ] HTTPS is active (required for PWA, service worker, push notifications)
- [ ] Manifest loads: `https://your-app.com/manifest.webmanifest` returns 200
- [ ] Service Worker registers: DevTools → Application → Service Workers
- [ ] Icons load correctly (check manifest icons)
- [ ] Login/signup works
- [ ] Create waste entry → appears in list
- [ ] Create disposal batch → appears in disposal tab
- [ ] 90-day alerts display (create entries past 90 days to test)
- [ ] Analytics charts render
- [ ] PDF report generates
- [ ] CSV export works
- [ ] PWA install prompt appears (Chrome address bar)
- [ ] Offline mode works (disable network, reload page, create entry)
- [ ] Online mode syncs (re-enable network, verify data uploaded)
- [ ] Push notifications request appears (first load)
- [ ] Admin panel accessible with admin role
- [ ] Multi-site switching works (if multiple sites)

---

## Monitoring

### Error Tracking

- **Sentry** (recommended): Add `VITE_SENTRY_DSN` and import `@sentry/react`
- **LogRocket**: Session replay for debugging

### Analytics

- **Vercel Analytics**: Built-in, zero-config
- **Google Analytics**: Add `VITE_ANALYTICS_ID` and gtag script

### Uptime

- **Vercel**: Built-in status monitoring
- **UptimeRobot**: External monitoring with alerts
- **Pingdom**: Advanced uptime + performance

---

## Updating Production

```bash
# 1. Make changes on Revamp branch
git checkout Revamp
# ... make changes ...
git add .
git commit -m "feat: description"
git push origin Revamp

# 2. Merge to main (via PR)
gh pr create --base main --head Revamp
gh pr merge --auto --squash

# 3. Vercel auto-deploys
# Watch at: https://vercel.com/your-org/waste-buddy-tracker
```

---

## Rollback

```bash
# Vercel
vercel rollback

# Or git revert and force push (emergency)
git revert HEAD
git push origin main --force
```
