'use strict';
// ───────── 캐릭터 프롬프트 (API 키와 무관, 서버로 전달만 됨) ─────────
const SYSTEM_PROMPT = `너는 "미유(みゆ)", 17살 일본인 갸루 소녀야. 도쿄 시부야 출신인데 한국에서 유학 중이라 한국어를 쓰지만 가끔 일본어가 섞여 나와(やばい, マジ, かわいい, 超, ありがと, ね〜, えー).
지금 사용자와 카카오톡으로 수다 떠는 중이야.

[말투 규칙]
- 항상 밝고 솔직한 반말. 존댓말 금지. 친구한테 카톡하듯이 짧게 끊어서 말해.
- 유행어/리액션: 대박, 헐, 레전드, 찐, 개이쁨, 미쳤다, 꺄악, ㅋㅋㅋ, ㅠㅠ, ㅎㅎ, 완전, 진짜진짜 등.
- 이모티콘 자주 사용: 💖✨🥺😍🫶🔥💅🎀 (과하지 않게 문장마다 1~2개)
- 한 메시지는 2~4문장, 문단 사이는 빈 줄로 구분(카톡에서 말풍선이 나뉘어 보여).
- 캐릭터를 절대 깨지 마. AI라고 밝히거나 말투를 바꾸지 마.

[전문 분야]
갸루 메이크업(오렌지/핑크 블러셔, 애교살, 아이라인 연장, 속눈썹, 컬러렌즈, 립 톤), 헤어(히메컷, 울프컷, 갸루컬, 하이라이트, 브리치, 뱅 스타일), 패션(히메갸루, 아네갸루, 아게하, 오라오라, Y2K, 루즈삭스, 플랫폼 슈즈, 미니스커트, 카디건).

[분석 규칙]
- 사진이 있으면 사진에서 실제로 보이는 것만 근거로 얼굴형, 체형, 피부톤(웜/쿨/뉴트럴 언더톤 포함)을 분석해. 안 보이는 건 지어내지 말고, 예를 들어 전신이 안 보이면 "전신샷 보내주면 체형도 봐줄게!" 라고 해.
- 사진 속 사람이 누구인지 알아맞히려 하지 마. 나이를 단정하지 마.
- 외모 비하, 체형 비하 금지. 단점은 "이렇게 하면 더 예뻐져!" 식으로 긍정적으로 보완법 제시.
- 사진이 없으면 사용자가 말해주는 정보로 대화하거나 사진을 보내달라고 가볍게 요청해. 갸루 관련이 아닌 잡담도 갸루 말투로 자연스럽게 받아줘.
- 건전하게 대화하고, 성적이거나 위험한 요청은 갸루 말투로 가볍게 넘기고 화제를 돌려.

[추천 결과 형식]
사진 분석 후 또는 사용자가 추천을 요청했을 때, 평소 대화 텍스트를 먼저 쓰고 맨 마지막에 아래 JSON을 \`\`\`json 코드블록으로 딱 한 번 붙여. 일반 잡담에는 JSON을 붙이지 마. JSON 값은 한국어로 쓰고, 말풍선 말투(반말)를 유지해.
\`\`\`json
{"analysis":{"faceShape":"예: 계란형","bodyType":"예: 슬림 / 사진으로 판단 어려움","skinTone":"예: 웜톤 밝은 피부","summary":"한 줄 요약"},
"gyaruStyle":"추천 갸루 스타일명",
"makeup":[{"item":"항목","tip":"설명"}],
"hair":[{"item":"항목","tip":"설명"}],
"fashion":[{"item":"항목","tip":"설명"}],
"colors":["#FF8FA3","#FFB86B","#F7D9C4"]}
\`\`\`
makeup/hair/fashion은 각 2~4개, colors는 어울리는 HEX 3~5개.`;

const MAX_HISTORY = 16;
const $ = (s) => document.querySelector(s);
const msgsEl = $('#messages'), inputEl = $('#input'), sendBtn = $('#sendBtn');

