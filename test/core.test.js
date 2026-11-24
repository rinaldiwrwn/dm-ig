import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtRbK, fmtNum, buildReply } from '../lib/format.js';
import { parseInput } from '../lib/parse.js';
import { handleOngkir, _resetCache } from '../lib/handler.js';

test('format rb / k', () => {
  assert.equal(fmtRbK(18), '18rb');
  assert.equal(fmtRbK(18.5), '18,5rb');
  assert.equal(fmtRbK(373), '373rb');
  assert.equal(fmtRbK(1250), '1.250k');
  assert.equal(fmtRbK(1250.5), '1.250,5k');
  assert.equal(fmtNum(1000), '1.000');
});

test('template balasan 1 barang', () => {
  assert.equal(
    buildReply({ prices: [350], ongkirRupiah: 18000, sapaan: 'om' }),
    'Untuk kesitu ongkirnya jadi 18rb dan biaya packingnya 5rb/item yaa om, jadi totalnya 350+5+18=373rb om\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)'
  );
});

test('template balasan banyak barang + desimal + jutaan', () => {
  assert.equal(
    buildReply({ prices: [1000, 230], ongkirRupiah: 18500, sapaan: 'ka' }),
    'Untuk kesitu ongkirnya jadi 18,5rb dan biaya packingnya 5rb/item yaa kaa, jadi totalnya 1.000+5+230+5+18,5=1.258,5k kaa\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)'
  );
});

test('parse input dasar', () => {
  const p = parseInput('Tebet, 350, om');
  assert.deepEqual(p.address, ['Tebet']);
  assert.deepEqual(p.prices, [350]);
  assert.equal(p.sapaan, 'om');
  assert.equal(p.weightKg, 1);
  assert.equal(p.service, 'reg');
  assert.equal(p.errors.length, 0);
});

test('parse input lengkap', () => {
  const p = parseInput('Jl. Melati No 5, Cibinong, Kab. Bogor, 16911, 350 1.200, ka, 2 kg, yes');
  assert.deepEqual(p.address, ['Jl. Melati No 5', 'Cibinong', 'Kab. Bogor', '16911']);
  assert.deepEqual(p.prices, [350, 1200]);
  assert.equal(p.sapaan, 'ka');
  assert.equal(p.weightKg, 2);
  assert.equal(p.service, 'yes');
});

test('parse trucking, gram, harga dengan +', () => {
  const p = parseInput('Medan\n350+200 om\ntrucking 1500gr');
  assert.deepEqual(p.prices, [350, 200]);
  assert.equal(p.service, 'jtr');
  assert.equal(p.weightKg, 1.5);
});

test('parse error tanpa harga', () => {
  assert.ok(parseInput('Tebet, om').errors.length > 0);
});

// ---- mock RajaOngkir ----
const DB = [
  { id: 1, subdistrict_name: 'KEBAYORAN LAMA UTARA', district_name: 'KEBAYORAN LAMA', city_name: 'JAKARTA SELATAN', province_name: 'DKI JAKARTA', zip_code: '12240' },
  { id: 10, subdistrict_name: 'TEBET BARAT', district_name: 'TEBET', city_name: 'JAKARTA SELATAN', province_name: 'DKI JAKARTA', zip_code: '12810' },
  { id: 11, subdistrict_name: 'TEBET TIMUR', district_name: 'TEBET', city_name: 'JAKARTA SELATAN', province_name: 'DKI JAKARTA', zip_code: '12820' },
  { id: 20, subdistrict_name: 'PAKANSARI', district_name: 'CIBINONG', city_name: 'BOGOR', province_name: 'JAWA BARAT', zip_code: '16915' },
  { id: 30, subdistrict_name: 'CIBINONG', district_name: 'CIBINONG', city_name: 'CIANJUR', province_name: 'JAWA BARAT', zip_code: '43271' },
];

