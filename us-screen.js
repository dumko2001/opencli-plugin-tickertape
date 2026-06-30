import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import {
  DEFAULT_US_PROJECT,
  ECOSYSTEM_BASE,
  US_SCREEN_COLUMNS,
  fetchJson,
  fetchUsPrebuiltScreens,
  findUsPrebuiltScreen,
  firstUsScreenResult,
  normalizeLimit,
  normalizeOffset,
  parseMetricListArg,
  parseSortOrder,
  requireRows,
  rowFromUsScreenerResult,
  uniqueProject,
} from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'us-screen',
  access: 'read',
  description: 'Run a Tickertape US ready-made screen by id or slug',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'id', positional: true, required: true, help: 'US screen id/slug, e.g. quality-value-plays' },
    { name: 'project', type: 'string', default: '', help: 'Extra US metric labels; use semicolons or a JSON array when labels contain commas' },
    { name: 'sort', type: 'string', default: '', help: 'Optional US metric label to override the screen sort' },
    { name: 'order', type: 'string', default: '', help: 'Optional sort order override: desc or asc' },
    { name: 'limit', type: 'int', default: 20, help: 'Maximum rows to return (max 100)' },
    { name: 'offset', type: 'int', default: 0, help: 'Result offset for pagination' },
  ],
  columns: US_SCREEN_COLUMNS,
  func: async (args) => {
    const limit = normalizeLimit(args.limit, 20, 100);
    const offset = normalizeOffset(args.offset);
    const screens = await fetchUsPrebuiltScreens();
    const screen = findUsPrebuiltScreen(screens, args.id);
    if (!screen) throw new ArgumentError(`Unknown US prebuilt screen "${args.id}"`, 'Run tickertape us-prebuilt-screens to list screen ids');

    const query = screen.query ?? {};
    const screenProject = Array.isArray(query.project) ? query.project : [];
    const extraProject = parseMetricListArg(args.project, []);
    const project = uniqueProject([...screenProject, ...DEFAULT_US_PROJECT, ...extraProject]);
    const body = {
      ...query,
      project,
      offset,
      count: limit,
    };
    if (args.sort) body.sortBy = String(args.sort);
    if (args.order) body.sortOrder = parseSortOrder(args.order);

    const payload = await fetchJson(`${ECOSYSTEM_BASE}/screener/US/security/query`, {
      method: 'POST',
      body,
      bucket: 'us-screener',
      service: 'ecosystem',
    });
    const rows = requireRows(firstUsScreenResult(payload), 'tickertape us-screen', 'The selected US screen returned no rows');
    return rows.map((item, index) => rowFromUsScreenerResult(item, offset + index + 1, project, {
      screen: screen.title,
      premium: screen.premium,
    }));
  },
});
