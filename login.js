import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError } from '@jackwener/opencli/errors';
import { API_BASE, ECOSYSTEM_BASE, browserFetchJson, ensureTickertapePage } from './utils.mjs';

cli({
  site: 'tickertape',
  name: 'login',
  access: 'read',
  description: 'Open Tickertape in the connected Chrome profile and verify the logged-in Pro/session state',
  domain: 'www.tickertape.in',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['loginStatus', 'userLevel', 'csrfCookie', 'screensAuth', 'watchlistAuth', 'exportRemaining', 'url'],
  func: async (page) => {
    await ensureTickertapePage(page, '/');
    const state = await page.evaluate(`(() => {
      const store = window.__NEXT_REDUX_STORE__;
      const st = store?.getState?.() || {};
      const user = st.userInfo?.userAuth || {};
      const hasCsrf = document.cookie.split(';').some((item) => item.trim().startsWith('x-csrf-token-tickertape-prod='));
      return {
        loginStatus: user.loginStatus === true,
        userLevel: user.userLevel || null,
        csrfCookie: hasCsrf,
        url: location.href,
      };
    })()`);
    if (!state?.loginStatus) throw new AuthRequiredError('www.tickertape.in', 'Tickertape is open, but this Chrome profile is not logged in');

    let screensAuth = false;
    let watchlistAuth = false;
    let exportRemaining = null;
    try {
      const screens = await browserFetchJson(page, `${API_BASE}/screener/screens`, { service: 'root', bucket: 'account' });
      screensAuth = screens?.success === true;
    } catch {}
    try {
      const exportLimit = await browserFetchJson(page, `${API_BASE}/screener/exportLimit`, { service: 'root', bucket: 'account' });
      exportRemaining = exportLimit?.data?.remainingCount ?? null;
    } catch {}
    try {
      const url = new URL(`${ECOSYSTEM_BASE}/watchlists`);
      url.searchParams.set('assetClass', 'SECURITY');
      url.searchParams.set('market', 'IN,US');
      const watchlists = await browserFetchJson(page, url, { service: 'ecosystem', bucket: 'account' });
      watchlistAuth = watchlists?.success === true;
    } catch {}

    return [{
      loginStatus: true,
      userLevel: state.userLevel,
      csrfCookie: state.csrfCookie,
      screensAuth,
      watchlistAuth,
      exportRemaining,
      url: state.url,
    }];
  },
});
