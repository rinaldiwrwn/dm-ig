import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveCustomer } from '../lib/monitor.js';

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
  assert.deepEqual(JSON.parse(calls[0].init.body), { username: 'budi.watch', ongkir: 18.5, greeting: 'ka' });
});

test('sapaan selain ka menjadi om, dan ongkir bulat tetap bulat', async () => {
  const calls = [];
  await saveCustomer({ username: 'x', ongkir: 10000, sapaan: 'kak', pin: '123456' }, env, { fetchImpl: okFetch(calls) });
  assert.deepEqual(JSON.parse(calls[0].init.body), { username: 'x', ongkir: 10, greeting: 'om' });
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
