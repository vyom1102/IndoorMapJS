# Deploy to Firebase Hosting

This app is a static Vite build. Firebase Hosting serves the `dist` folder.

## Prerequisites

1. [Node.js](https://nodejs.org/) 18+
2. A [Firebase](https://console.firebase.google.com/) project
3. [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
```

## One-time setup

1. **Link your Firebase project** (replace with your project ID from the Firebase console):

```bash
firebase use --add
```

Or edit `.firebaserc` and set `YOUR_FIREBASE_PROJECT_ID` to your real project id.

2. **Environment variables** (API URLs are baked in at build time):

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_BASE_URL=https://your-api.example.com
VITE_API_KEY=your_api_key
```

## Build and deploy

```bash
npm run deploy
```

This runs `npm run build` (includes copying `assets/` into `dist/`) then `firebase deploy --only hosting`.

## URLs after deploy

Your site will be at:

- `https://YOUR_PROJECT_ID.web.app`
- `https://YOUR_PROJECT_ID.firebaseapp.com`

**Venue in the URL:**

- `https://YOUR_PROJECT_ID.web.app/?venue=DelhiMetro`
- `https://YOUR_PROJECT_ID.web.app/DelhiMetro`

## Preview locally (production build)

```bash
npm run build
firebase serve --only hosting
```

Open `http://localhost:5000`

## CI / GitHub Actions (optional)

Set repository secrets `VITE_BASE_URL` and `VITE_API_KEY`, then build before deploy. Do not commit `.env.local`.

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Blank page after refresh on `/VenueName` | `firebase.json` rewrites to `index.html` are required (already configured). |
| API errors | Rebuild after updating `.env.local`; env vars are not read at runtime on Hosting. |
| Missing 3D models / icons | Ensure `npm run build` copies `assets/` to `dist/assets` (see `package.json` build script). |
| Wrong Firebase project | Run `firebase use YOUR_PROJECT_ID` |
