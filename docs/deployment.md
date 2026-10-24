# Deployment

TabBetter deploys as a single Cloudflare Worker built from tracked source. `scripts/build.sh` embeds the UI, logo and adapters into `dist/server/index.js`; `wrangler.toml` points at that artifact.

## Current state

| Item                | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| Worker name         | `tabbetter`                                                      |
| Cloudflare account  | `yasht2008@gmail.com` (`8d8d8a5a39a42bd0087453f6bc48e375`)        |
| Preview URL         | https://tabbetter.stepsense-dahacks.workers.dev                  |
| Production domain   | `tabbetter.com`, `www.tabbetter.com` (custom domains)            |
| Registrar / DNS     | GoDaddy (`ns47/ns48.domaincontrol.com`) until the zone is moved  |

## Manual deploy

```sh
bash scripts/build.sh
npx wrangler@4 deploy
```

A local OAuth login (`npx wrangler login`) or `CLOUDFLARE_API_TOKEN` is required. Credentials are never committed.

## Continuous deploy

`.github/workflows/deploy.yml` runs the same checks as `Quality`, then publishes on every push to `main` in the `production` environment. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: token with **Workers Scripts: Edit**, **Workers Routes: Edit**, **Account Settings: Read**, **Zone: Read** and **SSL and Certificates: Edit** for the `tabbetter.com` zone.
- `CLOUDFLARE_ACCOUNT_ID`: `8d8d8a5a39a42bd0087453f6bc48e375`.

## Connecting tabbetter.com

Custom domains require the zone to live on the same Cloudflare account. The current OAuth token cannot create zones, so the first step is done once in the dashboard.

1. Cloudflare dashboard, **Add a domain**, enter `tabbetter.com`, choose the Free plan.
2. Replace the GoDaddy nameservers with the two Cloudflare nameservers shown after the scan, then wait for the zone status to become `active`.
3. Deploy with the `routes` block in `wrangler.toml` enabled. Wrangler then creates the apex and `www` custom domains and the proxied DNS records with Cloudflare-managed TLS.
4. Verify:

```sh
curl -sI https://tabbetter.com | head -3
curl -sI https://www.tabbetter.com | head -3
```

Both must return `200` from the Worker, with HTTPS valid. Rollback is `npx wrangler rollback` (or **Deployments** in the dashboard); DNS can be reverted by restoring the GoDaddy nameservers.

Until the zone is active, `wrangler deploy` must be run with the `routes` block commented out, which is why the preview `workers.dev` URL is the only live endpoint.
