# cek-ongkir-JNE

Alat kecil untuk membalas DM Instagram lelang lebih cepat: ketik alamat/kecamatan, harga, dan sapaan,
lalu keluar teks siap tempel seperti:

> Untuk kesitu ongkirnya jadi 18,5rb dan biaya packingnya 5rb/item yaa om, jadi totalnya 350+18,5+5rb=373,5rb ya om

Tarif diambil dari **RajaOngkir API (Komerce)** untuk kurir **JNE**, asal **Kebayoran Lama, Jakarta Selatan**.

## Cara pakai

Ketik dipisah koma:

| Input | Arti |
|---|---|
| `Tebet, 350, om` | Ke Tebet, 1 barang 350rb, sapaan "om" (default 1 kg, Reguler) |
| `Cibinong, Bogor, 350 200, ka` | 2 barang (350rb & 200rb), packing jadi 10rb |
| `Medan, 1.250, om, 3kg, yes` | Berat 3 kg, layanan YES |
| `Makassar, 500, ka, trucking, 10kg` | Layanan JNE Trucking (JTR) |

Aturan:
- Harga ditulis dalam **ribuan** (`350` = 350rb, `1.250` = 1,25 juta).
- Hasil < 1 juta ditulis `rb`, ≥ 1 juta ditulis `k` (contoh `1.250k`). Desimal pakai koma (`18,5rb`).
- Packing 5rb × jumlah harga yang ditulis.
- Kalau sapaan tidak ditulis, dipakai `om`.
- Kalau nama kecamatan ada di beberapa kota, halaman akan menampilkan pilihan. Menambahkan nama kota
  (`Cibinong, Bogor`) biasanya langsung tepat.
- Untuk tujuan Jabodetabek, JNE memakai kode layanan **CTC** (pengganti REG) dan **CTCYES** (pengganti YES); ini
  sudah ditangani otomatis.

## Setup

1. Daftar di [RajaOngkir / Komerce](https://rajaongkir.com) dan ambil **API key** (Cek Ongkir / Shipping Cost).
2. Deploy ke [Vercel](https://vercel.com) (gratis): *Add New → Project → Import* repo ini, framework preset **Other**.
3. Di *Settings → Environment Variables* isi:

| Variabel | Wajib | Keterangan |
|---|---|---|
| `RAJAONGKIR_API_KEY` | ya | API key RajaOngkir |
| `ACCESS_PIN` | disarankan | PIN supaya orang lain yang tahu link tidak menghabiskan kuota API |
| `ORIGIN_ID` | tidak | ID lokasi asal di RajaOngkir. Kalau kosong, dicari otomatis dari `ORIGIN_SEARCH` |
| `ORIGIN_SEARCH` | tidak | Kata kunci asal, default `kebayoran lama` (Jakarta Selatan) |

4. Buka link Vercel-nya di HP, simpan ke Home Screen.

### Jalan di komputer sendiri

```bash
RAJAONGKIR_API_KEY=xxxx node server.js   # buka http://localhost:3000
npm test                                  # tes logika (tanpa internet)
```

Butuh Node.js 18+. Tidak ada dependensi tambahan.

## Struktur

- `lib/parse.js` mengurai input bebas
- `lib/format.js` memformat angka rb/k dan template balasan
- `lib/rajaongkir.js` klien API (ganti file ini kalau pindah agregator, mis. Biteship)
- `lib/resolve.js` mencocokkan alamat ke kecamatan dan memilih layanan JNE
- `lib/handler.js` alur utama
- `api/ongkir.js` endpoint Vercel, `server.js` server lokal, `public/index.html` tampilan
