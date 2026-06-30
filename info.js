import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, fetchJson, WEB_BASE } from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'info',
  access: 'read',
  description: 'Get Tickertape stock profile and key ratios by sid',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sid', positional: true, required: true, help: 'Tickertape stock sid, e.g. RELI' },
  ],
  columns: ['sid', 'ticker', 'name', 'exchange', 'sector', 'marketCap', 'lastPrice', 'pe', 'pb', 'roe', 'eps', 'dividendYield', 'beta', 'url'],
  func: async (args) => {
    const sid = String(args.sid).trim();
    const payload = await fetchJson(`${API_BASE}/stocks/info/${encodeURIComponent(sid)}`);
    const data = payload?.data ?? {};
    const info = data.info ?? {};
    const ratios = data.ratios ?? {};
    return [{
      sid: data.sid ?? sid,
      ticker: info.ticker ?? null,
      name: info.name ?? null,
      exchange: info.exchange ?? null,
      sector: data.gic?.sector ?? info.sector ?? null,
      marketCap: ratios.marketCap ?? ratios.mrktCapf ?? null,
      lastPrice: ratios.lastPrice ?? null,
      pe: ratios.pe ?? ratios.ttmPe ?? ratios.apef ?? null,
      pb: ratios.pb ?? ratios.pbr ?? null,
      roe: ratios.roe ?? null,
      eps: ratios.eps ?? null,
      dividendYield: ratios.divYield ?? null,
      beta: ratios.beta ?? null,
      url: data.slug ? `${WEB_BASE}${data.slug}` : null,
    }];
  },
});

