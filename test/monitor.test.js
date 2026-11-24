import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveCustomer, lookupCustomer, handlePelanggan } from '../lib/monitor.js';

const env = { MONITOR_URL: 'https://monitor.example.app', MONITOR_TOKEN: 'rahasia', ACCESS_PIN: '123456' };
const okFetch = (calls) => async (url, init) => {
  calls.push({ url: String(url), init });
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};

test('menyimpan pelanggan: username dirapikan, ongkir rupiah jadi ribuan, token dikirim', async () => {
  const calls = [];
  const r = await saveCustomer({ username: ' @Budi.Watch ', ongkir: 18500, sapaan: 'ka', pin: '123456' }, env, { fetchImpl: okFetch(calls) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, username: 'budi.watch', ongkir: 18.5, sapaan: 'ka', updated: false, previous: null });
  assert.equal(calls[0].url, 'https://monitor.example.app/api/customer');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer rahasia');
  assert.deepEqual(JSON.parse(calls[0].init.body), { username: 'budi.watch', ongkir: 18.5, greeting: 'ka', overwrite: false });
});

test('tanpa sapaan menjadi om, dan ongkir bulat tetap bulat', async () => {
  const calls = [];
  await saveCustomer({ username: 'x', ongkir: 10000, pin: '123456' }, env, { fetchImpl: okFetch(calls) });
  assert.deepEqual(JSON.parse(calls[0].init.body), { username: 'x', ongkir: 10, greeting: 'om', overwrite: false });
});

test('PIN salah ditolak sebelum menghubungi dashboard', async () => {
  const calls = [];
  const r = await saveCustomer({ username: 'x', ongkir: 10000, pin: 'salah' }, env, { fetchImpl: okFetch(calls) });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test('belum diatur: pesan jelas, tidak ada panggilan keluar', async () => {
  const calls = [];
  const r = await saveCustomer({ username: 'x', ongkir: 10000 }, {}, { fetchImpl: okFetch(calls) });
  assert.equal(r.status, 501);
  assert.match(r.json.error, /MONITOR_URL/);
  assert.equal(calls.length, 0);
});

test('username dan ongkir tidak valid ditolak', async () => {
  const calls = [];
  for (const body of [{ username: '', ongkir: 1000 }, { username: 'a b', ongkir: 1000 }, { username: 'x', ongkir: 'abc' }, { username: 'x', ongkir: -5 }]) {
    const r = await saveCustomer({ ...body, pin: '123456' }, env, { fetchImpl: okFetch(calls) });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test('dashboard menolak token atau tidak terjangkau: error ramah', async () => {
  const bad = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Tidak diizinkan' }) });
  const r1 = await saveCustomer({ username: 'x', ongkir: 1000, pin: '123456' }, env, { fetchImpl: bad });
  assert.equal(r1.status, 502);
  assert.match(r1.json.error, /MONITOR_TOKEN/);
  const down = async () => { throw new Error('ECONNREFUSED'); };
  const r2 = await saveCustomer({ username: 'x', ongkir: 1000, pin: '123456' }, env, { fetchImpl: down });
  assert.equal(r2.status, 502);
  assert.match(r2.json.error, /ECONNREFUSED/);
});

test('akun yang sudah ada: data lama diteruskan ke tampilan', async () => {
  const upd = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, updated: true, previous: { ongkir: 10, greeting: 'om' } }) });
  const r = await saveCustomer({ username: 'x', ongkir: 18500, sapaan: 'ka', pin: '123456' }, env, { fetchImpl: upd });
  assert.equal(r.status, 200);
  assert.equal(r.json.updated, true);
  assert.deepEqual(r.json.previous, { ongkir: 10, greeting: 'om' });
  const fresh = await saveCustomer({ username: 'x', ongkir: 18500, pin: '123456' }, env, { fetchImpl: okFetch([]) });
  assert.equal(fresh.json.updated, false);
  assert.equal(fresh.json.previous, null);
});

test('bawaannya tidak menimpa; akun sudah ada menghasilkan 409 berisi data lama', async () => {
  const calls = [];
  const exists = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: false, status: 409, json: async () => ({ error: 'Akun sudah ada di daftar.', exists: true, previous: { ongkir: 10, greeting: 'om' } }) };
  };
  const r = await saveCustomer({ username: '@X', ongkir: 18500, sapaan: 'ka', pin: '123456' }, env, { fetchImpl: exists });
  assert.equal(r.status, 409);
  assert.deepEqual(r.json, { exists: true, previous: { ongkir: 10, greeting: 'om' }, username: 'x', ongkir: 18.5, sapaan: 'ka' });
  assert.equal(calls[0].overwrite, false);
});

