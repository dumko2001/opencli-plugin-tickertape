# Tickertape for OpenCLI

Use Tickertape from your terminal: search stocks, get quotes, inspect company basics, run screeners, read financials, and pull recent events.

This is an unofficial plugin for [OpenCLI](https://github.com/jackwener/OpenCLI). It is not made by, endorsed by, or sponsored by Tickertape.

## What You Can Do

- Search Indian stocks, funds, ETFs, indices, and US stocks
- Get live quotes for Indian and US stocks
- Read company profiles, ratios, financial statements, peers, and events
- List Tickertape screeners, filters, saved screens, and watchlists
- Run public screeners and account-backed Tickertape Pro screeners
- Export results as tables or JSON

## Install

First install OpenCLI:

```bash
npm install -g @jackwener/opencli
```

Then install this plugin:

```bash
opencli plugin install github:dumko2001/opencli-plugin-tickertape
```

Check that it worked:

```bash
opencli tickertape search reliance
```

## Quick Examples

Search for a company:

```bash
opencli tickertape search reliance
```

Get live quotes:

```bash
opencli tickertape quote RELI,HDBK
```

Get company basics:

```bash
opencli tickertape info RELI
```

Read financial statements:

```bash
opencli tickertape financials RELI --statement income --period annual
opencli tickertape financials RELI --statement balance --period annual
opencli tickertape financials RELI --statement cashflow --period annual
```

Read recent company events:

```bash
opencli tickertape events RELI --type all --limit 20
```

Search US stocks:

```bash
opencli tickertape us-info ACN
opencli tickertape us-quote ACN,MSFT
```

Get JSON instead of a table:

```bash
opencli tickertape info RELI -f json
```

## Screeners

List available filters:

```bash
opencli tickertape filters --category Valuation
```

List ready-made screens:

```bash
opencli tickertape prebuilt-screens
```

Run a ready-made screen:

```bash
opencli tickertape screen SCR0150 --limit 10
```

Run a custom screener:

```bash
opencli tickertape screener \
  --match '{"breco":{"g":60},"upside":{"g":20}}' \
  --project subindustry,mrktCapf,lastPrice,breco,upside,nBreco \
  --sort upside \
  --order desc \
  --limit 20
```

US screeners work too:

```bash
opencli tickertape us-filters --query roe
opencli tickertape us-prebuilt-screens --query "free cash"
opencli tickertape us-screen quality-value-plays --limit 10
```

## Account And Pro Features

Most basic commands work without logging in.

Commands that read your saved screens, watchlists, or Pro fields need your normal Tickertape browser session. OpenCLI uses your existing browser login; this plugin does not ask for your Tickertape password.

For those account-backed commands, install and enable the OpenCLI browser extension too:

- Recommended: install **OpenCLI** from the [Chrome Web Store](https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk)
- Manual option: download the latest extension zip from the [OpenCLI releases page](https://github.com/jackwener/opencli/releases), unzip it, open `chrome://extensions`, turn on **Developer mode**, and choose **Load unpacked**

If you see an "extension not connected" or browser-session error, open Chrome, make sure the OpenCLI extension is enabled, open Tickertape, and log in there normally.

Check your session:

```bash
opencli tickertape login
```

Account-backed read commands:

```bash
opencli tickertape screens
opencli tickertape watchlist
opencli tickertape peers RELI --tab forecast
```

This plugin is read-oriented. It does not create, edit, or delete your Tickertape watchlists or screens.

## Command List

| Command | What it does |
| --- | --- |
| `tickertape search <query>` | Search Tickertape assets |
| `tickertape quote <sid[,sid]>` | Indian stock quotes |
| `tickertape info <sid>` | Indian company profile and ratios |
| `tickertape financials <sid>` | Income, balance sheet, or cash flow rows |
| `tickertape events <sid>` | Announcements, dividends, actions, and legal events |
| `tickertape peers <sid>` | Peer comparison rows |
| `tickertape filters` | Indian screener filters |
| `tickertape prebuilt-screens` | Ready-made Indian screens |
| `tickertape screen <id>` | Run one Indian ready-made screen |
| `tickertape screener` | Run a custom Indian screener |
| `tickertape screens` | Saved screens from your account |
| `tickertape watchlist` | Watchlists from your account |
| `tickertape news-events [sid]` | News and event feed |
| `tickertape stock-feed <sid>` | Per-stock feed where Tickertape supports it |
| `tickertape us-info <ticker>` | US company profile |
| `tickertape us-quote <ticker[,ticker]>` | US stock quotes |
| `tickertape us-financials <ticker>` | US financial rows |
| `tickertape us-filters` | US screener filters |
| `tickertape us-prebuilt-screens` | Ready-made US screens |
| `tickertape us-screen <id>` | Run one ready-made US screen |
| `tickertape us-screener` | Run a custom US screener |

## Reliability Notes

This is a `0.1.0` beta. It works today, but Tickertape can change its website or API responses without notice.

The plugin rate-limits requests by default. For long batch runs, slow it down:

```bash
TICKERTAPE_MIN_INTERVAL_MS=1500 opencli tickertape screener --limit 100
```

Use this for research assistance only. It is not investment advice. Respect Tickertape's [Terms and Conditions](https://www.tickertape.in/meta/terms), account limits, and data usage rules.

## For Codex Agents

This repo includes a Codex skill at `codex-skills/tickertape-opencli/SKILL.md`. Use it when an agent needs to run or maintain this plugin without rediscovering the command surface.

## Credits

Built for [OpenCLI](https://github.com/jackwener/OpenCLI). OpenCLI is required at runtime through the `@jackwener/opencli` peer dependency.
