// /go/<이름>: "이동 중" 안내 페이지를 이름을 넣어 내보낸다.
// 등록 여부는 static/_redirects의 /out/<이름> 규칙으로 판단한다(302면 등록, 아니면 404).
// 자동 meta refresh는 두지 않는다. 링크 미리보기 로봇이 따라가 Awin 클릭이 부풀기 때문이다.
// 자바스크립트가 꺼져 있으면 "이동 중" 문구 대신 버튼을 누르라는 문구와 버튼만 보인다.
const STYLE = `:root { color-scheme: light dark; --bg: #fff; --fg: #1e1e1e; --sub: #6c6c6c; --accent: #326CE5; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1d1e20; --fg: #dadadb; --sub: #9b9c9d; } }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif; }
  main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 24px; box-sizing: border-box; text-align: center; word-break: keep-all; }
  .spin { width: 36px; height: 36px; border: 4px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-top-color: var(--accent); border-radius: 50%; animation: s 0.9s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  h1 { font-size: 1.375rem; font-weight: 600; margin: 0; }
  p { margin: 0; color: var(--sub); font-size: 1rem; line-height: 1.6; }
  a.btn { display: inline-block; margin-top: 4px; padding: 0.55em 1.1em; border-radius: 6px; background: var(--accent);
    color: #fff; font-weight: 600; text-decoration: none; }
  h1, p { text-wrap: balance; }
  /* 휴대폰에서는 제목이 한 줄에 들어가게 줄인다. 그래도 넘치면 두 줄 길이를 맞춘다. */
  @media (max-width: 480px) { h1 { font-size: 1.125rem; } .spin { width: 32px; height: 32px; } }
  .nojs { display: none; }
  .late { display: none; }
  .is-late .late { display: block; }`;

const TEXT = {
  ko: { title: '리눅스 재단 페이지로 이동하고 있습니다', desc: '리눅스 재단 서버가 응답하는&nbsp;데 몇 초 걸릴 수 있습니다.', late: '넘어가지 않으면 아래 버튼을 눌러 주세요.', retry: '다시 시도', button: '리눅스 재단 페이지로 가기', nojsTitle: '리눅스 재단 페이지로 이동합니다', nojsDesc: '아래 버튼을 눌러 주세요.', doc: '리눅스 재단 페이지로 이동 중' },
  en: { title: 'Taking you to the Linux Foundation', desc: 'Their server can take a few seconds to respond.', late: 'If nothing happens, press the button below.', retry: 'Try again', button: 'Go to the Linux Foundation', nojsTitle: 'Continue to the Linux Foundation', nojsDesc: 'Press the button below.', doc: 'Taking you to the Linux Foundation' },
};

function pickLang(request) {
  const ref = request.headers.get('Referer') || '';
  if (/\/en\//.test(ref)) return 'en';
  if (/\/ko\//.test(ref)) return 'ko';
  const al = (request.headers.get('Accept-Language') || '').toLowerCase();
  return al.startsWith('en') ? 'en' : 'ko';
}

export async function onRequest({ request, params, env }) {
  const name = String(params.name || '');
  const origin = new URL(request.url).origin;
  const notFound = () => env.ASSETS.fetch(new Request(new URL('/404', origin)))
    .then((r) => new Response(r.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } }));
  if (!/^[a-z0-9-]+$/.test(name)) return notFound();
  const probe = await env.ASSETS.fetch(new Request(new URL('/out/' + name, origin), { redirect: 'manual' }));
  if (probe.status < 300 || probe.status >= 400) return notFound();

  const lang = pickLang(request);
  const t = TEXT[lang];
  const target = '/out/' + name;
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.doc}</title>
<noscript><style>main .spin, main .js { display: none; } main .nojs { display: block; }</style></noscript>
<style>
${STYLE}
</style>
</head>
<body>
<main>
  <div class="spin" aria-hidden="true"></div>
  <h1 class="js">${t.title}</h1>
  <p class="js">${t.desc}</p>
  <h1 class="nojs">${t.nojsTitle}</h1>
  <p class="nojs">${t.nojsDesc}</p>
  <div class="late">
    <p>${t.late}</p>
    <a class="btn" href="${target}">${t.retry}</a>
  </div>
  <noscript><a class="btn" href="${target}">${t.button}</a></noscript>
</main>
<script>
(function () {
  /* 앞쪽 탭에서는 안내 화면이 한 번 그려진 뒤 넘긴다. 배경 탭은 그 신호가 오지 않으므로 0.3초 뒤에는 그냥 넘긴다. */
  var moved = false;
  function go() { if (!moved) { moved = true; location.replace(${JSON.stringify(target)}); } }
  requestAnimationFrame(function () { setTimeout(go, 30); });
  setTimeout(go, 300);
  setTimeout(function () { document.body.classList.add('is-late'); }, 8000);
})();
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } });
}