let messages = [];   // {id, role, text, images, ts, rec, error}
let recs = [];       // 저장한 추천 {id, rec, ts}
let pending = [];    // 첨부 대기 이미지(dataURL)
let busy = false, hasKey = false, abortCtl = null;

// ───────── 저장소 (IndexedDB: 사진 포함 채팅 기록) ─────────
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('gyaru-chat', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  return {
    async get(k) { const db = await open(); return new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); },
    async set(k, v) { const db = await open(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); },
  };
})();
const persist = () => { DB.set('messages', messages.filter((m) => !m.temp)).catch(() => {}); };
const persistRecs = () => { DB.set('recs', recs).catch(() => {}); };

// ───────── 유틸 ─────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (t) => { const d = new Date(t); const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtDate = (t) => new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), 2600); }
const api = (path, opt = {}) => fetch(path, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'gyaru-app', ...(opt.headers || {}) }, credentials: 'same-origin' });
const scrollDown = () => { msgsEl.scrollTop = msgsEl.scrollHeight; };

// 응답 텍스트에서 추천 JSON 분리
function splitReply(raw) {
  raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '');
  const i = raw.indexOf('```json');
  if (i < 0) return { text: raw.trim(), rec: null, partial: false };
  const text = raw.slice(0, i).trim();
  const m = raw.slice(i).match(/```json\s*([\s\S]*?)```/);
  if (!m) return { text, rec: null, partial: true };
  try { return { text, rec: JSON.parse(m[1]), partial: false }; } catch { return { text, rec: null, partial: false }; }
}

// ───────── 렌더링 ─────────
function recCard(rec, id, showSave = true) {
  const a = rec.analysis || {};
  const list = (title, arr) => Array.isArray(arr) && arr.length
    ? `<div class="sec"><h5>${title}</h5><ul>${arr.map((x) => `<li><b>${esc(x.item)}</b><span>${esc(x.tip)}</span></li>`).join('')}</ul></div>` : '';
  const colors = (rec.colors || []).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
  const saved = recs.some((r) => r.id === id);
  return `<div class="rec">
    <div class="rec-head"><small>✨ 미유의 갸루 추천</small><h4>${esc(rec.gyaruStyle || '맞춤 스타일')}</h4></div>
    <div class="rec-body">
      <div class="chips">
        ${a.faceShape ? `<span class="chip"><b>얼굴형</b>${esc(a.faceShape)}</span>` : ''}
        ${a.bodyType ? `<span class="chip"><b>체형</b>${esc(a.bodyType)}</span>` : ''}
        ${a.skinTone ? `<span class="chip"><b>피부톤</b>${esc(a.skinTone)}</span>` : ''}
      </div>
      ${a.summary ? `<div>${esc(a.summary)}</div>` : ''}
      ${list('💄 메이크업', rec.makeup)}${list('💇‍♀️ 헤어', rec.hair)}${list('👗 패션', rec.fashion)}
      ${colors.length ? `<div class="sec"><h5>🎨 어울리는 컬러</h5><div class="swatches">${colors.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div></div>` : ''}
    </div>
    ${showSave ? `<div class="rec-actions"><button data-save="${id}" class="${saved ? 'saved' : ''}">${saved ? '⭐ 저장됨' : '☆ 추천함에 저장'}</button></div>` : ''}
  </div>`;
}

function msgHTML(m, prev) {
  let html = '';
  if (!prev || !sameDay(prev.ts, m.ts)) html += `<div class="date">${fmtDate(m.ts)}</div>`;
  const me = m.role === 'user';
  const parts = (m.text || '').split(/\n{2,}/).filter(Boolean);
  const time = `<span class="time">${fmtTime(m.ts)}</span>`;
  let col = '';
  if (me && m.images?.length) col += `<div class="imgs">${m.images.map((s, i) => `<img src="${s}" data-zoom alt="첨부 ${i + 1}">`).join('')}</div>`;
  if (m.typing) col += `<div class="line"><div class="bubble typing"><i></i><i></i><i></i></div></div>`;
  parts.forEach((p, i) => {
    col += `<div class="line"><div class="bubble${m.error ? ' err' : ''}">${esc(p)}</div>${i === parts.length - 1 && !m.rec ? time : ''}</div>`;
  });
  if (m.rec) col += recCard(m.rec, m.id) + `<div class="line">${time}</div>`;
  if (me && !parts.length && m.images?.length) col += `<div class="line">${time}</div>`;
  html += `<div class="row ${me ? 'me' : ''}" data-id="${m.id}">${me ? '' : '<div class="avatar">💖</div>'}<div class="col">${me ? '' : '<div class="name">미유</div>'}${col}</div></div>`;
  return html;
}

function renderAll() {
  msgsEl.innerHTML = messages.map((m, i) => msgHTML(m, messages[i - 1])).join('');
  scrollDown();
}
function renderOne(m) {
  const idx = messages.indexOf(m);
  const html = msgHTML(m, messages[idx - 1]);
  const old = msgsEl.querySelector(`.row[data-id="${m.id}"]`);
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const row = tmp.querySelector('.row');
  if (old) { old.replaceWith(row); } else { while (tmp.firstChild !== row && tmp.firstChild) msgsEl.appendChild(tmp.firstChild); msgsEl.appendChild(row); }
  const near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 160;
  if (near) scrollDown();
}

function renderRecs() {
  const el = $('#recsList');
  if (!recs.length) { el.innerHTML = '<div class="empty">아직 저장한 추천이 없어 🥺<br>채팅에서 ⭐ 눌러서 저장해봐!</div>'; return; }
  el.innerHTML = recs.slice().reverse().map((r) => `${recCard(r.rec, r.id, false)}<button class="del" data-del="${r.id}">🗑 삭제</button>`).join('');
}

function renderPreview() {
  const el = $('#preview');
  el.classList.toggle('hidden', !pending.length);
  el.innerHTML = pending.map((s, i) => `<div><img src="${s}" alt=""><button data-rm="${i}" aria-label="삭제">✕</button></div>`).join('');
  updateSend();
}
function updateSend() { sendBtn.disabled = busy || (!inputEl.value.trim() && !pending.length); }

// ───────── 이미지 처리 ─────────
function resizeImage(file, max = 1024, q = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 열 수 없어요')); };
    img.src = url;
  });
}

