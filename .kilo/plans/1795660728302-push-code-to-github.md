# Plan: Fix Vercel FUNCTION_INVOCATION_FAILED

## Goal
Make the Node/Express Olongapo FixIt app deployable on Vercel without 500 errors on `/favicon.ico` or any route.

## Root causes
1. `src/db.js` opens SQLite at `process.env.DB_FILE || path.join(__dirname,'..','fixit.db')` — the project directory is read-only on Vercel, causing a crash on cold start.
2. `server.js` calls `seed()` at module load and exports an `http.Server` instance; Vercel's Node runtime expects a request-handler function, not a server object.
3. No `vercel.json` routes all requests to the handler; static files may hit the function.
4. No `public/favicon.ico`, so `/favicon.ico` returns 404 JSON or triggers function errors.

## Changes
1. `src/db.js`: use `process.env.DB_FILE || (process.env.VERCEL ? '/tmp/fixit.db' : path.join(__dirname,'..','fixit.db'))`.
2. `server.js`: extract request handler into `handleRequest(req,res)`; export it as `module.exports = handleRequest`; only call `server.listen` when `require.main === module`. Keep `seed()` guarded with try/catch and skip on Vercel if needed (or run once; DB in /tmp persists per instance).
3. Add `vercel.json` with `builds`/`routes` routing all paths to `server.js` (or create `api/index.js` wrapper). Prefer `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [{"src":"server.js","use":"@vercel/node"}],
     "routes": [{"src":"/(.*)","dest":"/server.js"}]
   }
   ```
4. Add a valid `public/favicon.ico` (small valid ICO). Also optionally `app/favicon.ico` not applicable (no Next.js).
5. Ensure env vars documented in `.env.example` (GEMINI_API_KEY, etc.) and configured in Vercel dashboard.

## Validation
- `npm install`
- `npm run build` (no build script; use `node --check server.js` and `node test.js`)
- `node server.js` locally, request `/favicon.ico` returns 200.
- `vercel dev` or deploy and check `/favicon.ico` and `/api/health`.

## Risks
- `/tmp` SQLite is ephemeral per instance; data not persistent across cold starts. For production, recommend external DB, but minimal fix uses /tmp.
- `@xenova/transformers` may be heavy; Vercel function size limits. Could disable image verification via `IMAGE_VERIFY_DISABLED=1` in Vercel env.

## Open questions
- Should we keep demo seed on Vercel? (Recommended: skip seed in production to avoid repeated seeding; but DB in /tmp starts empty each cold start.)
- Should static assets be served by Vercel CDN instead of function? (Recommended: keep simple; all routes to function.)
