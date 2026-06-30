import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { ANALYZE_BASE, ANALYZE_FALLBACK_BASE, fetchJson, formatDate, normalizeLimit, normalizeOffset, parseCsv, requireRows } from './utils.js';

function valueAt(item, names) {
  for (const name of names) {
    if (item?.[name] !== undefined && item?.[name] !== null) return item[name];
  }
  return null;
}

function mapItem(item, category, timing, rank) {
  return {
    rank,
    category: item?.categoryType ?? item?.type ?? category,
    timing,
    sid: valueAt(item, ['sid', 'assetId', 'ticker', 'symbol']),
    date: formatDate(valueAt(item, ['date', 'createdAt', 'publishedAt', 'publishedDate', 'broadcastTime', 'exDate', 'orderDate'])),
    title: valueAt(item, ['title', 'headline', 'subject', 'name']),
    summary: valueAt(item, ['summary', 'description', 'desc']),
    source: valueAt(item, ['source', 'publisher', 'provider']),
    url: valueAt(item, ['url', 'link', 'attachment', 'attachement']),
  };
}

function pushRowsFromValue(rows, value, category, timing = null) {
  if (Array.isArray(value)) {
    for (const item of value) rows.push(mapItem(item, category, timing, rows.length + 1));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of ['items', 'data', 'news', 'events', 'results']) {
    if (Array.isArray(value[key])) {
      pushRowsFromValue(rows, value[key], category, timing);
      return;
    }
  }
  for (const group of ['upcoming', 'past']) {
    if (Array.isArray(value[group])) pushRowsFromValue(rows, value[group], category, group);
  }
}

function flatten(payload) {
  const rows = [];
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) pushRowsFromValue(rows, data, 'item');
  else if (data && typeof data === 'object') {
    for (const [category, value] of Object.entries(data)) {
      if (category === 'all') continue;
      pushRowsFromValue(rows, value, category);
    }
  }
  return rows
    .filter((row) => row.title || row.summary || row.url)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

cli({
  site: 'tickertape',
  name: 'news-events',
  access: 'read',
  description: 'Read Tickertape news/events feed by sid and category',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sids', positional: true, required: false, default: '', help: 'Comma-separated sid/ticker values, e.g. ACN or RELI' },
    { name: 'type', type: 'string', default: 'all', help: 'Feed category such as all, market, corporate, earnings, dividends, announcements' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Feed offset' },
    { name: 'filters', type: 'string', default: '', help: 'Optional Tickertape filters string' },
  ],
  columns: ['rank', 'category', 'timing', 'sid', 'date', 'title', 'summary', 'source', 'url'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const sids = parseCsv(args.sids, '');
    const type = String(args.type ?? 'all').trim();
    let lastError = null;
    let payload = null;
    for (const base of [ANALYZE_BASE, ANALYZE_FALLBACK_BASE]) {
      const url = new URL(`${base}/v2/homepage/events`);
      url.searchParams.set('count', String(limit));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('sids', sids.join(','));
      if (type && type !== 'all') url.searchParams.set('type', type);
      if (args.filters) url.searchParams.set('filters', String(args.filters));
      try {
        payload = await fetchJson(url, { bucket: 'analyze', service: 'analyze' });
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!payload && lastError) {
      if (lastError instanceof CommandExecutionError) throw lastError;
      throw new CommandExecutionError(`tickertape news-events request failed: ${lastError?.message || lastError}`);
    }
    return requireRows(flatten(payload).slice(0, limit), 'tickertape news-events', 'No Tickertape news/events matched the requested filters');
  },
});
