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

// ───────── 아이콘 (SVG, 24px 기준 선 아이콘) ─────────
const ICONS = {
  sparkle: '<path d="M12 2.5l2.3 6.7 6.7 2.3-6.7 2.3L12 20.5l-2.3-6.7L3 11.5l6.7-2.3z"/>',
  heart: '<path d="M12 20.3s-7.6-4.5-7.6-10.1a4.3 4.3 0 0 1 7.6-2.7 4.3 4.3 0 0 1 7.6 2.7c0 5.6-7.6 10.1-7.6 10.1z"/>',
  star: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.7l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
  bookmark: '<path d="M6.5 3.5h11v17L12 16.6l-5.5 3.9z"/>',
  camera: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  wand: '<path d="M4.5 19.5L15 9"/><path d="M14 4.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="M19 12l.5 1.3 1.3.5-1.3.5L19 15.6l-.5-1.3-1.3-.5 1.3-.5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 1.6-2-.5-1.2.2-2.5 1.6-2.5H18a3.5 3.5 0 0 0 3.5-3.5C21.5 7.4 17.4 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15.5" cy="8" r="1.1"/>',
  lipstick: '<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M5.5 18.5L3.5 20.5M9.5 14.5l-1.2 1.2"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8.2 8.2L20 17M8.2 15.8L20 7"/>',
  hanger: '<path d="M12 8.5V6a2 2 0 1 0-2-2"/><path d="M12 8.5L3.5 15.5h17z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
document.querySelectorAll('[data-ic]').forEach((el) => { el.innerHTML = ic(el.dataset.ic, el.dataset.fill ? 'fill' : ''); });

const MAX_HISTORY = 16;
const $ = (s) => document.querySelector(s);
const msgsEl = $('#messages'), inputEl = $('#input'), sendBtn = $('#sendBtn');

let messages = [];   // {id, role, text, images, ts, rec, error}
let recs = [];       // 저장한 추천 {id, rec, ts}
let pending = [];    // 첨부 대기 이미지(dataURL)
let busy = false, hasKey = false, hasImgKey = false, abortCtl = null;

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
  const list = (icon, title, arr) => Array.isArray(arr) && arr.length
    ? `<div class="sec"><h5>${ic(icon)}${title}</h5><ul>${arr.map((x) => `<li><b>${esc(x.item)}</b><span>${esc(x.tip)}</span></li>`).join('')}</ul></div>` : '';
  const colors = (rec.colors || []).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
  const saved = recs.some((r) => r.id === id);
  return `<div class="rec">
    <div class="rec-head"><small>${ic('sparkle', 'fill')}미유의 갸루 추천</small><h4>${esc(rec.gyaruStyle || '맞춤 스타일')}</h4></div>
    <div class="rec-body">
      <div class="chips">
        ${a.faceShape ? `<span class="chip"><b>얼굴형</b>${esc(a.faceShape)}</span>` : ''}
        ${a.bodyType ? `<span class="chip"><b>체형</b>${esc(a.bodyType)}</span>` : ''}
        ${a.skinTone ? `<span class="chip"><b>피부톤</b>${esc(a.skinTone)}</span>` : ''}
      </div>
      ${a.summary ? `<div>${esc(a.summary)}</div>` : ''}
      ${list('lipstick', '메이크업', rec.makeup)}${list('scissors', '헤어', rec.hair)}${list('hanger', '패션', rec.fashion)}
      ${colors.length ? `<div class="sec"><h5>${ic('palette')}어울리는 컬러</h5><div class="swatches">${colors.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div></div>` : ''}
    </div>
    ${showSave ? `<div class="rec-actions"><button class="pill grad" data-gen="${id}">${ic('wand')}내 모습 만들기</button><button class="pill ${saved ? 'saved' : ''}" data-save="${id}">${ic('bookmark', saved ? 'fill' : '')}${saved ? '저장됨' : '추천함에 저장'}</button></div>` : ''}
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
  if (m.genImage) col += `<div class="imgs gen"><img src="${m.genImage}" data-zoom alt="미유가 만든 스타일 이미지"></div><div class="line"><a class="pill" href="${m.genImage}" download="miyu-style.png">${ic('download')}저장하기</a></div>`;
  if (m.typing) col += `<div class="line"><div class="bubble typing"><i></i><i></i><i></i></div></div>`;
  parts.forEach((p, i) => {
    col += `<div class="line"><div class="bubble${m.error ? ' err' : ''}">${esc(p)}</div>${i === parts.length - 1 && !m.rec ? time : ''}</div>`;
  });
  if (m.rec) col += recCard(m.rec, m.id) + `<div class="line">${time}</div>`;
  if (me && !parts.length && m.images?.length) col += `<div class="line">${time}</div>`;
  html += `<div class="row ${me ? 'me' : ''}" data-id="${m.id}">${me ? '' : `<div class="avatar">${ic('heart', 'fill')}</div>`}<div class="col">${me ? '' : '<div class="name">미유</div>'}${col}</div></div>`;
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
  if (old) { old.replaceWith(row); } else {
    row.classList.add('new');  // 새 말풍선만 등장 애니메이션 (스트리밍 갱신에는 안 씀)
    while (tmp.firstChild !== row && tmp.firstChild) msgsEl.appendChild(tmp.firstChild);
    msgsEl.appendChild(row);
  }
  const near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 160;
  if (near) scrollDown();
}

function renderRecs() {
  const el = $('#recsList');
  if (!recs.length) { el.innerHTML = `<div class="empty">${ic('star', 'fill')}<br>아직 저장한 추천이 없어<br>채팅에서 저장 버튼을 눌러봐!</div>`; return; }
  el.innerHTML = recs.slice().reverse().map((r) => `${recCard(r.rec, r.id, false)}<button class="del" data-del="${r.id}">${ic('trash')}삭제</button>`).join('');
}

function renderPreview() {
  const el = $('#preview');
  el.classList.toggle('hidden', !pending.length);
  el.innerHTML = pending.map((s, i) => `<div><img src="${s}" alt=""><button data-rm="${i}" aria-label="삭제">${ic('x')}</button></div>`).join('');
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
    if (!s.text && !s.rec) throw new Error('답장이 비어있어. 모델을 바꿔보거나 다시 보내줘!');
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
  sendBtn.innerHTML = b ? `${ic('stop', 'fill')}<span>멈추기</span>` : `${ic('send')}<span>전송</span>`;
  $('#status').textContent = b ? '입력 중…' : '갸루 스타일 전문가 · 17세';
  sendBtn.disabled = b ? false : sendBtn.disabled;
}

// ───────── 이미지 생성 ─────────
function stylePrompt(rec) {
  const f = (arr) => (Array.isArray(arr) ? arr.map((x) => `${x.item}${x.tip ? ` (${x.tip})` : ''}`).join(', ') : '');
  return `Edit this photo. Keep the same person: same face identity, pose, camera angle, background and photo quality. Do not change the person's age or body shape. Give them a Japanese gyaru look: ${rec.gyaruStyle || 'gyaru style'}. ` +
    `Makeup: ${f(rec.makeup)}. Hair: ${f(rec.hair)}. Fashion: ${f(rec.fashion)}. Color palette: ${(rec.colors || []).join(', ')}. ` +
    'Photorealistic, natural skin texture, tasteful and wholesome, fully clothed.';
}
async function generateImage(id) {
  if (busy) return;
  const idx = messages.findIndex((x) => x.id === id); const src = messages[idx];
  if (!src?.rec) return;
  let photo = null;
  for (let i = idx; i >= 0 && !photo; i--) if (messages[i].role === 'user' && messages[i].images?.length) photo = messages[i].images[0];
  if (!photo) return toast('먼저 내 사진을 보내줘!');
  if (!hasImgKey) { toast('설정에서 이미지 생성 키를 먼저 입력해줘!'); openSheet(); return; }
  const bot = { id: crypto.randomUUID(), role: 'assistant', text: '잠깐만~ 그려볼게! (10~30초 걸려)', ts: Date.now(), typing: true, temp: true };
  messages.push(bot); renderOne(bot); setBusy(true); sendBtn.disabled = true;
  try {
    const r = await api('/api/img/generate', { method: 'POST', body: JSON.stringify({ image: photo, prompt: stylePrompt(src.rec) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `오류 (${r.status})`);
    Object.assign(bot, { text: '짜잔~! 이렇게 해보면 어때? 완전 찰떡이지 💖✨\n\n마음에 들면 저장해서 미용실이랑 쇼핑할 때 보여줘 🫶', genImage: d.image, typing: false, temp: false });
  } catch (e) {
    Object.assign(bot, { text: '앗 이미지 만들다 에러났어 ㅠㅠ\n' + (e.message || '알 수 없는 오류'), error: true, typing: false, temp: false });
  }
  bot.ts = Date.now(); renderOne(bot); persist(); setBusy(false);
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
  try {
    const g = await (await api('/api/img/status')).json();
    hasImgKey = !!g.hasKey;
    $('#imgKeyState').innerHTML = g.hasKey ? `✅ 저장됨 <b>${esc(g.hint)}</b>` : '⚠️ 아직 키가 없어요 (선택)';
  } catch { hasImgKey = false; $('#imgKeyState').textContent = '이미지 생성은 배포 서버에서만 쓸 수 있어요'; }
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
    $('#keyInput').value = ''; toast('API 키 저장 완료!'); await refreshKeyState(); loadModels();
  } catch (e) { toast(e.message || '저장 실패'); }
  $('#keySave').disabled = false;
};
$('#keyDelete').onclick = async () => {
  if (!confirm('저장된 API 키를 삭제할까?')) return;
  await api('/api/key', { method: 'DELETE' }); toast('키를 삭제했어'); await refreshKeyState(); loadModels();
};
$('#imgKeySave').onclick = async () => {
  const key = $('#imgKeyInput').value.trim(); if (!key) return toast('키를 입력해줘!');
  $('#imgKeySave').disabled = true;
  try {
    const r = await api('/api/img/key', { method: 'POST', body: JSON.stringify({ key }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    $('#imgKeyInput').value = ''; toast('이미지 키 저장 완료!'); await refreshKeyState();
  } catch (e) { toast(e.message || '저장 실패'); }
  $('#imgKeySave').disabled = false;
};
$('#imgKeyDelete').onclick = async (e) => {
  e.preventDefault(); if (!confirm('이미지 생성 키를 삭제할까?')) return;
  await api('/api/img/key', { method: 'DELETE' }); toast('이미지 키를 삭제했어'); refreshKeyState();
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
$('#preview').onclick = (e) => {
  const b = e.target.closest('[data-rm]'); if (!b) return;
  pending.splice(+b.dataset.rm, 1); renderPreview();
};
msgsEl.onclick = (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { $('#lightbox img').src = z.src; $('#lightbox').classList.remove('hidden'); return; }
  const g = e.target.closest('[data-gen]');
  if (g) return generateImage(g.dataset.gen);
  const sv = e.target.closest('[data-save]');
  if (sv) {
    const id = sv.dataset.save;
    const i = recs.findIndex((r) => r.id === id);
    if (i >= 0) { recs.splice(i, 1); toast('추천함에서 뺐어'); }
    else { const m = messages.find((x) => x.id === id); if (m?.rec) { recs.push({ id, rec: m.rec, ts: Date.now() }); toast('추천함에 저장했어!'); } }
    persistRecs(); renderOne(messages.find((x) => x.id === id));
  }
};
$('#lightbox').onclick = () => $('#lightbox').classList.add('hidden');
$('#recsBtn').onclick = () => { renderRecs(); $('#recsView').classList.remove('hidden'); };
$('#recsBack').onclick = () => $('#recsView').classList.add('hidden');
$('#recsList').onclick = (e) => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const id = b.dataset.del;
  recs = recs.filter((r) => r.id !== id); persistRecs(); renderRecs();
  if (messages.some((m) => m.id === id)) renderOne(messages.find((m) => m.id === id));
};

const QUICK = [
  { icon: 'camera', label: '내 사진 분석해줘', photo: true },
  { icon: 'lipstick', label: '갸루 메이크업 추천', text: '갸루 메이크업 추천해줘!' },
  { icon: 'scissors', label: '어울리는 헤어는?', text: '나한테 어울리는 헤어 뭐야?' },
  { icon: 'hanger', label: '코디 추천해줘', text: '코디 추천해줘!' },
  { icon: 'sparkle', label: '갸루 종류 알려줘', text: '갸루 종류 알려줘!' },
];
$('#quick').innerHTML = QUICK.map((q, i) => `<button data-q="${i}">${ic(q.icon)}${esc(q.label)}</button>`).join('');
$('#quick').onclick = (e) => {
  const b = e.target.closest('button[data-q]'); if (!b) return;
  const q = QUICK[+b.dataset.q];
  if (q.photo) { $('#file').click(); inputEl.value = '내 얼굴형이랑 피부톤 분석해서 어울리는 갸루 스타일 추천해줘!'; autoGrow(); updateSend(); }
  else send(q.text);
};

// ───────── 웹 인터랙션: 클릭 반짝 · 마우스 따라 빛나는 배경 ─────────
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('pointerdown', (e) => {
  if (reduceMotion() || !e.target.closest('button,.bubble,.rec,.imgs img,.quick button,.sec li,.chip,.pill')) return;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.className = 'burst';
    const a = (i / 7) * Math.PI * 2, d = 30 + Math.random() * 18;
    s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.innerHTML = ic('sparkle', 'fill');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}, { passive: true });
window.addEventListener('pointermove', (e) => {
  if (!matchMedia('(min-width:900px)').matches) return;
  document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth) * 100 + '%');
  document.documentElement.style.setProperty('--my', (e.clientY / innerHeight) * 100 + '%');
}, { passive: true });

// ───────── 시작 ─────────
function greet() {
  messages.push({ id: crypto.randomUUID(), role: 'assistant', ts: Date.now(), text: '안뇽~! 나 미유야 💖 일본에서 온 갸루!\n\n사진 한 장만 보내주면 얼굴형이랑 피부톤 보고 딱 어울리는 메이크업, 헤어, 패션 추천해줄게 ✨\n\n아래 + 버튼으로 사진 보내봐~ 🫶' });
  persist(); renderAll();
}
(async () => {
  setBusy(false);
  try { messages = (await DB.get('messages')) || []; recs = (await DB.get('recs')) || []; } catch { messages = []; recs = []; }
  await refreshKeyState();
  if (!messages.length) greet(); else renderAll();
  if (!hasKey) setTimeout(openSheet, 400);
})();
