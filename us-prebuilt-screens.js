import { cli, Strategy } from '@jackwener/opencli/registry';
import { fetchUsPrebuiltScreens, normalizeLimit, requireRows } from './utils.js';

cli({
  site: 'tickertape',
  name: 'us-prebuilt-screens',
  access: 'read',
  description: 'List Tickertape US ready-made stock screens',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', type: 'string', default: '', help: 'Optional search across title, slug, group, and description' },
    { name: 'premium', type: 'bool', default: false, help: 'Only show premium screens' },
    { name: 'limit', type: 'int', default: 50, help: 'Maximum rows to return (max 200)' },
  ],
  columns: ['rank', 'id', 'slug', 'title', 'group', 'premium', 'locked', 'sortBy', 'filterCount', 'projectCount', 'description'],
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 50, 200);
    const needle = String(args.query ?? '').trim().toLowerCase();
    const onlyPremium = args.premium === true || args.premium === 'true';
    const screens = await fetchUsPrebuiltScreens();
    const rows = [];
    for (const screen of screens) {
      if (onlyPremium && screen.premium !== true) continue;
      const haystack = [screen.id, screen.slug, screen.title, screen.group, screen.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      rows.push({
        rank: rows.length + 1,
        id: screen.id,
        slug: screen.slug,
        title: screen.title,
        group: screen.group,
        premium: screen.premium,
        locked: screen.locked,
        sortBy: screen.query?.sortBy ?? null,
        filterCount: Object.keys(screen.query?.match ?? {}).length,
        projectCount: Array.isArray(screen.query?.project) ? screen.query.project.length : 0,
        description: screen.description,
      });
    }
    return requireRows(rows.slice(0, limit), 'tickertape us-prebuilt-screens', 'No matching US screens found');
  },
});
