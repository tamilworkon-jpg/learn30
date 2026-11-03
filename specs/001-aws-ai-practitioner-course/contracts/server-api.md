# Contract: Node server, SQLite storage and login (Phase 13, T188–T193)

**Decisions (learner, 2026-11-02)**: one login = one learner (accounts replace the local "Who's learning?" profiles); a login page with a server session (not the HTTP Basic popup); the server is required to save progress (lessons stay readable when signed out). This supersedes FR-024 ("no login") and the localStorage-only storage rule for progress.

All three parallel streams (server, client, tests) build against THIS document. If something here is wrong or missing, the coordinator changes this file — don't silently diverge.

---

## 1. Runtime

- `site/server/` — TypeScript, run with `tsx` (already a devDependency). **No new runtime dependencies**: HTTP via `node:http`, SQLite via Node 22's built-in `node:sqlite` (`DatabaseSync`), hashing via `node:crypto` (`scrypt`, `randomBytes`, `timingSafeEqual`, `createHash`).
- Entry: `site/server/index.ts`. Scripts in `site/package.json`:
  - `npm start` → `npm run build && tsx server/index.ts` (production-like: build, then serve).
  - `npm run serve` → `tsx server/index.ts` (serve an existing `dist/`).
- Config (env): `PORT` (default 4321), `HOST` (default `127.0.0.1` — this computer only; VS Code port forwarding still works; `HOST=0.0.0.0` opts in to LAN access), `AIP_MAX_USERS` (default 50; total accounts), `AIP_SIGNUPS_PER_HOUR` (default 5; successful sign-ups per IP per hour), `AIP_SCRYPT_N` (default 131072 = 2^17; power of two 2^14–2^18; cost of new password hashes — tests may lower it), `AIP_TRUST_PROXY=1` (key rate limits for loopback peers on the right-most `X-Forwarded-For` entry; off by default), `AIP_DB` (default `site/data/aip.db`; `site/data/` is gitignored), `AIP_DIST` (default `site/dist`), `NODE_ENV=production` → cookies get `Secure` only when the request is HTTPS (`x-forwarded-proto: https` or TLS socket) so http://localhost still works.
- The server serves `dist/` files (correct `Content-Type`, `index.html` for directory paths, 404 page `dist/404.html` if present, ETag/Last-Modified for assets, `Cache-Control: no-store` for HTML). Path traversal must be impossible (resolve + prefix check).
- Security headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: interest-cohort=()`. Pages keep their build-time `<meta>` CSP.

## 2. SQLite schema (`PRAGMA user_version = 1`)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- 3–30 chars: [a-z0-9_.-], stored lower-case
  display_name TEXT NOT NULL,                      -- 1–30 chars, plain text
  pass_hash TEXT NOT NULL,                         -- "scrypt$N$r$p$<salt b64>$<hash b64>"
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                     -- sha256(hex) of the cookie token; raw token never stored
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL                         -- sliding 30 days
);
CREATE TABLE progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  doc TEXT NOT NULL,                               -- Progress JSON, valid per contracts/progress-schema.json
  updated_at TEXT NOT NULL
);
CREATE TABLE ui_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  doc TEXT NOT NULL,                               -- UiState JSON (§4), ≤ 64 KB
  updated_at TEXT NOT NULL
);
```
`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;` A new user's progress is created at sign-up with `startedAt` = now (their course start date).

## 3. Auth

