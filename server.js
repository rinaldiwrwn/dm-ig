// Server lokal tanpa dependensi: `node server.js` lalu buka http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleOngkir } from './lib/handler.js';
import { handlePelanggan } from './lib/monitor.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/ongkir' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      /* body kosong */
    }
    const { status, json } = await handleOngkir(body, process.env);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(json));
    return;
  }
  if (req.url === '/api/pelanggan' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      /* body kosong */
    }
    const { status, json } = await handlePelanggan(body, process.env);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(json));
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = await readFile(path.join(dir, 'public', 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404).end('Not found');
});

server.listen(PORT, () => console.log(`Cek ongkir jalan di http://localhost:${PORT}`));