test('timpa: true mengizinkan dashboard menimpa', async () => {
  const calls = [];
  await saveCustomer({ username: 'x', ongkir: 18500, sapaan: 'ka', pin: '123456', timpa: true }, env, { fetchImpl: okFetch(calls) });
  assert.equal(JSON.parse(calls[0].init.body).overwrite, true);
});

test('sapaan bebas diteruskan apa adanya setelah dirapikan; kosong menjadi om', async () => {
  const calls = [];
  for (const sapaan of ['Mann', '  bro   besar ', 'ka', '', undefined, 'x'.repeat(40)]) {
    await saveCustomer({ username: 'x', ongkir: 10000, sapaan, pin: '123456' }, env, { fetchImpl: okFetch(calls) });
  }
  assert.deepEqual(calls.map((c) => JSON.parse(c.init.body).greeting), ['Mann', 'bro besar', 'ka', 'om', 'om', 'x'.repeat(20)]);
});

test('cek username: ada di database pemenang lama, tidak ada, belum terhubung, dan gangguan tidak jadi error', async () => {
  const calls = [];
  const have = async (url, init) => {
    calls.push({ url: String(url), auth: init?.headers?.Authorization });
    return { ok: true, status: 200, json: async () => ({ exists: true, customer: { ongkir: 10, greeting: 'Mann' } }) };
  };
  const r = await lookupCustomer({ username: ' @Budi.Watch ', pin: '123456' }, env, { fetchImpl: have });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { exists: true, username: 'budi.watch', customer: { ongkir: 10, greeting: 'Mann' } });
  assert.equal(calls[0].url, 'https://monitor.example.app/api/customer?username=budi.watch');
  assert.equal(calls[0].auth, 'Bearer rahasia');

  const none = async () => ({ ok: true, status: 200, json: async () => ({ exists: false, customer: null }) });
  assert.equal((await lookupCustomer({ username: 'x', pin: '123456' }, env, { fetchImpl: none })).json.exists, false);

  assert.deepEqual((await lookupCustomer({ username: 'x', pin: '123456' }, {}, { fetchImpl: none })).json, { unavailable: true });
  const down = async () => { throw new Error('ECONNREFUSED'); };
  assert.deepEqual((await lookupCustomer({ username: 'x', pin: '123456' }, env, { fetchImpl: down })).json, { unavailable: true });
  const refused = async () => ({ ok: false, status: 401, json: async () => ({}) });
  assert.deepEqual((await lookupCustomer({ username: 'x', pin: '123456' }, env, { fetchImpl: refused })).json, { unavailable: true });

  assert.equal((await lookupCustomer({ username: 'x', pin: 'salah' }, env, { fetchImpl: none })).status, 401);
  assert.equal((await lookupCustomer({ username: 'a b', pin: '123456' }, env, { fetchImpl: none })).status, 400);
});

test('handlePelanggan: cek:true hanya mengecek, selain itu menyimpan', async () => {
  const urls = [];
  const f = async (url, init) => {
    urls.push((init?.method || 'GET') + ' ' + new URL(url).pathname);
    return { ok: true, status: 200, json: async () => ({ exists: false, ok: true }) };
  };
  await handlePelanggan({ cek: true, username: 'x', pin: '123456' }, env, { fetchImpl: f });
  await handlePelanggan({ username: 'x', ongkir: 1000, pin: '123456' }, env, { fetchImpl: f });
  assert.deepEqual(urls, ['GET /api/customer', 'POST /api/customer']);
});
