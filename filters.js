import { cli, Strategy } from '@jackwener/opencli/registry';
import { API_BASE, fetchJson, normalizeLimit, requireRows } from './utils.js';

cli({
  site: 'tickertape',
  name: 'filters',
  access: 'read',
  description: 'List Tickertape screener filter labels, categories, and ranges',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'category', type: 'string', default: '', help: 'Optional category name, e.g. Valuation or Analyst Ratings' },
    { name: 'premium', type: 'bool', default: false, help: 'Only show premium filters' },
    { name: 'limit', type: 'int', default: 80, help: 'Maximum rows to return (max 300)' },
  ],
  columns: ['label', 'display', 'category', 'premium', 'unit', 'uiType', 'min', 'max'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 80, 300);
    const categoryFilter = String(args.category ?? '').trim().toLowerCase();
    const onlyPremium = args.premium === true || args.premium === 'true';
    const payload = await fetchJson(`${API_BASE}/screener/filters`);
    const rows = [];
    for (const [category, filters] of Object.entries(payload?.data ?? {})) {
      if (categoryFilter && category.toLowerCase() !== categoryFilter) continue;
      for (const filter of filters ?? []) {
        if (onlyPremium && filter.premium !== true) continue;
        const slider = (filter.ui ?? []).find((item) => item.type === 'slider') ?? {};
        rows.push({
          label: filter.label ?? null,
          display: filter.display ?? filter.short ?? null,
          category,
          premium: filter.premium === true,
          unit: filter.unit ?? null,
          uiType: (filter.ui ?? []).map((item) => item.type).join(',') || null,
          min: slider.min ?? null,
          max: slider.max ?? null,
        });
      }
    }
    return requireRows(rows.slice(0, limit), 'tickertape filters', 'Try a different category');
  },
});

