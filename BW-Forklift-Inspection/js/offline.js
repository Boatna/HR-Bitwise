const OFFLINE_KEY = 'fl_offline_queue';
let offlineSyncing = false;

function readQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch (e) { return []; }
}
function writeQueue(q) {
  try {
    if (q.length) localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
    else localStorage.removeItem(OFFLINE_KEY);
  } catch (e) { console.warn('writeQueue error', e); }
}

function saveOfflineQueue(payload) {
  const q = readQueue();
  if (!q.some(x => x.data && x.data.submitId === payload.data.submitId)) {
    q.push(payload);
    writeQueue(q);
  }
}

async function syncOfflineQueue() {
  if (offlineSyncing || !navigator.onLine || !TOKEN) return;
  offlineSyncing = true;
  try {
    const q = readQueue();
    const mine = q.filter(x => (x.userId || USER_ID) === USER_ID);
    if (!mine.length) return;
    const keep = q.filter(x => (x.userId || USER_ID) !== USER_ID);
    let sent = 0, rejected = 0;
    for (let i = 0; i < mine.length; i++) {
      const r = await apiPost('submitCheck', { token: TOKEN, data: mine[i].data });
      if (r.ok) { sent++; continue; }
      if (r.network || r.code === 'AUTH') { keep.push(...mine.slice(i)); break; }
      rejected++;
      console.warn('Offline item rejected:', r.error || r.msg);
    }
    writeQueue(keep);
    if (sent) toast(_t('syncDone', { n: sent }), 4000);
    if (rejected) toast(_t('syncRejected', { n: rejected }), 6000);
  } catch (e) {
    console.warn('syncOfflineQueue error', e);
  } finally {
    offlineSyncing = false;
  }
}