- Passwords: 8–128 chars. `scrypt` (N=2^17, r=8, p=1, 64-byte key, 16-byte random salt, `maxmem` raised accordingly); compare with `timingSafeEqual`. Stored parameters are bounded when parsed (N a power of two in 2^10–2^18, r ≤ 8, p ≤ 4); hashes with a lower N (e.g. the original 16384) still verify and are re-hashed on the next successful login. Password inputs over 1024 chars are rejected without hashing.
- Session cookie: `aip_session=<base64url 32 random bytes>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` (+ `Secure` on HTTPS). Sliding expiry: refresh `expires_at` (and cookie) at most once per hour.
- CSRF: every non-GET `/api/*` request must have `Content-Type: application/json` (or none for empty bodies), header `X-AIP-Request: 1`, and — when an `Origin` header is present — Origin host must equal the request `Host`. Otherwise 403.
- Rate limit (in memory): login and sign-up — max 10 failed attempts per (IP, username) per 15 min and 50 per IP per 15 min → 429 with `Retry-After`. Each attempt is reserved **before** the password check and released on success, so parallel guesses all count. When the TCP peer is loopback (localhost, or a local tunnel / port forwarder through which every client arrives), the per-user bucket is keyed on the username only and the per-IP cap is 200; with `AIP_TRUST_PROXY=1` a loopback peer's right-most `X-Forwarded-For` entry is used as the client IP instead (normal limits). Failed sign-ups (400/409) count as failures.
- Sign-up caps: successful sign-ups max `AIP_SIGNUPS_PER_HOUR` (5) per IP per hour (×4 for loopback peers) → 429 + `Retry-After`; total accounts max `AIP_MAX_USERS` (50) → 403 `{ error, field: 'username' }` with a message naming `AIP_MAX_USERS`.
- Re-verification of the current password (`PATCH /api/me` password change, `DELETE /api/me`): max 10 failures per user per 15 min → 429.
- Display names: 1–30 chars, no control (`Cc`) or invisible format (`Cf`) characters.
- `next` (login redirect): same-site relative paths only, re-checked after URL normalisation (a result starting with `//` or containing `\` → `/`).
- Errors are generic: login failure → 401 `{ "error": "Incorrect username or password." }` (never reveal which part).

## 4. JSON API (all bodies ≤ 1 MB; JSON only; `Cache-Control: no-store`)

| Method + path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/auth/signup` | — | `{ username, password, displayName? }` | 201 `{ user }` + session cookie · 400 `{ error, field }` · 409 username taken · 429 |
| `POST /api/auth/login` | — | `{ username, password }` | 200 `{ user }` + cookie · 401 · 429 |
| `POST /api/auth/logout` | session | — | 204, cookie cleared, session row deleted |
| `GET /api/me` | — | — | 200 `{ user }` or 401 `{ error }` |
| `PATCH /api/me` | session | `{ displayName? , currentPassword?, newPassword? }` | 200 `{ user }` · 400 · 403 wrong current password |
| `DELETE /api/me` | session | `{ password }` | 204 (deletes user + data) · 403 |
| `GET /api/progress` | session | — | 200 `Progress` |
| `PUT /api/progress` | session | `Progress` (validated with the existing Ajv progress validator `src/schemas/generated/validate-progress`) | 204 · 400 `{ error }` · 413 |
| `GET /api/ui` | session | — | 200 `UiState` |
| `PUT /api/ui` | session | `UiState` | 204 · 400 |

`user` = `{ id, username, displayName, createdAt }`.

`UiState` = `{ lessonView?: 'slides' | 'full', sidebar?: 'expanded' | 'collapsed', sections?: 'expanded' | 'collapsed', slides?: { [day: '1'..'30']: { sectionId: string, block: number } } }` — server validates shape/types and size (≤ 64 KB); unknown keys rejected.

Writes are last-write-wins (single learner per account). Unknown `/api/*` → 404 JSON.

## 5. Page bootstrap (no loading flicker, CSP-safe)

For every HTML response the server inserts, immediately before `</head>`:
```html
<script type="application/json" id="aip-bootstrap">{"user":{…}|null,"progress":{…}|null,"ui":{…}|null}</script>
```
JSON-escaped so it cannot break out of the element (`<` → `<`, `>` → `>`, `&` → `&`, U+2028/2029 escaped). `type="application/json"` is never executed, so the strict CSP is unaffected. Signed out → `{"user":null,"progress":null,"ui":null}`.

## 6. Page access

- Public (signed out OK): `/login`, `/signup`, `/day/*`, `/glossary`, `/cheatsheet/*`, `/search`, `/coverage`, `/outline`, static assets (`/_astro/*`, `/diagrams/*`, `/illustrations/*`, `/pagefind/*`, `/scripts/*`, fonts, favicon), `/design/*` (fixtures/mockups).
- Requires sign-in (server 302 → `/login?next=<path>` when signed out): `/`, `/settings`, `/mock/*`.
- Signed-in user visiting `/login` or `/signup` → 302 to `/` (or `next`).
- Signed out on public pages: lessons/quizzes work in memory only, with a banner "Sign in to save your progress" (link to `/login?next=…`); nothing is written to localStorage.

## 7. Client (store + UI)

- `src/lib/progress/store.ts` keeps its synchronous API (`getStore().get()/subscribe()/mutators`), but in the browser the initial state comes from `#aip-bootstrap` (`progress`) and every save does a debounced (≈ 400 ms, flushed on `pagehide` via `fetch(..., { keepalive: true })`) `PUT /api/progress`. Signed out → in-memory only. `createStore(storage, key)` remains for unit tests.
- UI prefs (`aip-ui:lesson-view`, `aip-ui:sidebar`, `aip-ui:sections`, `aip-ui:slide:<day>`) move into `UiState` via a small `src/lib/ui-state.ts` (read from bootstrap, debounced `PUT /api/ui`). The before-paint scripts (`public/scripts/lesson-view.js`, `ui-prefs.js`) read `#aip-bootstrap` instead of localStorage (signed out → defaults, still keep a localStorage fallback for UI prefs only).
- Header: `ProfileMenu` → `AccountMenu`: avatar initials of `displayName`, menu with name/username, "Settings", "Log out" (POST logout → `/login`). Signed out: "Sign in" button.
- Pages `/login` and `/signup` (static Astro pages + small Preact form islands calling the API; `next` param honoured but only for same-site relative paths).
- Settings: "Account" section (display name, change password, delete account with password confirm) replaces "Learners"; schedule (start date) and export/import stay and act on the signed-in learner. First sign-in on a browser that still has old localStorage progress (`aip-course:v1` or profile keys): offer "Import progress saved in this browser" once (uses the existing import validation), then stop offering.
- Local profiles (`profiles.ts`, `keys.ts` profile logic, `ProfileMenu`, `LearnerSettings`) are removed or reduced to the legacy-import helper.

## 8. Tests

- Playwright `webServer`: `npm run build && tsx server/index.ts` with `PORT=$E2E_PORT|4321` and a fresh temp `AIP_DB` per run (deleted at start). `reuseExistingServer: false` (a stale server on the port must never be reused silently).
- `tests/e2e/fixtures.ts` exports `test`/`expect` with an auto-fixture that signs up a **fresh random user per test** (isolation under parallel workers) and stores the cookie in the page context; `seed(page, progress)` becomes `PUT /api/progress` for that user (same signature as today). Specs import `test` from `./fixtures`. Specs for signed-out behaviour opt out (`test.use({ signedIn: false })`).
- New: `tests/unit/server-*.test.ts` (in-process server on an ephemeral port + temp DB: auth flows, CSRF, rate limit, validation, traversal, bootstrap escaping) and `tests/e2e/auth.spec.ts` (sign up, log out, log in, wrong password, protected-page redirect with `next`, progress + slide position survive reload and a second browser context, signed-out banner, legacy import offer, axe on login/signup).
