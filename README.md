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
- Everyone and Following feeds with pagination and record/reply search
- D1-backed records associated with authenticated users
- Public record UUID permalinks
- UUID-addressed replies and record threads
- Up to four images per record or reply, with alt text and full-size viewing
- Immutable records that authors can soft-delete
- Filterable, paginated specimen collections with a featured specimen on profiles
- Historical bounty archives and preserved winner trophies
- Logout and protected app routes
- Automatic production deploys from `main`

Usernames are normalized to lowercase and must contain 3-24 letters, numbers,
underscores, or hyphens. Records and replies support up to 500 characters and four images; text is optional
when an image is attached.
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

Profile images and record images are stored in separate private Cloudflare R2
buckets. D1 stores metadata. Record images are processed once using the Cloudflare
Images binding, then served from R2 through the application.

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
| `app/services/` | Authentication, feeds, specimens, social features, and historical bounty logic |
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
3. Runs the test suite.
4. Applies pending remote D1 migrations.
5. Deploys the Worker to Cloudflare.

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

## Bounty retirement

The app no longer generates daily or weekly bounties. Existing bounties remain
claimable until their original deadline at `/bounties` or their permanent links.
The archive, earned trophies, claims, and graph connections remain intact.

Migration `0009_add_featured_specimen.sql` adds the optional profile specimen.
Apply it before running this version. Only the owner's active records and replies
can be featured; deleted specimens are automatically hidden from profiles.

Specimen pages return at most 24 identities. Global rarity ordering, filters, and
counts currently read the owner's active record IDs and derive each identity once
per request. Persisting indexed specimen metadata is a future scaling option if
collections grow enough to make that scan expensive.

## Record images

Before deploying this feature, create the private `uuid-social-media` R2 bucket
(the Terraform resource is `cloudflare_r2_bucket.media`) and enable Cloudflare
Images Paid for the account. The existing avatar bucket is unchanged. Do not enable
public bucket access or an `r2.dev` URL. The deployment token must be able to deploy
Workers with the R2 and Images bindings. Migration `0010_add_record_images.sql`
is applied by the deployment workflow before the Worker is deployed.

Uploads accept JPEG, PNG, and WebP, up to 10 MiB and 50 million pixels per image.
The server validates signatures and decodes the image. Images are re-encoded as
static WebP at 800px and 2048px maximum edge lengths, with aspect ratio and
transparency preserved. Source orientation is applied and source metadata is
removed by the encoder. Original files are not retained. Animated files become
still images. HEIC, GIF, SVG, and video uploads are not supported.

Limits are configured in `wrangler.jsonc`: 20 upload attempts per account per UTC
day, 8 pending uploads per account, and 500 attempts globally per UTC day. Failed
and discarded uploads count toward daily quotas because processing may have
incurred cost. Reservations are made atomically before processing. Set the global
limit to `0` to stop new uploads while leaving existing media readable.

Ready uploads expire after 24 hours unless published. A record and its attachments
are published in one D1 batch. Each image belongs to its uploader and can be used
once. Attachment order and descriptions are immutable after publication.

Media routes check record visibility on every request, including ETag requests.
Unpublished uploads are never exposed through media routes. Browsers must
revalidate cached images; no public cache is placed in front of these routes.
Author deletion immediately hides and queues the images for physical deletion.
Moderated records hide their images from the public but retain them for 30 days
so admins can review and restore them. After cleanup, releasing an old moderated
record restores its text only. Account deactivation retains public history,
including images, consistent with the existing account deletion behavior.

The hourly Worker scheduled handler processes up to 100 image removals per run,
retrying failed R2 deletions. It cleans up abandoned uploads and author-deleted
images, and removes moderated images after their retention period. Daily quota
reservations remain through the accounting window. Existing downloads and copies
already saved by viewers cannot be revoked.

Local development uses local D1/R2 and the local Images implementation. Run
`npm run db:migrate:local` before testing. Cloudflare documents differences between
local and production image processing. The installed local encoder ignores EXIF
orientation and uses padded resizing instead of `scale-down`. Local HTTP checks
verify uploads, transparency, metadata removal, and access control; verify
orientation and resize geometry against the production Images service before enabling uploads
for everyone. No account credentials should be placed in source files.
