import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError } from '@jackwener/opencli/errors';
import { API_BASE, fetchJson, normalizeLimit, normalizeSid, requireRows } from './utils.mjs';

const ENDPOINTS = {
  income: {
    endpoint: 'income',
    periods: new Set(['annual', 'interim']),
  },
  balance: {
    endpoint: 'balancesheet',
    periods: new Set(['annual']),
  },
  balancesheet: {
    endpoint: 'balancesheet',
    periods: new Set(['annual']),
  },
  cashflow: {
    endpoint: 'cashflow',
    periods: new Set(['annual']),
  },
};

function selectValue(row, names) {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
  }
  return null;
}

function mapFinancialRow(row, statement) {
  const base = {
    period: row.displayPeriod ?? null,
    endDate: row.endDate ?? null,
    reporting: row.reporting ?? null,
  };
  if (statement === 'income') {
    return {
      ...base,
      revenue: selectValue(row, ['incTrev', 'qIncTrev']),
      ebitda: selectValue(row, ['incEbi', 'qIncEbi']),
      depreciation: selectValue(row, ['incDep', 'qIncDep']),
      pbit: selectValue(row, ['incPbi', 'qIncPbi']),
      pbt: selectValue(row, ['incPbt', 'qIncPbt']),
      netIncome: selectValue(row, ['incNinc', 'qIncNinc']),
      eps: selectValue(row, ['incEps', 'qIncEps']),
      dps: selectValue(row, ['incDps', 'qIncDps']),
      raw: row,
    };
  }
  if (statement === 'balance' || statement === 'balancesheet') {
    return {
      ...base,
      totalAssets: row.balTota ?? null,
      currentAssets: row.balTca ?? row.balCa ?? null,
      totalLiabilities: row.balTotl ?? null,
      currentLiabilities: row.balTcl ?? null,
      totalDebt: row.balTdeb ?? null,
      totalEquity: row.balTeq ?? null,
      cashAndShortTermInvestments: row.balCsti ?? null,
      raw: row,
    };
  }
  return {
    ...base,
    operatingCashFlow: row.cafCfoa ?? null,
    capitalExpenditure: row.cafCexp ?? null,
    investingCashFlow: row.cafCfia ?? null,
    financingCashFlow: row.cafCffa ?? null,
    freeCashFlow: row.cafFcf ?? null,
    netChangeInCash: row.cafNcic ?? null,
    raw: row,
  };
}

cli({
  site: 'tickertape',
  name: 'financials',
  access: 'read',
  description: 'Read income, balance sheet, or cash flow statements from a Tickertape stock page',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'sid', positional: true, required: true, help: 'Tickertape stock sid, e.g. RELI' },
    { name: 'statement', type: 'string', default: 'income', help: 'income / balance / cashflow' },
    { name: 'period', type: 'string', default: 'annual', help: 'annual or interim (interim only for income)' },
    { name: 'limit', type: 'int', default: 12, help: 'Maximum periods to return (max 40)' },
  ],
  columns: ['period', 'endDate', 'reporting', 'revenue', 'ebitda', 'pbt', 'netIncome', 'eps', 'totalAssets', 'totalDebt', 'freeCashFlow'],
  func: async (args) => {
    const sid = normalizeSid(args.sid);
    const statement = String(args.statement ?? 'income').toLowerCase();
    const period = String(args.period ?? 'annual').toLowerCase();
    const limit = normalizeLimit(args.limit, 12, 40);
    const config = ENDPOINTS[statement];
    if (!config || !config.periods.has(period)) {
      throw new ArgumentError('statement/period must be one of: income annual, income interim, balance annual, balancesheet annual, cashflow annual');
    }

    const payload = await fetchJson(`${API_BASE}/stocks/financials/${config.endpoint}/${encodeURIComponent(sid)}/${period}/normal`);
    const rows = requireRows(payload?.data, 'tickertape financials', 'Tickertape did not return the requested statement');
    return rows.slice(-limit).map((row) => {
      const mapped = mapFinancialRow(row, statement);
      return {
        period: mapped.period,
        endDate: mapped.endDate,
        reporting: mapped.reporting,
        revenue: mapped.revenue ?? null,
        ebitda: mapped.ebitda ?? null,
        pbt: mapped.pbt ?? null,
        netIncome: mapped.netIncome ?? null,
        eps: mapped.eps ?? null,
        totalAssets: mapped.totalAssets ?? null,
        totalDebt: mapped.totalDebt ?? null,
        freeCashFlow: mapped.freeCashFlow ?? null,
      };
    });
  },
});
