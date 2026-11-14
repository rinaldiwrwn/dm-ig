// Format angka (dalam ribuan rupiah) ke gaya chat lelang.
// 18.5    -> "18,5"
// 1250    -> "1.250"
// 373     -> "373"
export function fmtNum(thousands) {
  const rounded = Math.round(thousands * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split('.');
  const intStr = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decStr = decPart.replace(/0+$/, '');
  return decStr ? `${intStr},${decStr}` : intStr;
}

// "rb" untuk ratusan ribu ke bawah, "k" kalau sudah jutaan (>= 1.000 ribu).
export function fmtRbK(thousands) {
  return fmtNum(thousands) + (thousands >= 1000 ? 'k' : 'rb');
}

export const PACKING_PER_ITEM = 5000; // rupiah

// prices: array harga barang dalam ribuan (350 = 350rb)
// ongkirRupiah: ongkir dalam rupiah (18500)
export function buildReply({ prices, ongkirRupiah, sapaan }) {
  const packingRupiah = PACKING_PER_ITEM * prices.length;
  const totalRupiah =
    prices.reduce((sum, p) => sum + Math.round(p * 1000), 0) + ongkirRupiah + packingRupiah;

  const ongkir = ongkirRupiah / 1000;
  const packing = packingRupiah / 1000;
  const total = totalRupiah / 1000;
  const hargaStr = prices.map(fmtNum).join('+');

  return (
    `Untuk kesitu ongkirnya jadi ${fmtRbK(ongkir)} dan biaya packingnya 5rb/item yaa ${sapaan}, ` +
    `jadi totalnya ${hargaStr}+${fmtNum(ongkir)}+${fmtRbK(packing)}=${fmtRbK(total)} ya ${sapaan}`
  );
}
