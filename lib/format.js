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

export const REKENING = '4980430176 a/n Rinaldi Wiriawan (BCA)';

// prices: array harga barang dalam ribuan (350 = 350rb)
// ongkirRupiah: ongkir dalam rupiah (18500)
// manual: true kalau ongkir diketik sendiri -> wording lebih singkat.
export function buildReply({ prices, ongkirRupiah, sapaan, manual = false }) {
  const packingRupiah = PACKING_PER_ITEM * prices.length;
  const totalRupiah =
    prices.reduce((sum, p) => sum + Math.round(p * 1000), 0) + ongkirRupiah + packingRupiah;

  const ongkir = ongkirRupiah / 1000;
  const total = totalRupiah / 1000;
  // Packing dijabarkan setelah tiap barang: 350+5+200+5+18
  const packingEach = fmtNum(PACKING_PER_ITEM / 1000);
  const rincian = prices.map((p) => `${fmtNum(p)}+${packingEach}`).join('+');

  // "ka" ditulis "kaa".
  const s = sapaan === 'ka' ? 'kaa' : sapaan;
  const transfer = `\n\nTransfernya kesini yaa:\n${REKENING}`; // tanpa sapaan

  if (manual) {
    return `Untuk totalnya jadi ${rincian}+${fmtNum(ongkir)}=${fmtRbK(total)} yaa ${s}` + transfer;
  }

  return (
    `Untuk kesitu ongkirnya jadi ${fmtRbK(ongkir)} dan biaya packingnya 5rb/item yaa ${s}, ` +
    `jadi totalnya ${rincian}+${fmtNum(ongkir)}=${fmtRbK(total)} ${s}` + transfer // setelah total: sapaan saja (tanpa "ya")
  );
}
