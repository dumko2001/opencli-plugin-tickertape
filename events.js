import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import { API_BASE, fetchJson, formatDate, normalizeLimit, normalizeSid, requireRows } from './utils.js';

const EVENT_ENDPOINTS = {
  announcements: 'announcements',
  actions: 'actions',
  dividends: 'dividends',
  legal: 'legal',
};

function mapEvent(item, type, timing, rank) {
  return {
    rank,
    type,
    timing,
    sid: item?.sid ?? null,
    ticker: item?.ticker ?? null,
    date: formatDate(item?.broadcastTime ?? item?.exDate ?? item?.orderDate),
    title: item?.subject ?? item?.title ?? item?.subType ?? item?.caseNo ?? null,
    description: item?.description ?? item?.desc ?? null,
    value: item?.value ?? item?.dividend ?? null,
    source: item?.source ?? null,
    attachment: item?.attachement ?? item?.attachment ?? item?.link ?? null,
    caseNo: item?.caseNo ?? null,
  };
}

cli({
  site: 'tickertape',
  name: 'events',
  access: 'read',
  description: 'Read stock announcements, corporate actions, dividends, and legal events',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sid', positional: true, required: true, help: 'Tickertape stock sid, e.g. RELI' },
    { name: 'type', type: 'string', default: 'all', help: 'all / announcements / actions / dividends / legal' },
    { name: 'timing', type: 'string', default: 'all', help: 'all / upcoming / past' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 200)' },
  ],
  columns: ['rank', 'type', 'timing', 'sid', 'ticker', 'date', 'title', 'description', 'value', 'source', 'attachment', 'caseNo'],
  func: async (args) => {
    const sid = normalizeSid(args.sid);
    const type = String(args.type ?? 'all').toLowerCase();
    const timing = String(args.timing ?? 'all').toLowerCase();
    const limit = normalizeLimit(args.limit, 20, 200);
    const types = type === 'all' ? Object.keys(EVENT_ENDPOINTS) : [type];
    if (!types.every((item) => EVENT_ENDPOINTS[item])) {
      throw new ArgumentError('type must be all, announcements, actions, dividends, or legal');
    }
    if (!['all', 'upcoming', 'past'].includes(timing)) throw new ArgumentError('timing must be all, upcoming, or past');

    const rows = [];
    for (const currentType of types) {
      const endpoint = EVENT_ENDPOINTS[currentType];
      const payload = await fetchJson(`${API_BASE}/stocks/corporates/${endpoint}/${encodeURIComponent(sid)}`, { bucket: 'events' });
      const groups = timing === 'all' ? ['upcoming', 'past'] : [timing];
      for (const currentTiming of groups) {
        for (const item of payload?.data?.[currentTiming] ?? []) {
          rows.push(mapEvent(item, currentType, currentTiming, rows.length + 1));
        }
      }
    }
    rows.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    return requireRows(rows.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 })), 'tickertape events', 'No events matched the requested type/timing');
  },
});
