# Plan: Remove Vercel-specific code and prepare Olongapo FixIt for Render

## Goal
Make the app deployable as a Node.js web service on Render while preserving all existing functionality.

## Changes

### `server.js`
- Replace guarded seed execution with unconditional `seed();`
- Remove duplicate `module.exports = handleRequest;`
- Keep `module.exports = server;`
- Keep `server.listen(listenPort, ...)` using `PORT = process.env.PORT || 3000`
- No Vercel-specific routing or serverless assumptions

### `src/db.js`
- Use `process.env.DB_FILE || path.join(__dirname, '..', 'fixit.db')`
- Remove `/tmp` Vercel special-case
- Ensure DB directory exists before opening:
  ```js
  const fs = require('fs');
  const dbDir = path.dirname(dbFile);
  if (dbDir && !fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  ```
- Preserve schema/migrations

### Remove Vercel config
- Delete `vercel.json`

### Add `render.yaml`
```yaml
services:
  - type: web
    name: olongapo-fixit
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: GEMINI_API_KEY
        sync: false
      - key: GEMINI_MODEL
        value: gemini-2.5-flash-lite
      - key: DB_FILE
        value: /var/data/fixit.db
```

### `package.json`
- Already has `"start": "node server.js"`; preserve all scripts/deps

## Validation
- `node --check server.js`
- `npm start`
- Test `/`, `/favicon.ico`, `/api/health`
- Verify DB opens and seed does not duplicate records
- Ensure `.env` remains gitignored and no secrets committed

## Render notes
- Configure a persistent disk mounted at `/var/data` for SQLite durability
- Set `GEMINI_API_KEY` in Render dashboard
- Model can be changed if the key does not support `gemini-2.5-flash-lite`
