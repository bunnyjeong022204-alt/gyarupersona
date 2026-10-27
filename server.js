// 갸루 챗봇 서버: 정적 파일 + Groq API 프록시 (외부 의존성 없음, Node 18+)
// API 키는 브라우저 코드/저장소에 절대 포함되지 않고, 서버에 암호화되어 세션별로 보관됩니다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const GROQ_BASE = process.env.GROQ_BASE || 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 20 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

// ── 암호화 키 (서버 전용, 최초 실행 시 자동 생성) ──
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE);

const STORE_FILE = path.join(DATA_DIR, 'keys.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { store = {}; }
const saveStore = () => fs.writeFileSync(STORE_FILE, JSON.stringify(store), { mode: 0o600 });

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', SECRET, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function decrypt(blob) {
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', SECRET, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}

// ── 세션 (HttpOnly 쿠키) ──
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function getSid(req, res, create) {
  let sid = parseCookies(req).sid;
  if (sid && /^[a-f0-9]{48}$/.test(sid)) return sid;
  if (!create) return null;
  sid = crypto.randomBytes(24).toString('hex');
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`);
  return sid;
}
const getKey = (sid) => (sid && store[sid] ? decrypt(store[sid]) : null);

// ── 유틸 ──
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
const groqHeaders = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const VISION_PREFS = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
const VISION_RE = /llama-4|vision|-vl|scout|maverick|qwen3\.[5-9]|qwen3-?vl/i;
async function pickModel(key, requested, needVision) {
  const r = await fetch(`${GROQ_BASE}/models`, { headers: groqHeaders(key) }).catch(() => null);
  if (!r || !r.ok) return requested || DEFAULT_MODEL;
  const ids = ((await r.json()).data || []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|playai/i.test(id));
  if (requested && ids.includes(requested) && (!needVision || VISION_RE.test(requested))) return requested;
  const vision = VISION_PREFS.find((id) => ids.includes(id)) || ids.find((id) => VISION_RE.test(id));
  if (vision) return vision;
  return ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0] || DEFAULT_MODEL;
}
function groqError(status) {
  if (status === 401) return 'API 키가 올바르지 않아요. 설정에서 다시 입력해줘!';
  if (status === 429) return '요청이 너무 많거나 한도를 넘었어요. 잠시 후 다시 해봐!';
  if (status === 413) return '사진이 너무 커요. 더 작은 사진으로 해줘!';
  return `Groq 오류 (${status})`;
}

// ── API ──
async function handleApi(req, res, url) {
  // CSRF 방어: 변경 요청은 커스텀 헤더 필수 (SameSite=Strict 쿠키와 이중 방어)
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'gyaru-app') return json(res, 403, { error: 'forbidden' });

  if (url.pathname === '/api/key/status' && req.method === 'GET') {
    const key = getKey(getSid(req, res, false));
    return json(res, 200, { hasKey: !!key, hint: key ? '…' + key.slice(-4) : null, defaultModel: DEFAULT_MODEL });
  }

  if (url.pathname === '/api/key' && req.method === 'POST') {
    const body = await readBody(req);
    const key = String(body.key || '').trim();
    if (!/^[\w-]{20,200}$/.test(key)) return json(res, 400, { error: 'API 키 형식이 이상해요.' });
    const r = await fetch(`${GROQ_BASE}/models`, { headers: groqHeaders(key) }).catch(() => null);
    if (!r) return json(res, 502, { error: 'Groq 서버에 연결할 수 없어요.' });
    if (!r.ok) return json(res, 400, { error: groqError(r.status) });
    const sid = getSid(req, res, true);
    store[sid] = encrypt(key);
    saveStore();
    return json(res, 200, { ok: true, hint: '…' + key.slice(-4) });
  }

  if (url.pathname === '/api/key' && req.method === 'DELETE') {
    const sid = getSid(req, res, false);
    if (sid && store[sid]) { delete store[sid]; saveStore(); }
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/models' && req.method === 'GET') {
    const key = getKey(getSid(req, res, false));
    if (!key) return json(res, 401, { error: 'no_key' });
    const r = await fetch(`${GROQ_BASE}/models`, { headers: groqHeaders(key) }).catch(() => null);
    if (!r || !r.ok) return json(res, 502, { error: '모델 목록을 불러오지 못했어요.' });
    const data = await r.json();
    const models = (data.data || []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|playai/i.test(id)).sort();
    return json(res, 200, { models });
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const key = getKey(getSid(req, res, false));
    if (!key) return json(res, 401, { error: '먼저 설정에서 Groq API 키를 입력해줘!' });
    const body = await readBody(req);
    if (!Array.isArray(body.messages) || !body.messages.length) return json(res, 400, { error: 'messages 필요' });
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const r = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: groqHeaders(key),
      signal: ac.signal,
      body: JSON.stringify({
        model: await pickModel(key, body.model && String(body.model), JSON.stringify(body.messages).includes('"image_url"')),
        messages: body.messages,
        stream: true,
        temperature: 0.9,
        max_tokens: 1800,
      }),
    }).catch(() => null);
    if (!r) return json(res, 502, { error: 'Groq 서버에 연결할 수 없어요.' });
    if (!r.ok) {
      const detail = await r.json().then((j) => j.error?.message).catch(() => '');
      return json(res, r.status, { error: groqError(r.status) + (detail && r.status !== 401 ? ` - ${detail}` : '') });
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    try { for await (const chunk of r.body) res.write(chunk); } catch { /* 클라이언트 중단 */ }
    return res.end();
  }

  json(res, 404, { error: 'not_found' });
}

// ── 정적 파일 ──
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, e.message === 'too_large' ? 413 : 500, { error: e.message === 'too_large' ? '요청이 너무 커요.' : '서버 오류' });
    else res.end();
  }
}).listen(PORT, HOST, () => console.log(`갸루 챗봇 실행 중 → http://localhost:${PORT}`));
