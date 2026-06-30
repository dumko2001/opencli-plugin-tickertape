import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

export const API_BASE = 'https://api.tickertape.in';
export const ANALYZE_BASE = 'https://analyze-api.prod.tickertape.in';
export const ANALYZE_FALLBACK_BASE = 'https://analyze.api.tickertape.in';
export const AUTH_BASE = 'https://auth.api.tickertape.in';
export const ECOSYSTEM_BASE = 'https://ecosystem.api.tickertape.in';
export const GMS_BASE = 'https://gms-api.tickertape.in';
export const QUOTES_BASE = 'https://quotes-api.tickertape.in';
export const WEB_BASE = 'https://www.tickertape.in';

const RATE_FILE = path.join(os.homedir(), '.opencli', 'tickertape-rate-limit.json');
const LOCK_DIR = path.join(os.homedir(), '.opencli', 'tickertape-rate-limit.lock');
const SERVICE_VERSIONS = {
  analyze: '8.14.0',
  root: '8.14.0',
  auth: '3.5.0',
  ecosystem: '8.0.0',
  gms: '1.0.0',
  quotes: '1.0.0',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      fs.mkdirSync(LOCK_DIR);
      return;
    } catch {
      if (Date.now() - started > 5000) return;
      await sleep(50);
    }
  }
}

function releaseLock() {
  try {
    fs.rmdirSync(LOCK_DIR);
  } catch {}
}

function intervalForBucket(bucket) {
  const safeBucket = String(bucket || 'api').replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const specific = process.env[`TICKERTAPE_${safeBucket}_INTERVAL_MS`];
  return Number(specific ?? process.env.TICKERTAPE_MIN_INTERVAL_MS ?? 650);
}

function jitterMs() {
  const maxJitter = Number(process.env.TICKERTAPE_JITTER_MS ?? 150);
  if (!Number.isFinite(maxJitter) || maxJitter <= 0) return 0;
  return Math.floor(Math.random() * maxJitter);
}

export async function tickertapeThrottle(bucket = 'api') {
  const minInterval = intervalForBucket(bucket);
  if (!Number.isFinite(minInterval) || minInterval <= 0) return;
  await acquireLock();
  try {
    const state = readJsonFile(RATE_FILE, {});
    const now = Date.now();
    const last = Number(state[bucket] ?? 0);
    const waitMs = Math.max(0, last + minInterval - now);
    if (waitMs > 0) await sleep(waitMs + jitterMs());
    state[bucket] = Date.now();
    fs.mkdirSync(path.dirname(RATE_FILE), { recursive: true });
    fs.writeFileSync(RATE_FILE, JSON.stringify(state, null, 2));
  } finally {
    releaseLock();
  }
}

export function normalizeLimit(raw, fallback = 20, max = 100) {
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new ArgumentError('limit must be a positive integer');
  if (value > max) throw new ArgumentError(`limit must be <= ${max}`);
  return value;
}

export function normalizeOffset(raw) {
  const value = raw == null || raw === '' ? 0 : Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new ArgumentError('offset must be a non-negative integer');
  return value;
}

export function parseJsonArg(raw, fallback, name) {
  if (raw == null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected object');
    }
    return parsed;
  } catch (error) {
    throw new ArgumentError(`${name} must be a JSON object`, error?.message);
  }
}

export function parseCsv(raw, fallback) {
  const value = raw == null || raw === '' ? fallback : String(raw);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseMetricListArg(raw, fallback = []) {
  if (raw == null || raw === '') return uniqueProject(Array.isArray(fallback) ? fallback : parseCsv(fallback, ''));
  const value = String(raw).trim();
  if (!value) return uniqueProject(Array.isArray(fallback) ? fallback : parseCsv(fallback, ''));
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('expected array');
      return uniqueProject(parsed);
    } catch (error) {
      throw new ArgumentError('project must be a JSON array, semicolon list, or comma list', error?.message);
    }
  }
  const separator = value.includes(';') ? ';' : ',';
  return uniqueProject(value.split(separator).map((item) => item.trim()).filter(Boolean));
}

export function parseSortOrder(raw) {
  const value = String(raw ?? 'desc').toLowerCase();
  if (value === 'desc' || value === '-1') return -1;
  if (value === 'asc' || value === '1') return 1;
  throw new ArgumentError('order must be desc or asc');
}

