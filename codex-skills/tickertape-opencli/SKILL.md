---
name: tickertape-opencli
description: Work with the unofficial Tickertape OpenCLI plugin. Use when Codex needs to run, test, publish, explain, or modify `opencli-plugin-tickertape`; inspect Tickertape command behavior; verify public smoke checks; or keep account-backed Tickertape reads safe and read-only.
---

# Tickertape OpenCLI

## Orient First

- Locate the plugin repo. If this skill lives inside the repo, the repo root is usually two directories above this file. Otherwise use the user's current checkout.
- Read `README.md` for user-facing behavior and `STRATEGY.md` for endpoint/auth posture before changing command behavior.
- Treat Tickertape as an unofficial, changing web/API surface. Verify live behavior before claiming current support.

## Safety Rules

- Keep the plugin read-oriented.
- Do not add watchlist, saved-screen, order, trade, account-mutating, or destructive commands without explicit user approval and a separate confirmation flow.
- Do not ask for, print, store, or commit Tickertape passwords, cookies, tokens, or browser session data.
- Respect Tickertape's terms, account limits, and rate limits.
- Present outputs as research assistance, not investment advice.

## Command Groups

Public commands normally do not require a logged-in browser session:

- `tickertape search <query>`
- `tickertape quote <sid[,sid]>`
- `tickertape info <sid>`
- `tickertape filters`
- `tickertape prebuilt-screens`
- `tickertape screen <id>`
- `tickertape screener` when using public fields
- `tickertape financials <sid>`
- `tickertape events <sid>`
- `tickertape news-events [sid]`
- `tickertape stock-feed <sid>`
- US commands: `us-info`, `us-quote`, `us-financials`, `us-filters`, `us-prebuilt-screens`, `us-screen`, `us-screener`

Account-backed commands use the user's existing browser session through OpenCLI:

- `tickertape login`
- `tickertape screens`
- `tickertape watchlist`
- `tickertape peers <sid>` for Pro tabs such as forecast
- `tickertape screener` or `tickertape screen` when Pro fields/screens are requested

## Validation

Run deterministic tests after code changes:

```bash
npm test
```

Run live public smoke checks before release claims:

```bash
npm run smoke:public
```

Check package contents before publishing:

```bash
npm pack --dry-run --json
```

Expected package hygiene:

- no `node_modules`
- no local `reports`
- no cookies, tokens, credentials, or `.env`
- README, LICENSE, STRATEGY, manifest, package metadata, and runtime `.js` commands included

## Common Fix Pattern

When a command stops returning rows:

1. Reproduce with the OpenCLI command and `-f json`.
2. Fetch the underlying endpoint directly only if needed.
3. Compare the live response shape with the mapper in the command file.
4. Add or update a focused mapper test before claiming the fix.
5. Rerun `npm test` and the smallest relevant live smoke command.

## Release Posture

For public release, frame the project as:

> Unofficial OpenCLI plugin for Tickertape. Beta-quality, read-oriented, useful for research workflows, and not affiliated with Tickertape.

Use version `0.1.x` until command coverage, account-backed checks, and endpoint stability have more history.
