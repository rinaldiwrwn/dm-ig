// Menyimpan pelanggan (username Instagram, ongkir, sapaan) ke dashboard Lelang Monitor, supaya rekap total
// di dashboard memakai ongkir yang sama dan tidak perlu diketik ulang. Pemanggilan dari server ke server,
// jadi token rahasia tidak pernah sampai ke browser.

// body: { username, ongkir (rupiah), sapaan, pin, timpa }
// timpa: true = boleh menimpa akun yang sudah ada di dashboard. Selain itu (bawaan), akun yang sudah ada tidak diubah
// dan hasilnya 409 berisi data lamanya, supaya pengguna ditanya dulu.
// env: MONITOR_URL (alamat dashboard), MONITOR_TOKEN (sama dengan CUSTOMER_API_TOKEN di dashboard), ACCESS_PIN
// -> { status, json }
export async function saveCustomer(body, env, { fetchImpl = fetch } = {}) {
  if (env.ACCESS_PIN && String(body?.pin || '') !== String(env.ACCESS_PIN)) {
    return { status: 401, json: { error: 'PIN salah.' } };
  }
  if (!env.MONITOR_URL || !env.MONITOR_TOKEN) {
    return { status: 501, json: { error: 'Belum terhubung: isi MONITOR_URL dan MONITOR_TOKEN di pengaturan aplikasi ini.' } };
  }
  let base;
  try {
    base = new URL(env.MONITOR_URL);
    if (!/^https?:$/.test(base.protocol)) throw new Error('bukan http(s)');
  } catch {
    return { status: 500, json: { error: 'MONITOR_URL tidak valid.' } };
  }

  const username = String(body?.username || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    return { status: 400, json: { error: 'Username Instagram tidak valid.' } };
  }
  const rupiah = Number(body?.ongkir);
  if (!Number.isFinite(rupiah) || rupiah < 0 || rupiah > 100_000_000) {
    return { status: 400, json: { error: 'Ongkir tidak valid.' } };
  }
  const ongkirRb = Math.round(rupiah / 10) / 100; // rupiah -> ribuan, 2 desimal (18500 -> 18.5)
  const greeting = ['om', 'ka', 'mann'].includes(body?.sapaan) ? body.sapaan : 'om';

  try {
    const r = await fetchImpl(new URL('/api/customer', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.MONITOR_TOKEN}` },
      body: JSON.stringify({ username, ongkir: ongkirRb, greeting, overwrite: body?.timpa === true }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.exists) {
      return { status: 409, json: { exists: true, previous: j.previous || null, username, ongkir: ongkirRb, sapaan: greeting } };
    }
    if (!r.ok) {
      const why = r.status === 401 ? 'token ditolak, cek MONITOR_TOKEN' : j.error || `HTTP ${r.status}`;
      return { status: 502, json: { error: `Dashboard menolak: ${why}.` } };
    }
    // Kalau akunnya sudah ada dan pengguna memilih menimpa, data lama ikut dikabarkan.
    return { status: 200, json: { ok: true, username, ongkir: ongkirRb, sapaan: greeting, updated: !!j.updated, previous: j.previous || null } };
  } catch (err) {
    return { status: 502, json: { error: `Tidak bisa menghubungi dashboard: ${err.message}` } };
  }
}