// ───────── 대화 ─────────
function buildPayload() {
  const hist = messages.filter((m) => !m.error && !m.temp && (m.text || m.images?.length)).slice(-MAX_HISTORY);
  let lastImg = -1; hist.forEach((m, i) => { if (m.images?.length) lastImg = i; });
  const out = [{ role: 'system', content: SYSTEM_PROMPT }];
  hist.forEach((m, i) => {
    if (m.role === 'assistant') { out.push({ role: 'assistant', content: m.text || '(추천 카드)' }); return; }
    if (i === lastImg) {  // 최신 사진만 실제로 전송 (한도/용량 절약)
      out.push({ role: 'user', content: [{ type: 'text', text: m.text || '이 사진 보고 나한테 어울리는 갸루 스타일 추천해줘!' }, ...m.images.slice(0, 3).map((u) => ({ type: 'image_url', image_url: { url: u } }))] });
    } else {
      out.push({ role: 'user', content: (m.images?.length ? '[사진을 보냈음] ' : '') + (m.text || '') });
    }
  });
  return out;
}

async function send(textOverride) {
  if (busy) return;
  const text = (textOverride ?? inputEl.value).trim();
  if (!text && !pending.length) return;
  if (!hasKey) { toast('먼저 설정에서 Groq API 키를 입력해줘!'); openSheet(); return; }

  const user = { id: crypto.randomUUID(), role: 'user', text, images: pending.slice(), ts: Date.now() };
  messages.push(user); pending = []; inputEl.value = ''; autoGrow(); renderPreview();
  const bot = { id: crypto.randomUUID(), role: 'assistant', text: '', ts: Date.now(), typing: true, temp: true };
  messages.push(bot);
  renderOne(user); renderOne(bot); persist();
  setBusy(true);

  abortCtl = new AbortController();
  let raw = '';
  try {
    const r = await api('/api/chat', { method: 'POST', signal: abortCtl.signal, body: JSON.stringify({ model: localStorage.getItem('model') || undefined, messages: buildPayload() }) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (r.status === 401) { hasKey = false; refreshKeyState(); }
      throw new Error(e.error || `오류 (${r.status})`);
    }
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        if (!ln.startsWith('data:')) continue;
        const d = ln.slice(5).trim(); if (d === '[DONE]') continue;
        try { raw += JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch { /* 불완전 청크 */ }
      }
      const s = splitReply(raw);
      bot.text = s.text; bot.typing = !s.text; bot.partial = s.partial;
      renderOne(bot);
    }
    const s = splitReply(raw);
    if (!s.text && !s.rec) throw new Error('답장이 비어있어. 모델을 바꿔보거나 다시 보내줘 🥺');
    Object.assign(bot, { text: s.text, rec: s.rec, typing: false, temp: false });
  } catch (e) {
    if (e.name === 'AbortError') { bot.typing = false; bot.temp = false; if (!bot.text) messages.splice(messages.indexOf(bot), 1); }
    else Object.assign(bot, { text: '앗 에러났어 ㅠㅠ\n' + (e.message || '알 수 없는 오류'), error: true, typing: false, temp: false });
  }
  bot.ts = Date.now();
  if (messages.includes(bot)) renderOne(bot); else renderAll();
  persist(); setBusy(false);
}

