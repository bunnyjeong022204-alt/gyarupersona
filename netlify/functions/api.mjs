// Netlify Function: Groq 프록시. API 키는 서버 비밀값으로 암호화해 HttpOnly 쿠키에 보관합니다.
// (DB 불필요 — 브라우저 JS는 키를 읽을 수 없고, 서버만 복호화할 수 있어요.)
import crypto from 'node:crypto';

const GROQ_BASE = process.env.GROQ_BASE || 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const COOKIE = 'gk';

export const config = { path: '/api/*' };

const secret = () => {
  const s = process.env.KEY_SECRET;
  if (!s || s.length < 16) throw new Error('KEY_SECRET 환경변수가 설정되지 않았어요 (16자 이상).');
  return crypto.createHash('sha256').update(s).digest();
};
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secret(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
function decrypt(blob) {
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', secret(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}
const readCookie = (req) => {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decrypt(m[1]) : null;
};
const setCookie = (val, maxAge) => `${COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const json = (code, obj, cookie) => new Response(JSON.stringify(obj), {
  status: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) },
});
const gh = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const groqError = (s) => s === 401 ? 'API 키가 올바르지 않아요. 설정에서 다시 입력해줘!' : s === 429 ? '요청이 너무 많거나 한도를 넘었어요. 잠시 후 다시 해봐!' : s === 413 ? '사진이 너무 커요. 더 작은 사진으로 해줘!' : `Groq 오류 (${s})`;

const VISION_PREFS = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
const VISION_RE = /llama-4|vision|-vl|scout|maverick|qwen3\.[5-9]|qwen3-?vl/i;
async function pickModel(key, requested, needVision) {
  const r = await fetch(`${GROQ_BASE}/models`, { headers: gh(key) }).catch(() => null);
  if (!r || !r.ok) return requested || DEFAULT_MODEL;
  const ids = ((await r.json()).data || []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|playai/i.test(id));
  if (requested && ids.includes(requested) && (!needVision || VISION_RE.test(requested))) return requested;
  const vision = VISION_PREFS.find((id) => ids.includes(id)) || ids.find((id) => VISION_RE.test(id));
  if (vision) return vision;
  return ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0] || DEFAULT_MODEL;
}

export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/$/, '');
  try {
    if (req.method !== 'GET' && req.headers.get('x-requested-with') !== 'gyaru-app') return json(403, { error: 'forbidden' });

    if (p === '/api/key/status' && req.method === 'GET') {
      const key = readCookie(req);
      return json(200, { hasKey: !!key, hint: key ? '…' + key.slice(-4) : null, defaultModel: DEFAULT_MODEL });
    }
    if (p === '/api/key' && req.method === 'POST') {
      const key = String((await req.json().catch(() => ({}))).key || '').trim();
      if (!/^[\w-]{20,200}$/.test(key)) return json(400, { error: 'API 키 형식이 이상해요.' });
      const r = await fetch(`${GROQ_BASE}/models`, { headers: gh(key) }).catch(() => null);
      if (!r) return json(502, { error: 'Groq 서버에 연결할 수 없어요.' });
      if (!r.ok) return json(400, { error: groqError(r.status) });
      return json(200, { ok: true, hint: '…' + key.slice(-4) }, setCookie(encrypt(key), 31536000));
    }
    if (p === '/api/key' && req.method === 'DELETE') return json(200, { ok: true }, setCookie('', 0));

    if (p === '/api/models' && req.method === 'GET') {
      const key = readCookie(req);
      if (!key) return json(401, { error: 'no_key' });
      const r = await fetch(`${GROQ_BASE}/models`, { headers: gh(key) }).catch(() => null);
      if (!r || !r.ok) return json(502, { error: '모델 목록을 불러오지 못했어요.' });
      const models = ((await r.json()).data || []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|playai/i.test(id)).sort();
      return json(200, { models });
    }
    if (p === '/api/chat' && req.method === 'POST') {
      const key = readCookie(req);
      if (!key) return json(401, { error: '먼저 설정에서 Groq API 키를 입력해줘!' });
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.messages) || !body.messages.length) return json(400, { error: 'messages 필요' });
      const model = await pickModel(key, body.model && String(body.model), JSON.stringify(body.messages).includes('"image_url"'));
      const r = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: 'POST', headers: gh(key), signal: req.signal,
        body: JSON.stringify({ model, messages: body.messages, stream: true, temperature: 0.9, max_tokens: 1800 }),
      }).catch(() => null);
      if (!r) return json(502, { error: 'Groq 서버에 연결할 수 없어요.' });
      if (!r.ok) {
        const detail = await r.json().then((j) => j.error?.message).catch(() => '');
        return json(r.status, { error: groqError(r.status) + (detail && r.status !== 401 ? ` - ${detail}` : '') });
      }
      return new Response(r.body, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
    }
    return json(404, { error: 'not_found' });
  } catch (e) {
    return json(500, { error: e.message || '서버 오류' });
  }
};
