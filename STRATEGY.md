# Tickertape Adapter Strategy

## Release Posture

This is an unofficial OpenCLI plugin. The first public release should be framed as `0.1.x` beta: useful for read-only research, not guaranteed stable against Tickertape endpoint changes, and not investment advice.

Release checks:
- `npm test` for shape/regression tests.
- `npm run smoke:public` for live public endpoints.
- Browser-backed Pro commands should be checked manually with a logged-in Tickertape session before claiming account-level coverage.

## Public Market Data

Strategy: PUBLIC_API

Contract: stable enough for a local adapter. The website itself calls public JSON endpoints and Node-side replay returns 200 JSON with target data.

Evidence:
- `GET https://api.tickertape.in/search?text=reliance` returns stock search rows with `sid`, `ticker`, `quote`, and `slug`.
- `GET https://quotes-api.tickertape.in/quotes?sids=RELI` returns quote rows.
- `GET https://api.tickertape.in/stocks/info/RELI` returns stock profile and ratios.
- `POST https://api.tickertape.in/screener/query` returns screener results from a JSON body containing `match`, `project`, `sortBy`, `sortOrder`, `offset`, and `count`. Public fields work anonymously; Pro fields require the browser-authenticated wrapper.
- `GET https://api.tickertape.in/screener/filters`, `/screener/universes`, and `/screener/v2/prebuilt` return filter and screen metadata.
- `GET https://api.tickertape.in/stocks/corporates/{announcements,actions,dividends,legal}/RELI` returns events JSON.
- `GET https://api.tickertape.in/stocks/financials/{income,balancesheet,cashflow}/RELI/{annual,interim}/normal` returns statement rows.

## Financial Statements

Strategy: PUBLIC_API

Contract: stable JSON API. The stock page still includes statement rows in `__NEXT_DATA__`, but the CLI uses the financials API because it is faster and less brittle.

Evidence:
- `GET /stocks/financials/income/RELI/annual/normal` returns FY income rows.
- `GET /stocks/financials/balancesheet/RELI/annual/normal` returns balance sheet rows.
- `GET /stocks/financials/cashflow/RELI/annual/normal` returns cash flow rows.

## US Screener

Strategy: PUBLIC_API

Contract: internal-but-stable-enough public JSON used by the visible Tickertape US screener route.

Evidence:
- `opencli browser ttus analyze https://www.tickertape.in/screener/home/us-stocks` classified the route as SSR/Next state with a `__NEXT_DATA__` React Query key for `US_SCREENER_PREBUILT_V2`.
- The app bundle maps US screener routes to `https://ecosystem.api.tickertape.in/screener/US/security/*`.
- `GET /screener/US/security/v2/prebuilt` returns the US ready-made screen catalog.
- `GET /screener/US/security/filters` returns US filter metadata under `data.filters`.
- `POST /screener/US/security/query` returns non-empty US stock rows for both ready-made screen queries and custom filter JSON.
- The root `https://api.tickertape.in/screener/query` endpoint is not used for US screens because replaying US payloads there returns empty rows; root `/screener/v2/prebuilt?market=US` also returns Indian-style screen data.

Auth: none for public US screen metadata and public custom filter queries. Pro-gated US fields, if Tickertape adds them, should use the same Browser Bridge cookie pattern as Indian Pro screener reads.

## Pro Account Reads

Strategy: COOKIE_API through Browser Bridge.

Evidence:
- Browser Bridge profile is logged in and premium.
- Redux state exposes premium status, filter catalogs, saved-screen state, watchlist state, and current screener session state.
- App request wrapper adds `x-csrf-token` from the `x-csrf-token-tickertape-prod` cookie, `accept-version: 8.14.0` for root APIs, and `accept-version: 8.0.0` plus `x-device-type: web` for ecosystem APIs.
- Browser-authenticated `POST /screener/query` succeeds for Pro fields such as `breco`, `upside`, and `nBreco`.
- Browser-authenticated `GET /screener/screens`, `GET /screener/exportLimit`, and `GET ecosystem.api.tickertape.in/watchlists` return 200.
- `GET /stocks/peers/RELI?tab=forecast` is Pro-gated: anonymous replay returns 403; browser-authenticated replay returns forecast peer fields.

## Account Writes

Strategy: gated COOKIE_API or UI_SELECTOR, not enabled by default.

Known endpoints:
- `POST /screener/screens` or related screen save routes are present in the app bundle.
- `POST /watchlists`, `PATCH /watchlists/:watchlistId`, `POST/PATCH/DELETE /watchlists/:watchlistId/constituents` are present in ecosystem routes.

Policy:
- Do not mutate saved screens or watchlists during reconnaissance.
- Add write commands only with exact payload capture and explicit `--yes` style confirmation.

## Rate Limit Policy

Default local throttle: `TICKERTAPE_MIN_INTERVAL_MS=650` plus up to `TICKERTAPE_JITTER_MS=150` random jitter. This is intentionally moderate: fast enough for research, slow enough to avoid hammering endpoints. Raise it to `1000-2000` for long batch runs. Bucket-specific overrides like `TICKERTAPE_SCREENER_INTERVAL_MS=1200` and `TICKERTAPE_QUOTES_INTERVAL_MS=300` are supported.
