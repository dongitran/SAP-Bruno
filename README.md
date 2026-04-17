# sapbruno

Interactive TUI runner for [Bruno](https://www.usebruno.com/) collections with **OAuth2 client_credentials auto-fetch** and pluggable credential providers.

## Why

Bruno's GUI handles OAuth2 nicely, but the [CLI does not yet trigger OAuth flows](https://github.com/usebruno/bruno/issues/4348) — meaning collections that work in the desktop app fail with `401` when run from `bru run` (which breaks CI pipelines). `sapbruno`:

1. Fetches OAuth2 tokens just-in-time before each `bru run`
2. Writes them into the per-environment `.bru` env file
3. Wraps everything in a keyboard-driven TUI so you can pick env → service → suite → file without leaving the terminal
4. Supports a separate "local" mock-user mode (basic auth) for working against a locally running CAP server

It works with **any** Bruno collection — there is no hardcoded folder convention or auth scheme. SAP BTP / xsuaa is just one supported credential provider, configurable via plugins.

## Install

```bash
pnpm add -D sapbruno @usebruno/cli
# or
npm i -D sapbruno @usebruno/cli
```

## Quick start

1. Drop a `sapbruno.config.json` next to your `collections/` folder. See [`examples/sapbruno.config.json`](./examples/sapbruno.config.json).
2. Run `npx sapbruno`.
3. Pick an environment, group, service, and suite. The OAuth token (if needed) is fetched automatically before `bru run` is invoked.

## Configuration

Minimal config — runs against `dev` with credentials from environment variables:

```json
{
  "collections": "./collections",
  "environments": {
    "dev": {
      "auth": { "type": "oauth2-client-credentials" },
      "credentialProvider": {
        "type": "env",
        "tokenUrl": "DEV_TOKEN_URL",
        "clientId": "DEV_CLIENT_ID",
        "clientSecret": "DEV_CLIENT_SECRET"
      }
    }
  }
}
```

### Auth types

| `auth.type`                 | Behavior                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| `oauth2-client-credentials` | Fetch a bearer token via `client_credentials` grant before each run. |
| `basic`                     | Inject `Basic` auth from a local user file (multi-user picker).      |
| `none`                      | Run requests with whatever auth the `.bru` files already define.     |

### Built-in credential providers

| `credentialProvider.type` | Source of `client_id` / `client_secret` / `token_url`                               |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `env`                     | Process environment variables (field names configurable).                           |
| `file`                    | A local JSON file mapping prefix → credentials. Useful for downloaded service keys. |
| `manual`                  | Prompts interactively. Good for one-off/dev usage.                                  |

Third-party providers (e.g. SAP CF/BTP) can be published as separate npm packages — see the [`CredentialProvider` interface](./src/providers/index.ts).

### Variable naming convention

For each service, `sapbruno` writes these vars into the env `.bru` file:

```
{prefix}_oauth_token_url
{prefix}_oauth_client_id
{prefix}_oauth_client_secret
{prefix}_auth_header           # ← Bearer <token>  or  Basic <base64>
```

Reference `{{<prefix>_auth_header}}` in your Bruno requests' `Authorization` header.

The prefix is auto-derived: `{group}_{service_folder}` (lowercased, dashes → underscores). Configure `prefixStrip` to chop a shared prefix off every service folder.

## CLI

```
sapbruno                         # interactive TUI (default)
sapbruno run                     # alias for default
sapbruno token --env dev --prefix <prefix>   # fetch token only (planned)
```

## Roadmap

- [ ] `token` subcommand
- [ ] Authorization Code grant (browser + PKCE)
- [ ] `@sapbruno/cf-btp` provider package — pulls xsuaa creds from `cf curl /v3/apps/{guid}/env`
- [ ] Headless `--non-interactive` mode for CI

## License

MIT
