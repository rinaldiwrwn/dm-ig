// Mencocokkan alamat yang diketik ke ID tujuan RajaOngkir.
// Kalau nama kecamatan ada di lebih dari satu kota dan alamat tidak cukup
// untuk membedakan, kembalikan daftar pilihan supaya user memilih sendiri.

const PREFIX_RE =
  /^(kec\.?|kecamatan|kel\.?|kelurahan|desa|ds\.?|kota|kab\.?|kabupaten|kota adm\.?|prov\.?|provinsi)\s+/i;

export function cleanSegment(seg) {
  return seg.replace(PREFIX_RE, '').replace(/\s+/g, ' ').trim();
}

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function fieldMatches(fieldValue, seg) {
  const f = norm(fieldValue);
  const s = norm(seg);
  if (!f || !s) return false;
  if (f === s) return true;
  // "KOTA JAKARTA SELATAN" vs "Jakarta Selatan", "BOGOR" vs "Kab Bogor"
  return s.length >= 4 && (f.includes(s) || s.includes(f));
}

function score(candidate, segments) {
  const fields = [
    candidate.subdistrict_name,
    candidate.district_name,
    candidate.city_name,
    candidate.province_name,
    candidate.zip_code,
  ];
  return segments.filter((seg) => fields.some((f) => fieldMatches(f, seg))).length;
}

export function describe(c) {
  return [c.subdistrict_name, c.district_name, c.city_name, c.province_name]
    .filter(Boolean)
    .join(', ');
}

// -> { destination } | { choices: [{ id, label }] } | { notFound: true }
export async function resolveDestination(client, addressSegments) {
  const segments = addressSegments.map(cleanSegment).filter((s) => s.length >= 3);
  if (!segments.length) return { notFound: true };

  // Batasi jumlah request: cukup 4 bagian terakhir (biasanya kel/kec/kota/prov).
  const toSearch = segments.slice(-4);
  const byId = new Map();
  for (const seg of toSearch) {
    const rows = await client.searchDestination(seg);
    for (const r of rows) byId.set(r.id, r);
  }
  const candidates = [...byId.values()];
  if (!candidates.length) return { notFound: true };

  const scored = candidates.map((c) => ({ c, s: score(c, segments) }));
  const best = Math.max(...scored.map((x) => x.s));
  const top = scored.filter((x) => x.s === best).map((x) => x.c);

  // Kelompokkan per kecamatan + kota: tarif JNE praktis sama dalam satu kecamatan.
  const groups = new Map();
  for (const c of top) {
    const key = `${norm(c.district_name)}|${norm(c.city_name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  if (groups.size === 1) {
    const list = [...groups.values()][0];
    // Utamakan kelurahan yang cocok dengan yang diketik, kalau ada.
    const exact = list.find((c) => segments.some((s) => norm(c.subdistrict_name) === norm(s)));
    return { destination: exact || list[0] };
  }

  const choices = [...groups.values()].slice(0, 12).map((list) => {
    const c = list[0];
    return {
      id: c.id,
      label: [c.district_name, c.city_name, c.province_name].filter(Boolean).join(', '),
    };
  });
  return { choices };
}

// Layanan JNE. Untuk rute Jabodetabek, JNE memakai kode CTC / CTCYES.
const SERVICE_CODES = {
  reg: ['REG', 'CTC'],
  yes: ['YES', 'CTCYES'],
  jtr: ['JTR', 'JTR<130', 'JTR>130', 'JTR>200', 'JTR250'],
};

export const SERVICE_LABEL = { reg: 'Reguler', yes: 'YES', jtr: 'Trucking (JTR)' };

export function pickService(costs, service) {
  const wanted = SERVICE_CODES[service] || SERVICE_CODES.reg;
  const up = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  for (const code of wanted) {
    const hit = costs.find((c) => up(c.service) === up(code));
    if (hit) return hit;
  }
  if (service === 'jtr') {
    const hit = costs.find((c) => up(c.service).startsWith('JTR'));
    if (hit) return hit;
  }
  return null;
}
