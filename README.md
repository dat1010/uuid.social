# uuid.social

[uuid.social](https://uuid.social) is a small social-network experiment where a
random UUID is the only account credential.

There are no emails, passwords, or recovery flows. A new account receives one
UUID, shown once during signup. Losing it means losing access to that account.

## Current Features

- Unique public usernames
- Public profiles with status, bio, and R2-backed profile images
- UUID-only signup and login
- One-time UUID reveal with copy support
- Server-side sessions stored in Cloudflare D1
- Public global timeline
- D1-backed records associated with authenticated users
- Public record UUID permalinks
- UUID-addressed replies and record threads
- Immutable records that authors can soft-delete
- Daily and weekly UUID bounties with public winner trophies
- Logout and protected app routes
- Automatic production deploys from `main`

Usernames are normalized to lowercase and must contain 3-24 letters, numbers,
underscores, or hyphens. Records and replies are limited to 500 characters.
Profiles support an 80-character status, a 500-character bio, and JPEG, PNG, or
WebP avatars up to 2 MB.

## Security Model

UUID credentials are generated server-side with `crypto.randomUUID()`. The raw
UUID is never stored in D1. Instead, the Worker stores an HMAC-SHA-256 hash keyed
with the server-only `AUTH_PEPPER` secret.

Successful login exchanges the UUID for an independent 256-bit random session
token. The browser receives that token in an `HttpOnly`, `SameSite=Lax` cookie;
only its SHA-256 hash is stored in D1. Sessions expire after 30 days and are
deleted from D1 on logout.

An account credential UUID must never appear in URLs, logs, profile data, or
timeline content. Record UUIDs are separate public identifiers and are
intentionally visible and shareable. Signup, login, and authenticated pages use
`Cache-Control: no-store`.

There is intentionally no account-recovery mechanism.

## Stack

- TypeScript
- React 19 and React Router framework mode
- Cloudflare Workers
- Cloudflare D1
- Drizzle ORM
- Tailwind CSS and daisyUI
- Wrangler
- Vitest
- Terraform
- GitHub Actions

Profile images are stored in Cloudflare R2, while profile metadata lives in D1.

## Local Development

Requirements:

- Node.js 22
- npm
- A Cloudflare account and Wrangler authentication for remote operations only

Install dependencies:

```bash
npm install
```

Create the local secret file:

```bash
cp .dev.vars.example .dev.vars
```

Replace the placeholder with a long random value:

```txt
AUTH_PEPPER=<long-random-secret>
```

Initialize the local D1 database:

```bash
npm run db:migrate:local
```

Start the app:

```bash
npm run dev
```

The local URL is normally `http://localhost:5173`.

Wrangler provides local D1 and R2 emulation, so normal development does not
write to the production database or avatar bucket. Local state is stored under
`.wrangler/`.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

`npm test` runs the Vitest suite once. `typecheck` regenerates Cloudflare and
React Router types before running the TypeScript project build.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local React Router development server |
| `npm test` | Run the Vitest test suite |
| `npm run typecheck` | Generate framework types and type-check the project |
| `npm run build` | Create the production Worker build |
| `npm run preview` | Build and serve the production output locally |
| `npm run cf-typegen` | Regenerate Cloudflare binding types |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |
| `npm run db:migrate:remote` | Apply migrations to the configured remote D1 database |
| `npm run deploy` | Build and deploy the Worker with Wrangler |

## Database Migrations

Create a migration after changing `app/db/schema.ts`:

```bash
npm run db:generate
```

Apply migrations locally:

```bash
npm run db:migrate:local
```

Apply migrations to the production D1 database:

```bash
npm run db:migrate:remote
```

Migration files are committed under `migrations/` and applied in filename
order. Review generated SQL before committing or applying it remotely.

## Project Layout

| Path | Purpose |
| --- | --- |
| `app/routes.ts` | Application route manifest |
| `app/routes/` | React Router pages, loaders, and actions |
| `app/components/` | Shared UI components |
| `app/services/` | Authentication and bounty domain logic |
| `app/db/schema.ts` | Drizzle schema for D1 |
| `workers/app.ts` | Cloudflare Worker entry point and `www` redirect |
| `migrations/` | Ordered D1 SQL migrations |
| `wrangler.jsonc` | Worker routes and D1/R2 bindings |
| `infra/` | Terraform for D1, R2, and DNS resources |
| `docs/setup.md` | Production infrastructure and deployment setup |

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`. The workflow:

1. Installs dependencies with `npm ci`.
2. Runs the TypeScript checks.
3. Applies pending remote D1 migrations.
4. Deploys the Worker to Cloudflare.

GitHub repository secrets:

```txt
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The Cloudflare API token needs account-level permission to edit Workers and D1,
plus read access to the `uuid.social` zone. DNS edit access is required when
custom-domain records change.

Manual deployment is also available:

```bash
npm run deploy
```

For local development, `AUTH_PEPPER` belongs in `.dev.vars`. CLI operations
that need a Cloudflare token can read `CLOUDFLARE_API_TOKEN` from a local
`.env` copied from `.env.example`; neither file should be committed. Production
`AUTH_PEPPER` must be created as a Wrangler secret, not as a plaintext variable
in `wrangler.jsonc`.

Do not rotate or delete the production `AUTH_PEPPER` after accounts exist.
Changing it makes every existing UUID hash unverifiable.

More operational details are in [`docs/setup.md`](docs/setup.md).
