import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, browserFetchJson, ensureTickertapePage, normalizeLimit, normalizeOffset, parseCsv, parseJsonArg, parseSortOrder, requireRows, rowFromScreenerResult } from './utils.js';

const DEFAULT_PROJECT = ['subindustry', 'mrktCapf', 'lastPrice', 'pe', 'apef', 'pbr', 'roe', 'pr1d', '4wpct'];

cli({
  site: 'tickertape',
  name: 'screener',
  access: 'read',
  description: 'Run Tickertape stock screener queries with basic or Pro filters',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'match', type: 'string', default: '{}', help: 'Filter JSON, e.g. {"mrktCapf":{"g":100000},"roe":{"g":15}}' },
    { name: 'project', type: 'string', default: DEFAULT_PROJECT.join(','), help: 'Comma-separated metric labels to request' },
    { name: 'sort', type: 'string', default: 'mrktCapf', help: 'Metric label to sort by' },
    { name: 'order', type: 'string', default: 'desc', help: 'Sort order: desc or asc' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Result offset for pagination' },
  ],
  columns: ['rank', 'sid', 'ticker', 'name', 'sector', 'subindustry', 'marketCap', 'lastPrice', 'pe', 'pb', 'roe', 'roce', 'upside', 'buyRecoPct', 'analystCount', 'oneDayReturnPct', 'oneMonthReturnPct', 'slug'],
  func: async (page, args) => {
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const project = parseCsv(args.project, DEFAULT_PROJECT.join(','));
    const body = {
      match: parseJsonArg(args.match, {}, 'match'),
      project,
      sortBy: String(args.sort ?? 'mrktCapf'),
      sortOrder: parseSortOrder(args.order),
      offset,
      count: limit,
    };
    await ensureTickertapePage(page, '/screener/equity');
    const payload = await browserFetchJson(page, `${API_BASE}/screener/query`, {
      method: 'POST',
      body,
      service: 'root',
      bucket: 'screener',
    });
    const results = requireRows(payload?.data?.results, 'tickertape screener', 'Try fewer or different filters');
    return results.map((item, index) => rowFromScreenerResult(item, offset + index + 1, project));
  },
});
