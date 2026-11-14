import { parseInput } from './parse.js';
import { buildReply } from './format.js';
import { createRajaOngkirClient, ApiError } from './rajaongkir.js';
import { resolveDestination, pickService, describe, SERVICE_LABEL } from './resolve.js';

let cachedOrigin = null;

async function getOriginId(client, env) {
  if (env.ORIGIN_ID) return env.ORIGIN_ID;
  if (cachedOrigin) return cachedOrigin;
  const rows = await client.searchDestination(env.ORIGIN_SEARCH || 'kebayoran lama');
  const jkt = rows.find((r) => /KEBAYORAN LAMA/i.test(r.district_name || '') && /JAKARTA/i.test(r.city_name || ''))
    || rows.find((r) => /JAKARTA/i.test(r.city_name || r.label || '')) || rows[0];
  if (!jkt) throw new ApiError('Kota asal (Jakarta) tidak ditemukan. Isi ORIGIN_ID.');
  cachedOrigin = jkt.id;
  return cachedOrigin;
}

export function _resetCache() {
  cachedOrigin = null;
}

// body: { text, destinationId?, pin? }
// -> { status, json }
export async function handleOngkir(body, env, { fetchImpl } = {}) {
  if (env.ACCESS_PIN && String(body?.pin || '') !== String(env.ACCESS_PIN)) {
    return { status: 401, json: { error: 'PIN salah.' } };
  }

  const parsed = parseInput(body?.text);
  if (parsed.errors.length) {
    return { status: 400, json: { error: parsed.errors.join(' ') } };
  }

  // Ongkir diketik sendiri: tidak perlu tanya RajaOngkir.
  if (parsed.manualOngkir !== null) {
    const ongkirRupiah = Math.round(parsed.manualOngkir * 1000);
    return {
      status: 200,
      json: {
        reply: buildReply({ prices: parsed.prices, ongkirRupiah, sapaan: parsed.sapaan }),
        detail: {
          tujuan: 'Ongkir diisi manual',
          layanan: 'Manual',
          berat: null,
          ongkir: ongkirRupiah,
          etd: null,
          jumlahBarang: parsed.prices.length,
        },
      },
    };
  }

  try {
    const client = createRajaOngkirClient({ apiKey: env.RAJAONGKIR_API_KEY, fetchImpl });

    let destinationId = body?.destinationId;
    let destinationLabel = body?.destinationLabel || null;
    if (!destinationId) {
      const r = await resolveDestination(client, parsed.address);
      if (r.notFound) {
        return {
          status: 404,
          json: { error: `Tujuan "${parsed.address.join(', ')}" tidak ditemukan. Coba tulis nama kecamatannya saja.` },
        };
      }
      if (r.choices) {
        return { status: 200, json: { needChoice: true, choices: r.choices, parsed } };
      }
      destinationId = r.destination.id;
      destinationLabel = describe(r.destination);
    }

    const origin = await getOriginId(client, env);
    const weightGram = Math.max(1, Math.round(parsed.weightKg * 1000));
    const costs = await client.calculate({ origin, destination: destinationId, weightGram });
    const picked = pickService(costs, parsed.service);
    if (!picked) {
      const avail = costs.map((c) => c.service).join(', ') || 'tidak ada';
      return {
        status: 422,
        json: {
          error: `Layanan ${SERVICE_LABEL[parsed.service]} tidak tersedia ke tujuan ini. Tersedia: ${avail}.`,
        },
      };
    }

    const reply = buildReply({ prices: parsed.prices, ongkirRupiah: picked.cost, sapaan: parsed.sapaan });
    return {
      status: 200,
      json: {
        reply,
        detail: {
          tujuan: destinationLabel,
          layanan: `JNE ${picked.service}`,
          berat: `${parsed.weightKg} kg`,
          ongkir: picked.cost,
          etd: picked.etd || null,
          jumlahBarang: parsed.prices.length,
        },
      },
    };
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : `Gagal menghubungi RajaOngkir: ${err.message}`;
    return { status: 502, json: { error: msg } };
  }
}
