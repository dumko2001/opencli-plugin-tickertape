import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  DEFAULT_US_PROJECT,
  ECOSYSTEM_BASE,
  US_SCREEN_COLUMNS,
  fetchJson,
  firstUsScreenResult,
  normalizeLimit,
  normalizeOffset,
  parseCsv,
  parseMetricListArg,
  parseJsonArg,
  parseSortOrder,
  requireRows,
  rowFromUsScreenerResult,
  uniqueProject,
} from './utils.js';

cli({
  site: 'tickertape',
  name: 'us-screener',
  access: 'read',
  description: 'Run custom Tickertape US stock screener filters',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'match', type: 'string', default: '{}', help: 'Filter JSON using US filter labels, e.g. {"priceEarningsTtm":{"g":0,"l":20}}' },
    { name: 'project', type: 'string', default: DEFAULT_US_PROJECT.join(';'), help: 'US metric labels to request; use semicolons or a JSON array when labels contain commas' },
    { name: 'sort', type: 'string', default: 'marketCapitalizationMln', help: 'US metric label to sort by' },
    { name: 'order', type: 'string', default: 'desc', help: 'Sort order: desc or asc' },
    { name: 'assetIds', type: 'string', default: '', help: 'Optional comma-separated Tickertape US assetIds to restrict the universe' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Result offset for pagination' },
  ],
  columns: US_SCREEN_COLUMNS,
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const project = uniqueProject(parseMetricListArg(args.project, DEFAULT_US_PROJECT));
    const assetIds = parseCsv(args.assetIds, '');
    const body = {
      match: parseJsonArg(args.match, {}, 'match'),
      project,
      sortBy: String(args.sort ?? 'marketCapitalizationMln'),
      sortOrder: parseSortOrder(args.order),
      offset,
      count: limit,
    };
    if (assetIds.length) body.assetIds = assetIds;
    const payload = await fetchJson(`${ECOSYSTEM_BASE}/screener/US/security/query`, {
      method: 'POST',
      body,
      bucket: 'us-screener',
      service: 'ecosystem',
    });
    const rows = requireRows(firstUsScreenResult(payload), 'tickertape us-screener', 'Try fewer or different US filters');
    return rows.map((item, index) => rowFromUsScreenerResult(item, offset + index + 1, project));
  },
});
