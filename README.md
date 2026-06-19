# uuid.social

[uuid.social](https://uuid.social) is a small social-network experiment where a
random UUID is the only account credential.

There are no emails, passwords, or recovery flows. A new account receives one
UUID, shown once during signup. Losing it means losing access to that account.

## Current Features

- Unique public usernames
- UUID-only signup and login
- One-time UUID reveal with copy support
- Server-side sessions stored in Cloudflare D1
- Public global timeline
- D1-backed records associated with authenticated users
- Public record UUID permalinks
- UUID-addressed replies and record threads
- Logout and protected app routes
- Automatic production deploys from `main`

## Security Model

UUID credentials are generated server-side with `crypto.randomUUID()`. The raw
UUID is never stored in D1. Instead, the Worker stores an HMAC-SHA-256 hash keyed
with the server-only `AUTH_PEPPER` secret.

Successful login exchanges the UUID for an independent 256-bit random session
token. The browser receives that token in an `HttpOnly`, `SameSite=Lax` cookie;
only its SHA-256 hash is stored in D1.

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
- Tailwind CSS
- Wrangler
- GitHub Actions

R2-backed profile images and Terraform-managed infrastructure are planned but
are not active yet.

## Local Development

Requirements:

- Node.js 22
- npm
- A Cloudflare account for remote operations

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

## Verification

```bash
npm run typecheck
npm run build
```

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

Do not rotate or delete the production `AUTH_PEPPER` after accounts exist.
Changing it makes every existing UUID hash unverifiable.

More operational details are in [`docs/setup.md`](docs/setup.md).
