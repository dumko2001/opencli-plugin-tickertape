import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, fetchJson, normalizeLimit, requireRows } from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'prebuilt-screens',
  access: 'read',
  description: 'List Tickertape prebuilt stock screens including Pro screens',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'premium', type: 'bool', default: false, help: 'Only show premium screens' },
    { name: 'limit', type: 'int', default: 50, help: 'Maximum rows to return (max 200)' },
  ],
  columns: ['rank', 'id', 'title', 'group', 'premium', 'locked', 'sortBy', 'filterCount', 'description'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 50, 200);
    const onlyPremium = args.premium === true || args.premium === 'true';
    const payload = await fetchJson(`${API_BASE}/screener/v2/prebuilt`);
    const rows = [];
    for (const group of payload?.data ?? []) {
      for (const item of group.screens ?? []) {
        const screen = item.screen ?? {};
        if (onlyPremium && screen.premium !== true) continue;
        rows.push({
          rank: rows.length + 1,
          id: item.id ?? screen.slug ?? null,
          title: screen.title ?? null,
          group: group.name ?? null,
          premium: screen.premium === true,
          locked: screen.locked === true,
          sortBy: screen.query?.sortBy ?? null,
          filterCount: Object.keys(screen.query?.match ?? {}).length,
          description: screen.description ?? null,
        });
      }
    }
    return requireRows(rows.slice(0, limit), 'tickertape prebuilt-screens', 'No matching screens found');
  },
});

