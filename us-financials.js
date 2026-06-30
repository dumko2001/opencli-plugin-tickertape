import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
import { GMS_BASE, WEB_BASE, fetchJson, fetchPageNextData, normalizeLimit, normalizeTicker, requireRows } from './utils.mjs';

const STATEMENTS = new Set(['income', 'balance', 'cashflow']);
const PERIODS = new Set(['annual', 'quarterly']);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

async function tryEndpoint(url) {
  try {
    return await fetchJson(url, { bucket: 'gms', service: 'gms' });
  } catch (error) {
    if (error instanceof CommandExecutionError) return null;
    throw error;
  }
}

async function fetchEndpointFinancials(ticker, statement) {
  const candidates = [
    `${GMS_BASE}/US/stocks/${encodeURIComponent(ticker)}/financials/${statement}/normal`,
    `${GMS_BASE}/US/stocks/${encodeURIComponent(ticker)}/financials/${statement}`,
    `${GMS_BASE}/US/stocks/financials/${encodeURIComponent(ticker)}/${statement}/normal`,
    `${GMS_BASE}/US/stocks/financials/${encodeURIComponent(ticker)}/${statement}`,
  ];
  for (const candidate of candidates) {
    const payload = await tryEndpoint(candidate);
    const financials = payload?.data?.financials ?? payload?.financials ?? payload?.data;
    if (financials && typeof financials === 'object') return financials;
  }
  return null;
}

async function fetchPageFinancials(ticker, statement) {
  if (statement !== 'income') return null;
  const overview = await fetchJson(`${GMS_BASE}/US/stocks/${encodeURIComponent(ticker)}/overview`, {
    bucket: 'gms',
    service: 'gms',
  });
  const slug = overview?.data?.slug;
  const url = slug ? `${WEB_BASE}${slug}` : `${WEB_BASE}/us-stocks/${ticker}`;
  const page = await fetchPageNextData(url);
  const queries = page?.props?.pageProps?.dehydratedState?.queries ?? [];
  const query = queries.find((item) => Array.isArray(item?.queryKey)
    && item.queryKey[0] === 'useq'
    && item.queryKey[1] === 'financials'
    && String(item.queryKey[2]).toUpperCase() === ticker
    && item.queryKey[3] === statement);
  return query?.state?.data?.financials ?? null;
}

function statementBlock(row) {
  return row?.incomeStatement ?? row?.balanceSheet ?? row?.cashFlowStatement ?? row?.cashflowStatement ?? row ?? {};
}

function mapRow(row, statement, period) {
  const block = statementBlock(row);
  return {
    period,
    date: row?.date ?? row?.endDate ?? row?.fiscalDateEnding ?? null,
    currency: row?.currency ?? row?.reportedCurrency ?? null,
    revenue: firstDefined(block.totalRevenue, block.revenue, block.sales),
    costOfRevenue: firstDefined(block.costOfRevenue, block.costOfGoodsAndServicesSold),
    grossProfit: block.grossProfit ?? null,
    operatingIncome: firstDefined(block.operatingIncome, block.operatingProfit),
    pretaxIncome: firstDefined(block.incomeBeforeTax, block.pretaxIncome),
    netIncome: block.netIncome ?? null,
    eps: firstDefined(block.eps, block.dilutedEPS, block.basicEPS),
    netProfitMargin: block.netProfitMargin ?? null,
    totalAssets: block.totalAssets ?? null,
    totalLiabilities: block.totalLiabilities ?? null,
    totalEquity: firstDefined(block.totalStockholderEquity, block.totalShareholderEquity, block.totalEquity),
    operatingCashFlow: firstDefined(block.totalCashFromOperatingActivities, block.operatingCashFlow),
    capitalExpenditure: firstDefined(block.capitalExpenditures, block.capitalExpenditure),
    freeCashFlow: block.freeCashFlow ?? null,
  };
}

cli({
  site: 'tickertape',
  name: 'us-financials',
  access: 'read',
  description: 'Read Tickertape US stock annual or quarterly financial statements',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'ticker', positional: true, required: true, help: 'US ticker, e.g. ACN' },
    { name: 'statement', type: 'string', default: 'income', help: 'income / balance / cashflow' },
    { name: 'period', type: 'string', default: 'annual', help: 'annual or quarterly' },
    { name: 'limit', type: 'int', default: 8, help: 'Maximum periods to return (max 40)' },
  ],
  columns: ['period', 'date', 'currency', 'revenue', 'grossProfit', 'operatingIncome', 'pretaxIncome', 'netIncome', 'eps', 'netProfitMargin', 'totalAssets', 'totalLiabilities', 'operatingCashFlow', 'freeCashFlow'],
  func: async (args) => {
    const ticker = normalizeTicker(args.ticker);
    const statement = String(args.statement ?? 'income').toLowerCase();
    const period = String(args.period ?? 'annual').toLowerCase();
    const limit = normalizeLimit(args.limit, 8, 40);
    if (!STATEMENTS.has(statement)) throw new ArgumentError('statement must be income, balance, or cashflow');
    if (!PERIODS.has(period)) throw new ArgumentError('period must be annual or quarterly');

    const financials = await fetchEndpointFinancials(ticker, statement) ?? await fetchPageFinancials(ticker, statement);
    const rows = financials?.[period] ?? financials?.[period === 'annual' ? 'yearly' : 'quarterly'] ?? [];
    return requireRows(rows, 'tickertape us-financials', 'Tickertape did not return the requested US financial statement')
      .slice(0, limit)
      .map((row) => mapRow(row, statement, period));
  },
});
