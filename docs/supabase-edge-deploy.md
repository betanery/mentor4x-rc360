# Supabase Edge Functions deployment

This repository supports manual deployment of Edge Functions through GitHub Actions without requiring Lovable credits.

## Required GitHub secret

Configure this repository secret before running the workflow:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with permission to deploy Edge Functions to project `fjgdcmtwstmslmbxlsga`.

The Supabase project ref is intentionally stored in the workflow because it is an identifier, not a secret.

## Workflow

Run **Deploy Supabase Edge Functions** manually from GitHub Actions.

Inputs:

- `target = security-hardened`: deploys only `admin-invite`, `admin-list-users`, `ai-action`, `chat`, and `socio-tools`.
- `target = all`: deploys every Edge Function present under `supabase/functions`.
- `confirm`: must be exactly `DEPLOY_PRODUCTION` or the deploy job will not run.

The workflow always checks out `main`, validates the Supabase token by listing remote functions, deploys via the Supabase Management API, and lists the remote function inventory after deployment.

## Production safeguards

- Deployment is manual only; there is no automatic deploy on push or merge.
- The workflow does not run database migrations.
- The workflow does not create or modify Supabase secrets.
- The workflow does not use `--prune`, so remote functions are never deleted automatically.
- Production deploy should only be triggered after `main` has passed validation and the required Supabase secrets are already configured.
