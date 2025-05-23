# Changelog

## [3.0.6] - 2025-05-23

- fix: Netlify deployment would fail when creating new sites

## [3.0.5] - 2025-05-14

- avoid warning about wrangler being missing and being installed

## [3.0.4] - 2025-05-14

- fix: Cloudflare would not deploy with uppercase in project name, so we make them lowercase.

## [3.0.3] - 2025-05-12

- Retrieve Github token from app secrets

## [3.0.0] - 2025-05-09

- Add Github as a provider
- Use Infisical to retrieve env vars
- Publish to Cloudflare by default
- Removed heavy Dependencies (like Netlify) for much faster install
- breaking: requires Node 18+

## [2.0.12] - 2025-02-24

- Replaced `hv.dev` with `dept.dev` (endpoint)
