// Serverless function untuk Vercel: POST /api/ongkir
import { handleOngkir } from '../lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Gunakan POST.' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { status, json } = await handleOngkir(body || {}, process.env);
  res.status(status).json(json);
}
