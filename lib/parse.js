// Mengurai input bebas seperti:
//   "Tebet, 350, om"
//   "Jl. Melati 5, Cibinong, Bogor, 350 200, ka, 2kg, yes"
//   "Kemang; 1.250; om; trucking 10kg"
//   "Tebet, 350, Mann"           (kata terakhir setelah harga/berat/layanan = sapaan bebas, ditulis persis "Mann")
// Pisahkan bagian dengan koma / titik koma / baris baru.
// Bagian yang seluruh katanya dikenali (harga, sapaan, berat, layanan) dipakai
// sebagai parameter; sisanya dianggap alamat.

const SAPAAN = { om: 'om', ka: 'ka', kak: 'ka', kaka: 'ka', kakak: 'ka' };

// Sapaan bebas: satu kata di paling akhir isian, setelah bagian harga/berat/layanan (mis. "..., 350, mann").
// Ditulis persis seperti yang diketik (huruf besar kecil ikut): "mann" -> "mann", "Mann" -> "Mann", "NANGG" -> "NANGG".
// Hanya om dan ka (juga kak, kaka, kakak) yang punya arti sendiri.
const CUSTOM_WORD_RE = /^\p{L}{2,20}$/u;

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
// 350 | 1.250 | 350rb | 1.250k | 18.5 (desimal pakai titik, 1-2 angka)
const PRICE_RE = /^(\d{1,3}(?:\.\d{3})+|\d+\.\d{1,2}|\d+)(rb|k)?$/;
const THOUSANDS_RE = /^\d{1,3}(?:\.\d{3})+$/;

function classifyWord(word) {
  const w = word.toLowerCase();
  if (SAPAAN[w]) return { type: 'sapaan', value: SAPAAN[w] };
  if (SERVICES[w]) return { type: 'service', value: SERVICES[w] };
  if (w === 'ongkir' || w === 'ongkos') return { type: 'ongkirMarker' };

  const wm = w.match(WEIGHT_RE);
  if (wm) {
    const n = parseFloat(wm[1].replace(',', '.'));
    const kg = wm[2].startsWith('k') ? n : n / 1000;
    return { type: 'weight', value: kg };
  }

  const pm = w.match(PRICE_RE);
  if (pm) {
    // Angka 5 digit tanpa satuan kemungkinan besar kode pos, bukan harga.
    if (!pm[2] && /^\d{5}$/.test(pm[1])) return null;
    const value = THOUSANDS_RE.test(pm[1])
      ? parseInt(pm[1].replace(/\./g, ''), 10)
      : parseFloat(pm[1]);
    return { type: 'price', value };
  }
  return null;
}

function parseCore(text, extract) {
  const result = {
    address: [],
    prices: [],
    sapaan: null,
    weightKg: 1,
    service: 'reg',
    manualOngkir: null, // dalam ribuan, kalau ongkir diketik sendiri
  };
  // Bagian yang isinya angka saja, disimpan per bagian (urutan diketik).
  const numberSegments = [];

  const segments = String(text || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Kata terakhir yang tidak dikenal, tepat setelah bagian yang dikenal (harga/berat/layanan), adalah sapaan bebas.
  // Alamat tidak terambil, karena alamat diketik sebelum harga.
  const isRecognized = (seg) => {
    const c = seg.replace(/(\d)\s+(kg|kilo|gr|gram|g|rb|k)\b/gi, '$1$2').split(/[\s+]+/).filter(Boolean).map(classifyWord);
    return c.length > 0 && c.every(Boolean);
  };
  let custom = null;
  if (extract && segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (CUSTOM_WORD_RE.test(last) && !classifyWord(last) && isRecognized(segments[segments.length - 2])) {
      custom = last; // persis seperti yang diketik
      segments.pop();
    }
  }

  for (const seg of segments) {
    // satukan "2 kg" -> "2kg", "350 rb" -> "350rb"
    const normalized = seg.replace(/(\d)\s+(kg|kilo|gr|gram|g|rb|k)\b/gi, '$1$2');
    const words = normalized.split(/[\s+]+/).filter(Boolean);
    const classified = words.map(classifyWord);

    if (classified.length && classified.every(Boolean)) {
      const nums = classified.filter((c) => c.type === 'price').map((c) => c.value);
      if (classified.some((c) => c.type === 'ongkirMarker')) {
        // "ongkir 10" di mana saja = ongkir manual
        if (nums.length !== 1) {
          result.address.push(seg);
          continue;
        }
        result.manualOngkir = nums[0];
      } else if (nums.length) {
        numberSegments.push(nums);
      }
      for (const c of classified) {
        if (c.type === 'price' || c.type === 'ongkirMarker') continue;
        else if (c.type === 'sapaan') result.sapaan = c.value;
        else if (c.type === 'service') result.service = c.value;
        else if (c.type === 'weight') result.weightKg = c.value;
      }
    } else {
      result.address.push(seg);
    }
  }

  // Tanpa alamat: bagian angka pertama = ongkir (mis. "10, 350 200, ka").
  if (!result.address.length && result.manualOngkir === null && numberSegments.length >= 2 && numberSegments[0].length === 1) {
    result.manualOngkir = numberSegments.shift()[0];
  }
  result.prices = numberSegments.flat();

  const errors = [];
  if (!result.address.length && result.manualOngkir === null) {
    errors.push('Tulis alamat/kecamatan tujuan, atau ongkirnya di depan (mis. "10, 350, om").');
  }
  if (!result.prices.length) errors.push('Harga barang belum ditulis.');
  if (!(result.weightKg > 0)) errors.push('Berat tidak valid.');
  // Sapaan om/ka yang diketik langsung menang atas kata terakhir; tanpa keduanya dipakai sapaan bebas, lalu om.
  if (!result.sapaan) result.sapaan = custom || 'om';

  return { ...result, errors, customSapaan: !!custom && result.sapaan === custom };
}

export function parseInput(text) {
  const withCustom = parseCore(text, true);
  // Kata terakhir yang ternyata alamat (mis. "350, Tebet"): kalau membacanya sebagai sapaan membuat isian tidak valid, baca ulang tanpa itu.
  if (withCustom.customSapaan && withCustom.errors.length) {
    const plain = parseCore(text, false);
    if (!plain.errors.length) return plain;
  }
  return withCustom;
}
