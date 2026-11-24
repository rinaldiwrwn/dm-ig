# dm-ig

Alat kecil untuk membalas DM Instagram lelang lebih cepat: ketik alamat/kecamatan, harga, dan sapaan,
lalu keluar teks siap tempel seperti:

> Untuk kesitu ongkirnya jadi 18,5rb dan biaya packingnya 5rb/item yaa om, jadi totalnya 350+5+18,5=373,5rb om
>
> Transfernya kesini yaa:
> 4980430176 a/n Rinaldi Wiriawan (BCA)

Tarif diambil dari **RajaOngkir API (Komerce)** untuk kurir **JNE**, asal **Kebayoran Lama, Jakarta Selatan**.

## Cara pakai

Ketik dipisah koma:

| Input | Arti |
|---|---|
| `Tebet, 350, om` | Ke Tebet, 1 barang 350rb, sapaan "om" (default 1 kg, Reguler) |
| `Cibinong, Bogor, 350 200, ka` | 2 barang (350rb & 200rb), packing jadi 10rb |
| `Medan, 1.250, om, 3kg, yes` | Berat 3 kg, layanan YES |
| `Makassar, 500, ka, trucking, 10kg` | Layanan JNE Trucking (JTR) |
| `10, 350 200, ka` | Ongkir sudah tahu (10rb), tanpa cek ke RajaOngkir → `Untuk totalnya jadi 350+5+200+5+10=570rb yaa kaa` + baris rekening transfer |
| `350, ongkir 12.5, om` | Sama, pakai kata `ongkir`; desimal pakai titik |

Aturan:
- Harga ditulis dalam **ribuan** (`350` = 350rb, `1.250` = 1,25 juta).
- Hasil < 1 juta ditulis `rb`, ≥ 1 juta ditulis `k` (contoh `1.250k`). Desimal pakai koma (`18,5rb`).
- Packing 5rb × jumlah harga yang ditulis.
- Sapaan: `om` atau `ka` (ditulis `kaa`), atau **sapaan bebas**: satu kata di paling akhir, setelah bagian harga/berat/layanan, mis. `Tebet, 350, Mann` atau `10, 350 200, nangg`. Sapaan bebas ditulis **persis seperti yang diketik** (huruf besar kecilnya ikut): `Mann` tetap `Mann`, `mann` tetap `mann`, `NANGG` tetap `NANGG`. Alamat di akhir (mis. `350, Tebet`) tidak ikut terbaca sebagai sapaan. Tanpa sapaan dipakai `om`.
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

### Simpan pelanggan ke Lelang Monitor (opsional)

Setelah ongkir dihitung, pelanggan bisa langsung disimpan ke dashboard Lelang Monitor sebagai *pelanggan lama*
(username, ongkir, sapaan), sehingga rekap total di sana memakai ongkir yang sama dan tidak diketik ulang.

1. Di Lelang Monitor, isi variabel `CUSTOMER_API_TOKEN` dengan kunci rahasia yang panjang dan acak.
2. Di proyek ini (Vercel), tambahkan:

| Variabel | Keterangan |
|---|---|
| `MONITOR_URL` | Alamat dashboard, mis. `https://nama-dashboard.vercel.app` |
| `MONITOR_TOKEN` | Sama persis dengan `CUSTOMER_API_TOKEN` di dashboard |

3. Isi kolom **Username Instagram** sebelum menekan *Buat balasan*, lalu tekan tombol **Simpan ... ke Lelang Monitor**
   yang muncul di bawah hasil. Pemanggilannya dari server ke server (`/api/pelanggan`), jadi token tidak pernah sampai
   ke browser, dan memakai PIN yang sama dengan pengecekan ongkir.

Ongkir desimal tetap bekerja: `18.5` menjadi 18,5rb di dashboard.

Saat username diisi, webapp mengecek ke dashboard apakah akun itu **sudah ada di database pemenang lama** dan mengingatkannya (dengan ongkir dan sapaan yang tersimpan) sebelum kamu menyimpan.

Kalau akun itu **sudah ada** di dashboard, datanya tidak ditimpa diam-diam: muncul pertanyaan dengan data lama dan data baru, dan kamu memilih *Timpa data lama* atau *Batal, biarkan data lama*.

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
