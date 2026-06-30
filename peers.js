import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import { API_BASE, WEB_BASE, browserFetchJson, ensureTickertapePage, normalizeLimit, normalizeSid, requireRows } from './utils.mjs';

const TABS = ['valuation', 'technical', 'forecast'];

function mapPeer(item, tab, rank) {
  const ratios = item?.ratios ?? {};
  return {
    rank,
    tab,
    sid: item?.sid ?? null,
    ticker: item?.ticker ?? null,
    name: item?.name ?? null,
    sector: item?.sector ?? null,
    pe: ratios.ttmPe ?? ratios.apef ?? null,
    pb: ratios.pbr ?? null,
    dividendYield: ratios.divDps ?? null,
    volatility12m: ratios['12mVol'] ?? null,
    rsi14: ratios['14dRsi'] ?? null,
    priceMomentumRank: ratios.prmr ?? null,
    buyRecoPct: ratios.breco ?? null,
    upside: ratios.upside ?? null,
    epsGrowth12m: ratios['12mEpsg'] ?? null,
    url: item?.slug ? `${WEB_BASE}${item.slug}` : null,
  };
}

cli({
  site: 'tickertape',
  name: 'peers',
  access: 'read',
  description: 'Compare a stock with Tickertape peers; forecast peer fields use your Pro browser session',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'sid', positional: true, required: true, help: 'Tickertape stock sid, e.g. RELI' },
    { name: 'tab', type: 'string', default: 'valuation', help: 'valuation / technical / forecast / all' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
  ],
  columns: ['rank', 'tab', 'sid', 'ticker', 'name', 'sector', 'pe', 'pb', 'dividendYield', 'volatility12m', 'rsi14', 'priceMomentumRank', 'buyRecoPct', 'upside', 'epsGrowth12m', 'url'],
  func: async (page, args) => {
    const sid = normalizeSid(args.sid);
    const tab = String(args.tab ?? 'valuation').toLowerCase();
    const limit = normalizeLimit(args.limit, 20, 100);
    const tabs = tab === 'all' ? TABS : [tab];
    if (!tabs.every((item) => TABS.includes(item))) throw new ArgumentError('tab must be valuation, technical, forecast, or all');

    await ensureTickertapePage(page, '/');
    const rows = [];
    for (const currentTab of tabs) {
      const url = new URL(`${API_BASE}/stocks/peers/${encodeURIComponent(sid)}`);
      url.searchParams.set('tab', currentTab);
      const payload = await browserFetchJson(page, url, { service: 'root', bucket: 'peers' });
      for (const item of payload?.data ?? []) {
        rows.push(mapPeer(item, currentTab, rows.length + 1));
      }
    }
    return requireRows(rows.slice(0, limit), 'tickertape peers', 'Check the sid or choose a different peer tab');
  },
});