function mockFetch(costs) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const json = (data, code = 200) => ({ ok: code === 200, status: code, json: async () => ({ meta: { code, message: 'x' }, data }) });
    if (url.includes('/destination/domestic-destination')) {
      const q = new URL(url).searchParams.get('search').toUpperCase();
      const rows = DB.filter((r) => [r.subdistrict_name, r.district_name, r.city_name].some((f) => f.includes(q)));
      return rows.length ? json(rows) : json(null, 404);
    }
    if (url.includes('/calculate/domestic-cost')) return json(costs);
    throw new Error('unexpected ' + url);
  };
  fn.calls = calls;
  return fn;
}

const env = { RAJAONGKIR_API_KEY: 'test' };
const JABO_COSTS = [
  { service: 'CTC', cost: 10000, etd: '1-2 day' },
  { service: 'CTCYES', cost: 18000, etd: '1 day' },
];
const LUAR_COSTS = [
  { service: 'OKE', cost: 15000 },
  { service: 'REG', cost: 18500, etd: '2-3 day' },
  { service: 'YES', cost: 32000 },
  { service: 'JTR', cost: 60000 },
];

test('end-to-end: Tebet (Jabodetabek, CTC)', async () => {
  _resetCache();
  const f = mockFetch(JABO_COSTS);
  const r = await handleOngkir({ text: 'Tebet, 350, om' }, env, { fetchImpl: f });
  assert.equal(r.status, 200);
  assert.equal(r.json.reply, 'Untuk kesitu ongkirnya jadi 10rb dan biaya packingnya 5rb/item yaa om, jadi totalnya 350+5+10=365rb om\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)');
  const calc = f.calls.find((c) => c.url.includes('calculate'));
  const body = new URLSearchParams(calc.init.body.toString());
  assert.equal(body.get('origin'), '1');
  assert.equal(body.get('destination'), '10');
  assert.equal(body.get('weight'), '1000');
  assert.equal(body.get('courier'), 'jne');
});

test('end-to-end: kecamatan ambigu -> pilihan, lalu pilih', async () => {
  _resetCache();
  const f = mockFetch(LUAR_COSTS);
  const r = await handleOngkir({ text: 'Cibinong, 350, ka' }, env, { fetchImpl: f });
  assert.equal(r.json.needChoice, true);
  assert.equal(r.json.choices.length, 2);
  const r2 = await handleOngkir({ text: 'Cibinong, 350, ka', destinationId: 30 }, env, { fetchImpl: f });
  assert.match(r2.json.reply, /ongkirnya jadi 18,5rb/);
});

test('end-to-end: kota di alamat membedakan otomatis + YES', async () => {
  _resetCache();
  const f = mockFetch(LUAR_COSTS);
  const r = await handleOngkir({ text: 'Cibinong, Bogor, 350 200, ka, yes, 3kg' }, env, { fetchImpl: f });
  assert.equal(r.status, 200);
  assert.equal(r.json.reply, 'Untuk kesitu ongkirnya jadi 32rb dan biaya packingnya 5rb/item yaa kaa, jadi totalnya 350+5+200+5+32=592rb kaa\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)');
  assert.match(r.json.detail.tujuan, /BOGOR/);
});

test('end-to-end: tujuan tidak ditemukan & PIN', async () => {
  _resetCache();
  const f = mockFetch(LUAR_COSTS);
  const r = await handleOngkir({ text: 'Antah Berantah, 350, om' }, env, { fetchImpl: f });
  assert.equal(r.status, 404);
  const r2 = await handleOngkir({ text: 'Tebet, 350, om', pin: 'salah' }, { ...env, ACCESS_PIN: '1234' }, { fetchImpl: f });
  assert.equal(r2.status, 401);
});

test('sapaan default om', () => {
  assert.equal(parseInput('Tebet, 350').sapaan, 'om');
});

test('contoh dari user: 3 barang', () => {
  assert.match(buildReply({ prices: [350, 200, 500], ongkirRupiah: 18000, sapaan: 'ka' }), /totalnya 350\+5\+200\+5\+500\+5\+18=1\.083k kaa\n/);
});

test('ongkir manual: angka pertama tanpa alamat', () => {
  const p = parseInput('10, 350 200, ka');
  assert.equal(p.manualOngkir, 10);
  assert.deepEqual(p.prices, [350, 200]);
  assert.equal(p.errors.length, 0);
});

