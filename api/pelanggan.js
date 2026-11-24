// Serverless function untuk Vercel: POST /api/pelanggan
import { saveCustomer } from '../lib/monitor.js';

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
  const { status, json } = await saveCustomer(body || {}, process.env);
  res.status(status).json(json);
}
