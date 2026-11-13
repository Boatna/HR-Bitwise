async function api(method, action, payload = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const r = method === 'GET'
      ? await fetch(`${API_URL}?${new URLSearchParams({ action, ...payload })}`, { redirect: 'follow', signal: ctrl.signal })
      : await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ action, ...payload }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          signal: ctrl.signal
        });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    setApiStatus(true);
    if (json && json.code === 'AUTH') handleSessionExpired();
    return json || { ok: false, error: _t('errNoResp') };
  } catch (err) {
    console.warn('API failed:', action, err);
    setApiStatus(false);
    return {
      ok: false,
      network: true,
      error: err.name === 'AbortError'
        ? _t('errTimeout')
        : _t('errNetwork')
    };
  } finally {
    clearTimeout(timer);
  }
}
const apiGet = (action, params) => api('GET', action, params);
const apiPost = (action, payload) => api('POST', action, payload);

function handleSessionExpired() {
  if (!TOKEN) return;
  toast(_t('sessionExpired'), 4500);
  doLogout(false);
}
