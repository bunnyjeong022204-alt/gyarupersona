# 미유 갸루톡 (Groq 챗봇)
실행: `node server.js` → http://localhost:3000 (Node 18+, 의존성 없음). 폰에서는 같은 Wi-Fi의 `http://<PC-IP>:3000` 접속 후 "홈 화면에 추가".
- 첫 실행 시 설정(⚙️)에서 Groq API 키 입력. 키는 서버에서 AES-256-GCM 암호화(`data/`), HttpOnly 세션 쿠키로 연결. 프론트엔드에는 저장·노출되지 않음.
- 배포 시 반드시 HTTPS 뒤에 두세요. 기본 모델은 `DEFAULT_MODEL` 환경변수로 변경(사진 분석은 비전 모델 필요).

## Netlify 배포
1. GitHub에 올린 뒤 Netlify에서 "Add new site → Import from Git" (또는 `npx netlify-cli deploy --prod`).
2. Site configuration → Environment variables 에 `KEY_SECRET` 추가 (임의의 긴 문자열, 16자 이상). 바꾸면 저장된 키는 무효가 됩니다.
3. 배포 후 `https://<사이트>.netlify.app` 접속 → ⚙️ 설정에서 Groq 키 입력.
주의: 드래그&드롭(Netlify Drop)은 함수가 포함되지 않아 채팅이 동작하지 않습니다.