export function normalizeSid(raw) {
  const sid = String(raw ?? '').trim().toUpperCase();
  if (!sid) throw new ArgumentError('sid is required');
  return sid;
}

export function normalizeTicker(raw) {
  const ticker = String(raw ?? '').trim().toUpperCase();
  if (!ticker) throw new ArgumentError('ticker is required');
  return ticker;
}

export function formatDate(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toISOString();
}

export async function fetchJson(url, { method = 'GET', body, bucket = 'api', service = 'root' } = {}) {
  let response;
  let text = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await tickertapeThrottle(bucket);
    try {
      response = await fetch(url, {
        method,
        headers: {
          'accept': 'application/json',
          'accept-version': SERVICE_VERSIONS[service] || SERVICE_VERSIONS.root,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          'origin': WEB_BASE,
          'referer': `${WEB_BASE}/`,
          'user-agent': 'Mozilla/5.0',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new CommandExecutionError(`tickertape request failed: ${error?.message || error}`);
    }
    text = await response.text();
    if (response.status !== 429 && response.status < 500) break;
    await sleep((attempt + 1) * 1500 + jitterMs());
  }

  if (!response.ok) {
    if (response.status === 401) throw new AuthRequiredError('www.tickertape.in');
    const hint = text.includes('No access')
      ? 'This endpoint needs your Tickertape Pro browser session. Use a browser-backed command such as tickertape screener or tickertape screen.'
      : text.slice(0, 300);
    throw new CommandExecutionError(`tickertape request failed: HTTP ${response.status}`, hint);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CommandExecutionError('tickertape returned non-JSON data', text.slice(0, 300));
  }

  if (data && data.success === false) {
    throw new CommandExecutionError(`tickertape API error: ${data.error || data.errorType || 'unknown'}`);
  }
  return data;
}

export async function ensureTickertapePage(page, pathname = '/') {
  const target = pathname.startsWith('http') ? pathname : `${WEB_BASE}${pathname}`;
  await page.goto(target);
  if (typeof page.wait === 'function') await page.wait(1.5);
}

export async function browserFetchJson(page, url, { method = 'GET', body, service = 'root', bucket = 'browser' } = {}) {
  await tickertapeThrottle(bucket);
  const input = {
    url: String(url),
    method,
    body: body === undefined ? null : body,
    service,
    versions: SERVICE_VERSIONS,
    authBase: AUTH_BASE,
  };
  const result = await page.evaluate(`(async () => {
    const input = ${JSON.stringify(input)};
    const getCookie = (name) => document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(name + '='))
      ?.slice(name.length + 1) || '';

    const headersFor = () => {
      const csrf = getCookie('x-csrf-token-tickertape-prod');
      const headers = {
        accept: 'application/json',
        'accept-version': input.versions[input.service] || input.versions.root,
      };
      if (input.body !== null) headers['content-type'] = 'application/json';
      if (csrf) headers['x-csrf-token'] = csrf;
      if (input.service === 'ecosystem' || input.service === 'auth') headers['x-device-type'] = 'web';
      return headers;
    };

    const request = async () => {
      const response = await fetch(input.url, {
        method: input.method,
        credentials: 'include',
        headers: headersFor(),
        ...(input.body === null ? {} : { body: JSON.stringify(input.body) }),
      });
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: response.status, ok: response.ok, text, json };
    };

    let result = await request();
    if (result.status === 401) {
      await fetch(input.authBase + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          'accept-version': input.versions.auth,
          'x-device-type': 'web',
        },
      }).catch(() => null);
      result = await request();
    }
    return result;
  })()`);

  if (!result || typeof result !== 'object') {
    throw new CommandExecutionError('tickertape browser request returned no result');
  }
  if (result.status === 401) throw new AuthRequiredError('www.tickertape.in');
  if (!result.ok) {
    const message = result.json?.error || result.json?.message || `HTTP ${result.status}`;
    const hint = result.json?.errorType === 'FORBIDDEN'
      ? 'Your browser is logged in, but this specific Tickertape field/screen is not available to the current account entitlement.'
      : result.text?.slice(0, 300);
    throw new CommandExecutionError(`tickertape authenticated request failed: ${message}`, hint);
  }
  if (!result.json) throw new CommandExecutionError('tickertape returned non-JSON browser data', result.text?.slice(0, 300));
  if (result.json.success === false) {
    throw new CommandExecutionError(`tickertape API error: ${result.json.error || result.json.errorType || 'unknown'}`);
  }
  return result.json;
}

export async function fetchPageNextData(url) {
  let response;
  try {
    await tickertapeThrottle('page');
    response = await fetch(url, {
      headers: {
        'accept': 'text/html',
        'user-agent': 'Mozilla/5.0',
      },
    });
  } catch (error) {
    throw new CommandExecutionError(`tickertape page request failed: ${error?.message || error}`);
  }
  if (!response.ok) throw new CommandExecutionError(`tickertape page request failed: HTTP ${response.status}`);
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new CommandExecutionError('tickertape page did not include __NEXT_DATA__');
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new CommandExecutionError('tickertape __NEXT_DATA__ was not valid JSON');
  }
}

export async function fetchTickertapeText(url, { accept = '*/*', bucket = 'page' } = {}) {
  let response;
  try {
    await tickertapeThrottle(bucket);
    response = await fetch(url, {
      headers: {
        accept,
        'origin': WEB_BASE,
        'referer': `${WEB_BASE}/`,
        'user-agent': 'Mozilla/5.0',
      },
    });
  } catch (error) {
    throw new CommandExecutionError(`tickertape text request failed: ${error?.message || error}`);
  }
  if (!response.ok) throw new CommandExecutionError(`tickertape text request failed: HTTP ${response.status}`);
  return response.text();
}

export function requireRows(rows, command, hint) {
  if (!Array.isArray(rows) || rows.length === 0) throw new EmptyResultError(command, hint);
  return rows;
}

export function rowFromScreenerResult(item, rank, project = []) {
  const ratios = item?.stock?.advancedRatios ?? {};
  const info = item?.stock?.info ?? item?.info ?? {};
  const slug = item?.stock?.slug ?? item?.slug ?? null;
  const base = {
    rank,
    sid: item?.sid ?? null,
    ticker: info.ticker ?? null,
    name: info.name ?? null,
    sector: info.sector ?? null,
    subindustry: ratios.subindustry ?? null,
    marketCap: ratios.mrktCapf ?? ratios.marketCap ?? null,
    lastPrice: ratios.lastPrice ?? null,
    pe: ratios.pe ?? ratios.apef ?? null,
    pb: ratios.pb ?? ratios.pbr ?? null,
    roe: ratios.roe ?? null,
    roce: ratios.roce ?? null,
    upside: ratios.upside ?? null,
    buyRecoPct: ratios.breco ?? null,
    analystCount: ratios.nBreco ?? null,
    holdRecoPct: ratios.pctHldReco ?? null,
    sellRecoPct: ratios.pctSelReco ?? null,
    oneDayReturnPct: ratios.pr1d ?? null,
    oneMonthReturnPct: ratios['4wpct'] ?? null,
    slug: slug ? `${WEB_BASE}${slug}` : null,
  };
  for (const field of project ?? []) {
    if (!Object.prototype.hasOwnProperty.call(base, field)) {
      base[field] = ratios[field] ?? info[field] ?? item?.[field] ?? null;
    }
  }
  return base;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function metricValue(metrics, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(metrics, key) && metrics[key] !== undefined && metrics[key] !== null) {
      return metrics[key];
    }
  }
  return null;
}

