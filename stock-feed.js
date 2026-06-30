import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { ANALYZE_BASE, ANALYZE_FALLBACK_BASE, API_BASE, fetchJson, formatDate, normalizeLimit, normalizeOffset, normalizeSid, requireRows } from './utils.mjs';

function valueAt(item, names) {
  for (const name of names) {
    if (item?.[name] !== undefined && item?.[name] !== null) return item[name];
  }
  return null;
}

function rowFrom(item, rank) {
  return {
    rank,
    sid: valueAt(item, ['sid', 'assetId', 'ticker', 'symbol']),
    type: valueAt(item, ['type', 'category', 'categoryType']),
    date: formatDate(valueAt(item, ['date', 'createdAt', 'publishedAt', 'publishedDate', 'broadcastTime'])),
    title: valueAt(item, ['title', 'headline', 'subject', 'name']),
    summary: valueAt(item, ['summary', 'description', 'desc']),
    source: valueAt(item, ['source', 'publisher', 'provider']),
    url: valueAt(item, ['url', 'link', 'attachment', 'attachement']),
  };
}

function flatten(payload) {
  const data = payload?.data ?? payload;
  const candidates = [];
  if (Array.isArray(data)) candidates.push(...data);
  else if (data && typeof data === 'object') {
    for (const key of ['feed', 'items', 'data', 'news', 'events', 'results']) {
      if (Array.isArray(data[key])) candidates.push(...data[key]);
    }
    for (const group of ['upcoming', 'past']) {
      if (Array.isArray(data[group])) candidates.push(...data[group]);
    }
  }
  return candidates
    .map((item, index) => rowFrom(item, index + 1))
    .filter((row) => row.title || row.summary || row.url);
}

async function fetchFeed(url) {
  try {
    return await fetchJson(url, { bucket: 'analyze', service: 'analyze' });
  } catch (error) {
    if (error instanceof CommandExecutionError) return { error };
    throw error;
  }
}

cli({
  site: 'tickertape',
  name: 'stock-feed',
  access: 'read',
  description: 'Read Tickertape per-stock news/feed rows by sid',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sid', positional: true, required: true, help: 'Tickertape sid/ticker, e.g. RELI or ACN' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Feed offset' },
    { name: 'type', type: 'string', default: '', help: 'Optional feed type such as news or video' },
  ],
  columns: ['rank', 'sid', 'type', 'date', 'title', 'summary', 'source', 'url'],
  func: async (args) => {
    const sid = normalizeSid(args.sid);
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const bases = [
      `${ANALYZE_BASE}/v2/stocks/feed/${encodeURIComponent(sid)}`,
      `${ANALYZE_FALLBACK_BASE}/v2/stocks/feed/${encodeURIComponent(sid)}`,
      `${API_BASE}/stocks/feed/${encodeURIComponent(sid)}`,
    ];
    for (const base of bases) {
      const url = new URL(base);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      if (args.type) url.searchParams.set('type', String(args.type));
      const payload = await fetchFeed(url);
      if (payload?.error) {
        continue;
      }
      const rows = flatten(payload).slice(0, limit);
      if (rows.length) return rows.map((row, index) => ({ ...row, rank: index + 1 }));
    }
    return requireRows([], 'tickertape stock-feed', 'No Tickertape stock feed rows matched this sid; this Tickertape feed currently appears to cover Indian equity sids');
  },
});