test('ongkir manual: desimal pakai titik & kata "ongkir"', () => {
  assert.equal(parseInput('18.5, 350').manualOngkir, 18.5);
  const p = parseInput('350 200, ongkir 12, om');
  assert.equal(p.manualOngkir, 12);
  assert.deepEqual(p.prices, [350, 200]);
});

test('tanpa alamat & cuma satu bagian angka -> error', () => {
  const p = parseInput('350 200, om');
  assert.equal(p.manualOngkir, null);
  assert.ok(p.errors.length > 0);
});

test('harga ribuan tetap benar', () => {
  assert.deepEqual(parseInput('Tebet, 1.250').prices, [1250]);
  assert.deepEqual(parseInput('15, 1.250').prices, [1250]);
});

test('end-to-end ongkir manual tanpa memanggil API', async () => {
  const f = async () => { throw new Error('API tidak boleh dipanggil'); };
  const r = await handleOngkir({ text: '10, 350 200, ka' }, {}, { fetchImpl: f });
  assert.equal(r.status, 200);
  assert.equal(r.json.reply, 'Untuk totalnya jadi 350+5+200+5+10=570rb yaa kaa\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)');
});

test('ongkir manual: sapaan default om', async () => {
  const r = await handleOngkir({ text: '23, 350' }, {}, { fetchImpl: async () => { throw new Error('x'); } });
  assert.equal(r.json.reply, 'Untuk totalnya jadi 350+5+23=378rb yaa om\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)');
});

test('sapaan bebas: kata terakhir setelah harga/berat/layanan, ditulis persis seperti diketik', () => {
  const s = (txt) => parseInput(txt).sapaan;
  assert.equal(s('Tebet, 350, man'), 'man');
  assert.equal(s('Tebet, 350, mann'), 'mann');
  assert.equal(s('Tebet, 350, Mann'), 'Mann');
  assert.equal(s('Tebet, 350, NANGG'), 'NANGG');
  assert.equal(s('Tebet, 350, nAnGg'), 'nAnGg');
  assert.equal(s('10, 350 200, Mann'), 'Mann'); // ongkir diketik: tanpa alamat
  assert.equal(s('Tebet, 350, 2kg, bro'), 'bro'); // setelah berat
  assert.equal(s('Cibinong, Bogor, 350, mann'), 'mann');
  assert.deepEqual(parseInput('Cibinong, Bogor, 350, mann').address, ['Cibinong', 'Bogor']);
  // om dan ka tetap seperti biasa, dan menang atas kata terakhir
  assert.equal(s('Tebet, 350, om'), 'om');
  assert.equal(s('Tebet, 350, ka'), 'ka');
  assert.equal(s('Tebet, 350, kakak'), 'ka');
  assert.equal(s('Tebet, 350, ka, bro'), 'ka');
  assert.equal(s('Tebet, 350'), 'om');
  // alamat di akhir tidak ikut terbaca sebagai sapaan
  const addrLast = parseInput('350, Tebet');
  assert.equal(addrLast.sapaan, 'om');
  assert.deepEqual(addrLast.address, ['Tebet']);
  assert.equal(parseInput('350, Cibinong, Bogor').sapaan, 'om'); // bagian sebelum "Bogor" bukan harga
  // layanan dan kata kunci yang dikenal bukan sapaan
  assert.equal(s('Tebet, 350, yes'), 'om');
  assert.equal(parseInput('Tebet, 350, yes').service, 'yes');
  // satu kata saja, huruf saja
  assert.equal(parseInput('Tebet, 350, bro besar').sapaan, 'om');
  assert.equal(parseInput('Tebet, 350, b').sapaan, 'om');
  assert.equal(parseInput('Tebet, 350, a1b').sapaan, 'om');
  assert.equal(
    buildReply({ prices: [350], ongkirRupiah: 10000, sapaan: 'Mann', manual: true }),
    'Untuk totalnya jadi 350+5+10=365rb yaa Mann\n\nTransfernya kesini yaa:\n4980430176 a/n Rinaldi Wiriawan (BCA)'
  );
});
