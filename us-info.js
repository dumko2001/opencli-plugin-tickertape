import { cli, Strategy } from '@jackwener/opencli/registry';
import { GMS_BASE, WEB_BASE, fetchJson, normalizeTicker } from './utils.mjs';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

cli({
  site: 'tickertape',
  name: 'us-info',
  access: 'read',
  description: 'Get Tickertape US stock profile by ticker',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'ticker', positional: true, required: true, help: 'US ticker, e.g. ACN' },
  ],
  columns: ['ticker', 'name', 'exchange', 'assetType', 'sector', 'industry', 'marketCap', 'pe', 'eps', 'dividendYield', 'url', 'description'],
  func: async (args) => {
    const ticker = normalizeTicker(args.ticker);
    const payload = await fetchJson(`${GMS_BASE}/US/stocks/${encodeURIComponent(ticker)}/overview`, {
      bucket: 'gms',
      service: 'gms',
    });
    const data = payload?.data ?? {};
    const ratios = data.metrics ?? data.ratios ?? data.keyRatios ?? {};
    return [{
      ticker: firstDefined(data.ticker, data.symbol, ticker),
      name: data.name ?? null,
      exchange: data.exchange ?? null,
      assetType: data.assetType ?? null,
      sector: data.sector ?? data.gic?.sector ?? null,
      industry: data.industry ?? data.gic?.industry ?? null,
      marketCap: firstDefined(
        data.marketCap,
        ratios.marketCap,
        ratios.mrktCapf,
        ratios.marketCapitalization,
        ratios.marketCapitalizationMln,
        ratios.marketCapUsd,
      ),
      pe: firstDefined(data.pe, ratios.pe, ratios.ttmPe, ratios.priceEarningsTtm, ratios.priceEarnings),
      eps: firstDefined(data.eps, ratios.eps, ratios.earningsPerShareTtm),
      dividendYield: firstDefined(data.dividendYield, ratios.dividendYield, ratios.divYield, ratios.dividendYieldPercent),
      url: data.slug ? `${WEB_BASE}${data.slug}` : null,
      description: data.description ?? null,
    }];
  },
});