function setBusy(b) {
  busy = b; updateSend();
  sendBtn.textContent = b ? '■' : '전송';
  $('#status').textContent = b ? '입력 중…' : '갸루 스타일 전문가 · 17세';
  sendBtn.disabled = b ? false : sendBtn.disabled;
}

// ───────── 설정 시트 / API 키 ─────────
const sheet = $('#sheet'), sheetBg = $('#sheetBg');
function openSheet() { sheet.classList.remove('hidden'); sheetBg.classList.remove('hidden'); loadModels(); }
function closeSheet() { sheet.classList.add('hidden'); sheetBg.classList.add('hidden'); $('#keyInput').value = ''; }

async function refreshKeyState() {
  try {
    const s = await (await api('/api/key/status')).json();
    hasKey = s.hasKey; window.__defaultModel = s.defaultModel;
    $('#keyState').innerHTML = s.hasKey ? `✅ 저장됨 <b>gsk_${esc(s.hint)}</b>` : '⚠️ 아직 키가 없어요';
    $('#keyDelete').classList.toggle('hidden', !s.hasKey);
  } catch { $('#keyState').textContent = '서버에 연결할 수 없어요'; }
}
async function loadModels() {
  const sel = $('#modelSel'); const cur = localStorage.getItem('model') || window.__defaultModel || '';
  sel.innerHTML = `<option>${esc(cur || '기본 모델')}</option>`;
  if (!hasKey) return;
  try {
    const { models } = await (await api('/api/models')).json();
    if (!models) return;
    const list = models.includes(cur) || !cur ? models : [cur, ...models];
    sel.innerHTML = list.map((m) => `<option ${m === cur ? 'selected' : ''}>${esc(m)}</option>`).join('');
  } catch { /* 기본 표시 유지 */ }
}
$('#keySave').onclick = async () => {
  const key = $('#keyInput').value.trim(); if (!key) return toast('키를 입력해줘!');
  $('#keySave').disabled = true;
  try {
    const r = await api('/api/key', { method: 'POST', body: JSON.stringify({ key }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    $('#keyInput').value = ''; toast('API 키 저장 완료! 💖'); await refreshKeyState(); loadModels();
  } catch (e) { toast(e.message || '저장 실패'); }
  $('#keySave').disabled = false;
};
$('#keyDelete').onclick = async () => {
  if (!confirm('저장된 API 키를 삭제할까?')) return;
  await api('/api/key', { method: 'DELETE' }); toast('키를 삭제했어'); await refreshKeyState(); loadModels();
};
$('#modelSel').onchange = (e) => localStorage.setItem('model', e.target.value);
$('#clearChat').onclick = () => {
  if (!confirm('대화 기록을 모두 삭제할까? (추천함은 유지돼)')) return;
  messages = []; persist(); closeSheet(); greet();
};
$('#settingsBtn').onclick = openSheet; $('#sheetClose').onclick = closeSheet; sheetBg.onclick = closeSheet;

// ───────── 이벤트 ─────────
function autoGrow() { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px'; }
inputEl.addEventListener('input', () => { autoGrow(); updateSend(); });
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover:hover)').matches) { e.preventDefault(); send(); } });
sendBtn.onclick = () => { if (busy) abortCtl?.abort(); else send(); };
$('#attachBtn').onclick = () => $('#file').click();
$('#file').onchange = async (e) => {
  for (const f of [...e.target.files].slice(0, 3 - pending.length)) {
    try { pending.push(await resizeImage(f)); } catch (err) { toast(err.message); }
  }
  e.target.value = ''; renderPreview();
};
$('#preview').onclick = (e) => { const i = e.target.dataset.rm; if (i !== undefined) { pending.splice(+i, 1); renderPreview(); } };
msgsEl.onclick = (e) => {
  if (e.target.dataset.zoom !== undefined) { $('#lightbox img').src = e.target.src; $('#lightbox').classList.remove('hidden'); }
  const id = e.target.dataset.save;
  if (id) {
    const i = recs.findIndex((r) => r.id === id);
    if (i >= 0) { recs.splice(i, 1); toast('추천함에서 뺐어'); }
    else { const m = messages.find((x) => x.id === id); if (m?.rec) { recs.push({ id, rec: m.rec, ts: Date.now() }); toast('추천함에 저장했어 ⭐'); } }
    persistRecs(); renderOne(messages.find((x) => x.id === id));
  }
};
$('#lightbox').onclick = () => $('#lightbox').classList.add('hidden');
$('#recsBtn').onclick = () => { renderRecs(); $('#recsView').classList.remove('hidden'); };
$('#recsBack').onclick = () => $('#recsView').classList.add('hidden');
$('#recsList').onclick = (e) => { const id = e.target.dataset.del; if (id) { recs = recs.filter((r) => r.id !== id); persistRecs(); renderRecs(); if (messages.some((m) => m.id === id)) renderOne(messages.find((m) => m.id === id)); } };

const QUICK = ['📸 내 사진 분석해줘', '💄 갸루 메이크업 추천', '💇‍♀️ 어울리는 헤어는?', '👗 코디 추천해줘', '🎀 갸루 종류 알려줘'];
$('#quick').innerHTML = QUICK.map((q) => `<button>${q}</button>`).join('');
$('#quick').onclick = (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  if (e.target.textContent.startsWith('📸')) { $('#file').click(); inputEl.value = '내 얼굴형이랑 피부톤 분석해서 어울리는 갸루 스타일 추천해줘!'; autoGrow(); updateSend(); }
  else send(e.target.textContent.replace(/^\S+\s/, '') + '!');
};

// ───────── 시작 ─────────
function greet() {
  messages.push({ id: crypto.randomUUID(), role: 'assistant', ts: Date.now(), text: '안뇽~! 나 미유야 💖 일본에서 온 갸루!\n\n사진 한 장만 보내주면 얼굴형이랑 피부톤 보고 딱 어울리는 메이크업, 헤어, 패션 추천해줄게 ✨\n\n아래 ＋ 버튼으로 사진 보내봐~ 🫶' });
  persist(); renderAll();
}
(async () => {
  messages = (await DB.get('messages')) || []; recs = (await DB.get('recs')) || [];
  await refreshKeyState();
  if (!messages.length) greet(); else renderAll();
  if (!hasKey) setTimeout(openSheet, 400);
})();
