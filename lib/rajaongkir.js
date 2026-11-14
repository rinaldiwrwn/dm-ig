// Klien RajaOngkir API V2 (Komerce).
// Dokumentasi: https://rajaongkir.com/docs
// Kalau nanti pindah agregator (mis. Biteship), cukup buat file pengganti
// dengan dua fungsi yang sama: searchDestination() dan calculate().

const BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export class ApiError extends Error {}

export function createRajaOngkirClient({ apiKey, fetchImpl = globalThis.fetch, baseUrl = BASE_URL }) {
  if (!apiKey) throw new ApiError('RAJAONGKIR_API_KEY belum diisi.');

  async function call(path, init = {}) {
    const res = await fetchImpl(baseUrl + path, {
      ...init,
      headers: { key: apiKey, Accept: 'application/json', ...(init.headers || {}) },
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* respons bukan JSON */
    }
    const code = json?.meta?.code ?? res.status;
    if (code === 404) return []; // "Data not found"
    if (!res.ok || code !== 200) {
      const msg = json?.meta?.message || `HTTP ${res.status}`;
      throw new ApiError(`RajaOngkir error: ${msg}`);
    }
    return json.data || [];
  }

  return {
    // -> [{ id, label, province_name, city_name, district_name, subdistrict_name, zip_code }]
    async searchDestination(keyword) {
      const q = new URLSearchParams({ search: keyword, limit: '50', offset: '0' });
      return call(`/destination/domestic-destination?${q}`);
    },

    // -> [{ name, code, service, description, cost, etd }]
    async calculate({ origin, destination, weightGram }) {
      const body = new URLSearchParams({
        origin: String(origin),
        destination: String(destination),
        weight: String(weightGram),
        courier: 'jne',
        price: 'lowest',
      });
      return call('/calculate/domestic-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    },
  };
}