export function uniqueProject(fields) {
  const seen = new Set();
  const result = [];
  for (const field of fields ?? []) {
    const value = String(field ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export const DEFAULT_US_PROJECT = [
  'marketCapitalizationMln',
  'marketCapLabel',
  'prevClosePrice',
  'priceEarningsTtm',
  'priceEarnings',
  'priceBook',
  'earningsPerShareTtm',
  'returnOnEquityTtm,100,*',
  'quarterlyRevenueGrowthYoy,100,*',
  'quarterlyEarningsGrowthYoy,100,*',
  'profitMarginPercent,100,*',
  'operatingMarginTtm,100,*',
  'dividendYieldPercent',
  'upsidePercent',
  'analystBuyPercent',
  'analystTrackingCount',
  '1MReturn,100,*',
  '1YReturn,100,*',
  'totalDebt,totalStockholderEquity,/',
  'marketCapUsd,freeCashFlow,/',
];

export const US_SCREEN_COLUMNS = [
  'rank',
  'screen',
  'premium',
  'ticker',
  'name',
  'exchange',
  'sector',
  'industry',
  'marketCap',
  'marketCapLabel',
  'lastPrice',
  'pe',
  'pb',
  'eps',
  'roe',
  'revenueGrowth',
  'earningsGrowth',
  'profitMargin',
  'dividendYield',
  'upside',
  'analystCount',
  'oneMonthReturnPct',
  'oneYearReturnPct',
  'priceToFcf',
  'assetId',
  'slug',
  'selectedMetrics',
];

export function rowFromUsScreenerResult(item, rank, project = [], context = {}) {
  const metrics = item?.metrics ?? {};
  const selected = {};
  for (const field of project ?? []) {
    if (Object.prototype.hasOwnProperty.call(metrics, field)) selected[field] = metrics[field];
  }
  return {
    rank,
    screen: context.screen ?? null,
    premium: context.premium ?? null,
    assetId: item?.assetId ?? null,
    ticker: item?.ticker ?? null,
    name: item?.name ?? null,
    exchange: item?.exchange ?? null,
    sector: item?.sector ?? null,
    industry: item?.industry ?? null,
    marketCap: metricValue(metrics, 'marketCapitalizationMln', 'marketCapitalization', 'marketCapUsd'),
    marketCapLabel: metrics.marketCapLabel ?? null,
    lastPrice: metricValue(metrics, 'prevClosePrice', 'lastPrice', 'closePrice'),
    pe: metricValue(metrics, 'priceEarningsTtm', 'priceEarnings'),
    pb: metricValue(metrics, 'priceBook'),
    eps: metricValue(metrics, 'earningsPerShareTtm'),
    roe: metricValue(metrics, 'returnOnEquityTtm,100,*', 'returnOnEquityTtm', 'returnOnEquity'),
    revenueGrowth: metricValue(metrics, 'quarterlyRevenueGrowthYoy,100,*', 'quarterlyRevenueGrowthYoy'),
    earningsGrowth: metricValue(metrics, 'quarterlyEarningsGrowthYoy,100,*', 'quarterlyEarningsGrowthYoy'),
    profitMargin: metricValue(metrics, 'profitMarginPercent,100,*', 'profitMarginPercent'),
    operatingMargin: metricValue(metrics, 'operatingMarginTtm,100,*', 'operatingMarginTtm'),
    dividendYield: metricValue(metrics, 'dividendYieldPercent'),
    upside: metricValue(metrics, 'upsidePercent'),
    buyRecoPct: metricValue(metrics, 'analystBuyPercent', 'buyRecommendationPercent'),
    analystCount: metricValue(metrics, 'analystTrackingCount'),
    oneMonthReturnPct: metricValue(metrics, '1MReturn,100,*', '1MReturn'),
    oneYearReturnPct: metricValue(metrics, '1YReturn,100,*', '1YReturn'),
    debtToEquity: metricValue(metrics, 'totalDebt,totalStockholderEquity,/', 'debtToEquity'),
    priceToFcf: metricValue(metrics, 'marketCapUsd,freeCashFlow,/', 'priceToFreeCashFlow'),
    slug: item?.slug ? `${WEB_BASE}${item.slug}` : null,
    selectedMetrics: Object.keys(selected).length ? JSON.stringify(selected) : null,
  };
}

export function firstUsScreenResult(payload) {
  return firstDefined(payload?.data?.result, payload?.result, payload?.data?.results, payload?.results);
}

export async function fetchUsPrebuiltScreens({ bucket = 'us-screen-meta' } = {}) {
  const payload = await fetchJson(`${ECOSYSTEM_BASE}/screener/US/security/v2/prebuilt`, {
    bucket,
    service: 'ecosystem',
  });
  const screens = [];
  for (const group of payload?.data ?? []) {
    const groupName = group?.name ?? group?.title ?? group?.category ?? null;
    for (const item of group?.screens ?? []) {
      const screen = item?.screen ?? item ?? {};
      screens.push({
        id: item?.id ?? screen?.id ?? screen?.slug ?? screen?._id ?? null,
        group: groupName,
        title: screen?.title ?? screen?.name ?? null,
        slug: screen?.slug ?? null,
        description: screen?.description ?? null,
        premium: screen?.premium === true,
        locked: screen?.locked === true,
        query: screen?.query ?? item?.query ?? {},
      });
    }
  }
  return screens;
}

export function findUsPrebuiltScreen(screens, id) {
  const needle = String(id ?? '').trim().toLowerCase();
  if (!needle) throw new ArgumentError('US screen id is required');
  return screens.find((screen) => [screen.id, screen.slug, screen.title]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === needle));
}
