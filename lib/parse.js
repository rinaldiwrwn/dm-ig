// Mengurai input bebas seperti:
//   "Tebet, 350, om"
//   "Jl. Melati 5, Cibinong, Bogor, 350 200, ka, 2kg, yes"
//   "Kemang; 1.250; om; trucking 10kg"
// Pisahkan bagian dengan koma / titik koma / baris baru.
// Bagian yang seluruh katanya dikenali (harga, sapaan, berat, layanan) dipakai
// sebagai parameter; sisanya dianggap alamat.

const SAPAAN = { om: 'om', ka: 'ka', kak: 'ka', kaka: 'ka', kakak: 'ka' };

const SERVICES = {
  reg: 'reg',
  reguler: 'reg',
  regular: 'reg',
  yes: 'yes',
  trucking: 'jtr',
  truck: 'jtr',
  jtr: 'jtr',
};

const WEIGHT_RE = /^(\d+(?:[.,]\d+)?)(kg|kilo|g|gr|gram)$/;
// 350 | 1.250 | 350rb | 1.250k
const PRICE_RE = /^(\d{1,3}(?:\.\d{3})+|\d+)(rb|k)?$/;

function classifyWord(word) {
  const w = word.toLowerCase();
  if (SAPAAN[w]) return { type: 'sapaan', value: SAPAAN[w] };
  if (SERVICES[w]) return { type: 'service', value: SERVICES[w] };

  const wm = w.match(WEIGHT_RE);
  if (wm) {
    const n = parseFloat(wm[1].replace(',', '.'));
    const kg = wm[2].startsWith('k') ? n : n / 1000;
    return { type: 'weight', value: kg };
  }

  const pm = w.match(PRICE_RE);
  if (pm) {
    const digits = pm[1].replace(/\./g, '');
    // Angka 5 digit tanpa satuan kemungkinan besar kode pos, bukan harga.
    if (!pm[2] && !pm[1].includes('.') && digits.length === 5) return null;
    return { type: 'price', value: parseInt(digits, 10) };
  }
  return null;
}

export function parseInput(text) {
  const result = {
    address: [],
    prices: [],
    sapaan: null,
    weightKg: 1,
    service: 'reg',
  };

  const segments = String(text || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    // satukan "2 kg" -> "2kg", "350 rb" -> "350rb"
    const normalized = seg.replace(/(\d)\s+(kg|kilo|gr|gram|g|rb|k)\b/gi, '$1$2');
    const words = normalized.split(/[\s+]+/).filter(Boolean);
    const classified = words.map(classifyWord);

    if (classified.length && classified.every(Boolean)) {
      for (const c of classified) {
        if (c.type === 'price') result.prices.push(c.value);
        else if (c.type === 'sapaan') result.sapaan = c.value;
        else if (c.type === 'service') result.service = c.value;
        else if (c.type === 'weight') result.weightKg = c.value;
      }
    } else {
      result.address.push(seg);
    }
  }

  const errors = [];
  if (!result.address.length) errors.push('Alamat / kecamatan tujuan belum ditulis.');
  if (!result.prices.length) errors.push('Harga barang belum ditulis.');
  if (!(result.weightKg > 0)) errors.push('Berat tidak valid.');
  if (!result.sapaan) result.sapaan = 'ka';

  return { ...result, errors };
}
