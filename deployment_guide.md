# 🚀 CRUNCH — Full-Stack Deployment Guide

This guide contains everything required to deploy the CRUNCH Full-Stack application to production cloud infrastructure.

---

## 🔑 Environment Variables Configuration

Create a `.env` file in the root of your cloud hosting environment.

```env
# Node Environment
NODE_ENV=production

# Core API Bindings
PORT=3000
HOST=0.0.0.0

# Google Gemini API Credentials
GEMINI_API_KEY=your_production_gemini_api_key_here

# Google OAuth Credentials (for Calendar Sync)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

*Note: In our preview environment, Google Calendar sync falls back seamlessly to offline "Suggested Schedule Mode" using local storage, protecting the application from crashes if credentials are omitted.*

---

## 🛠️ Production Build & Launch

CRUNCH uses a full-stack configuration where an Express server serves API routes (`/api/*`) and acts as a static file server for compiled React/Vite assets.

### 1. Build Compilation
Run the unified build command:
```bash
npm run build
```
This script executes two compile phases:
1. Compiles React/Vite frontend source into optimized static files inside `/dist`.
2. Bundles the Express `server.ts` entry file into a self-contained CommonJS target (`/dist/server.cjs`) using `esbuild`.

### 2. Standalone Start Command
To launch the production server:
```bash
npm start
```
This executes `node dist/server.cjs`, which:
- Listens on `0.0.0.0:3000`.
- Routes `/api/*` endpoints to active controllers.
- Serves frontend bundles from the physical `/dist` path with fallback single-page routing (`*`).

---

## ☁️ Deployment Targets

### 1. Google Cloud Run (Recommended for full-stack Node container)
Because Cloud Run supports fully containerized Express applications, it is the most stable target.

**Dockerfile Example:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

**Deploy CLI Command:**
```bash
gcloud run deploy crunch-rescue-agent \
  --source . \
  --port 3000 \
  --allow-unauthenticated \
  --set-env-vars=GEMINI_API_KEY=your_key
```

### 2. Vercel Deployment (Serverless API + Frontend assets)
To deploy on Vercel, configure a `vercel.json` file in the root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ]
}
```

---

## 🛡️ Production Security Checklist

- [ ] **HTTPS Routing**: Force all incoming traffic through TLS protocols (Port 443).
- [ ] **Secret Scoping**: Never expose `GEMINI_API_KEY` to the browser. All AI prompts must be proxied through backend `/api/agent/*` controllers.
- [ ] **Auth Token Validation**: Ensure incoming headers carry robust JWT tokens generated during Google sign-in.
- [ ] **Rate Limiting**: Protect Express routes from overload by installing `express-rate-limit` middlewares.
