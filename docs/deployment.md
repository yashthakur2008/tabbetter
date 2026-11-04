# Deployment

TabBetter is a single Cloudflare Worker built from tracked source. `scripts/build.sh` embeds the UI, logo and adapters into `dist/server/index.js`; `wrangler.toml` points at that artifact.

## Verified production state

Verified on 2026-10-26:

- https://tabbetter.com and https://www.tabbetter.com both return HTTP 200 over valid HTTPS and the TabBetter page title.
- Worker: `tabbetter`, Cloudflare account `8d8d8a5a39a42bd0087453f6bc48e375`.
- Zone: `464a86e7411094552f4be148375d63f6`.
- Registrar: GoDaddy. Authoritative DNS: Cloudflare Free plan.
- Nameservers: `alla.ns.cloudflare.com`, `milan.ns.cloudflare.com`.
- Both hostnames are managed Worker custom domains with Cloudflare certificates.
- The old apex parking A records and www CNAME were replaced. The existing `_dmarc` TXT and `_domainconnect` CNAME were preserved.
- Preview: https://tabbetter.stepsense-dahacks.workers.dev.

## Repository deployment status

The production Worker was deployed manually from repository source. Automatic GitHub deployment is **not enabled yet**:

1. PR #14 contains the deployment configuration and requires one approving review before merge. Branch protection has not been bypassed.
2. `CLOUDFLARE_ACCOUNT_ID` is configured as a repository secret. `CLOUDFLARE_API_TOKEN` still needs to be created and saved.

The proposed `.github/workflows/deploy.yml` checks hygiene, parser tests, build, runtime tests and the deployable artifact before publishing pushes to `main`. Until the token is configured, publishing is skipped with a warning. A successful checks-only run is not evidence of a deployment.

Use a scoped token with Account Workers Scripts Edit and Account Settings Read, plus Zone Workers Routes Edit, Zone Read and SSL and Certificates Edit. Limit account access to the account above and zone access to `tabbetter.com`. Never store the token in the repository or paste it into chat.

## Manual deployment

```sh
bash scripts/build.sh
node --test tests/*.test.mjs
node scripts/validate-artifact.mjs
npx --yes wrangler@4.152.0 deploy
```

Requires an authorized local Wrangler OAuth session or the scoped API token. Keep both custom-domain routes in `wrangler.toml` enabled so deployments preserve production routing.

## Verification and rollback

```sh
curl --fail --show-error https://tabbetter.com/
curl --fail --show-error https://www.tabbetter.com/
dig +short NS tabbetter.com
```

Verify the response is the TabBetter application, not only a 200 status. Both hostnames currently serve the app directly; a canonical www redirect is not configured.

For an application rollback, use `npx --yes wrangler@4.152.0 rollback` or Cloudflare's deployment history. Rollback has not been exercised as part of this launch. Avoid reverting nameservers as an application rollback: that restores the old GoDaddy parking configuration rather than a previous application version.
