import { cli, Strategy } from '@jackwener/opencli/registry';
import { ECOSYSTEM_BASE, fetchJson, normalizeLimit, requireRows } from './utils.js';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function valueCountFromUi(ui) {
  for (const item of ui ?? []) {
    const values = firstDefined(item?.values, item?.options, item?.ticks);
    if (Array.isArray(values)) return values.length;
  }
  return null;
}

function acronym(value) {
  return String(value ?? '')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toLowerCase();
}

cli({
  site: 'tickertape',
  name: 'us-filters',
  access: 'read',
  description: 'List Tickertape US screener filter labels and ranges',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'category', type: 'string', default: '', help: 'Optional category name' },
    { name: 'query', type: 'string', default: '', help: 'Optional search across labels and display names' },
    { name: 'premium', type: 'bool', default: false, help: 'Only show premium filters' },
    { name: 'limit', type: 'int', default: 80, help: 'Maximum rows to return (max 500)' },
  ],
  columns: ['label', 'display', 'category', 'premium', 'unit', 'uiType', 'min', 'max', 'valueCount', 'description'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 80, 500);
    const categoryFilter = String(args.category ?? '').trim().toLowerCase();
    const needle = String(args.query ?? '').trim().toLowerCase();
    const onlyPremium = args.premium === true || args.premium === 'true';
    const payload = await fetchJson(`${ECOSYSTEM_BASE}/screener/US/security/filters`, {
      bucket: 'us-screener-meta',
      service: 'ecosystem',
    });
    const rows = [];
    const catalog = payload?.data?.filters ?? payload?.data ?? {};
    for (const [category, filters] of Object.entries(catalog)) {
      if (!Array.isArray(filters)) continue;
      if (categoryFilter && category.toLowerCase() !== categoryFilter) continue;
      for (const filter of filters ?? []) {
        if (onlyPremium && filter?.premium !== true) continue;
        const haystack = [
          filter?.label,
          filter?.display,
          filter?.short,
          filter?.description,
          acronym(filter?.display),
          acronym(filter?.short),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (needle && !haystack.includes(needle)) continue;
        const slider = (filter?.ui ?? []).find((item) => item?.min !== undefined || item?.max !== undefined) ?? {};
        rows.push({
          label: filter?.label ?? null,
          display: filter?.display ?? filter?.short ?? filter?.name ?? null,
          category,
          premium: filter?.premium === true,
          unit: filter?.unit ?? null,
          uiType: (filter?.ui ?? []).map((item) => item?.type).filter(Boolean).join(',') || null,
          min: slider.min ?? null,
          max: slider.max ?? null,
          valueCount: valueCountFromUi(filter?.ui),
          description: filter?.description ?? null,
        });
      }
    }
    return requireRows(rows.slice(0, limit), 'tickertape us-filters', 'Try a different category or query');
  },
});
