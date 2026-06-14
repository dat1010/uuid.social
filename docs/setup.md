# uuid.social Setup

## Stack

- TypeScript for frontend and backend code
- React Router framework mode for pages, loaders, and actions
- Cloudflare Workers for runtime and deploys
- Cloudflare D1 for relational app data
- Cloudflare R2 for profile images
- Terraform for durable Cloudflare resources
- Wrangler for local development, deploys, type generation, and D1 migrations

## Domain

Keep Namecheap as the registrar. Add `uuid.social` to Cloudflare, then set the Namecheap nameservers to the two Cloudflare nameservers Cloudflare gives you.

The primary app URL should be `https://uuid.social`. `www.uuid.social` should redirect to the apex domain.

## First Cloudflare Steps

1. Add `uuid.social` to Cloudflare.
2. Point Namecheap nameservers to Cloudflare.
3. Create a Cloudflare API token with the minimum permissions needed for DNS, D1, R2, and Workers.
4. Copy `infra/terraform.tfvars.example` to `infra/terraform.tfvars`.
5. Fill in the account id and zone id.
6. Run Terraform from `infra/`.
7. Copy the Terraform `d1_database_id` output into `wrangler.jsonc`.
8. Run `npm run db:migrate:remote` after the D1 database exists.

## Local Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Use local D1 while developing:

```bash
npm run db:migrate:local
```
